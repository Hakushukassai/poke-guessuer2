import { useCallback, useEffect, useRef, useState } from 'react'
import Peer, { type DataConnection } from 'peerjs'
import type { DexPool, QuizMode } from './game'
import {
  applyClientMessage,
  createOnlineRoom,
  disconnectSeat,
  seatOf,
  toClientView,
  type ClientMessage,
  type OnlineClientView,
  type OnlineRoomState,
  type ServerMessage,
} from './onlineRoom'
import { hostPeerId } from './webrtcPeer'

type Options = {
  roomCode: string | null
  isHost: boolean
  displayName: string
  pool: DexPool
  quizMode: QuizMode
}

function parseServerMessage(raw: unknown): ServerMessage | null {
  try {
    const data = JSON.parse(String(raw)) as ServerMessage
    if (data?.type === 'state' || data?.type === 'error') return data
  } catch {
    /* ignore */
  }
  return null
}

function isTransientPeerError(type: string | undefined): boolean {
  return (
    type === 'network' ||
    type === 'server-error' ||
    type === 'socket-error' ||
    type === 'socket-closed' ||
    type === 'disconnected' ||
    type === 'webrtc'
  )
}

export function useOnlineRoom({
  roomCode,
  isHost,
  displayName,
  pool,
  quizMode,
}: Options) {
  const [view, setView] = useState<OnlineClientView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  const peerRef = useRef<Peer | null>(null)
  const guestConnRef = useRef<DataConnection | null>(null)
  const hostConnRef = useRef<DataConnection | null>(null)
  const roomRef = useRef<OnlineRoomState>(createOnlineRoom(pool, quizMode))
  const hostIdRef = useRef<string>('')
  const pendingClaim = useRef<ClientMessage | null>(null)
  const displayNameRef = useRef(displayName)
  const poolRef = useRef(pool)
  const quizModeRef = useRef(quizMode)
  displayNameRef.current = displayName
  poolRef.current = pool
  quizModeRef.current = quizMode

  const pushHostView = useCallback(() => {
    const you = seatOf(roomRef.current, hostIdRef.current)
    setView(toClientView(roomRef.current, you))
  }, [])

  const sendToGuest = useCallback((payload: ServerMessage) => {
    const conn = guestConnRef.current
    if (conn?.open) {
      conn.send(JSON.stringify(payload))
      return true
    }
    return false
  }, [])

  const broadcastHost = useCallback(() => {
    pushHostView()
    const guest = guestConnRef.current
    if (!guest?.open) return
    const guestSeat = seatOf(roomRef.current, guest.peer)
    sendToGuest({
      type: 'state',
      view: toClientView(roomRef.current, guestSeat),
    })
  }, [pushHostView, sendToGuest])

  const applyAsHost = useCallback(
    (connectionId: string, msg: ClientMessage) => {
      const result = applyClientMessage(roomRef.current, connectionId, msg)
      if (result.error) {
        if (connectionId === hostIdRef.current) setError(result.error)
        else sendToGuest({ type: 'error', message: result.error })
        broadcastHost()
        return
      }
      roomRef.current = result.state
      setError(null)
      broadcastHost()
    },
    [broadcastHost, sendToGuest],
  )

  const applyAsHostRef = useRef(applyAsHost)
  const broadcastHostRef = useRef(broadcastHost)
  applyAsHostRef.current = applyAsHost
  broadcastHostRef.current = broadcastHost

  const send = useCallback(
    (msg: ClientMessage) => {
      if (isHost) {
        if (!hostIdRef.current) {
          if (msg.type === 'claim') pendingClaim.current = msg
          setError('接続の準備中です…')
          return
        }
        applyAsHost(hostIdRef.current, msg)
        return
      }

      const conn = hostConnRef.current
      if (!conn?.open) {
        if (msg.type === 'claim') pendingClaim.current = msg
        setError(
          '部屋主に繋がっていません。部屋主がページを開いたままか確認してね',
        )
        return
      }
      conn.send(JSON.stringify(msg))
    },
    [applyAsHost, isHost],
  )

  const claim = useCallback(
    (opts: { name?: string; pool?: DexPool; quizMode?: QuizMode }) => {
      const msg: ClientMessage = {
        type: 'claim',
        name: opts.name,
        pool: opts.pool,
        quizMode: opts.quizMode,
      }
      pendingClaim.current = msg
      send(msg)
    },
    [send],
  )

  useEffect(() => {
    if (!roomCode) {
      peerRef.current?.destroy()
      peerRef.current = null
      guestConnRef.current = null
      hostConnRef.current = null
      setView(null)
      setConnected(false)
      return
    }

    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let guestAttempts = 0
    const maxGuestAttempts = 40
    /** Avoid overlapping peer rebuilds while a recreate is already scheduled. */
    let recreating = false

    const clearRetry = () => {
      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
    }

    const schedule = (fn: () => void, ms: number) => {
      clearRetry()
      retryTimer = setTimeout(() => {
        retryTimer = null
        if (!cancelled) fn()
      }, ms)
    }

    const softDisconnect = (message: string) => {
      if (cancelled) return
      setConnected(false)
      setError(message)
    }

    const destroyPeerOnly = () => {
      const peer = peerRef.current
      peerRef.current = null
      if (!peer) return
      peer.removeAllListeners()
      try {
        peer.destroy()
      } catch {
        /* ignore */
      }
    }

    const wireGuestConnection = (conn: DataConnection) => {
      if (hostConnRef.current && hostConnRef.current !== conn) {
        hostConnRef.current.close()
      }
      hostConnRef.current = conn

      conn.on('open', () => {
        if (cancelled) return
        setConnected(true)
        setError(null)
        guestAttempts = 0
        const claimMsg = pendingClaim.current ?? {
          type: 'claim' as const,
          name: displayNameRef.current,
        }
        pendingClaim.current = null
        conn.send(JSON.stringify(claimMsg))
      })

      conn.on('data', (raw) => {
        const data = parseServerMessage(raw)
        if (!data) {
          setError('相手からの応答を読めませんでした')
          return
        }
        if (data.type === 'state') setView(data.view)
        if (data.type === 'error') setError(data.message)
      })

      conn.on('close', () => {
        if (cancelled) return
        if (hostConnRef.current === conn) {
          hostConnRef.current = null
          softDisconnect('部屋主との接続が切れました。再接続しています…')
          schedule(connectGuest, 1500)
        }
      })

      conn.on('error', () => {
        if (cancelled) return
        softDisconnect('接続エラー。再接続しています…')
        schedule(connectGuest, 2000)
      })
    }

    const connectGuest = () => {
      const peer = peerRef.current
      if (cancelled || !peer || !peer.open) return
      guestAttempts += 1
      if (guestAttempts > maxGuestAttempts) {
        softDisconnect(
          '部屋が見つかりません。部屋主が先にページを開いているか確認して、もう一度入室してね',
        )
        return
      }
      setError(`部屋主を探しています…（${guestAttempts}/${maxGuestAttempts}）`)
      const conn = peer.connect(hostPeerId(roomCode), { reliable: true })
      wireGuestConnection(conn)
    }

    const attachHostIncoming = (peer: Peer) => {
      peer.on('connection', (conn) => {
        if (guestConnRef.current?.open) {
          conn.on('open', () => {
            conn.send(
              JSON.stringify({
                type: 'error',
                message: '部屋がいっぱいです',
              } satisfies ServerMessage),
            )
            conn.close()
          })
          return
        }

        guestConnRef.current = conn
        conn.on('open', () => {
          broadcastHostRef.current()
        })
        conn.on('data', (raw) => {
          try {
            const msg = JSON.parse(String(raw)) as ClientMessage
            applyAsHostRef.current(conn.peer, msg)
          } catch {
            sendToGuest({ type: 'error', message: '不正なメッセージです' })
          }
        })
        conn.on('close', () => {
          if (guestConnRef.current === conn) guestConnRef.current = null
          roomRef.current = disconnectSeat(roomRef.current, conn.peer)
          broadcastHostRef.current()
        })
        if (conn.open) broadcastHostRef.current()
      })
    }

    const onPeerOpen = (peer: Peer, id: string) => {
      if (cancelled) return
      recreating = false
      setConnected(true)
      setError(null)

      if (isHost) {
        hostIdRef.current = id
        // Keep existing room if we already claimed a seat (tab resume).
        const existingSeat = seatOf(roomRef.current, id)
        if (!existingSeat) {
          roomRef.current = createOnlineRoom(
            poolRef.current,
            quizModeRef.current,
          )
          const claimMsg = pendingClaim.current ?? {
            type: 'claim' as const,
            name: displayNameRef.current,
            pool: poolRef.current,
            quizMode: quizModeRef.current,
          }
          pendingClaim.current = null
          applyAsHostRef.current(id, claimMsg)
        } else {
          broadcastHostRef.current()
        }
        return
      }

      guestAttempts = 0
      connectGuest()
    }

    const tryReconnectPeer = () => {
      const peer = peerRef.current
      if (cancelled) return
      if (peer && !peer.destroyed) {
        if (peer.open) {
          setConnected(true)
          if (!isHost && !hostConnRef.current?.open) connectGuest()
          return
        }
        softDisconnect('再接続しています…')
        try {
          peer.reconnect()
          return
        } catch {
          /* fall through to recreate */
        }
      }
      startPeer()
    }

    const startPeer = () => {
      if (cancelled) return
      recreating = false
      clearRetry()
      destroyPeerOnly()
      guestConnRef.current = null
      hostConnRef.current = null
      // Keep hostIdRef so room seat mapping survives brief rebuilds when ID is stable.

      softDisconnect('シグナリングサーバに接続しています…')

      const peer = isHost ? new Peer(hostPeerId(roomCode)) : new Peer()
      peerRef.current = peer

      peer.on('error', (err) => {
        if (cancelled) return
        const type = (err as { type?: string }).type

        if (type === 'unavailable-id' && isHost) {
          softDisconnect('部屋IDの解放待ち…しばらくして自動で再開します')
          // Previous socket may still hold the id after a mobile background.
          schedule(startPeer, 2800)
          return
        }

        if (type === 'peer-unavailable' && !isHost) {
          if (guestAttempts >= maxGuestAttempts) {
            softDisconnect(
              '部屋が見つかりません。部屋主が先にページを開いているか確認してね',
            )
            return
          }
          schedule(connectGuest, 2000)
          return
        }

        if (isTransientPeerError(type)) {
          softDisconnect('通信が不安定です。再接続しています…')
          schedule(tryReconnectPeer, 1800)
          return
        }

        if (!isHost && guestAttempts > 0 && guestAttempts < maxGuestAttempts) {
          schedule(connectGuest, 2000)
          return
        }

        softDisconnect(err.message || '接続エラーが起きました。再接続しています…')
        schedule(tryReconnectPeer, 2500)
      })

      peer.on('disconnected', () => {
        if (cancelled) return
        softDisconnect('シグナリングが切れました。再接続しています…')
        try {
          peer.reconnect()
        } catch {
          schedule(startPeer, 1500)
        }
      })

      peer.on('close', () => {
        if (cancelled || recreating) return
        recreating = true
        softDisconnect('接続が閉じました。再接続しています…')
        schedule(startPeer, 1600)
      })

      peer.on('open', (id) => onPeerOpen(peer, id))

      if (isHost) attachHostIncoming(peer)
    }

    const onForeground = () => {
      if (cancelled) return
      if (document.visibilityState === 'hidden') return
      guestAttempts = Math.min(guestAttempts, 3)
      const peer = peerRef.current
      if (!peer || peer.destroyed) {
        startPeer()
        return
      }
      if (!peer.open) {
        softDisconnect('タブに戻ったので再接続しています…')
        try {
          peer.reconnect()
        } catch {
          schedule(startPeer, 800)
        }
        return
      }
      setConnected(true)
      if (!isHost && !hostConnRef.current?.open) {
        guestAttempts = 0
        connectGuest()
      } else if (isHost) {
        broadcastHostRef.current()
      }
    }

    startPeer()

    document.addEventListener('visibilitychange', onForeground)
    window.addEventListener('online', onForeground)
    window.addEventListener('pageshow', onForeground)

    return () => {
      cancelled = true
      clearRetry()
      document.removeEventListener('visibilitychange', onForeground)
      window.removeEventListener('online', onForeground)
      window.removeEventListener('pageshow', onForeground)
      guestConnRef.current?.close()
      hostConnRef.current?.close()
      guestConnRef.current = null
      hostConnRef.current = null
      destroyPeerOnly()
      hostIdRef.current = ''
      setConnected(false)
    }
  }, [roomCode, isHost, sendToGuest])

  return {
    view,
    error,
    connected,
    send,
    claim,
    clearError: () => setError(null),
  }
}

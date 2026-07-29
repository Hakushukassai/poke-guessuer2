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
    let attempts = 0
    const maxAttempts = 12

    const peer = isHost ? new Peer(hostPeerId(roomCode)) : new Peer()
    peerRef.current = peer

    const fail = (message: string) => {
      if (!cancelled) {
        setConnected(false)
        setError(message)
      }
    }

    const wireGuestConnection = (conn: DataConnection) => {
      hostConnRef.current?.close()
      hostConnRef.current = conn

      conn.on('open', () => {
        if (cancelled) return
        setConnected(true)
        setError(null)
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
          setConnected(false)
          setError('部屋主との接続が切れました')
        }
      })
    }

    const connectGuest = () => {
      if (cancelled || !peer.open) return
      attempts += 1
      setError(`部屋主を探しています…（${attempts}/${maxAttempts}）`)
      const conn = peer.connect(hostPeerId(roomCode), { reliable: true })
      wireGuestConnection(conn)
    }

    peer.on('error', (err) => {
      const type = (err as { type?: string }).type
      if (type === 'unavailable-id') {
        fail('その部屋コードは使用中です。別のコードで部屋をつくってね')
        return
      }
      if (type === 'peer-unavailable' && !isHost) {
        if (cancelled) return
        if (attempts >= maxAttempts) {
          fail(
            '部屋が見つかりません。部屋主が先にページを開いているか確認してね',
          )
          return
        }
        retryTimer = setTimeout(connectGuest, 2000)
        return
      }
      if (type === 'network' || type === 'server-error') {
        fail('シグナリングサーバに繋がりません。通信環境を確認してね')
        return
      }
      // Ignore benign errors during guest retry storms
      if (!isHost && attempts > 0 && attempts < maxAttempts) return
      fail(err.message || '接続エラーが起きました')
    })

    peer.on('open', (id) => {
      if (cancelled) return

      if (isHost) {
        setConnected(true)
        setError(null)
        hostIdRef.current = id
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
        return
      }

      setConnected(true)
      connectGuest()
    })

    if (isHost) {
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
          // 接続完了時に必ず最新部屋状態を送る（選出待ち中の取りこぼし防止）
          broadcastHostRef.current()
        })
        // PeerJS は open 前に data が来る場合があるため、先に listener を付ける
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
        // すでに open 済みなら直後に同期
        if (conn.open) broadcastHostRef.current()
      })
    }

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      guestConnRef.current?.close()
      hostConnRef.current?.close()
      guestConnRef.current = null
      hostConnRef.current = null
      peer.destroy()
      peerRef.current = null
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

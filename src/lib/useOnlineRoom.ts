import { useCallback, useEffect, useRef, useState } from 'react'
import PartySocket from 'partysocket'
import type { DexPool } from './game'
import { partyHost } from './partyHost'
import type {
  ClientMessage,
  OnlineClientView,
  ServerMessage,
} from './onlineRoom'

export function useOnlineRoom(roomCode: string | null) {
  const [view, setView] = useState<OnlineClientView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<PartySocket | null>(null)
  const pendingClaim = useRef<ClientMessage | null>(null)

  const send = useCallback((msg: ClientMessage) => {
    const sock = socketRef.current
    if (!sock || sock.readyState !== WebSocket.OPEN) {
      if (msg.type === 'claim') pendingClaim.current = msg
      setError('接続できていません。partykit が起動しているか確認してね')
      return
    }
    sock.send(JSON.stringify(msg))
  }, [])

  useEffect(() => {
    if (!roomCode) {
      socketRef.current?.close()
      socketRef.current = null
      setView(null)
      setConnected(false)
      return
    }

    const socket = new PartySocket({
      host: partyHost(),
      room: roomCode.toLowerCase(),
    })
    socketRef.current = socket

    const onOpen = () => {
      setConnected(true)
      setError(null)
      if (pendingClaim.current) {
        socket.send(JSON.stringify(pendingClaim.current))
        pendingClaim.current = null
      }
    }

    const onMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(String(event.data)) as ServerMessage
        if (data.type === 'state') setView(data.view)
        if (data.type === 'error') setError(data.message)
      } catch {
        setError('サーバ応答を読めませんでした')
      }
    }

    const onClose = () => setConnected(false)

    socket.addEventListener('open', onOpen)
    socket.addEventListener('message', onMessage)
    socket.addEventListener('close', onClose)

    return () => {
      socket.removeEventListener('open', onOpen)
      socket.removeEventListener('message', onMessage)
      socket.removeEventListener('close', onClose)
      socket.close()
      socketRef.current = null
    }
  }, [roomCode])

  const claim = useCallback((opts: { name?: string; pool?: DexPool }) => {
    const msg: ClientMessage = {
      type: 'claim',
      name: opts.name,
      pool: opts.pool,
    }
    pendingClaim.current = msg
    const sock = socketRef.current
    if (sock && sock.readyState === WebSocket.OPEN) {
      sock.send(JSON.stringify(msg))
    }
  }, [])


  return {
    view,
    error,
    connected,
    send,
    claim,
    clearError: () => setError(null),
  }
}

import type * as Party from 'partykit/server'
import {
  applyClientMessage,
  createOnlineRoom,
  disconnectSeat,
  seatOf,
  toClientView,
  type ClientMessage,
  type OnlineRoomState,
  type ServerMessage,
} from '../src/lib/onlineRoom'

export default class GameRoom implements Party.Server {
  state: OnlineRoomState

  constructor(readonly room: Party.Room) {
    this.state = createOnlineRoom('champions')
  }

  onConnect(conn: Party.Connection) {
    this.push(conn)
  }

  onClose(conn: Party.Connection) {
    this.state = disconnectSeat(this.state, conn.id)
    this.broadcastAll()
  }

  onMessage(message: string, sender: Party.Connection) {
    let msg: ClientMessage
    try {
      msg = JSON.parse(message) as ClientMessage
    } catch {
      this.send(sender, { type: 'error', message: '不正なメッセージです' })
      return
    }

    const result = applyClientMessage(this.state, sender.id, msg)
    if (result.error) {
      this.send(sender, { type: 'error', message: result.error })
      // Still push current state so UI stays in sync
      this.push(sender)
      return
    }

    this.state = result.state
    this.broadcastAll()
  }

  private send(conn: Party.Connection, payload: ServerMessage) {
    conn.send(JSON.stringify(payload))
  }

  private push(conn: Party.Connection) {
    const you = seatOf(this.state, conn.id)
    this.send(conn, { type: 'state', view: toClientView(this.state, you) })
  }

  private broadcastAll() {
    for (const conn of this.room.getConnections()) {
      this.push(conn)
    }
  }
}

GameRoom satisfies Party.Worker

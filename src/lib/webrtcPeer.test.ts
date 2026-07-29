import { describe, expect, it } from 'vitest'
import { hostPeerId } from './webrtcPeer'

describe('hostPeerId', () => {
  it('部屋コードから安定した Peer ID を作る', () => {
    expect(hostPeerId('Ab12CD')).toBe('pg2-ab12cd')
    expect(hostPeerId(' ab12cd ')).toBe('pg2-ab12cd')
  })
})

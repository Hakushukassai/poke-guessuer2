/** PeerJS peer id for the room host (guest dials this id). */
export function hostPeerId(roomCode: string): string {
  const code = roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  return `pg2-${code.toLowerCase()}`
}

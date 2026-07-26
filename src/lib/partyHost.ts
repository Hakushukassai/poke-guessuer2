/** PartyKit host for online rooms. Override with VITE_PARTY_HOST. */
export function partyHost(): string {
  const fromEnv = import.meta.env.VITE_PARTY_HOST as string | undefined
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.replace(/^https?:\/\//, '')
  }
  return 'localhost:1999'
}

export function makeRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]!
  }
  return code
}

function base64Url(obj: Record<string, unknown>): string {
  const json = JSON.stringify(obj)
  const encoded = btoa(json)
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fakeJwt(scopes: string[]): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    scopes,
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: 'cypress-test-user',
    preferred_username: 'TestUser',
  }
  return `${base64Url(header)}.${base64Url(payload)}.fake-signature`
}

export function setAuth(role: 'viewer' | 'mod' | 'streamer'): void {
  const scopes: Record<string, string[]> = {
    viewer: [],
    mod: ['moderator:read:followers'],
    streamer: ['channel:read:subscriptions'],
  }
  const token = fakeJwt(scopes[role])
  window.localStorage.setItem('userToken', token)
}

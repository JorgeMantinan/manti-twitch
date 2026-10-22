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

/**
 * Los <input> de react-native-web se re-montan poco despues del load
 * (carga de participantes desde AsyncStorage + conexion del socket).
 * Si Cypress consulta el input durante esa ventana, queda con una
 * referencia a un nodo ya desconectado y cy.type() aborta con
 * "targeted a disabled element" (su comprobacion de focusability usa
 * jQuery/Sizzle, que no encuentra nodos fuera del documento).
 *
 * typeIn() espera a que el arbol se estabilice y escribe sobre el nodo vivo.
 */
Cypress.Commands.add('typeIn', (selector: string, text: string) => {
  cy.get(selector, { timeout: 15000 }).should('be.visible')
  cy.wait(800)
  cy.get(selector).then(($el) => {
    if (!$el.length || !$el[0].isConnected) {
      cy.wait(500)
    }
  })
  cy.get(selector, { timeout: 15000 }).type(text, { force: true })
})

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      typeIn(selector: string, text: string): Chainable<void>
    }
  }
}

export {}

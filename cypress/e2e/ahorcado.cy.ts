describe('Ahorcado', () => {
  beforeEach(() => {
    cy.window().then((win) => win.localStorage.clear())
    cy.intercept(/socket\.io/, (req) => req.destroy())
  })

  it('opens the start modal on load', () => {
    cy.visit('/Ahorcado?role=viewer', { timeout: 15000 })
    cy.contains('Empezar Partida').should('be.visible')
    cy.contains(/!ahorcado/).should('be.visible')
  })

  it('starts the game and shows game controls', () => {
    cy.visit('/Ahorcado?role=viewer', { timeout: 15000 })

    cy.contains('Empezar Partida').click()

    cy.contains('Nueva partida').should('be.visible')
    cy.contains('SACAR LETRA').should('be.visible')
    cy.contains('AUTOMÁTICO OFF').should('be.visible')
  })

  it('toggles auto mode', () => {
    cy.visit('/Ahorcado?role=viewer', { timeout: 15000 })

    cy.contains('Empezar Partida').click()

    cy.contains('AUTOMÁTICO OFF').click()
    cy.contains('AUTOMÁTICO ON').should('be.visible')

    cy.contains('AUTOMÁTICO ON').click()
    cy.contains('AUTOMÁTICO OFF').should('be.visible')
  })

  it('reopens the start modal via Nueva partida', () => {
    cy.visit('/Ahorcado?role=viewer', { timeout: 15000 })

    cy.contains('Empezar Partida').click()

    cy.contains('Nueva partida').click()

    cy.contains('Empezar Partida').should('be.visible')
  })

  it('shows mod-specific controls for mod role', () => {
    cy.visit('/Ahorcado?role=mod', { timeout: 15000 })

    cy.get('[placeholder="Nombre del canal"]').should('be.visible')
    cy.contains('Empezar Partida').should('be.visible')
  })

  it('does not show raffle or manual add controls for mod role', () => {
    cy.visit('/Ahorcado?role=mod', { timeout: 15000 })

    cy.get('[placeholder="!sorteo"]').should('not.exist')
    cy.contains('Obtener gente del chat').should('not.exist')
    cy.get('[placeholder="Nombre del usuario..."]').should('not.exist')
    cy.contains('Eliminar todos').should('not.exist')
  })

  it('shows streamer-specific controls for streamer role', () => {
    cy.visit('/Ahorcado?role=streamer', { timeout: 15000 })

    cy.contains('OBTENER SUBS').should('be.visible')
    cy.contains('Empezar Partida').should('be.visible')
  })

  it('toggles subs-only mode for streamer role', () => {
    cy.visit('/Ahorcado?role=streamer', { timeout: 15000 })

    cy.contains('OBTENER SUBS').click()
    cy.contains('SOLO SUBS: ACTIVADO').should('be.visible')

    cy.contains('SOLO SUBS: ACTIVADO').click()
    cy.contains('OBTENER SUBS').should('be.visible')
  })

  it('closes the modal via ✕ and reopens via Nueva partida', () => {
    cy.visit('/Ahorcado?role=viewer', { timeout: 15000 })

    cy.contains('✕').click()
    cy.contains('Empezar Partida').should('not.exist')
    cy.contains('Nueva partida').should('be.visible')

    cy.contains('Nueva partida').click()
    cy.contains('Empezar Partida').should('be.visible')
  })
})

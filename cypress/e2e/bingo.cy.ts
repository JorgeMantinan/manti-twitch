describe('Bingo', () => {
  beforeEach(() => {
    cy.window().then((win) => win.localStorage.clear())
    cy.intercept(/socket\.io/, (req) => req.destroy())
  })

  it('opens the participants modal on load', () => {
    cy.visit('/Bingo?role=viewer', { timeout: 15000 })
    cy.contains('Participantes').should('be.visible')
    cy.contains('Empezar Partida').should('be.visible')
  })

  it('adds participants in the modal', () => {
    cy.visit('/Bingo?role=viewer', { timeout: 15000 })

    const names = ['Alice', 'Bob', 'Charlie', 'Diana']
    names.forEach((name) => {
      cy.get('[placeholder="Nombre del usuario..."]').type(name)
      cy.contains('Añadir').click()
      cy.contains(name).should('be.visible')
    })
  })

  it('starts the game and shows game controls', () => {
    cy.visit('/Bingo?role=viewer', { timeout: 15000 })

    cy.get('[placeholder="Nombre del usuario..."]').type('Alice')
    cy.contains('Añadir').click()
    cy.contains('Empezar Partida').click()

    cy.contains('Nueva partida').should('be.visible')
    cy.contains('SACAR BOLA').should('be.visible')
    cy.contains('AUTOMÁTICO OFF').should('be.visible')
  })

  it('toggles auto mode', () => {
    cy.visit('/Bingo?role=viewer', { timeout: 15000 })

    cy.get('[placeholder="Nombre del usuario..."]').type('Alice')
    cy.contains('Añadir').click()
    cy.contains('Empezar Partida').click()

    cy.contains('AUTOMÁTICO OFF').click()
    cy.contains('AUTOMÁTICO ON').should('be.visible')

    cy.contains('AUTOMÁTICO ON').click()
    cy.contains('AUTOMÁTICO OFF').should('be.visible')
  })

  it('reopens the participants modal via Nueva partida', () => {
    cy.visit('/Bingo?role=viewer', { timeout: 15000 })

    cy.get('[placeholder="Nombre del usuario..."]').type('Alice')
    cy.contains('Añadir').click()
    cy.contains('Empezar Partida').click()

    cy.contains('Nueva partida').click()

    cy.contains('Participantes').should('be.visible')
    cy.get('[placeholder="Nombre del usuario..."]').should('be.visible')
  })

  it('removes an individual participant from the modal', () => {
    cy.visit('/Bingo?role=viewer', { timeout: 15000 })

    cy.get('[placeholder="Nombre del usuario..."]').type('Alice')
    cy.contains('Añadir').click()
    cy.get('[placeholder="Nombre del usuario..."]').type('Bob')
    cy.contains('Añadir').click()

    cy.contains('Alice').parent().contains('X').click()
    cy.contains('Alice').should('not.exist')
    cy.contains('Bob').should('be.visible')
  })

  it('clears all participants from the modal', () => {
    cy.visit('/Bingo?role=viewer', { timeout: 15000 })

    cy.get('[placeholder="Nombre del usuario..."]').type('Alice')
    cy.contains('Añadir').click()
    cy.get('[placeholder="Nombre del usuario..."]').type('Bob')
    cy.contains('Añadir').click()

    cy.contains('Eliminar todos').click()

    cy.contains('Alice').should('not.exist')
    cy.contains('Bob').should('not.exist')
  })

  it('starts game with zero participants', () => {
    cy.visit('/Bingo?role=viewer', { timeout: 15000 })

    cy.contains('Empezar Partida').click()

    cy.contains('Nueva partida').should('be.visible')
    cy.contains('SACAR BOLA').should('be.visible')
  })

  it('shows mod-specific controls for mod role', () => {
    cy.visit('/Bingo?role=mod', { timeout: 15000 })

    cy.contains('Participantes').should('be.visible')
    cy.get('[placeholder="Nombre del canal"]').should('be.visible')
    cy.get('[placeholder="!sorteo"]').should('be.visible')
    cy.contains('Obtener gente del chat').should('be.visible')
  })

  it('shows streamer-specific controls for streamer role', () => {
    cy.visit('/Bingo?role=streamer', { timeout: 15000 })

    cy.contains('OBTENER SUBS').should('be.visible')
  })

  it('closes the modal via ✕ and reopens via Nueva partida', () => {
    cy.visit('/Bingo?role=viewer', { timeout: 15000 })

    cy.contains('✕').click()
    cy.contains('Participantes').should('not.exist')
    cy.contains('Nueva partida').should('be.visible')

    cy.contains('Nueva partida').click()
    cy.contains('Participantes').should('be.visible')
  })
})

describe('Smart Roulette', () => {
  beforeEach(() => {
    cy.window().then((win) => win.localStorage.clear())
    cy.intercept(/socket\.io/, (req) => req.destroy())
  })

  it('renders the wheel and controls', () => {
    cy.visit('/SmartRoulette?role=viewer', { timeout: 15000 })
    cy.contains('Smart Twitch Roulette').should('be.visible')
    cy.contains('GIRAR RULETA').should('be.visible')
  })

  it('adds 6 participants and picks a winner', () => {
    cy.visit('/SmartRoulette?role=viewer', { timeout: 15000 })

    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank']
    names.forEach((name) => {
      cy.get('[placeholder="Add participant"]').type(name)
      cy.contains('Añadir').click()
      cy.contains(name).should('be.visible')
    })

    cy.contains('Participants').should('contain', '6')

    cy.contains('GIRAR RULETA').click()
    cy.contains('🏆', { timeout: 10000 }).should('be.visible')
  })

  it('removes an individual participant', () => {
    cy.visit('/SmartRoulette?role=viewer', { timeout: 15000 })

    cy.get('[placeholder="Add participant"]').type('Alice')
    cy.contains('Añadir').click()
    cy.get('[placeholder="Add participant"]').type('Bob')
    cy.contains('Añadir').click()

    cy.contains('Participants').should('contain', '2')

    cy.contains('❌').first().click()
    cy.contains('Participants').should('contain', '1')
  })

  it('clears all participants', () => {
    cy.visit('/SmartRoulette?role=viewer', { timeout: 15000 })

    cy.get('[placeholder="Add participant"]').type('Alice')
    cy.contains('Añadir').click()
    cy.get('[placeholder="Add participant"]').type('Bob')
    cy.contains('Añadir').click()

    cy.contains('Eliminar todo').click()
    cy.contains('Participants').should('contain', '0')
  })

  it('handles spin with no participants gracefully', () => {
    cy.visit('/SmartRoulette?role=viewer', { timeout: 15000 })

    cy.contains('GIRAR RULETA').click()
    cy.contains('🏆').should('not.exist')
  })

  it('shows mod-specific controls for mod role', () => {
    cy.visit('/SmartRoulette?role=mod', { timeout: 15000 })

    cy.get('[placeholder="Streamer channel"]').should('be.visible')
    cy.get('[placeholder="!sorteo"]').should('be.visible')
    cy.contains('Obtener gente del chat').should('be.visible')
  })

  it('shows viewer controls without mod options', () => {
    cy.visit('/SmartRoulette?role=viewer', { timeout: 15000 })

    cy.get('[placeholder="Streamer channel"]').should('not.exist')
    cy.get('[placeholder="!sorteo"]').should('not.exist')
    cy.contains('Obtener gente del chat').should('not.exist')
  })
})

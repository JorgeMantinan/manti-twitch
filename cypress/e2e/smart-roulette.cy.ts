describe('Smart Roulette', () => {
  beforeEach(() => {
    cy.window().then((win) => win.localStorage.clear())
    cy.intercept(/socket\.io/, (req) => req.destroy())
  })

  it('renders the wheel and controls', () => {
    cy.visit('/SmartRoulette?role=viewer', { timeout: 15000 })
    cy.contains('Smart Twitch Roulette').should('be.visible')
  })

  it('adds participants and picks a winner', () => {
    cy.visit('/SmartRoulette?role=mod', { timeout: 15000 })
    cy.contains('Añadir', { timeout: 10000 }).should('be.visible')

    // Add two participants
    cy.get('[placeholder="Add participant"]').type('Alice')
    cy.contains('Añadir').click()
    cy.contains('Alice').should('be.visible')

    cy.get('[placeholder="Add participant"]').type('Bob')
    cy.contains('Añadir').click()
    cy.contains('Bob').should('be.visible')

    cy.contains('Participants').should('contain', '2')

    // Spin and verify a winner is announced (animation takes ~5s)
    cy.contains('GIRAR RULETA').click()
    cy.contains('🏆', { timeout: 10000 }).should('be.visible')
  })
})

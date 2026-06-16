describe('Smart Roulette', () => {
  beforeEach(() => {
    cy.window().then((win) => win.localStorage.clear())
  })

  it('renders the wheel and controls', () => {
    cy.visit('/SmartRoulette?role=viewer')
    cy.contains('Smart Twitch Roulette').should('be.visible')
  })

  it('adds participants and picks a winner', () => {
    cy.visit('/SmartRoulette?role=mod')

    // Add two participants
    cy.get('input[placeholder="Add participant"]').type('Alice')
    cy.contains('Añadir').click()
    cy.contains('Alice').should('be.visible')

    cy.get('input[placeholder="Add participant"]').type('Bob')
    cy.contains('Añadir').click()
    cy.contains('Bob').should('be.visible')

    cy.contains('Participants').should('contain', '2')

    // Spin and verify a winner is announced
    cy.contains('GIRAR RULETA').click()
    cy.contains(/[🏆].*/).should('be.visible')
  })
})

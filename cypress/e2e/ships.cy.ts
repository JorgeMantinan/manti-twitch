describe('Ships battle', () => {
  beforeEach(() => {
    cy.window().then((win) => {
      win.localStorage.clear()
      win.localStorage.removeItem('participantes_barcos')
    })
    cy.intercept(/socket\.io/, (req) => req.destroy())
  })

  it('setup screen renders correctly', () => {
    cy.visit('/Ships?role=viewer', { timeout: 15000 })
    cy.contains('Batalla Naval').should('be.visible')
    cy.contains('INICIAR PELEA').should('be.visible')
    cy.get('[placeholder="Nombre"]').should('be.visible')
  })

  it('adds participants and starts a battle', () => {
    cy.visit('/Ships?role=viewer', { timeout: 15000 })

    // Add participants
    const names = ['Alice', 'Bob', 'Charlie']
    names.forEach((name) => {
      cy.get('[placeholder="Nombre"]').type(name)
      cy.contains('+').click()
      cy.contains(name).should('be.visible')
    })

    // Start battle
    cy.contains('INICIAR PELEA').click()

    // Verify playing state — ships should appear
    cy.contains(/🚢|🚤/).should('be.visible')

    // Wait for the battle to finish and winner modal
    cy.contains('¡VICTORIA!', { timeout: 30000 }).should('be.visible')
  })
})

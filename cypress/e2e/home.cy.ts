describe('Home page', () => {
  it('loads with title and role buttons', () => {
    cy.visit('/')
    cy.contains('Twitch Interaction Suite').should('be.visible')
    cy.contains('Usuario').should('be.visible')
    cy.contains('Moderador').should('be.visible')
    cy.contains('Streamer').should('be.visible')
  })

  it('navigates to ToolsUsers on "Usuario" click', () => {
    cy.visit('/')
    cy.contains('Usuario').click()
    cy.url().should('include', '/ToolsUsers')
  })
})

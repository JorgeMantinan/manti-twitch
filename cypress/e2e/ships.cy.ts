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

  it('adds 5 non-sub participants and starts a battle', () => {
    cy.visit('/Ships?role=viewer', { timeout: 15000 })

    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve']
    names.forEach((name) => {
      cy.get('[placeholder="Nombre"]').type(name)
      cy.contains('+').click()
      cy.contains(`🚤 ${name}`).should('be.visible')
    })

    cy.contains('INICIAR PELEA').click()

    cy.contains(/🚢|🚤/).should('be.visible')

    cy.contains('¡VICTORIA!', { timeout: 30000 }).should('be.visible')
  })

  it('adds only subscribers and starts a battle', () => {
    cy.visit('/Ships?role=viewer', { timeout: 15000 })

    cy.contains(/^🚤$/).click()

    const subs = ['SubOne', 'SubTwo', 'SubThree']
    subs.forEach((name) => {
      cy.get('[placeholder="Nombre"]').type(name)
      cy.contains('+').click()
      cy.contains(`👑 ${name}`).should('be.visible')
    })

    cy.contains('INICIAR PELEA').click()

    cy.contains(/🚢|🚤/).should('be.visible')

    cy.contains('¡VICTORIA!', { timeout: 30000 }).should('be.visible')
  })

  it('adds mixed subscribers and non-subscribers', () => {
    cy.visit('/Ships?role=viewer', { timeout: 15000 })

    cy.get('[placeholder="Nombre"]').type('NonSubOne')
    cy.contains('+').click()
    cy.contains(`🚤 NonSubOne`).should('be.visible')

    cy.get('[placeholder="Nombre"]').type('NonSubTwo')
    cy.contains('+').click()
    cy.contains(`🚤 NonSubTwo`).should('be.visible')

    cy.contains(/^🚤$/).click()

    cy.get('[placeholder="Nombre"]').type('SubOne')
    cy.contains('+').click()
    cy.contains(`👑 SubOne`).should('be.visible')

    cy.get('[placeholder="Nombre"]').type('SubTwo')
    cy.contains('+').click()
    cy.contains(`👑 SubTwo`).should('be.visible')

    cy.contains('INICIAR PELEA').click()

    cy.contains(/🚢|🚤/).should('be.visible')

    cy.contains('¡VICTORIA!', { timeout: 30000 }).should('be.visible')
  })

  it('removes an individual participant', () => {
    cy.visit('/Ships?role=viewer', { timeout: 15000 })

    cy.get('[placeholder="Nombre"]').type('Alice')
    cy.contains('+').click()
    cy.get('[placeholder="Nombre"]').type('Bob')
    cy.contains('+').click()

    cy.contains('Quitar').first().click()
    cy.contains('🚤 Alice').should('not.exist')
    cy.contains('🚤 Bob').should('be.visible')
  })

  it('clears all participants', () => {
    cy.visit('/Ships?role=viewer', { timeout: 15000 })

    cy.get('[placeholder="Nombre"]').type('Alice')
    cy.contains('+').click()
    cy.get('[placeholder="Nombre"]').type('Bob')
    cy.contains('+').click()

    cy.contains('BORRAR TODO').click()
    cy.contains('🚤 Alice').should('not.exist')
    cy.contains('🚤 Bob').should('not.exist')
  })

  it('handles start battle with zero participants gracefully', () => {
    cy.visit('/Ships?role=viewer', { timeout: 15000 })

    cy.contains('INICIAR PELEA').click()

    cy.contains('Batalla Naval').should('be.visible')
  })

  it('shows mod-specific controls for mod role', () => {
    cy.visit('/Ships?role=mod', { timeout: 15000 })

    cy.get('[placeholder="Nombre del streamer"]').should('be.visible')
    cy.get('[placeholder="Keyword"]').should('be.visible')
    cy.contains('Obtener gente del chat').should('be.visible')
  })

  it('shows streamer-specific controls for streamer role', () => {
    cy.visit('/Ships?role=streamer', { timeout: 15000 })

    cy.contains('OBTENER SUBS').should('be.visible')
  })

  it('shows viewer controls without mod options', () => {
    cy.visit('/Ships?role=viewer', { timeout: 15000 })

    cy.get('[placeholder="Nombre del streamer"]').should('not.exist')
    cy.get('[placeholder="Keyword"]').should('not.exist')
    cy.contains('Obtener gente del chat').should('not.exist')
    cy.contains('OBTENER SUBS').should('not.exist')
  })
})

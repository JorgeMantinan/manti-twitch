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
    cy.visit('/Ships?role=viewer&turbo=15', { timeout: 15000 })

    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve']
    names.forEach((name) => {
      cy.typeIn('[placeholder="Nombre"]', name)
      cy.contains('+').click()
      cy.contains(`🚤 ${name}`).should('be.visible')
    })

    cy.contains('INICIAR PELEA').click()

    cy.contains('FLOTA').should('be.visible')
    cy.contains(/🚢|🚤/).should('be.visible')

    cy.contains('¡VICTORIA!', { timeout: 60000 }).should('be.visible')
  })

  it('adds only subscribers and starts a battle', () => {
    cy.visit('/Ships?role=viewer&turbo=15', { timeout: 15000 })

    
    cy.get('button').filter(':visible').then($btns => {
      for (let i = 0; i < $btns.length; i++) {
        const t = $btns[i].textContent || ''
        if (t.includes('SUB') || t.includes('🚤')) { cy.wrap($btns[i]).click(); break; }
      }
    })


    const subs = ['SubOne', 'SubTwo', 'SubThree']
    subs.forEach((name) => {
      cy.typeIn('[placeholder="Nombre"]', name)
      cy.contains('+').click()
      cy.contains(`?? ${name}`).should('be.visible')
    })

    cy.contains('INICIAR PELEA').click()

    cy.contains('FLOTA').should('be.visible')
    cy.contains(/🚢|🚤/).should('be.visible')

    cy.contains('¡VICTORIA!', { timeout: 60000 }).should('be.visible')
  })

  it('adds mixed subscribers and non-subscribers', () => {
    cy.visit('/Ships?role=viewer&turbo=15', { timeout: 15000 })

    cy.typeIn('[placeholder="Nombre"]', 'NonSubOne')
    cy.contains('+').click()
    cy.contains(`🚤 NonSubOne`).should('be.visible')

    cy.typeIn('[placeholder="Nombre"]', 'NonSubTwo')
    cy.contains('+').click()
    cy.contains(`🚤 NonSubTwo`).should('be.visible')

    
    cy.get('button').filter(':visible').then($btns => {
      for (let i = 0; i < $btns.length; i++) {
        const t = $btns[i].textContent || ''
        if (t.includes('SUB') || t.includes('🚤')) { cy.wrap($btns[i]).click(); break; }
      }
    })


    cy.typeIn('[placeholder="Nombre"]', 'SubOne')
    cy.contains('+').click()
    cy.contains(`?? SubOne`).should('be.visible')

    cy.typeIn('[placeholder="Nombre"]', 'SubTwo')
    cy.contains('+').click()
    cy.contains(`?? SubTwo`).should('be.visible')

    cy.contains('INICIAR PELEA').click()

    cy.contains('FLOTA').should('be.visible')
    cy.contains(/🚢|🚤/).should('be.visible')

    cy.contains('¡VICTORIA!', { timeout: 60000 }).should('be.visible')
  })

  it('removes an individual participant', () => {
    cy.visit('/Ships?role=viewer', { timeout: 15000 })

    cy.typeIn('[placeholder="Nombre"]', 'Alice')
    cy.contains('+').click()
    cy.typeIn('[placeholder="Nombre"]', 'Bob')
    cy.contains('+').click()

    cy.contains('Quitar').first().click()
    cy.contains('🚤 Alice').should('not.exist')
    cy.contains('🚤 Bob').should('be.visible')
  })

  it('clears all participants', () => {
    cy.visit('/Ships?role=viewer', { timeout: 15000 })

    cy.typeIn('[placeholder="Nombre"]', 'Alice')
    cy.contains('+').click()
    cy.typeIn('[placeholder="Nombre"]', 'Bob')
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

  it('shows the local command panel during a local battle', () => {
    cy.visit('/Ships?role=viewer&turbo=1', { timeout: 15000 })

    cy.typeIn('[placeholder="Nombre"]', 'Alice')
    cy.contains('+').click()
    cy.typeIn('[placeholder="Nombre"]', 'Bob')
    cy.contains('+').click()

    cy.contains('INICIAR PELEA').click()

    cy.contains('MUNICIÓN').should('be.visible')
    cy.contains('FUEGO').should('be.visible')
    cy.contains('BLINDAJE').should('be.visible')
    cy.contains('💻 LOCAL').should('be.visible')
  })
})

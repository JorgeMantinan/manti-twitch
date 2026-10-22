describe('Ships visual capture', () => {
  beforeEach(() => {
    cy.window().then((win) => {
      win.localStorage.clear()
      win.localStorage.removeItem('participantes_barcos')
    })
    cy.intercept(/socket\.io/, (req) => req.destroy())
  })

  it('captures setup and battle', () => {
    cy.viewport(1280, 800)
    cy.visit('/Ships?role=viewer', { timeout: 30000 })
    cy.contains('Batalla Naval').should('be.visible')
    cy.screenshot('ships-setup', { capture: 'viewport' })

    const names = ['Alice', 'Bob', 'Charlie', 'Diana']
    names.forEach((name) => {
      cy.typeIn('[placeholder="Nombre"]', name)
      cy.contains('+').click()
    })

    cy.contains('INICIAR PELEA').click()
    cy.contains('FLOTA').should('be.visible')
    cy.wait(4000)
    cy.screenshot('ships-battle', { capture: 'viewport' })

    cy.wait(6000)
    cy.screenshot('ships-battle-2', { capture: 'viewport' })
  })

  it('renders the scene with ships inside the viewport', () => {
    cy.viewport(1280, 800)
    cy.visit('/Ships?role=viewer', { timeout: 30000 })

    const names = ['Alice', 'Bob', 'Charlie', 'Diana']
    names.forEach((name) => {
      cy.typeIn('[placeholder="Nombre"]', name)
      cy.contains('+').click()
    })

    cy.contains('INICIAR PELEA').click()
    cy.contains('FLOTA').should('be.visible')

    // Fondo oceano presente y cubriendo el viewport
    cy.get('[data-testid="ocean-scene"]').should('exist')
    cy.get('[data-testid="ocean-scene"]').then(($el) => {
      const rect = $el[0].getBoundingClientRect()
      expect(rect.width).to.be.greaterThan(1200)
      expect(rect.height).to.be.greaterThan(700)
    })

    // 4 barcos presentes
    cy.get('[data-testid^="ship-"]').should('have.length', 4)

    // Todos dentro del viewport y con tamano razonable
    cy.get('[data-testid^="ship-"]').each(($el) => {
      const rect = $el[0].getBoundingClientRect()
      expect(rect.left, 'x dentro').to.be.greaterThan(-60)
      expect(rect.top, 'y dentro').to.be.greaterThan(-60)
      expect(rect.left, 'x dentro').to.be.lessThan(1340)
      expect(rect.top, 'y dentro').to.be.lessThan(860)
      expect(rect.width, 'ancho barcode').to.be.greaterThan(8)
      expect(rect.height, 'alto barcode').to.be.greaterThan(5)
    })

    // Los barcos estan repartidos (no apilados)
    cy.get('[data-testid^="ship-"]').then(($els) => {
      const centers = Array.from($els).map((el) => {
        const r = el.getBoundingClientRect()
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      })
      let minDist = Infinity
      for (let i = 0; i < centers.length; i++) {
        for (let j = i + 1; j < centers.length; j++) {
          const d = Math.hypot(
            centers[i].x - centers[j].x,
            centers[i].y - centers[j].y,
          )
          if (d < minDist) minDist = d
        }
      }
      expect(minDist, 'separacion minima').to.be.greaterThan(1)
    })

    // El HUD muestra la flota y el cronometro
    cy.get('[data-testid="scoreboard"]').should('be.visible')
    cy.contains('⏱').should('be.visible')

    // El timer avanza
    cy.contains(/⏱ \d+s/).invoke('text').then((t0) => {
      cy.wait(2500)
      cy.contains(/⏱ \d+s/).invoke('text').should((t1) => {
        expect(t1).to.not.equal(t0)
      })
    })

    // Tras unos segundos hay proyectiles en pantalla
    cy.wait(4000)
    cy.get('[data-testid="bullet"]').should('have.length.greaterThan', 0)
  })
})

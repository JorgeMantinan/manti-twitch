describe('Roulette new features', () => {
  const data = (names: string[]) =>
    encodeURIComponent(
      JSON.stringify(names.map((n) => ({ user_name: n, weight: 1 }))),
    );

  beforeEach(() => {
    cy.window().then((win) => win.localStorage.clear());
  });

  it('prizes mode: N prizes then exhausted', () => {
    cy.visit(
      `/SmartRoulette?role=mod&data=${data(['Alice', 'Bob', 'Carol'])}&drawMode=prizes&spins=3`,
      { timeout: 15000 },
    );
    cy.contains('Participants (3)').should('be.visible');
    cy.wait(1200);

    cy.contains('GIRAR RULETA', { scrollBehavior: false }).click({ scrollBehavior: false });
    cy.contains('🏆', { timeout: 15000, scrollBehavior: false }).should('be.visible');
    cy.contains('Participants (2)').should('be.visible');

    cy.contains('GIRAR RULETA', { scrollBehavior: false }).click({ scrollBehavior: false });
    cy.contains('🏆', { timeout: 15000, scrollBehavior: false }).should('be.visible');
    cy.contains('Participants (1)').should('be.visible');

    cy.contains('GIRAR RULETA', { scrollBehavior: false }).click({ scrollBehavior: false });
    cy.contains('🏆', { timeout: 15000, scrollBehavior: false }).should('be.visible');
    cy.contains('Participants (0)').should('be.visible');

    cy.contains('¡PREMIOS AGOTADOS!').scrollIntoView().should('be.visible');
    cy.contains('Historial').scrollIntoView().should('be.visible');
    cy.screenshot('prizes-done');
  });

  it('duel mode: winner only from the pair', () => {
    cy.visit(
      `/SmartRoulette?role=mod&data=${data(['Alice', 'Bob', 'Carol'])}&spins=3`,
      { timeout: 15000 },
    );
    cy.contains('Participants (3)').should('be.visible');
    cy.wait(1200);

    cy.contains('DUELO').click({ scrollBehavior: false });
    cy.get('[placeholder="Jugador A"]').type('Alice');
    cy.get('[placeholder="Jugador B"]').type('Bob');

    cy.contains('GIRAR RULETA', { scrollBehavior: false }).click({ scrollBehavior: false });
    cy.contains('🏆', { timeout: 15000, scrollBehavior: false }).should('be.visible');

    cy.window().then((win) => {
      const html = win.document.body.innerText;
      const m = html.match(/🏆\s*(\w+)/);
      expect(m).to.not.eq(null);
      expect(['Alice', 'Bob']).to.include(m![1]);
    });
  });

  it('lock blocks the list', () => {
    cy.visit(`/SmartRoulette?role=mod&data=${data(['Alice'])}`, {
      timeout: 15000,
    });
    cy.contains('Participants (1)').should('be.visible');
    cy.wait(1000);

    cy.contains('🔒 BLOQUEAR').click({ scrollBehavior: false });
    cy.get('[placeholder="Add participant"]').should('have.attr', 'readonly');

    cy.contains('🔓 LISTA').click({ scrollBehavior: false });
    cy.get('[placeholder="Add participant"]').should('not.have.attr', 'readonly');
  });

  it('anonymous mode hides real names in list', () => {
    cy.visit(`/SmartRoulette?role=mod&data=${data(['Alice', 'Bob'])}`, {
      timeout: 15000,
    });
    cy.contains('Participants (2)').should('be.visible');
    cy.wait(1000);

    cy.contains('ANÓNIMO').click({ scrollBehavior: false });
    cy.contains('Jugador 1').scrollIntoView().should('be.visible');
    cy.contains('Jugador 2').scrollIntoView().should('be.visible');
    cy.contains('Alice').should('not.exist');
    cy.screenshot('anon-mode');
  });

  it('winner modal shows and closes', () => {
    cy.visit(
      `/SmartRoulette?role=mod&data=${data(['Alice', 'Bob'])}&modal=1&spins=3`,
      { timeout: 15000 },
    );
    cy.contains('Participants (2)').should('be.visible');
    cy.wait(1200);

    cy.contains('GIRAR RULETA', { scrollBehavior: false }).click({ scrollBehavior: false });
    cy.contains('¡GANADOR!', { timeout: 15000 }).should('be.visible');
    cy.screenshot('winner-modal');
    cy.contains('Cerrar').click();
    cy.contains('¡GANADOR!').should('not.exist');
  });

  it('mini view has wheel but no controls panel', () => {
    cy.visit(`/SmartRoulette?role=mod&view=mini&data=${data(['Alice'])}`, {
      timeout: 15000,
    });
    cy.contains('GIRAR RULETA').should('be.visible');
    cy.contains('Add participant').should('not.exist');
    cy.contains('Participants').should('not.exist');
  });

  it('restores previous session after prompt', () => {
    cy.visit(`/SmartRoulette?role=mod&data=${data(['Alice', 'Bob', 'Carol'])}`, {
      timeout: 15000,
    });
    cy.contains('Participants (3)').should('be.visible');
    cy.wait(1200); // let persistence effect write storage

    cy.visit('/SmartRoulette?role=mod', { timeout: 15000 });
    cy.contains('Restaurar lista anterior')
      .scrollIntoView()
      .should('be.visible');
    cy.contains('RESTAURAR').click({ scrollBehavior: false });
    cy.contains('Participants (3)').should('be.visible');
  });

  it('csv import adds parsed names', () => {
    cy.visit('/SmartRoulette?role=mod', { timeout: 15000 });
    cy.contains('Participants (0)').should('be.visible');
    cy.wait(1000);

    cy.contains('CSV').scrollIntoView().click({ scrollBehavior: false });
    cy.get('[placeholder="Pega CSV (nombre,peso)"]').type('Ana,2{enter}Luis');
    cy.contains('IMPORTAR').scrollIntoView().click({ scrollBehavior: false });
    cy.contains('Participants (2)').should('be.visible');
  });

  it('anti-repeat button cycles and dark theme applies', () => {
    cy.visit(`/SmartRoulette?role=mod&data=${data(['Alice'])}&dark=1`, {
      timeout: 15000,
    });
    cy.contains('Participants (1)').should('be.visible');
    cy.wait(800);

    cy.contains('NO REPETIR: OFF').click({ scrollBehavior: false });
    cy.contains('NO REPETIR: 2').should('be.visible');

    cy.contains('Smart Twitch Roulette').should(
      'have.css',
      'color',
      'rgb(242, 237, 230)',
    );
    cy.screenshot('dark-mode');
  });
});

import { uniqueLetters, reveal, charStates } from '../../utils/ahorcado';

describe('uniqueLetters', () => {
  it('returns unique uppercase letters ignoring spaces/punctuation', () => {
    const letters = uniqueLetters('A una bala');
    expect(letters).toEqual(['A', 'U', 'N', 'B', 'L']);
  });

  it('handles Ñ', () => {
    const letters = uniqueLetters('mañana');
    expect(letters).toContain('Ñ');
  });
});

describe('reveal', () => {
  it('reveals drawn letters and hides the rest', () => {
    expect(reveal('A una bala', ['A', 'U', 'L'])).toBe('A U_A _ALA');
  });

  it('reveals the full phrase when all letters are drawn', () => {
    const phrase = 'Manti perro';
    const all = uniqueLetters(phrase);
    expect(reveal(phrase, all)).toBe('MANTI PERRO');
  });

  it('keeps spaces and punctuation visible', () => {
    expect(reveal('Te la dedico Black', [])).toBe('__ __ ______ _____');
  });
});

describe('charStates', () => {
  it('marks letters in drawn as revealed', () => {
    const states = charStates('A una', ['A']);
    const revealedLetters = states.filter((s) => s.revealed);
    expect(revealedLetters.map((s) => s.ch)).toEqual(['A', 'A']);
  });

  it('marks spaces', () => {
    const states = charStates('A una', []);
    expect(states.filter((s) => s.isSpace)).toHaveLength(1);
  });

  it('keeps punctuation as non-letters', () => {
    const states = charStates('¡Hola!', []);
    expect(states[0].ch).toBe('¡');
    expect(states[0].isLetter).toBe(false);
    expect(states[states.length - 1].ch).toBe('!');
    expect(states[states.length - 1].isLetter).toBe(false);
  });
});

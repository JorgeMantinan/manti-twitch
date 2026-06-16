import { generateSpanishCard } from '../../utils/bingoCard';

describe('generateSpanishCard', () => {
  it('returns a 3x9 array', () => {
    const card = generateSpanishCard();
    expect(card).toHaveLength(3);
    card.forEach((row) => {
      expect(row).toHaveLength(9);
    });
  });

  it('each row has exactly 5 filled cells', () => {
    const card = generateSpanishCard();
    card.forEach((row) => {
      const filled = row.filter((c) => c !== null);
      expect(filled).toHaveLength(5);
    });
  });

  it('each column has numbers within the correct range', () => {
    const ranges = [
      [1, 9], [10, 19], [20, 29], [30, 39], [40, 49],
      [50, 59], [60, 69], [70, 79], [80, 90],
    ];
    const card = generateSpanishCard();
    for (let c = 0; c < 9; c++) {
      const [min, max] = ranges[c];
      for (let r = 0; r < 3; r++) {
        const num = card[r][c];
        if (num !== null) {
          expect(num).toBeGreaterThanOrEqual(min);
          expect(num).toBeLessThanOrEqual(max);
        }
      }
    }
  });

  it('no duplicate numbers in the same column', () => {
    const card = generateSpanishCard();
    for (let c = 0; c < 9; c++) {
      const nums = card.map((row) => row[c]).filter((n) => n !== null);
      const unique = new Set(nums);
      expect(unique.size).toBe(nums.length);
    }
  });

  it('values in each column are sorted ascending', () => {
    const card = generateSpanishCard();
    for (let c = 0; c < 9; c++) {
      const nums = card
        .map((row) => row[c])
        .filter((n) => n !== null) as number[];
      for (let i = 1; i < nums.length; i++) {
        expect(nums[i]).toBeGreaterThanOrEqual(nums[i - 1]);
      }
    }
  });
});

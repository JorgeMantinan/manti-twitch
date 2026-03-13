export function generateSpanishCard() {
  const ranges = [
    [1, 9],
    [10, 19],
    [20, 29],
    [30, 39],
    [40, 49],
    [50, 59],
    [60, 69],
    [70, 79],
    [80, 90],
  ];

  let card: (number | null)[][] = Array.from({ length: 3 }, () =>
    Array(9).fill(null),
  );

  for (let r = 0; r < 3; r++) {
    let cols = new Set<number>();

    while (cols.size < 5) {
      cols.add(Math.floor(Math.random() * 9));
    }

    cols.forEach((c) => {
      const [min, max] = ranges[c];

      let num: number;

      do {
        num = Math.floor(Math.random() * (max - min + 1)) + min;
      } while (card.some((row) => row[c] === num));

      card[r][c] = num;
    });
  }

  for (let c = 0; c < 9; c++) {
    let nums: number[] = [];

    for (let r = 0; r < 3; r++) {
      if (card[r][c] != null) nums.push(card[r][c] as number);
    }

    nums.sort((a, b) => a - b);

    let i = 0;
    for (let r = 0; r < 3; r++) {
      if (card[r][c] != null) {
        card[r][c] = nums[i++];
      }
    }
  }

  return card;
}

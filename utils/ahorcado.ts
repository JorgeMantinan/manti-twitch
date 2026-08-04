const LETTER_RE = /[A-ZÑ]/;

export type CharState = {
  ch: string;
  isLetter: boolean;
  isSpace: boolean;
  revealed: boolean;
};

export function uniqueLetters(phrase: string): string[] {
  return Array.from(
    new Set(
      phrase
        .toUpperCase()
        .replace(/[^A-ZÑ]/g, "")
        .split(""),
    ),
  );
}

export function reveal(phrase: string, drawn: string[]): string {
  const drawnSet = new Set(drawn.map((l) => l.toUpperCase()));

  return phrase
    .toUpperCase()
    .split("")
    .map((ch) => (LETTER_RE.test(ch) ? (drawnSet.has(ch) ? ch : "_") : ch))
    .join("");
}

export function charStates(phrase: string, drawn: string[]): CharState[] {
  const drawnSet = new Set(drawn.map((l) => l.toUpperCase()));

  return phrase.toUpperCase().split("").map((ch) => {
    const isLetter = LETTER_RE.test(ch);

    return {
      ch,
      isLetter,
      isSpace: ch === " ",
      revealed: isLetter && drawnSet.has(ch),
    };
  });
}

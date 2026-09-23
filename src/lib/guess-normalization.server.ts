import { ConverterFactory, Locale } from "opencc-js/t2cn";

// Fold Taiwan/Hong Kong orthographic variants before converting whole phrases
// to simplified Chinese. Keep phrase dictionaries (e.g. 乾隆 / 干燥, 著作 / 看着),
// but deliberately omit regional vocabulary rewrites such as 計程車 → 出租车.
// Construct the dictionary tries once per server process, not for every guess.
const toCanonicalChinese = ConverterFactory(Locale.from.tw, Locale.from.hk, Locale.to.cn);

/** Comparison only: never use this value as a displayed prompt or chat message. */
export function normalizeGuess(raw: string): string {
  const text = (raw ?? "")
    .normalize("NFKC")
    .replace(/[\p{White_Space}\p{Punctuation}\p{Default_Ignorable_Code_Point}]/gu, "")
    .toLowerCase();

  return toCanonicalChinese(text);
}

/** Apply the same canonical form to the guess and the answer, in either script. */
export function evaluateGuess(rawGuess: string, rawAnswer: string) {
  const guess = normalizeGuess(rawGuess);
  const answer = normalizeGuess(rawAnswer);
  if (!guess || !answer) return { correct: false, close: false };
  if (guess === answer) return { correct: true, close: false };

  // Preserve the game's existing near-miss rule, using Unicode code points on
  // both sides so an extension Han character is counted as one character.
  const guessCharacters = [...guess];
  const answerCharacters = [...answer];
  const shared = [...new Set(guessCharacters)].filter((character) =>
    answerCharacters.includes(character),
  ).length;
  const close =
    guessCharacters.length === answerCharacters.length &&
    shared >= Math.ceil(answerCharacters.length / 2);
  return { correct: false, close };
}

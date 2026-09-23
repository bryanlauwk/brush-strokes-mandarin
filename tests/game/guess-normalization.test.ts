import { describe, expect, test } from "bun:test";
import { evaluateGuess, normalizeGuess } from "../../src/lib/guess-normalization.server";

// These include phrases from the local/theme banks and the SQL seed bank.
const scriptPairs = [
  ["椰浆饭", "椰漿飯"],
  ["炒粿条", "炒粿條"],
  ["福建面", "福建麵"],
  ["云吞面", "雲吞麵"],
  ["咸蛋鸡", "鹹蛋雞"],
  ["香蕉叶饭", "香蕉葉飯"],
  ["轻快铁", "輕快鐵"],
  ["购物广场", "購物廣場"],
  ["独立广场", "獨立廣場"],
  ["红毛猩猩", "紅毛猩猩"],
  ["开斋节", "開齋節"],
  ["团圆饭", "團圓飯"],
  ["科学实验", "科學實驗"],
  ["电视机", "電視機"],
  ["龙卷风", "龍捲風"],
  ["电召车", "電召車"],
  ["头发", "頭髮"],
  ["发财", "發財"],
] as const;

describe("script-independent answer matching", () => {
  for (const [simplified, traditional] of scriptPairs) {
    test(`${simplified} accepts either script for either prompt script`, () => {
      expect(evaluateGuess(traditional, simplified)).toEqual({ correct: true, close: false });
      expect(evaluateGuess(simplified, traditional)).toEqual({ correct: true, close: false });
      expect(evaluateGuess(traditional, traditional)).toEqual({ correct: true, close: false });
      expect(normalizeGuess(simplified)).toBe(simplified);
    });
  }

  test("mixed scripts and Taiwan/Hong Kong glyph variants are equivalent", () => {
    for (const input of ["云吞麵", "雲吞面", "雲吞麪"]) {
      expect(evaluateGuess(input, "云吞面").correct).toBe(true);
    }
    for (const input of ["裡面", "裏面"]) {
      expect(evaluateGuess(input, "里面").correct).toBe(true);
    }
    for (const input of ["鷄蛋", "雞蛋"]) {
      expect(evaluateGuess(input, "鸡蛋").correct).toBe(true);
    }
  });

  test("conversion uses phrase context instead of blind character replacement", () => {
    expect(normalizeGuess("乾隆")).toBe("乾隆");
    expect(normalizeGuess("乾燥")).toBe("干燥");
    expect(normalizeGuess("著作")).toBe("著作");
    expect(normalizeGuess("看著")).toBe("看着");
    expect(evaluateGuess("干隆", "乾隆").correct).toBe(false);
    expect(evaluateGuess("着作", "著作").correct).toBe(false);
  });
});

describe("typing and punctuation tolerance", () => {
  test("normalizes full-width characters before removing Unicode punctuation", () => {
    expect(normalizeGuess("　「椰，漿　飯！」\n")).toBe("椰浆饭");
    expect(normalizeGuess("［ＴＶＢ］：‘１２３’！？")).toBe("tvb123");
    expect(evaluateGuess("『科學—實驗』…", "科学实验").correct).toBe(true);
    expect(evaluateGuess(" 輕／快\\鐵 ", "轻快铁").correct).toBe(true);
  });

  test("ignores Unicode spacing and invisible pasted formatting", () => {
    expect(normalizeGuess("椰\u00a0漿\u200b飯\ufeff")).toBe("椰浆饭");
    expect(normalizeGuess("雲吞麵\ufe00")).toBe("云吞面");
    expect(normalizeGuess("電\u2060視\t機")).toBe("电视机");
  });

  test("does not discard meaningful symbols or turn empty guesses into answers", () => {
    expect(evaluateGuess("☕咖啡", "咖啡").correct).toBe(false);
    expect(evaluateGuess("Ｃ＋＋", "C").correct).toBe(false);
    expect(evaluateGuess("　！…\u200b", "椰浆饭")).toEqual({ correct: false, close: false });
    expect(evaluateGuess("！！！", "？？？")).toEqual({ correct: false, close: false });
  });
});

describe("matching boundaries and near misses", () => {
  test("does not introduce synonyms, reordered words, or homophone matches", () => {
    for (const [guess, answer] of [
      ["計程車", "出租车"],
      ["炒飯", "炒面"],
      ["馬來西牙", "马来西亚"],
      ["飯椰漿", "椰浆饭"],
      ["椰漿", "椰浆饭"],
    ]) {
      expect(evaluateGuess(guess, answer).correct).toBe(false);
    }
  });

  test("applies script normalization to the existing near-miss hint", () => {
    expect(evaluateGuess("雲吞飯", "云吞面")).toEqual({ correct: false, close: true });
    expect(evaluateGuess("椰漿", "椰浆饭")).toEqual({ correct: false, close: false });
    expect(evaluateGuess("𠮷林", "𠮷隆")).toEqual({ correct: false, close: true });
  });

  test("canonicalization is stable across both scripts", () => {
    for (const pair of scriptPairs) {
      for (const original of pair) {
        const canonical = normalizeGuess(original);
        expect(normalizeGuess(canonical)).toBe(canonical);
      }
    }
  });
});

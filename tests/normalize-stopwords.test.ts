import { describe, expect, test } from "bun:test";
import { initTokenizer, tokenizeForFts, getLoadedTokenizers } from "../src/tokenizer";

describe("NFKC normalization", () => {
  test("fullwidth Latin folds to ASCII (JP keyboard input habit)", () => {
    expect(tokenizeForFts("ＴｙｐｅＳｃｒｉｐｔ ｃｏｄｅ", "en")).toBe("TypeScript code");
  });

  test("fullwidth digits fold", () => {
    expect(tokenizeForFts("２０２６年", "zh")).toContain("2026");
  });

  test("halfwidth katakana folds to fullwidth before ja tokenization", async () => {
    await initTokenizer();
    const out = tokenizeForFts("ﾄｳｷｮｳﾀﾜｰ", "ja");
    expect(out).not.toMatch(/[ｦ-ﾟ]/); // no halfwidth kana survives
  });
});

describe("stopword removal (opt-in)", () => {
  test("disabled by default — behavior preserved", async () => {
    await initTokenizer();
    const out = tokenizeForFts("机器学习的应用", "zh");
    expect(out.split(" ")).toContain("的");
  });

  test("zh stopwords removed when enabled", async () => {
    await initTokenizer();
    const out = tokenizeForFts("机器学习的应用", "zh", { removeStopwords: true });
    const tokens = out.split(" ");
    expect(tokens).not.toContain("的");
    expect(tokens).toContain("应用");
  });

  test("en stopwords removed when enabled", () => {
    const out = tokenizeForFts("the quick fox and the dog", "en", {
      removeStopwords: true,
    });
    const tokens = out.split(" ");
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("and");
    expect(tokens).toContain("quick");
  });

  test("ja particles removed when enabled", async () => {
    await initTokenizer();
    const out = tokenizeForFts("東京の空は青いです", "ja", { removeStopwords: true });
    const tokens = out.split(" ");
    expect(tokens).not.toContain("の");
    expect(tokens).not.toContain("は");
  });
});

describe("selective init + diagnostics", () => {
  test("getLoadedTokenizers reports loaded packs", async () => {
    await initTokenizer();
    const loaded = getLoadedTokenizers();
    // dev environment has all optional deps installed
    expect(loaded).toContain("jieba");
    expect(loaded).toContain("kuromoji");
    expect(loaded).toContain("tinyld");
  });

  test("initTokenizer({languages}) accepts subsets without throwing", async () => {
    // already-loaded packs stay loaded (idempotent), so we only assert
    // the call path works; true isolation is covered by the
    // no-optional-deps CI job.
    await initTokenizer({ languages: ["zh", "de"] });
    expect(getLoadedTokenizers()).toContain("jieba");
  });
});

import { describe, expect, test } from "bun:test";
import { intlWithBigrams, segmentWithIntl, tokenizeForFts } from "../src/tokenizer";

// Intl.Segmenter is built into Node 16+ / Bun / Deno (full-icu).
// These tests assert the zero-dependency word-level fallback quality.

describe("segmentWithIntl", () => {
  test("Chinese: word-level segmentation, not per-character", () => {
    const out = segmentWithIntl("机器学习在自然语言处理中的应用", "zh");
    expect(out).not.toBeNull();
    const tokens = out!.split(" ");
    // ICU should produce multi-char words like 机器/学习, not single chars
    expect(tokens).toContain("机器");
    expect(tokens).toContain("学习");
    expect(tokens.some((t) => t.length >= 2)).toBe(true);
  });

  test("Japanese: word-level segmentation", () => {
    const out = segmentWithIntl("東京タワーはとても高いです", "ja");
    expect(out).not.toBeNull();
    const tokens = out!.split(" ");
    expect(tokens.length).toBeGreaterThan(2);
    // katakana compound should stay together
    expect(tokens.some((t) => t.includes("タワー"))).toBe(true);
  });

  test("Thai: produces multiple tokens (current passthrough would be 1)", () => {
    const out = segmentWithIntl("สวัสดีครับผมชอบกินข้าว", "th");
    expect(out).not.toBeNull();
    expect(out!.split(" ").length).toBeGreaterThan(2);
  });

  test("Korean tokenizeForFts stays syllable-level (agglutinative: word-level breaks BM25 partial match)", () => {
    // "프로젝트는" = 프로젝트 + topic particle; query "프로젝트" must still match
    expect(tokenizeForFts("프로젝트", "ko")).toBe("프 로 젝 트");
  });

  test("intlWithBigrams expands long CJK tokens so partial queries match", () => {
    // ICU may emit compounds like "東京タワー" as one token; bigram
    // expansion ensures query "タワー" (→ タワ ワー) still hits.
    const out = intlWithBigrams("東京タワー", "ja");
    expect(out).not.toBeNull();
    const tokens = out!.split(" ");
    const longCjk = tokens.filter((t) => t.length >= 3 && /^[぀-ヿ一-鿿]+$/u.test(t));
    for (const compound of longCjk) {
      for (let i = 0; i < compound.length - 1; i++) {
        expect(tokens).toContain(compound.slice(i, i + 2));
      }
    }
  });

  test("intlWithBigrams leaves Latin tokens un-bigrammed", () => {
    const out = intlWithBigrams("我用 TypeScript 编程", "zh");
    expect(out).not.toBeNull();
    const tokens = out!.split(" ");
    expect(tokens).toContain("TypeScript");
    expect(tokens).not.toContain("Ty"); // no Latin bigrams
  });

  test("strips punctuation via isWordLike", () => {
    const out = segmentWithIntl("机器学习，很有趣！", "zh");
    expect(out).not.toBeNull();
    expect(out).not.toContain("，");
    expect(out).not.toContain("！");
  });

  test("empty / punctuation-only input returns null (caller falls back)", () => {
    expect(segmentWithIntl("", "zh")).toBeNull();
    expect(segmentWithIntl("！？。", "zh")).toBeNull();
  });

  test("mixed CJK + Latin keeps both", () => {
    const out = segmentWithIntl("我用 TypeScript 写代码", "zh");
    expect(out).not.toBeNull();
    const tokens = out!.split(" ");
    expect(tokens).toContain("TypeScript");
    expect(tokens.some((t) => /[一-鿿]/.test(t))).toBe(true);
  });
});

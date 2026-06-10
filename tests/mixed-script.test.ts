import { describe, expect, test } from "bun:test";
import { detectLanguageDetailed } from "../src/detect";
import { tokenizeForFts } from "../src/tokenizer";

describe("detectLanguageDetailed", () => {
  test("pure Chinese: not mixed", () => {
    const d = detectLanguageDetailed("机器学习在自然语言处理中的应用非常广泛");
    expect(d.language).toBe("zh");
    expect(d.isMixed).toBe(false);
    expect(d.scripts.cjk).toBeGreaterThan(0.9);
  });

  test("CN/EN tech chat (the AI-conversation case): mixed flagged", () => {
    const d = detectLanguageDetailed(
      "我在用 TypeScript 给 RecallNest 写 tokenizer hook 然后发现一个 bug"
    );
    expect(d.isMixed).toBe(true);
    expect(d.scripts.latin).toBeGreaterThan(0.1);
    expect(d.scripts.cjk).toBeGreaterThan(0.1);
  });

  test("pure English: not mixed, no false positives", () => {
    const d = detectLanguageDetailed("The quick brown fox jumps over the lazy dog");
    expect(d.language).toBe("en");
    expect(d.isMixed).toBe(false);
  });

  test("agrees with detectLanguage on primary language", () => {
    const d = detectLanguageDetailed("東京タワーはとても高いです");
    expect(d.language).toBe("ja");
  });
});

describe("mixed-script tokenizeForFts routing", () => {
  test("CJK islands inside text detected as 'en' still get segmented", () => {
    // Latin-heavy mixed text gets classified "en" by ratio thresholds;
    // previously the Chinese ran through as one unsegmented blob.
    const text = "I implemented 机器学习模型 using TensorFlow yesterday";
    const out = tokenizeForFts(text, "en");
    // the Chinese run must be split into multiple tokens
    expect(out).not.toContain("机器学习模型");
    expect(out).toContain("TensorFlow");
    expect(out.split(" ").filter((t) => /[一-鿿]/.test(t)).length).toBeGreaterThan(1);
  });

  test("Japanese runs (kana present) route to ja strategy", () => {
    const out = tokenizeForFts("deploy した後で 東京タワー を見た", "en");
    expect(out).toContain("deploy");
    // kana/kanji content must not survive as one giant blob
    expect(out).not.toContain("した後で東京タワーを見た");
  });

  test("pure English via 'en' is passthrough (behavior preserved)", () => {
    const text = "just a plain English sentence";
    expect(tokenizeForFts(text, "en")).toBe(text);
  });

  test("Korean runs in mixed text become syllables", () => {
    const out = tokenizeForFts("check 프로젝트 status", "en");
    expect(out).toContain("프 로 젝 트");
  });

  test("Thai runs in mixed text get segmented", () => {
    const out = tokenizeForFts("meeting note สวัสดีครับผม end", "en");
    expect(out.split(" ").filter((t) => /[฀-๿]/.test(t)).length).toBeGreaterThan(1);
  });
});

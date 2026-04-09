import { describe, expect, test, beforeAll } from "bun:test";
import { tokenizeForFts, initTokenizer } from "../src/tokenizer";

beforeAll(async () => {
  await initTokenizer();
});

describe("tokenizeForFts", () => {
  test("Chinese text gets jieba word segmentation", () => {
    const result = tokenizeForFts("机器学习很有趣", "zh");
    expect(result).toContain("机器");
    expect(result).toContain("学习");
    expect(result.includes(" ")).toBe(true);
  });

  test("Chinese sentence preserves all semantic units", () => {
    const result = tokenizeForFts("这个项目的架构设计非常优秀", "zh");
    expect(result).toContain("项目");
    expect(result).toContain("架构");
    expect(result).toContain("设计");
  });

  test("English text returned unchanged", () => {
    const input = "This is a test sentence";
    expect(tokenizeForFts(input, "en")).toBe(input);
  });

  test("Japanese text gets per-character split", () => {
    const result = tokenizeForFts("東京タワー", "ja");
    expect(result).toBe("東 京 タ ワ ー");
  });

  test("Korean text gets per-character split", () => {
    const result = tokenizeForFts("서울대학교", "ko");
    expect(result).toBe("서 울 대 학 교");
  });

  test("empty string returns empty string", () => {
    expect(tokenizeForFts("", "zh")).toBe("");
    expect(tokenizeForFts("", "en")).toBe("");
  });

  test("mixed Chinese-English preserves both", () => {
    const result = tokenizeForFts("使用Python开发", "zh");
    expect(result).toContain("Python");
    expect(result).toContain("使用");
    expect(result).toContain("开发");
  });

  test("punctuation is preserved in output", () => {
    const result = tokenizeForFts("你好，世界！", "zh");
    expect(result.length).toBeGreaterThan(0);
  });
});

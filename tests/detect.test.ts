import { describe, expect, test } from "bun:test";
import { detectLanguage } from "../src/detect";

describe("detectLanguage", () => {
  test("pure Chinese text -> zh", () => {
    expect(detectLanguage("这个项目的架构设计非常优秀")).toBe("zh");
  });

  test("pure English text -> en", () => {
    expect(detectLanguage("This project has excellent architecture")).toBe("en");
  });

  test("pure Japanese with hiragana -> ja", () => {
    expect(detectLanguage("これはとても面白いプロジェクトです")).toBe("ja");
  });

  test("pure Korean -> ko", () => {
    expect(detectLanguage("이 프로젝트는 매우 훌륭합니다")).toBe("ko");
  });

  test("mixed Chinese-English -> zh (CJK dominant)", () => {
    expect(detectLanguage("使用 Python 开发的机器学习项目，基于 TensorFlow 框架")).toBe("zh");
  });

  test("mostly English with a few CJK -> en", () => {
    expect(detectLanguage("The project uses TensorFlow and contributed")).toBe("en");
  });

  test("Japanese with kanji (should not be detected as Chinese)", () => {
    expect(detectLanguage("東京タワーはとても高いです")).toBe("ja");
  });

  test("empty string -> en", () => {
    expect(detectLanguage("")).toBe("en");
  });

  test("numbers and punctuation only -> en", () => {
    expect(detectLanguage("123 456 !@#$%")).toBe("en");
  });

  test("emoji only -> en", () => {
    expect(detectLanguage("\u{1F389}\u{1F680}\u{1F4A1}")).toBe("en");
  });

  test("single CJK character -> zh", () => {
    expect(detectLanguage("好")).toBe("zh");
  });

  test("Thai text -> th", () => {
    expect(detectLanguage("สวัสดีครับ วันนี้อากาศดีมาก")).toBe("th");
  });

  test("Arabic text -> ar", () => {
    expect(detectLanguage("مرحبا بالعالم، هذا مشروع جديد")).toBe("ar");
  });

  test("Hindi/Devanagari text -> hi", () => {
    expect(detectLanguage("नमस्ते दुनिया, यह एक नया प्रोजेक्ट है")).toBe("hi");
  });

  test("Russian/Cyrillic text -> ru", () => {
    expect(detectLanguage("Привет мир, это новый проект")).toBe("ru");
  });

  test("mixed Thai-English -> th", () => {
    expect(detectLanguage("ใช้ Python สำหรับ Machine Learning")).toBe("th");
  });

  test("mixed Arabic-English -> ar", () => {
    expect(detectLanguage("استخدام Python في مشروع الذكاء الاصطناعي")).toBe("ar");
  });
});

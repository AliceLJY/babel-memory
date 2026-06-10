import { beforeAll, describe, expect, test } from "bun:test";
import { detectLanguageExtended, loadTinyld } from "../src/detect";

describe("detectLanguageExtended", () => {
  beforeAll(async () => {
    await loadTinyld();
  });

  test("Latin-script languages get refined beyond 'en' when tinyld present", () => {
    expect(detectLanguageExtended("Das ist ein wunderschöner Tag und wir gehen spazieren")).toBe("de");
    expect(detectLanguageExtended("Bonjour, comment allez-vous aujourd'hui mes amis")).toBe("fr");
    expect(detectLanguageExtended("El aprendizaje automático es muy interesante para todos")).toBe("es");
  });

  test("English still detected as en", () => {
    expect(detectLanguageExtended("The quick brown fox jumps over the lazy dog")).toBe("en");
  });

  test("non-Latin scripts bypass tinyld (script detection wins)", () => {
    expect(detectLanguageExtended("机器学习在自然语言处理中的应用")).toBe("zh");
    expect(detectLanguageExtended("東京タワーはとても高いです")).toBe("ja");
    expect(detectLanguageExtended("Машинное обучение очень интересно")).toBe("ru");
  });

  test("empty input returns en", () => {
    expect(detectLanguageExtended("")).toBe("en");
  });
});

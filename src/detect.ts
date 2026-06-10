export type Language = "zh" | "ja" | "ko" | "th" | "ar" | "hi" | "ru" | "en";

// Unicode ranges for script detection
const HIRAGANA_RE = /[぀-ゟ]/g;
const KATAKANA_RE = /[゠-ヿ]/g;
const HANGUL_RE = /[가-힯ᄀ-ᇿ㄰-㆏]/g;
const CJK_UNIFIED_RE = /[一-鿿㐀-䶿豈-﫿]/g;
const THAI_RE = /[฀-๿]/g;
const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿ]/g;
const DEVANAGARI_RE = /[ऀ-ॿ]/g;
const CYRILLIC_RE = /[Ѐ-ӿ]/g;
const LATIN_RE = /[A-Za-zÀ-ɏ]/g;

interface ScriptCounts {
  total: number;
  ja: number; // hiragana + katakana
  ko: number;
  cjk: number;
  th: number;
  ar: number;
  hi: number;
  ru: number;
  latin: number;
}

function countScripts(text: string): ScriptCounts {
  const stripped = text.replace(/[\s\p{P}\p{S}\d]/gu, "");
  return {
    total: stripped.length,
    ja:
      (text.match(HIRAGANA_RE) || []).length +
      (text.match(KATAKANA_RE) || []).length,
    ko: (text.match(HANGUL_RE) || []).length,
    cjk: (text.match(CJK_UNIFIED_RE) || []).length,
    th: (text.match(THAI_RE) || []).length,
    ar: (text.match(ARABIC_RE) || []).length,
    hi: (text.match(DEVANAGARI_RE) || []).length,
    ru: (text.match(CYRILLIC_RE) || []).length,
    latin: (text.match(LATIN_RE) || []).length,
  };
}

function primaryLanguage(c: ScriptCounts): Language {
  const total = c.total;
  if (total === 0) return "en";
  // Detection order: unique scripts first, most specific to least
  if (c.ja / total > 0.1) return "ja";
  if (c.ko / total > 0.1) return "ko";
  if (c.th / total > 0.1) return "th";
  if (c.ar / total > 0.1) return "ar";
  if (c.hi / total > 0.1) return "hi";
  if (c.ru / total > 0.1) return "ru";
  if (c.cjk / total > 0.15) return "zh";
  return "en";
}

export function detectLanguage(text: string): Language {
  if (!text || text.trim().length === 0) return "en";
  return primaryLanguage(countScripts(text));
}

// ── Optional tinyld upgrade for Latin-script languages ───────────────
// Script-ratio detection cannot tell German from French from English —
// they all share the Latin alphabet and land on "en". When the optional
// tinyld package is installed, detectLanguageExtended() refines those.
let tinyldDetect: ((text: string) => string) | null = null;
let tinyldWarned = false;

/** Diagnostic: whether the optional tinyld detector is loaded. */
export function isTinyldLoaded(): boolean {
  return tinyldDetect !== null;
}

/**
 * Load the optional tinyld language detector. Called by initTokenizer();
 * safe to call directly and idempotent. Returns true when available.
 */
export async function loadTinyld(): Promise<boolean> {
  if (tinyldDetect) return true;
  try {
    const mod = await import("tinyld");
    tinyldDetect = mod.detect;
    return true;
  } catch {
    if (!tinyldWarned) {
      tinyldWarned = true;
      console.warn(
        "[babel-memory] tinyld not available, Latin-script languages (de/fr/es/...) will detect as 'en'"
      );
    }
    return false;
  }
}

/**
 * Like detectLanguage, but refines Latin-script text into specific
 * language codes (de, fr, es, ...) when tinyld is installed. Non-Latin
 * scripts are resolved by Unicode analysis and never touch tinyld.
 * Without tinyld this behaves exactly like detectLanguage().
 *
 * Returns ISO 639-1 codes as plain strings — feed them straight into
 * tokenizeForFts(), which understands all Snowball codes.
 */
export function detectLanguageExtended(text: string): string {
  const base = detectLanguage(text);
  if (base !== "en" || !tinyldDetect) return base;
  try {
    const refined = tinyldDetect(text);
    return refined || "en";
  } catch {
    return "en";
  }
}

export interface LanguageDetail {
  /** Primary language, same value detectLanguage() returns */
  language: Language;
  /** Per-script character ratios (0-1), keys: ja, ko, cjk, th, ar, hi, ru, latin */
  scripts: Record<string, number>;
  /** True when a significant secondary script is present (e.g. CN/EN tech chat) */
  isMixed: boolean;
}

// Scripts that "belong" to a primary language and don't count as foreign.
// Japanese normally contains kanji (cjk); Korean may contain hanja.
const OWN_SCRIPTS: Record<Language, string[]> = {
  ja: ["ja", "cjk"],
  ko: ["ko", "cjk"],
  zh: ["cjk"],
  th: ["th"],
  ar: ["ar"],
  hi: ["hi"],
  ru: ["ru"],
  en: ["latin"],
};

const MIXED_THRESHOLD = 0.15;

/**
 * Like detectLanguage, but also reports per-script ratios and whether the
 * text significantly mixes scripts. Useful for AI conversation logs where
 * CN/EN (or JA/EN) mixing is the norm rather than the exception.
 */
export function detectLanguageDetailed(text: string): LanguageDetail {
  if (!text || text.trim().length === 0) {
    return { language: "en", scripts: {}, isMixed: false };
  }
  const c = countScripts(text);
  const language = primaryLanguage(c);
  const total = c.total || 1;
  const scripts: Record<string, number> = {
    ja: c.ja / total,
    ko: c.ko / total,
    cjk: c.cjk / total,
    th: c.th / total,
    ar: c.ar / total,
    hi: c.hi / total,
    ru: c.ru / total,
    latin: c.latin / total,
  };
  const own = new Set(OWN_SCRIPTS[language]);
  const isMixed = Object.entries(scripts).some(
    ([key, ratio]) => !own.has(key) && ratio >= MIXED_THRESHOLD
  );
  return { language, scripts, isMixed };
}

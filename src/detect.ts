export type Language = "zh" | "ja" | "ko" | "th" | "ar" | "hi" | "ru" | "en";

// Unicode ranges for script detection
const HIRAGANA_RE = /[\u3040-\u309F]/g;
const KATAKANA_RE = /[\u30A0-\u30FF]/g;
const HANGUL_RE = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g;
const CJK_UNIFIED_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g;
const THAI_RE = /[\u0E00-\u0E7F]/g;
const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g;
const DEVANAGARI_RE = /[\u0900-\u097F]/g;
const CYRILLIC_RE = /[\u0400-\u04FF]/g;

export function detectLanguage(text: string): Language {
  if (!text || text.trim().length === 0) return "en";

  const stripped = text.replace(/[\s\p{P}\p{S}\d]/gu, "");
  const total = stripped.length;
  if (total === 0) return "en";

  const hiraganaCount = (text.match(HIRAGANA_RE) || []).length;
  const katakanaCount = (text.match(KATAKANA_RE) || []).length;
  const hangulCount = (text.match(HANGUL_RE) || []).length;
  const cjkCount = (text.match(CJK_UNIFIED_RE) || []).length;
  const thaiCount = (text.match(THAI_RE) || []).length;
  const arabicCount = (text.match(ARABIC_RE) || []).length;
  const devanagariCount = (text.match(DEVANAGARI_RE) || []).length;
  const cyrillicCount = (text.match(CYRILLIC_RE) || []).length;

  const jaCount = hiraganaCount + katakanaCount;

  // Detection order: unique scripts first, most specific to least
  if (jaCount / total > 0.10) return "ja";
  if (hangulCount / total > 0.10) return "ko";
  if (thaiCount / total > 0.10) return "th";
  if (arabicCount / total > 0.10) return "ar";
  if (devanagariCount / total > 0.10) return "hi";
  if (cyrillicCount / total > 0.10) return "ru";
  if (cjkCount / total > 0.15) return "zh";

  return "en";
}

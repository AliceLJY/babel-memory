export type Language = "zh" | "ja" | "ko" | "en";

// Unicode ranges for CJK script detection
const HIRAGANA_RE = /[\u3040-\u309F]/g;
const KATAKANA_RE = /[\u30A0-\u30FF]/g;
const HANGUL_RE = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g;
const CJK_UNIFIED_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g;

export function detectLanguage(text: string): Language {
  if (!text || text.trim().length === 0) return "en";

  // Count only non-whitespace, non-punctuation, non-emoji characters as base
  const stripped = text.replace(/[\s\p{P}\p{S}\d]/gu, "");
  const total = stripped.length;
  if (total === 0) return "en";

  const hiraganaCount = (text.match(HIRAGANA_RE) || []).length;
  const katakanaCount = (text.match(KATAKANA_RE) || []).length;
  const hangulCount = (text.match(HANGUL_RE) || []).length;
  const cjkCount = (text.match(CJK_UNIFIED_RE) || []).length;

  const jaCount = hiraganaCount + katakanaCount;

  // Detection order: check language-unique scripts first
  // 1. Japanese: hiragana/katakana are unique to Japanese
  if (jaCount / total > 0.10) return "ja";

  // 2. Korean: hangul is unique to Korean
  if (hangulCount / total > 0.10) return "ko";

  // 3. Chinese: CJK ideographs without Japanese/Korean markers
  if (cjkCount / total > 0.15) return "zh";

  // 4. Default
  return "en";
}

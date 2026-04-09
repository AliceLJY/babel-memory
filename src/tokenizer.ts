import type { Language } from "./detect";

let jiebaReady = false;
let cutForSearch: ((text: string, hmm?: boolean | null) => string[]) | null = null;

/**
 * Initialize jieba-wasm. Call once at process start.
 * Safe to call multiple times (idempotent).
 */
export async function initTokenizer(): Promise<void> {
  if (jiebaReady) return;
  const jiebaModule = await import("jieba-wasm");
  cutForSearch = jiebaModule.cut_for_search;
  jiebaReady = true;
}

// CJK Unified Ideographs + Extension A + Compatibility
const CJK_CHAR_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/;
// Hiragana + Katakana
const JA_CHAR_RE = /[\u3040-\u309F\u30A0-\u30FF]/;
// Hangul
const KO_CHAR_RE = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;

/**
 * Pre-tokenize text for BM25 FTS indexing.
 * Chinese: jieba search-mode word segmentation.
 * Japanese/Korean: per-CJK-character split.
 * English: returned unchanged.
 */
export function tokenizeForFts(text: string, language: Language | string): string {
  if (!text) return "";

  switch (language) {
    case "zh":
      return tokenizeChinese(text);
    case "ja":
      return tokenizeCjkChars(text, JA_CHAR_RE, CJK_CHAR_RE);
    case "ko":
      return tokenizeCjkChars(text, KO_CHAR_RE, CJK_CHAR_RE);
    default:
      return text;
  }
}

function tokenizeChinese(text: string): string {
  if (!cutForSearch || !jiebaReady) {
    // Fallback: per-character split if jieba not initialized
    return tokenizeCjkChars(text, CJK_CHAR_RE);
  }
  // jieba cut_for_search produces overlapping terms for better recall
  const words: string[] = cutForSearch(text, true);
  return words.join(" ").replace(/\s+/g, " ").trim();
}

function tokenizeCjkChars(text: string, ...charPatterns: RegExp[]): string {
  const result: string[] = [];
  let latinBuffer = "";

  for (const char of text) {
    const isCjk = charPatterns.some((re) => re.test(char));
    if (isCjk) {
      if (latinBuffer.trim()) {
        result.push(latinBuffer.trim());
        latinBuffer = "";
      }
      result.push(char);
    } else {
      latinBuffer += char;
    }
  }
  if (latinBuffer.trim()) result.push(latinBuffer.trim());

  return result.join(" ");
}

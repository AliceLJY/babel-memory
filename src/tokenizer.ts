import type { Language } from "./detect";

// ── Lazy-loaded tokenizer state ──────────────────────────────────────
let jiebaReady = false;
let cutForSearch: ((text: string, hmm?: boolean | null) => string[]) | null =
  null;

let kuromojiTokenizer: { tokenize: (t: string) => { surface_form: string }[] } | null = null;
let kuromojiReady = false;

let wordcutReady = false;
let wordcutModule: { cut: (t: string) => string } | null = null;

type SnowballStemmer = { stem: (w: string) => string };
const snowballStemmers = new Map<string, SnowballStemmer>();
let snowballFactory: ((lang: string) => SnowballStemmer) | null = null;
let snowballAvailableAlgorithms: string[] | null = null;

// Track one-time warnings so we don't spam the console
const warnedPackages = new Set<string>();
function warnOnce(pkg: string, msg: string) {
  if (!warnedPackages.has(pkg)) {
    warnedPackages.add(pkg);
    console.warn(`[babel-memory] ${msg}`);
  }
}

// ── Snowball language mapping ────────────────────────────────────────
// Maps ISO 639-1 codes to Snowball algorithm names
const SNOWBALL_LANG_MAP: Record<string, string> = {
  ar: "arabic",
  da: "danish",
  de: "german",
  el: "greek", // not available in snowball-stemmers, will fallback
  es: "spanish",
  fi: "finnish",
  fr: "french",
  hu: "hungarian",
  it: "italian",
  nl: "dutch",
  no: "norwegian",
  pl: "polish", // not available in snowball-stemmers, will fallback
  pt: "portuguese",
  ro: "romanian",
  ru: "russian",
  sv: "swedish",
  tr: "turkish",
  cs: "czech",
};

// ── Unicode character ranges ─────────────────────────────────────────
const CJK_CHAR_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/;
const JA_CHAR_RE = /[\u3040-\u309F\u30A0-\u30FF]/;
const KO_CHAR_RE = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;

// ── Lazy loaders ─────────────────────────────────────────────────────

async function loadJieba(): Promise<boolean> {
  if (jiebaReady) return true;
  try {
    const mod = await import("jieba-wasm");
    cutForSearch = mod.cut_for_search;
    jiebaReady = true;
    return true;
  } catch {
    warnOnce("jieba-wasm", "jieba-wasm not available, Chinese will use character-level fallback");
    return false;
  }
}

async function loadKuromoji(): Promise<boolean> {
  if (kuromojiReady) return true;
  try {
    const mod = await import("@sglkc/kuromoji");
    const kuromoji = mod.default || mod;
    const path = await import("path");
    const dictPath = path.join(
      require.resolve("@sglkc/kuromoji"),
      "..",
      "..",
      "dict"
    );

    return new Promise<boolean>((resolve) => {
      kuromoji.builder({ dicPath: dictPath }).build(
        (err: Error | null, tokenizer: typeof kuromojiTokenizer) => {
          if (err || !tokenizer) {
            warnOnce("@sglkc/kuromoji", `kuromoji build failed: ${err?.message || "unknown error"}`);
            resolve(false);
            return;
          }
          kuromojiTokenizer = tokenizer;
          kuromojiReady = true;
          resolve(true);
        }
      );
    });
  } catch {
    warnOnce("@sglkc/kuromoji", "kuromoji not available, Japanese will use character-level fallback");
    return false;
  }
}

async function loadWordcut(): Promise<boolean> {
  if (wordcutReady) return true;
  try {
    // wordcut is CJS-only, use require
    const mod = require("wordcut");
    mod.init();
    wordcutModule = mod;
    wordcutReady = true;
    return true;
  } catch {
    warnOnce("wordcut", "wordcut not available, Thai will use character-level fallback");
    return false;
  }
}

async function loadSnowball(): Promise<boolean> {
  if (snowballFactory) return true;
  try {
    const mod = await import("snowball-stemmers");
    snowballFactory = mod.newStemmer;
    snowballAvailableAlgorithms = mod.algorithms();
    return true;
  } catch {
    warnOnce("snowball-stemmers", "snowball-stemmers not available, European languages will use passthrough");
    return false;
  }
}

function getSnowballStemmer(lang: string): SnowballStemmer | null {
  const algoName = SNOWBALL_LANG_MAP[lang];
  if (!algoName) return null;

  // Check cache
  const cached = snowballStemmers.get(algoName);
  if (cached) return cached;

  if (!snowballFactory) {
    // Try synchronous load as fallback
    try {
      const mod = require("snowball-stemmers");
      snowballFactory = mod.newStemmer;
      snowballAvailableAlgorithms = mod.algorithms();
    } catch {
      return null;
    }
  }

  // Check if algorithm is available
  if (snowballAvailableAlgorithms && !snowballAvailableAlgorithms.includes(algoName)) {
    return null;
  }

  try {
    const stemmer = snowballFactory!(algoName);
    snowballStemmers.set(algoName, stemmer);
    return stemmer;
  } catch {
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Initialize all available tokenizers in parallel.
 * Non-fatal if any fail -- each will fall back gracefully.
 * Safe to call multiple times (idempotent).
 */
export async function initTokenizer(): Promise<void> {
  await Promise.allSettled([
    loadJieba(),
    loadKuromoji(),
    loadWordcut(),
    loadSnowball(),
  ]);
}

/**
 * Pre-tokenize text for BM25 FTS indexing.
 *
 * Routes by language:
 * - zh: jieba search-mode word segmentation (fallback: char split)
 * - ja: kuromoji word segmentation (fallback: char split)
 * - ko: character-level CJK split
 * - th: wordcut segmentation (fallback: char split)
 * - Snowball languages: word-level stemming
 * - en / unknown: passthrough
 */
export function tokenizeForFts(text: string, language: Language | string): string {
  if (!text) return "";

  // Chinese
  if (language === "zh") {
    return tokenizeChinese(text);
  }

  // Japanese
  if (language === "ja") {
    return tokenizeJapanese(text);
  }

  // Korean
  if (language === "ko") {
    return tokenizeCjkChars(text, KO_CHAR_RE, CJK_CHAR_RE);
  }

  // Thai
  if (language === "th") {
    return tokenizeThai(text);
  }

  // Snowball-supported languages
  if (SNOWBALL_LANG_MAP[language]) {
    return tokenizeSnowball(text, language);
  }

  // English and unknown: passthrough
  return text;
}

// ── Internal tokenizers ──────────────────────────────────────────────

function tokenizeChinese(text: string): string {
  if (!cutForSearch || !jiebaReady) {
    return tokenizeCjkChars(text, CJK_CHAR_RE);
  }
  const words: string[] = cutForSearch(text, true);
  return words.join(" ").replace(/\s+/g, " ").trim();
}

function tokenizeJapanese(text: string): string {
  if (!kuromojiTokenizer || !kuromojiReady) {
    // Fallback: per-character split
    return tokenizeCjkChars(text, JA_CHAR_RE, CJK_CHAR_RE);
  }
  const tokens = kuromojiTokenizer.tokenize(text);
  return tokens
    .map((t) => t.surface_form)
    .filter((s) => s.trim().length > 0)
    .join(" ");
}

function tokenizeThai(text: string): string {
  if (!wordcutModule || !wordcutReady) {
    // Try synchronous require as a last resort
    try {
      const mod = require("wordcut");
      mod.init();
      wordcutModule = mod;
      wordcutReady = true;
    } catch {
      // Fallback: return as-is (Thai chars without tokenizer)
      return text;
    }
  }
  // wordcut returns pipe-separated string
  const result = wordcutModule!.cut(text);
  return result
    .split("|")
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0)
    .join(" ");
}

function tokenizeSnowball(text: string, lang: string): string {
  const stemmer = getSnowballStemmer(lang);
  if (!stemmer) {
    // Fallback: passthrough
    return text;
  }
  return text
    .split(/\s+/)
    .map((word) => {
      if (!word) return "";
      try {
        return stemmer.stem(word);
      } catch {
        return word;
      }
    })
    .filter((w) => w.length > 0)
    .join(" ");
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

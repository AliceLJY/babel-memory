import { describe, expect, test, beforeAll } from "bun:test";
import { tokenizeForFts, initTokenizer } from "../src/tokenizer";

// Index/query symmetry regression tests.
//
// FTS hit condition: every query-side token must appear among the
// document-side tokens produced by the SAME tokenizer path. README requires
// callers to invoke tokenizeForFts on both sides; these tests pin the library
// half of that contract — a refactor that breaks convergence fails loudly
// here instead of silently zeroing recall downstream (RecallNest fts_text).
//
// Case table adapted from deja-vu PR #338 (CJK bigram indexing, spec #337),
// which mirrors index/query emitters the same way. Which tier runs (jieba /
// Intl.Segmenter / char-level) depends on installed optional deps; the subset
// property below must hold on every tier, so the assertions are tier-agnostic.

beforeAll(async () => {
  await initTokenizer();
});

const tokens = (s: string, lang: string) =>
  tokenizeForFts(s, lang).split(" ").filter(Boolean);

function expectQueryHitsDoc(doc: string, query: string, lang: string) {
  const docSet = new Set(tokens(doc, lang));
  for (const t of tokens(query, lang)) {
    expect(docSet).toContain(t);
  }
}

describe("CJK index/query symmetry", () => {
  test("Chinese two-char query converges with document tokens", () => {
    expectQueryHitsDoc("刷新令牌怎么实现", "令牌", "zh");
  });

  test("Chinese multi-word query: every query token present in document", () => {
    expectQueryHitsDoc("刷新令牌怎么实现", "刷新令牌", "zh");
  });

  test("mixed CJK/ASCII document still hits ASCII query", () => {
    expectQueryHitsDoc("用 jwt 做 refresh", "jwt", "zh");
  });

  test("CJK run between ASCII neighbours is segmented, not glued", () => {
    const docSet = new Set(tokens("abc装订def", "zh"));
    // The CJK run must surface as its own token(s): no abc装/订def hybrids.
    for (const t of docSet) {
      const hasCJK = /[一-鿿]/.test(t);
      const hasAscii = /[a-z]/i.test(t);
      expect(hasCJK && hasAscii).toBe(false);
    }
    expectQueryHitsDoc("abc装订def", "装订", "zh");
  });

  test("Korean syllable-level split serves partial-match symmetry", () => {
    // Syllable split is a deliberate design choice (agglutinative language,
    // word-level tokens would break BM25 partial matching) — pin the payoff:
    // a two-syllable query converges with a five-syllable document.
    expectQueryHitsDoc("서울대학교", "서울", "ko");
  });

  test("Japanese query token converges with document tokens", () => {
    expectQueryHitsDoc("東京タワーに行く", "東京", "ja");
  });

  test("tokenization is deterministic (same input, same output)", () => {
    const once = tokenizeForFts("刷新令牌怎么实现", "zh");
    const twice = tokenizeForFts("刷新令牌怎么实现", "zh");
    expect(once).toBe(twice);
  });
});

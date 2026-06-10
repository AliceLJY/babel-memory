// Minimal high-frequency stopword sets for FTS noise reduction.
// Opt-in via tokenizeForFts(text, lang, { removeStopwords: true }).
// Kept deliberately small: BM25's IDF already down-weights common terms,
// so these lists only strip the highest-frequency function words.
// Korean is intentionally absent — its tokens are syllables here, and
// filtering particle syllables would also delete content syllables.

const STOPWORDS_EN = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at",
  "is", "are", "was", "were", "be", "been", "being", "am",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
  "this", "that", "these", "those", "there", "here",
  "with", "as", "for", "from", "by", "about", "into", "over", "after",
  "not", "no", "nor", "so", "if", "then", "than", "too", "very",
  "can", "will", "just", "do", "does", "did", "have", "has", "had",
  "its", "their", "his", "my", "your", "our",
]);

const STOPWORDS_ZH = new Set([
  "的", "了", "是", "在", "和", "有", "我", "你", "他", "她", "它",
  "们", "这", "那", "就", "都", "而", "及", "与", "或", "也", "很",
  "到", "说", "要", "去", "会", "着", "看", "好", "之", "为", "于",
  "上", "下", "不", "没", "没有", "一个", "我们", "你们", "他们",
  "自己", "什么", "怎么", "这个", "那个", "但是", "因为", "所以",
  "如果", "就是", "还是", "可以", "已经",
]);

const STOPWORDS_JA = new Set([
  "の", "に", "は", "を", "た", "が", "で", "て", "と", "し", "れ",
  "さ", "ある", "いる", "する", "です", "ます", "から", "まで",
  "など", "か", "も", "や", "よ", "ね", "な", "へ", "だ", "これ",
  "それ", "あれ", "この", "その", "あの", "ので", "けど", "でも",
]);

const STOPWORD_TABLES: Record<string, Set<string>> = {
  en: STOPWORDS_EN,
  zh: STOPWORDS_ZH,
  ja: STOPWORDS_JA,
};

export function getStopwords(lang: string): Set<string> | null {
  return STOPWORD_TABLES[lang] ?? null;
}

export interface KgPrompt {
  system: string;
  userTemplate: string;
}

const KG_SYSTEM_EN = `You are a knowledge graph extraction assistant. Extract (subject, predicate, object, confidence) tuples from text. Respond with valid JSON only.`;

const KG_USER_EN = `Extract knowledge graph triples from the following text.

Rules:
- Use simple predicates: uses, created_by, works_at, works_with, is_a, part_of, has, located_in, belongs_to, depends_on, implements, extends, related_to, caused_by, results_in, precedes, follows
- confidence must be EXACTLY one of these five values (models collapse continuous ranges — pick the one matching the evidence):
  1.0  = stated explicitly in the text
  0.85 = strong inference (clearly implied, never stated)
  0.75 = reasonable inference (requires interpretation)
  0.65 = weak inference (thematic association only)
  0.55 = speculative (surface co-occurrence)
  Never use 0.5 or any value outside this list. If unsure between two tiers, pick the lower.
- Extract 3-8 triples
- Return JSON: { "triples": [{ "subject": "", "predicate": "", "object": "", "confidence": 0.0 }] }

Examples:
Input: "Python is a programming language created by Guido van Rossum"
Output: { "triples": [{"subject":"Python","predicate":"is_a","object":"programming language","confidence":1.0},{"subject":"Python","predicate":"created_by","object":"Guido van Rossum","confidence":1.0}] }

Text to extract from:
{text}`;

const KG_SYSTEM_CJK = `你是知识图谱提取助手。从文本中提取 (主体, 谓词, 客体, 置信度) 四元组。仅返回有效 JSON。`;

const KG_USER_CJK = `从以下文本中提取知识图谱三元组。

规则：
- 使用简单谓词（保持英文作为规范化 key）: uses, created_by, works_at, works_with, is_a, part_of, has, located_in, belongs_to, depends_on, implements, extends, related_to, caused_by, results_in, precedes, follows
- 置信度必须从以下五档中精确取值（模型对连续区间会坍缩取中，请按证据强度选档）：
  1.0  = 文中明确陈述
  0.85 = 强推断（明显暗示但未明说）
  0.75 = 合理推断（需要解读）
  0.65 = 弱推断（仅主题关联）
  0.55 = 投机性（仅表面共现）
  禁止使用 0.5 或列表之外的任何值。两档之间拿不准时取较低档。
- 提取 3-8 个三元组
- 返回 JSON: { "triples": [{ "subject": "", "predicate": "", "object": "", "confidence": 0.0 }] }

示例：
输入: "Python 是由 Guido van Rossum 创建的编程语言"
输出: { "triples": [{"subject":"Python","predicate":"is_a","object":"编程语言","confidence":1.0},{"subject":"Python","predicate":"created_by","object":"Guido van Rossum","confidence":1.0}] }

输入: "RecallNest 是基于 LanceDB 构建的 AI 记忆系统"
输出: { "triples": [{"subject":"RecallNest","predicate":"uses","object":"LanceDB","confidence":1.0},{"subject":"RecallNest","predicate":"is_a","object":"AI 记忆系统","confidence":1.0}] }

需要提取的文本：
{text}`;

const KG_SYSTEM_JA = `あなたはナレッジグラフ抽出アシスタントです。テキストから (主語, 述語, 目的語, 信頼度) のタプルを抽出します。有効な JSON のみを返してください。`;

const KG_USER_JA = `以下のテキストからナレッジグラフのトリプルを抽出してください。

ルール：
- シンプルな述語を使用（正規化キーとして英語を維持）: uses, created_by, works_at, works_with, is_a, part_of, has, located_in, belongs_to, depends_on, implements, extends, related_to, caused_by, results_in, precedes, follows
- 信頼度は必ず次の 5 段階から正確に選ぶ（連続値はモデルが中央に収束するため、証拠の強さで段階を選ぶ）：
  1.0  = テキストに明示的に記載
  0.85 = 強い推論（明らかに示唆されるが明言なし）
  0.75 = 妥当な推論（解釈が必要）
  0.65 = 弱い推論（テーマ上の関連のみ）
  0.55 = 推測的（表面的な共起のみ）
  0.5 やリスト外の値は禁止。二つの段階で迷ったら低い方を選ぶ。
- 3-8 個のトリプルを抽出
- JSON を返す: { "triples": [{ "subject": "", "predicate": "", "object": "", "confidence": 0.0 }] }

例：
入力: "Python は Guido van Rossum によって作られたプログラミング言語です"
出力: { "triples": [{"subject":"Python","predicate":"is_a","object":"プログラミング言語","confidence":1.0},{"subject":"Python","predicate":"created_by","object":"Guido van Rossum","confidence":1.0}] }

抽出対象のテキスト：
{text}`;

/**
 * Prompt language matches content language: zh → Chinese, ja → Japanese.
 * Korean falls back to English — instructions in a third language (the
 * old behavior handed Korean users a Chinese prompt) hurt extraction.
 */
export function getKgPrompt(lang: string): KgPrompt {
  if (lang === "zh") {
    return { system: KG_SYSTEM_CJK, userTemplate: KG_USER_CJK };
  }
  if (lang === "ja") {
    return { system: KG_SYSTEM_JA, userTemplate: KG_USER_JA };
  }
  return { system: KG_SYSTEM_EN, userTemplate: KG_USER_EN };
}

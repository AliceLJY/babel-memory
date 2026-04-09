import { describe, expect, test } from "bun:test";
import { getKgPrompt } from "../src/prompts/kg-extraction";
import { getSessionPrompt } from "../src/prompts/session-summary";

describe("getKgPrompt", () => {
  test("zh returns Chinese system prompt", () => {
    const { system } = getKgPrompt("zh");
    expect(system).toContain("知识图谱");
  });

  test("en returns English system prompt", () => {
    const { system } = getKgPrompt("en");
    expect(system).toContain("knowledge graph");
  });

  test("ja routes to CJK variant", () => {
    const { system } = getKgPrompt("ja");
    expect(system).toContain("知识图谱");
  });

  test("ko routes to CJK variant", () => {
    const { system } = getKgPrompt("ko");
    expect(system).toContain("知识图谱");
  });

  test("CJK variant includes Chinese few-shot examples", () => {
    const { userTemplate } = getKgPrompt("zh");
    expect(userTemplate).toContain("works_at");
  });

  test("predicates stay English in CJK variant", () => {
    const { userTemplate } = getKgPrompt("zh");
    expect(userTemplate).toContain("uses");
    expect(userTemplate).toContain("created_by");
  });
});

describe("getSessionPrompt", () => {
  test("zh returns Chinese dimension labels", () => {
    const { system, dimensionLabels } = getSessionPrompt("zh");
    expect(system).toContain("会话总结");
    expect(dimensionLabels.user_intent).toContain("用户意图");
  });

  test("en returns English dimension labels", () => {
    const { system, dimensionLabels } = getSessionPrompt("en");
    expect(system).toContain("session summarizer");
    expect(dimensionLabels.user_intent).toContain("User intent");
  });

  test("all 9 dimensions present", () => {
    const { dimensionLabels } = getSessionPrompt("en");
    const keys = Object.keys(dimensionLabels);
    expect(keys).toContain("user_intent");
    expect(keys).toContain("technical_concepts");
    expect(keys).toContain("files_and_code");
    expect(keys).toContain("errors_and_fixes");
    expect(keys).toContain("problem_solving");
    expect(keys).toContain("user_quotes");
    expect(keys).toContain("unfinished_tasks");
    expect(keys).toContain("current_state");
    expect(keys).toContain("next_steps");
    expect(keys.length).toBe(9);
  });
});

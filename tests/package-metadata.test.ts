import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const packageMetadata = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
) as {
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

describe("package metadata", () => {
  test("keeps wordcut explicit instead of installing it for every consumer", () => {
    expect(packageMetadata.optionalDependencies?.wordcut).toBeUndefined();
    expect(packageMetadata.devDependencies?.wordcut).toBe("^0.9.1");
  });
});

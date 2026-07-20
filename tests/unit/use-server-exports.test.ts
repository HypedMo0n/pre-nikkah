import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import ts from "typescript";


function findFeatureSourceFiles(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((entry) => {
      const path = `${directory}/${entry}`;
      if (statSync(path).isDirectory()) return findFeatureSourceFiles(path);
      return /\.(ts|tsx)$/.test(path) ? [path] : [];
    });
}

function exportedRuntimeDeclarations(source: ts.SourceFile) {
  return source.statements.filter((statement) => {
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    const isExported = modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
    if (!isExported) return false;
    if (ts.isFunctionDeclaration(statement)) {
      return !modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword);
    }
    return true;
  });
}

describe('"use server" exports', () => {
  it("exports only async functions and imports no Zod runtime", () => {
    const offenders = findFeatureSourceFiles("features")
      .filter((filePath) => readFileSync(filePath, "utf8").includes('"use server"'))
      .flatMap((filePath) => {
        const text = readFileSync(filePath, "utf8");
        const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        const exportOffenders = exportedRuntimeDeclarations(source).map((statement) => `${filePath}:${source.getLineAndCharacterOfPosition(statement.getStart(source)).line + 1}`);
        const zodOffenders = text.includes('from "zod"') ? [`${filePath}:zod-import`] : [];
        return [...exportOffenders, ...zodOffenders];
      });

    expect(offenders).toEqual([]);
  });
});

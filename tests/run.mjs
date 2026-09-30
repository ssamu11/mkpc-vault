import ts from "typescript";
import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
const out = path.resolve(".test-build");
try {
  for (const file of [
    "lib/types.ts",
    "lib/catalog.ts",
    "lib/pocapop.ts",
    "lib/request-origin.ts",
    "lib/workbook.ts",
    "lib/pack-import.ts",
    "lib/planner.ts",
    "lib/planner-curation.ts",
    "lib/planner-discovery.ts",
    "tests/catalog.test.ts",
    "tests/database.test.ts",
    "tests/pocapop.test.ts",
    "tests/request-origin.test.ts",
    "tests/planner-import.test.ts",
    "tests/planner-discovery.test.ts",
  ]) {
    const source = await readFile(file, "utf8");
    const js = ts
      .transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ES2022,
        },
      })
      .outputText.replace(
        /from (['"])(\.[^'"]+)\1/g,
        (_, quote, name) => `from ${quote}${name}.js${quote}`,
      );
    const target = path.join(out, file.replace(/\.ts$/, ".js"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, js);
  }
  await writeFile(path.join(out, "package.json"), ' {"type":"module"}');
  const result = spawnSync(
    process.execPath,
    [
      "--test",
      path.join(out, "tests/catalog.test.js"),
      path.join(out, "tests/database.test.js"),
      path.join(out, "tests/pocapop.test.js"),
      path.join(out, "tests/request-origin.test.js"),
      path.join(out, "tests/planner-import.test.js"),
      path.join(out, "tests/planner-discovery.test.js"),
    ],
    { stdio: "inherit" },
  );
  process.exitCode = result.status ?? 1;
} finally {
  await rm(out, { recursive: true, force: true });
}

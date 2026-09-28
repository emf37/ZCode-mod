#!/usr/bin/env node
/**
 * 迁移基线断言。
 *
 * 背景：迁移 checksum 直接哈希源码文本（schema 模板字面量与 SQL 语句）。
 * 如果检出把 .ts 转成 CRLF，构建产物算出的 checksum 就会与已有数据库账本里的值
 * 不一致，启动时报不可重试的 `Task database migration checksum mismatch`，
 * 已有数据无法打开且界面无法恢复。
 *
 * .gitattributes 已把文本固定为 LF；这个脚本同时断言两件事，防止规则被改回去
 * 或迁移文本被误改：
 *   1. 迁移相关目录在**当前检出**里全部是 LF
 *   2. 可从源码直接求值的迁移，其 checksum 命中已有数据库记录的值
 *
 * 只断言无插值的迁移：含 `${}` 的迁需要真实求值才能算出最终 SQL，
 * 那部分由 `pnpm typecheck` 与构建流程覆盖，这里不重复实现。
 *
 * 用法：node scripts/ci/assert-migration-baseline.mjs [仓库根]
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? process.cwd());

/** 迁移相关目录：任一文件在检出里不是 LF 就直接失败。 */
const MIGRATION_DIRS = [
  "packages/services/src/session/tasksDatabase/",
  "apps/zcode-cli/packages/adapters/src/storage/session-store/",
];

/** 已有数据库账本里记录的值（闭源发行版写入）。改这些值等于让所有现有用户的数据打不开。 */
const EXPECTED = [
  {
    label: "桌面 tasks-index / 0002_provider_selection",
    file: "packages/services/src/session/tasksDatabase/migrations.ts",
    // checksumInput: ["legacy-automation-selection-v1", "no-provider-for-legacy-off-peak-v1"]
    // 纯字符串字面量、不含换行，因此对 CRLF 免疫——用作对照组。
    kind: "literal-array",
    anchor: "0002_provider_selection",
    sha256: "7244ef7c351f8d02750ab1953fff09f493a71befbf1b6e2d4bab726b0c6b48fc",
  },
  {
    label: "桌面 tasks-index / 0003_official_glm_selection",
    file: "packages/services/src/session/tasksDatabase/official-glm-selection-v3.ts",
    kind: "first-template",
    sha256: "8987adb50ae412a46c294141c1af89ccfc252f22d41351bdf4c7528f56edc8b4",
  },
  {
    label: "agent db / 0001_base_session_store",
    file: "apps/zcode-cli/packages/adapters/src/storage/session-store/migrations.ts",
    kind: "template-for-id",
    anchor: "0001_base_session_store",
    sha256: "60e2d6a38ab36f31417c4f92c02690c96c7dcaaa0b6abe1741117d62a55c6462",
  },
  {
    label: "agent db / 0021_official_glm_selection",
    file: "apps/zcode-cli/packages/adapters/src/storage/session-store/migrations/0021-official-glm-selection.ts",
    kind: "export-template",
    anchor: "OFFICIAL_GLM_SELECTION_MIGRATION_SQL",
    sha256: "433a8da454682406e962b043f2e0f412e9801bf7e4641ff25760aa16625ebafe",
  },
];

const failures = [];

// ---- 1. 检出必须是 LF ----
let eolOutput = "";
try {
  eolOutput = execFileSync("git", ["ls-files", "--eol", ...MIGRATION_DIRS], {
    cwd: root,
    encoding: "utf8",
  });
} catch (error) {
  failures.push(`无法读取 git 换行符状态（是否在 git 仓库内？）：${error.message}`);
}

const notLf = eolOutput
  .split("\n")
  .filter((line) => line.trim().length > 0)
  .filter((line) => line.split(/\s+/)[1] !== "w/lf");

if (notLf.length > 0) {
  failures.push(
    `迁移相关源码在检出里不是 LF（${notLf.length} 个文件）。` +
      `.gitattributes 的 * text=auto eol=lf 应保证这一点；` +
      `已有工作区需 \`git add --renormalize .\` 或重新克隆。\n` +
      notLf.map((line) => `      ${line}`).join("\n"),
  );
}

// ---- 2. 可从源码求值的迁移必须命中账本值 ----
const sha256OfJsonArray = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sha256OfTrimmed = (value) => createHash("sha256").update(value.trim()).digest("hex");

function extractSql(spec) {
  const source = readFileSync(join(root, spec.file), "utf8");

  if (spec.kind === "literal-array") {
    const at = source.indexOf(spec.anchor);
    const match = source.slice(at).match(/checksumInput:\s*\[([^\]]+)\]/);
    if (!match) throw new Error(`未能在 ${spec.file} 中找到 ${spec.anchor} 的 checksumInput`);
    return { sql: null, literals: [...match[1].matchAll(/"([^"]*)"/g)].map((m) => m[1]) };
  }

  let from = 0;
  if (spec.kind === "template-for-id") {
    from = source.indexOf(`"${spec.anchor}"`);
    if (from < 0) throw new Error(`未能在 ${spec.file} 中找到迁移 ${spec.anchor}`);
  } else if (spec.kind === "export-template") {
    from = source.indexOf(`export const ${spec.anchor} = \``);
    if (from < 0) throw new Error(`未能在 ${spec.file} 中找到导出 ${spec.anchor}`);
  }

  const open = source.indexOf("`", from);
  const close = source.indexOf("`", open + 1);
  if (open < 0 || close < 0) throw new Error(`未能提取 ${spec.label} 的模板字面量`);
  return { sql: source.slice(open + 1, close), literals: null };
}

for (const spec of EXPECTED) {
  try {
    const { sql, literals } = extractSql(spec);
    const actual =
      literals !== null
        ? sha256OfJsonArray(literals)
        : spec.kind === "first-template"
          ? sha256OfJsonArray([sql])
          : sha256OfTrimmed(sql);
    if (sql !== null && /(^|[^\\])\$\{/.test(sql)) {
      failures.push(`${spec.label}：提取到的 SQL 含 \${} 插值，无法直接求值，请把该断言改为真实求值`);
    } else if (actual !== spec.sha256) {
      failures.push(
        `${spec.label}：checksum 与已有数据库不符\n` +
          `      期望 ${spec.sha256}\n      实际 ${actual}`,
      );
    } else {
      console.log(`  ok  ${spec.label}`);
    }
  } catch (error) {
    failures.push(`${spec.label}：${error.message}`);
  }
}

if (failures.length > 0) {
  console.error("\n迁移基线断言失败：\n");
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    "\n这些值一旦变化，已装用户的数据库会以不可重试的 checksum mismatch 拒绝启动。\n",
  );
  process.exit(1);
}

console.log("\n迁移基线断言通过：检出为 LF，checksum 命中已有数据库记录。\n");

// 本包以预构建形式随发行包分发：只有 dist/，没有 TypeScript 源码（src/ 未随本仓库开源）。
// 因此构建步骤不再重新打包 MCP server，而是校验预构建产物确实存在——沿用
// zcode-cua-plugin/scripts/check-sdk.mjs 的做法：把"产物缺失"变成显式失败，
// 而不是让 seed 装出一个没有 server.js 的残缺插件。
import { access } from "node:fs/promises";
import { resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");
await access(resolve(packageRoot, "dist", "mcp", "server.js"));

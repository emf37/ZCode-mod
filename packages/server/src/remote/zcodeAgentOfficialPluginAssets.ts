import { posix } from "node:path";

export const REMOTE_AGENT_OFFICIAL_PLUGIN_DIR_NAME = "packages";

export const REMOTE_AGENT_OFFICIAL_PLUGIN_PACKAGE_NAMES = [
  "browser-use-plugin",
  // 随包分发的预构建内容型插件。与 prepare-prebuilds.mjs 的远端 staging 清单、
  // packages/desktop/scripts/prepare-agent-node-bundle.mjs 的桌面 seed 清单保持一致：
  // 远端 staging 会把这些目录一起上传，本清单据此断言它们确实到位。
  // 注意 docx/pdf/pptx/xlsx 技能的 LICENSE.txt 为 Z.ai 专有非商用许可。
  "android-emulator-plugin",
  "ios-simulator-plugin",
  "documents-plugin",
  "pdf-plugin",
  "presentations-plugin",
  "spreadsheets-plugin",
  "image-search-plugin",
  "plugin-creator-plugin",
  "skill-creator-plugin",
  "restore-legacy-sessions-plugin",
  "zcode-cua-plugin",
] as const;

export const REMOTE_AGENT_OFFICIAL_PLUGIN_INCLUDED_TOP_LEVEL_PATHS = [
  ".mcp.json",
  ".zcode-plugin",
  "README.md",
  // 开发态远程插件复制使用独立白名单，遗漏 agents 会只在远端丢失子代理。
  "agents",
  "commands",
  "dist",
  "docs",
  "hooks",
  "output-styles",
  "package.json",
  // Browser bootstrap 会从插件根目录动态导入 scripts/browser-client.mjs。
  // 开发态 SSH 部署若漏掉 scripts，会出现 MCP server 已启动但浏览器绑定无法初始化的半成品状态。
  "scripts",
  "skills",
  "templates",
] as const;

export const REMOTE_AGENT_OFFICIAL_PLUGIN_REQUIRED_RELATIVE_PATHS = [
  ...REMOTE_AGENT_OFFICIAL_PLUGIN_PACKAGE_NAMES.map(
    (packageName) => `${packageName}/.zcode-plugin/plugin.json`,
  ),
  // 只校验 Browser Use manifest 会把“有插件壳”的残缺目录
  // 误判为可复用。生产 remote、开发态 remote 与 release source 校验共用这份必需资产合同。
  //
  // 这里只能列 browser-use **自己产出**的资产。node_repl 宿主抽成 @zcode/node-repl-host 后
  // browser-use 不再产出 dist/mcp/server.js；
  // 本清单里指向不存在的文件，会让远端资产校验对着幽灵路径报缺失。
  // 远程工作区当前不承载 Browser Use / Computer Use，因此宿主 runtime 不进这份远端合同——
  // 要支持远程 bua/cua 时，应把 node-repl-host 补进上面的 PACKAGE_NAMES 并在此声明它的
  // dist/mcp/server.js，而不是把宿主产物挂回 browser-use 名下。
  "browser-use-plugin/docs/api.json",
  "browser-use-plugin/docs/documents.json",
  "browser-use-plugin/docs/overview.md",
  // 远端缓存若缺少 recording 正文，documents.json 仍会错误宣告该 lookup 可用。
  "browser-use-plugin/docs/recording.md",
  "browser-use-plugin/docs/workflow.md",
  "browser-use-plugin/scripts/browser-client.mjs",
  "browser-use-plugin/skills/control-browser/SKILL.md",
  "browser-use-plugin/skills/web-gui-tester/SKILL.md",
  // 仅校验 manifest 无法发现文档插件缺少技能正文或视觉评审 Agent。
  //
  // 同理，随包分发的预构建插件也要钉住主技能正文：只校验 manifest 会放过
  // "有插件壳、无技能正文" 的残缺目录，症状是远端 /skill 列表静默少项。
  "android-emulator-plugin/skills/android-dev/SKILL.md",
  "ios-simulator-plugin/skills/ios-dev/SKILL.md",
  "documents-plugin/skills/docx/SKILL.md",
  "pdf-plugin/skills/pdf/SKILL.md",
  "presentations-plugin/skills/pptx/SKILL.md",
  "spreadsheets-plugin/skills/xlsx/SKILL.md",
  "plugin-creator-plugin/skills/plugin-creator/SKILL.md",
  "skill-creator-plugin/skills/skill-creator/SKILL.md",
  "restore-legacy-sessions-plugin/skills/restore-legacy-sessions/SKILL.md",
  "zcode-cua-plugin/skills/computer-use/SKILL.md",
  // 文档技能还带一个视觉评审子代理，缺失时技能可用但产出无法评审。
  "documents-plugin/agents/visual-judge.md",
  "pdf-plugin/agents/visual-judge.md",
  "presentations-plugin/agents/visual-judge.md",
  "spreadsheets-plugin/agents/visual-judge.md",
] as const;

export function buildRemoteAgentOfficialPluginDir(remoteProviderDir: string): string {
  return posix.join(remoteProviderDir, REMOTE_AGENT_OFFICIAL_PLUGIN_DIR_NAME);
}

export function buildRemoteAgentOfficialPluginSourceRelativePath(params: {
  runtimeResourceDir: string;
  platformArch: string;
}): string {
  return posix.join(
    params.runtimeResourceDir,
    params.platformArch,
    REMOTE_AGENT_OFFICIAL_PLUGIN_DIR_NAME,
  );
}

export function buildRemoteAgentOfficialPluginRequiredPaths(remoteProviderDir: string): string[] {
  const remoteOfficialPluginDir = buildRemoteAgentOfficialPluginDir(remoteProviderDir);
  return REMOTE_AGENT_OFFICIAL_PLUGIN_REQUIRED_RELATIVE_PATHS.map((relativePath) =>
    posix.join(remoteOfficialPluginDir, relativePath),
  );
}

/**
 * 构建期开关：为真时安装包使用 Preview 身份，而后端环境仍由 `ZCODE_ENV` 单独决定。
 * 典型用法是 `ZCODE_ENV=production ZCODE_PREVIEW_IDENTITY=1`，得到一个连接生产后端、
 * 可与正式版并排安装的 `ZCode Preview`。
 */
export const ZCODE_PREVIEW_IDENTITY_ENV = "ZCODE_PREVIEW_IDENTITY";
/** 与 preview 同一套语义：只有 `1` 开启，`0` / 空关闭，其它拼写直接失败。 */
export const ZCODE_MOD_IDENTITY_ENV = "ZCODE_MOD_IDENTITY";

const PRODUCTION_IDENTITY = Object.freeze({
  flavor: "production",
  appId: "dev.zcode.app",
  productName: "ZCode",
  linuxExecutableName: "zcode",
  linuxPackageName: "zcode",
  cuaHelperInstallVariant: null,
});

const PREVIEW_IDENTITY = Object.freeze({
  flavor: "preview",
  appId: "dev.zcode.app.preview",
  productName: "ZCode Preview",
  linuxExecutableName: "zcode-preview",
  linuxPackageName: "zcode-preview",
  cuaHelperInstallVariant: "preview",
});

/**
 * 改装版身份：与正式版并排安装用。
 *
 * app id 决定 NSIS 卸载注册表项（electron-builder 由 appId 派生 guid）、快捷方式 AUMID
 * 与 Electron 数据目录；productName 决定默认安装目录、开始菜单项与产物文件名。
 * 三者都不同于正式版，才能做到「装了改装包不影响正式版，反之亦然」。
 *
 * 唯一的例外是 URL scheme：OAuth 回调是官网中转页透传到 `zcode://oauth/callback`，
 * scheme 不能按身份改（改了登录链路就断），所以两个身份仍会争同一个协议处理器，
 * 最后安装的那个成为默认 handler。
 */
const MOD_IDENTITY = Object.freeze({
  flavor: "mod",
  appId: "dev.zcode.app.mod",
  productName: "ZCode Mod",
  linuxExecutableName: "zcode-mod",
  linuxPackageName: "zcode-mod",
  cuaHelperInstallVariant: "mod",
});

export const desktopProductIdentities = Object.freeze({
  production: PRODUCTION_IDENTITY,
  preview: PREVIEW_IDENTITY,
  mod: MOD_IDENTITY,
});

function normalizeDesktopZCodeEnv(env) {
  return env.ZCODE_ENV?.trim().toLowerCase() === "production" ? "production" : "test";
}

/**
 * 开关只有一种开启拼写 `1`（`0` / 空 = 关闭），与 CI workflow 规则和 release 门的
 * `$ZCODE_PREVIEW_IDENTITY == "1"` 精确比较保持同一套语义。其它拼写在构建期直接失败，
 * 避免 `true` 之类在 YAML 路由层漏匹配、却在脚本层被当成开启，把 Preview 包打进生产验收目录。
 */
export function isModIdentityRequested(env = process.env) {
  const value = env[ZCODE_MOD_IDENTITY_ENV]?.trim() ?? "";
  if (value === "1") {
    return true;
  }
  if (value === "" || value === "0") {
    return false;
  }
  throw new Error(
    `invalid ${ZCODE_MOD_IDENTITY_ENV}=${env[ZCODE_MOD_IDENTITY_ENV]}; expected 1 or 0`,
  );
}

export function isPreviewIdentityRequested(env = process.env) {
  const value = env[ZCODE_PREVIEW_IDENTITY_ENV]?.trim() ?? "";
  if (value === "1") {
    return true;
  }
  if (value === "" || value === "0") {
    return false;
  }
  throw new Error(
    `invalid ${ZCODE_PREVIEW_IDENTITY_ENV}=${env[ZCODE_PREVIEW_IDENTITY_ENV]}; expected 1 or 0`,
  );
}

/**
 * 产品身份（flavor）与后端环境（`ZCODE_ENV`）是两个轴：
 * - `ZCODE_ENV=test` 一律是 Preview，测试后端不能顶着正式 `ZCode` 身份覆盖用户的正式安装；
 * - `ZCODE_ENV=production` 默认是正式身份，显式 `ZCODE_PREVIEW_IDENTITY=1` 时改用 Preview 身份。
 * 未知 `ZCODE_ENV` 继续按 test 处理，和共享层 normalizeZCodeEnv 的 fail-safe 默认值一致。
 */
export function resolveDesktopProductFlavor(env = process.env) {
  const preview = isPreviewIdentityRequested(env);
  const mod = isModIdentityRequested(env);
  // 两个开关同时给会让身份变得不可预测，直接拒绝而不是悄悄取其一。
  if (preview && mod) {
    throw new Error(
      `set only one of ${ZCODE_PREVIEW_IDENTITY_ENV} / ${ZCODE_MOD_IDENTITY_ENV}`,
    );
  }
  if (mod) {
    return "mod";
  }
  if (preview) {
    return "preview";
  }
  return normalizeDesktopZCodeEnv(env) === "production" ? "production" : "preview";
}

export function resolveDesktopProductIdentity(env = process.env) {
  return desktopProductIdentities[resolveDesktopProductFlavor(env)];
}

/**
 * 产物文件名后缀标记的是后端环境而不是身份：`_TEST` 只出现在测试后端的安装包上。
 * 生产后端的 Preview 包靠 productName（`ZCode Preview-<version>-...`）与正式包区分。
 */
export function resolveDesktopArtifactSuffix(env = process.env) {
  return normalizeDesktopZCodeEnv(env) === "test" ? "_TEST" : "";
}

/**
 * 返回 Windows Shell 使用的 AppUserModelId。
 *
 * 打包态必须复用 electron-builder 的 appId，否则快捷方式里的 AUMID、开始菜单索引
 * 和运行中的 Electron 进程会被 Windows 视为三个不同的应用。开发态继续保留旧身份，
 * 避免本地调试快捷方式和正式/Preview 安装包互相污染。
 */
export function resolveWindowsAppUserModelIdForFlavor(flavor, runtime = { isPackaged: true }) {
  if (runtime.isPackaged === false) {
    return "cn.aminer.zcode";
  }
  // 原来是 preview / 其余的二元判断：新增 mod 后必须按 flavor 直接查表，否则 mod 会拿到
  // production 的 appId，与正式版共用任务栏身份、通知归属和开始菜单索引。
  return (desktopProductIdentities[flavor] ?? desktopProductIdentities.production).appId;
}

export function resolveWindowsAppUserModelId(env = process.env, runtime = { isPackaged: true }) {
  return resolveWindowsAppUserModelIdForFlavor(resolveDesktopProductFlavor(env), runtime);
}

# 改装版厂商面边界

本仓库是 ZCode 的改装版（mod）。下面这些厂商面在改装版中被刻意移除或保留为休眠代码；
从上游同步时，不要因为上游仍注册、仍有引用就把它们接回来。

## 已移除（不要重新接入）

- 营销触达 UI：`components/marketing-touch/*`、`rewards/*`、`RewardsProvider`、`MarketingTouchProvider`
- 购买/升级漏斗：`CodingPlanUpgradeDialog(.Provider)`、`StartPlanCard`、`codingPlanEmbeddedWebview`、
  `useCodingPlanEntryPlanList`、`useStartPlanPreview`、BigModel 注册提示、购买横幅与升级入口
- 营销导航请求的生产者，以及设置页/工作区外壳上的升级跳转意图
- 对应单测与 e2e：`marketing-touch-*`、`coding-plan-upgrade-*`、`rewards-*`

## 刻意保留的休眠代码（勿接线）

- `packages/services/src/marketing-touch/*`：host 侧服务仍在 `services/src/node.ts` 注册，
  但全仓库没有 `query` / `report` 调用方，因此不会请求 `/api/v1/marketing/touch`。
- `packages/ui/src/lib/marketingNavigation.ts`：只剩 `SettingsPage` / `ModelProviderSection` /
  `PluginStorePage` 的接收端，永远不会收到请求。
- `packages/shared/src/rewardsBridge.ts`、`rewardsEmbedded.ts`、`desktop/src/preload/rewardsWebview.ts`
  与 rewards 会话分区：渲染层入口已删除，窗口不会被创建。

上游若新增营销 UI 或升级入口，先确认改装版是否需要，再决定是否接线；默认保持移除。

# Superpowers 工作流接入设计

## 目标

将 merchant-appeal（商户申诉平台）后续全部开发纳入 Cursor Superpowers 标准流程，并配套 GitHub 小步提交规范，使架构、质量与版本轨迹可审计、可开源。

## 当前项目状态（2026-05-20）

- **后端**：Express + MySQL，`server/createApp.js` + `registerRoutes.js` 单体路由；`evolution.js` AI 自进化；`adminAgent.js` 管理端 AI 助手。
- **前端**：React + Vite，`ChatPage` 用户申诉对话，`AdminPage` 管理后台（含 EvolutionPanel、AdminAIFab）。
- **验证脚本**：`server/scripts/agentSmokeTest.mjs`、`evolutionVerify.mjs`。
- **仓库**：`main` 分支存在大量未提交重构（旧 MVC 删除、新 `server/app/` 结构），需按功能拆提交，禁止一次性巨型 commit。

## 约束

1. 每个独立功能：brainstorming → writing-plans → TDD → executing-plans → verification → 单次 Git commit。
2. 分支隔离优先 `using-git-worktrees`（大功能）。
3. 用户指令优先于技能默认（例如用户禁止 amend 时遵守 user rules）。

## 方案（推荐）

**方案 A：仓库内文档 + AGENTS.md 约束 Agent（推荐）**

- 新增 `AGENTS.md`、`docs/DEVELOPMENT_WORKFLOW.md`、`docs/superpowers/plans/*`。
- `package.json` 增加 `verify:agent`、`verify:evolution`、`verify:all`。
- 不改变运行时行为，零风险。

**方案 B：CI 强制 verify**

- 后续在 GitHub Actions 跑 jest + smoke scripts。
- 依赖 A 先落地。

## 提交拆分建议（针对当前未提交改动）

| 顺序 | 类型 | 范围 |
|------|------|------|
| 1 | docs | Superpowers 文档、README、AI_EVOLUTION |
| 2 | refactor | server/app 架构迁移 |
| 3 | feat | admin agent + AdminAIFab |
| 4 | fix | evolution/config/runtime 修复 |
| 5 | feat | AI hub、models、mall 等面板 |
| 6 | test | 新增 unit/integration |

## 成功标准

- 文档可被新成员按步骤复现开发流程。
- `npm run verify:all` 与 `npm test` 在本机通过（有 MySQL + .env）。
- GitHub 上每个 commit 对应单一能力点，message 符合 Conventional Commits。

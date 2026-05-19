# merchant-appeal 前后端缺口修复路线图

**版本：** 2026-05-19  
**生产入口：** `server/index.js`（PM2 `merchant-appeal:3003`）  
**前端构建：** `npm run build` → `dist/`

---

## 1. 项目基线

| 项 | 说明 |
|----|------|
| 管理后台 | `src/pages/AdminPage.jsx` + `src/components/*Panel.jsx` |
| 安全报告 | `SECURITY-AUDIT.md`（静态审计，部分条目已由代码修复） |
| 未启用 | `server/app.js` + `server/routes/*`（生产不挂载） |

---

## 2. 已完成修复（Done）

- [x] **用户对话 Tab**：`TAB_GROUPS` 含 `sessions`，`renderSessions()` 已挂载
- [x] **会话管理员 API**：`/api/admin/sessions/:id/messages`、`/api/admin/sessions/:id/analysis`
- [x] **安全加固 #2–#8**：`sessionAccess.js`、`requireUser`、微信验签等（#1 无密码登录仍待办）
- [x] **motion 崩溃**：源码无 `framer-motion`；需 `npm run build` 后部署
- [x] **提示词收集迭代**：三层 Prompt（`CORE_SYSTEM` + DB `chat_collection` + 运行时上下文）、字段提取对齐、完成度反哺、加权触发报告、运营中心 Prompt 建议/测试、`report_generation` 分离
- [x] **审计项修复（不含登录）**：SSE 断连中止上游且不扣费、单轮合并扣费 + `breakdown`、`patchSessionCollectedData` 防覆盖、进化规则 LIMIT/截断、欢迎语 API、完成度 hint 闭环、`violation_reason` 加权冻结关键词

---

## 2.1 Prompt 迭代（验收）

| 项 | 说明 |
|----|------|
| 线上收集话术 | 运营中心发布 `chat_collection` 后 3 分钟内新会话生效（`promptLoader` TTL + `publishPrompt` 清缓存） |
| 字段提取 | `extractFieldsWithAI` 含 `business_scenario`、`miniprogram_*`、`order_info` 等 |
| 完成度闭环 | `_completeness_hint` → 下一轮 `_instruction`；SSE `completeness_hint`；前端顶栏「还缺」 |
| 报告触发 | `ready && score≥75 && checkWeightedCollectionReady`（冻结/纠纷加权必填） |
| 运营闭环 | `GET /api/admin/ops/prompt-suggestions`、Prompt 中心预览/样例测试 |
| 欢迎语 | `GET /api/public/welcome` → `getWelcomeMessage()`；前端 `fetchWelcomeMessage()` |

---

## 2.2 审计修复验收（不含登录）

| 项 | 验证方式 |
|----|----------|
| 断连不扣费 | 流式输出中途关页：无 `deductBalance`，`turnBilling` 未 finalize |
| 单轮一次扣费 | 一条消息触发提取+完成度后仅 1 次余额变动；SSE `usage.breakdown[]` |
| 并发不丢字段 | 快速连发 2 条消息，右侧收集字段不消失 |
| 规则上限 | active 规则 >30 条时 prompt 段长度稳定（LIMIT 25 + 4000 字截断） |
| 欢迎语一致 | 新会话/刷新首句与 `WELCOME_MESSAGE` 一致 |
| hint | 刷新后会话仍显示「还缺」；发新消息后清除 |
| 会话失效 | 无效 `sessionId` 时 SSE `start.sessionReplaced` + 前端更新 localStorage |

**按产品决策暂缓：** 手机号+姓名快捷登录、第三方 OAuth（GitHub/Google/微信/QQ）— 见「登录待设计」。

---

## 3. 待修复清单

### P0 — 部署与文档

| ID | 状态 | 说明 |
|----|------|------|
| P0-1 | 待验证 | build + pm2 重启 + 浏览器硬刷新（代码已就绪，请在服务器执行） |
| P0-2 | 完成 | `SECURITY-AUDIT.md` 已增补修复状态摘要 |

### P1 — 前后端缺口

| ID | 状态 | 后端 | 前端 |
|----|------|------|------|
| GAP-1 | 完成 | `/api/xianyu/orders/*` | 闲鱼订单：发货/改价/卡密弹窗 |
| GAP-2 | 完成 | `/api/xianyu/products*` | 订单管理 → 闲鱼商品子 Tab（`XianyuPanel`） |
| GAP-3 | 完成 | `/api/admin/audit/log` | 系统运维 → 资金流水（`AuditLogPanel`） |
| GAP-4 | 完成 | `PUT .../recommendations/:id/status` | MallPanel → 推荐审核子 Tab |
| GAP-5 | 完成 | `POST .../monitor/reset-api-metrics` | MonitorPanel 重置 API 指标 |
| GAP-6 | 不做 | `/api/copywriting/*` | 维持会话内申诉文案，无独立页 |

### P2 — 代码卫生

| ID | 状态 | 说明 |
|----|------|------|
| DEBT-1 | 完成 | `renderUsers` / `UserCard` 已停用（`return null` 早退，可后续物理删除） |
| DEBT-2 | 文档 | `server/routes/` 与 `index.js` 重复，以 `index.js` 为准；新抽离见 `docs/ARCHITECTURE-SPLIT.md`、`server/http/*` |
| DEBT-3 | 文档 | 前台推荐走 AI 卡片，非 `/api/mall/recommendations` 列表 |

### 安全遗留（单独立项）

| ID | 说明 |
|----|------|
| SEC-1 | 登录需 OTP/密码（产品决策：暂保留手机号+姓名快捷登录） |
| AUTH-1 | 第三方 OAuth 待设计（GitHub/Google/微信/QQ） |
| SEC-2 | 默认 admin 密码 |
| SEC-3 | 生产必配微信支付平台证书 |

---

## 4. 分阶段实施

### 阶段 0：验证与文档

1. `npm run build && pm2 restart merchant-appeal`
2. 冒烟：用户对话、闲鱼订单、后台登录
3. 更新 `SECURITY-AUDIT.md`、`docs/FIX-GAPS-ROADMAP.md`

### 阶段 1：闲鱼订单运营

- 闲鱼订单表增加「操作」列
- 弹窗：发货（物流公司 + 单号）、改价、查看卡密

### 阶段 2：闲鱼商品管理

- 组件 `XianyuPanel.jsx`
- 订单管理 → 子 Tab「闲鱼商品」
- 列表、店铺选择、余额、上架/下架、改库存

### 阶段 3：运营与运维

- `AuditLogPanel.jsx` → Tab「资金流水」
- `MallPanel` → 推荐记录审核
- `MonitorPanel` → 重置 API 指标

### 阶段 4：清理

- 删除 `renderUsers` 相关死代码
- copywriting 不建独立页

---

## 5. 产品决策（已采用默认）

1. **闲鱼商品**：放在「订单管理」下子 Tab「闲鱼商品」（非独立顶栏）
2. **copywriting**：不做管理端独立页

---

## 6. 发布检查单

- [ ] `npm run build` 无报错
- [ ] `pm2 restart merchant-appeal` 后 `/api/health` 正常
- [ ] 管理端未登录请求返回 401
- [ ] 闲鱼未配置 Key 时有友好提示
- [ ] 浏览器无 `motion is not defined`
- [ ] 本文件对应条目已勾选

---

## 7. 接口速查（后端有 → 前端对接）

| 方法 | 路径 | 阶段 |
|------|------|------|
| POST | `/api/xianyu/orders/ship` | 1 |
| POST | `/api/xianyu/orders/update-price` | 1 |
| GET | `/api/xianyu/orders/:orderId/cards` | 1 |
| GET | `/api/xianyu/logistics/companies` | 1 |
| GET/POST/PUT/DELETE | `/api/xianyu/products*` | 2 |
| GET | `/api/xianyu/shops`、`/balance` | 2 |
| GET | `/api/admin/audit/log` | 3 |
| GET | `/api/admin/mall/recommendations` | 3（新增） |
| PUT | `/api/mall/recommendations/:id/status` | 3 |
| POST | `/api/admin/monitor/reset-api-metrics` | 3 |
| GET | `/api/admin/ops/prompt-suggestions` | Prompt 迭代 |
| GET | `/api/admin/ops/prompts/published/:key` | Prompt 迭代 |
| POST | `/api/admin/ops/prompts/test` | Prompt 迭代 |
| GET | `/api/public/welcome` | 审计修复 |
| POST | `/api/xianyu/orders/cancel` | 闲管家 SDK 对齐 |
| GET | `/api/xianyu/logistics/companies` | 代理至 `express/companies` |

# merchant-appeal 深度审计提示词

> **用途**：一次性任务模板。新建 Cursor 对话，复制下方「执行块」全文粘贴即可。  
> **不要**把本文件内容塞进 `.cursor/rules`；审计结论应提炼进 `.cursor/rules/merchant-appeal-*.mdc`。

---

## 执行块（复制从这里开始）

```
你正在审计「商户申诉助手 merchant-appeal」项目。工作目录：/root/merchant-appeal。
线上：https://appeal.aikex.ink | 开发 /root/merchant-appeal | 线上 /www/wwwroot/appeal.aikex.ink | PM2 merchant-appeal 端口 3001。

【本次任务】
做一次**全面代码审计 + 架构梳理**，输出「项目全景报告」。
**禁止**在本任务中删除/重构任何代码。只读、只分析、只结论。

【核心原则】
1. 每个结论必须可追溯：文件路径、行号、或 grep 结果
2. 区分三层：**生产在跑** / **构建了但用户访问不到** / **零引用死代码**
3. 区分：**论文/设计文档说的** vs **代码实际实现的**
4. 不准凭目录名猜；不准说「大概」「应该」而不给证据

---

## 第 0 步：先读这些（按顺序）

1. package.json（start、build、test 脚本）
2. server/index.js 开头 import 段 + 所有 app.use / app.get|post 路由
3. server/db.js 全部 CREATE TABLE + 导出的 DAO 函数
4. vite.config.js + scripts/build-appeal-site.mjs
5. src/App.jsx + src/main.jsx + src/pages/ChatPage.jsx（import、state、Tab、Panel 挂载）
6. src/lib/auth.js + src/lib/appNav.js
7. /www/server/panel/vhost/nginx/appeal.aikex.ink.conf（若可读）
8. 若存在：/root/基于大模型与自进化RAG的微信商户申诉辅助系统设计与实现.md — 对照「设计 vs 实现」

---

## 一、生产真实链路（最高优先级）

1. **后端入口**：npm start 指向哪个文件？import 树列完整
2. **API 路由清单**：index.js 内联路由数量；app.use 挂载的外部 routes；按前缀分组 API 表
3. **前端入口**：React base path、build 输出、生产 URL
4. **nginx 策略**：/ 、/chat/ 、/api/ 、旧 Vue 路径分别怎么转发
5. **双前端**：dist/ 根 vs dist/chat/ 各是什么、谁被用户用到

【待验证假设 — 必须用代码证实或推翻】
- server/app.js 及 controllers/models/大部分 routes 是否从未在生产启动
- 生产是否仅挂载 wechatOAuthRoutes + customerProfileRoutes
- Vue customer-web 是否被 nginx 302 绕过

---

## 二、产品功能地图（用户视角）

每个功能写清：**前端入口 → API → 后端文件 → 表**

| 功能域 | 起点文件 |
|--------|----------|
| 手机/微信/绑手机 | auth.js, AuthView, BindPhoneView, WechatCallback, wechatOAuthService |
| 5 Tab 移动壳 | ChatPage, appNav.js, ChatBottomNav, HomeTab, ToolsHubPage, CasesTab, UserCenter |
| AI 对话采集 | ai.js, localAI.js, fieldCollector.js, dueDiligence.js |
| 申诉信/投诉书 | AppealTextPanel, ComplaintDocPanel, appeal_texts, complaint_docs |
| 会话历史 | HistoryDrawer, SessionItem, sessions/messages |
| 闲鱼订单 | UserCenter, CasesTab, xianGuanService |
| Token/充值 | TokenPanel, payment.js, recharge_orders |
| 自进化/案例库 | EvolutionPanel, evolution.js, knowledgeBase.js, ai_rules, success_cases |
| Admin | AdminPage, /api/admin/* |
| 服务页 | ServicePage, /service/:orderNo |

---

## 三、后端模块（按调用链）

深读并说明谁调用、读写哪些表：

- db.js（DAO 被 index.js 实际调用的部分）
- ai.js + localAI.js
- evolution.js + knowledgeBase.js（ragService.js 是否参与生产？）
- fieldCollector / dueDiligence / onlineChannels
- payment.js（各通道是否启用）
- mall / monitor / backup / modelHealth
- utils/crypto.js、middleware/auth.js

【必核实】sessions 主键 id vs session_id；users profile_completed / 微信占位手机号

---

## 四、前端架构

1. App.jsx 全部 Route
2. ChatPage 状态机：mobileTab / view / overlay；appNav 同步；登录/绑手机分支
3. Panel/Sheet 清单：open 条件、API
4. 从 App + ChatPage 做引用追踪：live 组件 vs 零引用组件
5. fetch / auth header / ensureSession / withSession

【待验证 ToolsSheet】grep setShowToolsSheet 是否从未 true

---

## 五、死代码（grep 实锤）

**表 A**：零引用 server 文件  
**表 B**：零引用 React 组件  
**表 C**：定义但未挂载的 API  

额外：broken npm scripts、initDb/migrations 旧表、tests 测 live 还是 dead

每项标注：**安全可删 / 需人工确认 / 不可删**

---

## 六、核心业务流程（markdown 流程图）

1. 打开 /chat/ → 登录 → 绑手机 → home Tab  
2. chat Tab → 发消息 → AI 流式 → collected_data  
3. 申诉信 Panel → 生成 → appeal_texts  
4.（可选）充值 → 回调 → balance/token  

---

## 七、外部依赖与站点边界

- process.env 变量名 + 用途（不输出密钥）
- LLM、微信 OAuth、支付、XIANGUAN_*、邮件
- **是否对接 aike.ink / epay.aikex.ink**（预期：无）

---

## 八、体量统计（仅 live 代码）

后端 live 行数、前端 live 行数、生产 API 数、生产 DB 表数、死代码占比、技术债评级

---

## 九、设计文档 vs 实现

文档有/代码无；代码有/文档无；三前端/双库等差异

---

## 输出格式

```markdown
# merchant-appeal 项目全景报告
## TL;DR
## 1. 生产链路
## 2. 功能地图
## 3. 后端模块
## 4. 前端架构
## 5. 死代码清单（A/B/C）
## 6. 业务流程图
## 7. 外部依赖
## 8. 体量统计
## 9. 设计 vs 实现
## 10. 建议的 .cursor/rules 修正项（5-10 条具体项）
## 11. 是否建议 Tier A 死代码清理？（是/否/部分 + 理由）
```

【工作方式】用 Read/Grep/Glob；不确定写「未证实」；本任务不改任何文件。

开始审计。
```

---

## 审计完成后

1. 将报告第 10 节结论写入 `.cursor/rules/merchant-appeal-*.mdc`
2. 推翻或确认 `core.mdc` 里「待验证」的假设（如 ToolsSheet、支付通道、自进化触发时机）
3. 再决定是否执行 `merchant-appeal-tasks.mdc` 中的「清理死代码」任务

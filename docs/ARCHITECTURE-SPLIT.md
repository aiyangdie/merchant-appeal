# 大文件拆分与规范化

**状态：** 2026-05-19 已完成首轮拆分；2026-05-19 修复缺失的 `/api/sessions/:id/info|field` 路由并 PM2 重启验证

## 生产入口

- `npm start` → [`server/index.js`](../server/index.js)（约 230 行：中间件 + 注册 + 启动）
- **勿用** [`server/app.js`](../server/app.js)（已标 DEPRECATED）

## 目录约定

```
server/
  index.js                 # 生产入口
  appContext.js            # JWT、限流、计费 ctx
  http/
    jwtAuth.js
    rateLimits.js
  lib/
    textUtils.js           # stripEmoji
    sseStream.js           # pipeAIStream, simulateTypingSSE
    mallPayload.js
  services/
    sessionAnalysis.js
    copywritingHelpers.js
    financialAudit.js
  handlers/
    appealGuideApi.js
    chatStreamHandler.js
    deepAnalysisHandler.js
  routes/prod/
    registerProdRoutes.js  # 统一注册
    userRoutes.js
    publicRoutes.js
    rechargeRoutes.js
    xianyuRoutes.js
    sessionRoutes.js
    chatRoutes.js
    adminRoutes.js
    mallRoutes.js
    orderRoutes.js
    copywritingRoutes.js
    healthRoutes.js
  db/
    pool.js
    schema.js              # runSchemaMigrations
    init.js                # initDatabase
  db.js                    # DAO + re-export getPool/initDatabase
```

## 依赖注入

```js
const ctx = createAppContext({ jwtSecret, jwtExpires, distPath })
registerProdRoutes(app, ctx)
```

各 `register*Routes(app, ctx)` 使用完整路径注册（如 `/api/user/login`），**不用** `app.use('/api/user', router)`，避免 `lookup` 与 `:id` 顺序问题。

## 遗留代码

- [`_archive/legacy-routes/README.md`](../_archive/legacy-routes/README.md)
- 旧 `server/routes/sessionRoutes.js` 等：**不要扩展**

## 验收

```bash
node --check server/index.js
npm test
npm run build
```

手动冒烟：登录 → 流式消息 → 申诉指导 → 管理后台一页。

## 后续（可选）

- 将 `adminRoutes.js`（约 1950 行）再拆为 `routes/prod/admin/*.js`
- `db.js` DAO 按域拆至 `db/sessions.js` 等
- 前端 `ChatPage.jsx` / `AdminPage.jsx` 拆 hook 与面板

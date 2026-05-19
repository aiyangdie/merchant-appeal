# 商户号申诉系统（merchant-appeal）漏洞检查报告

**检查时间：** 2026-05-18  
**最后同步：** 2026-05-18（代码修复状态）  
**检查范围：** `/root/我的项目/merchant-appeal/`（生产入口 `server/index.js`，约 5888 行）  
**线上域名：** `appeal.aikex.ink` / `www.aikex.ink`（PM2 `merchant-appeal`，端口 3003）

---

## 修复状态摘要（2026-05-18）

| 编号 | 问题 | 状态 | 说明 |
|------|------|------|------|
| 2.2 | `body.userId` 冒充扣费 | **已修复** | `POST /api/chat` 等改为 `requireUser`，仅 JWT |
| 2.3 | 会话 IDOR | **已修复** | `validateSessionOwnership` + `requireUser` |
| 2.4 | `sessions/lookup` 全局搜索 | **已修复** | 改为 `requireUser` |
| 2.5 | 未鉴权 AI（砍价/人设/copywriting） | **部分已修复** | bargain/persona/copywriting 已 `requireUser`；copywriting 仍 `optionalUser` 处需复核 |
| 2.6 | 微信回调验签/金额 | **已加固** | 生产应配置平台证书；见 `payment.js` |
| 2.8 | 日程 API 公开 | **已修复** | 已加 `requireAdmin` |
| 2.1 | 仅手机号登录 | **未修复** | 单独立项（SEC-1） |
| 2.7 | 默认 admin 弱口令 | **未修复** | 部署后强制改密 |
| 3.3 | 推荐位状态无鉴权 | **已修复** | `PUT .../status` 已 `requireAdmin` |

前后端产品缺口修复见 [`docs/FIX-GAPS-ROADMAP.md`](docs/FIX-GAPS-ROADMAP.md)。

---

## 一、总体结论

| 维度 | 评级 | 说明 |
|------|------|------|
| 管理后台鉴权 | 较好 | 绝大多数 `/api/admin/*` 使用 `requireAdmin` |
| 用户端鉴权 | **差** | 登录无密码、`body.userId` 可冒充、会话 IDOR |
| 支付安全 | **差** | 微信回调在无平台证书时跳过验签 |
| SQL 注入 | 较好 | 主流使用参数化查询 |
| 密钥管理 | 中 | JWT 强制配置，但 `.env` 未全覆盖 gitignore、存在弱默认值风险 |
| 架构债务 | 中 | `server/routes/` 有更严中间件，**未挂到生产入口** |

**综合：存在多项可被直接利用的高危漏洞，建议按 P0 → P1 顺序修复后再对外推广。**

---

## 二、高危漏洞（P0，建议立即修复）

### 2.1 用户登录无密码 — 任意账户接管

**位置：** `server/index.js` 735–746

**现象：** `POST /api/user/login` 仅校验 `phone` 是否存在，无短信验证码、无密码。

**影响：** 攻击者知道或枚举手机号即可获取该用户 JWT，读取申诉资料、消耗余额、绑定订单。

**注册同样薄弱：** `phone` 仅要求 2–20 字符（705–709 行），非真实手机号格式。

**修复建议：**
- 增加短信 OTP 或密码 + 失败锁定；
- 登录/注册与 JWT 签发绑定同一套强校验。

---

### 2.2 `body.userId` / `query.userId` 冒充用户扣费

**位置：**
- `server/index.js` 802–803（`POST /api/chat`）
- `server/index.js` 1071+（深度分析等，`query.userId`）

**现象：** 路由使用 `optionalUser`，但 `const userId = req.userId || bodyUserId`，攻击者可在无 Token 时传入任意 `userId`，以该用户身份触发 AI 对话并扣官方余额。

**修复建议：**
- **删除** `bodyUserId` / `query.userId` 作为身份依据；
- 所有计费接口改为 `requireUser`，且 `userId` 仅来自 JWT。

---

### 2.3 会话 IDOR — 敏感申诉数据泄露

**位置：** 多处 `optionalUser` + 条件判断：

```javascript
if (session.user_id && req.userId && String(session.user_id) !== String(req.userId))
```

**逻辑缺陷：**

| 场景 | 结果 |
|------|------|
| 会话未绑定 `user_id`（匿名） | **不校验**，知道 UUID 即可访问 |
| 已绑定用户但未带 JWT | **不校验**（`req.userId` 为空时条件不成立） |
| 双方都有 JWT 且用户不同 | 拒绝 |

**受影响接口（示例）：**
- `GET /api/sessions/:id/messages`
- `GET /api/sessions/:id/info`
- `GET /api/sessions/:id/deep-analysis-result`
- `PUT /api/sessions/:id/field`
- 等

**更严重：** `GET /api/sessions/:id/appeal-text`（2385–2389 行）**无任何归属校验**，知道 session ID 即可读取申诉文案。

**已有正确实现但未启用：** `server/routes/sessionRoutes.js` 中 `validateSessionOwnership` + `requireUser`，但生产使用 `index.js`，**未挂载该路由模块**。

**修复建议：**
- 统一中间件：匿名会话需 `sessionSecret` 或创建时 Cookie；已绑定会话必须 `requireUser` 且 `user_id === req.userId`；
- 将 `sessionRoutes.js` 接入或把校验逻辑复制到 `index.js` 所有会话相关路由。

---

### 2.4 未登录全局搜索会话（跨用户 PII）

**位置：** `server/index.js` 2023–2031 + `server/db.js` 1163–1184

**现象：** `GET /api/sessions/lookup?q=...` 使用 `optionalUser`；未登录时 `req.userId` 为 `null`，`lookupSessions` **不加** `user_id` 过滤，可搜索全部用户的会话 ID 与首条消息内容。

**修复建议：** 改为 `requireUser`，且 SQL 始终带 `s.user_id = ?`。

---

### 2.5 未鉴权 AI 接口 — 平台 API Key 可被刷量

| 路由 | 鉴权 | 风险 |
|------|------|------|
| `POST /api/mall/products/:id/bargain` | **无** | 调用 `aiBargain`，消耗平台 AI |
| `POST /api/mall/products/:id/persona` | **无** | 调用 `aiGenerateVirtualPersona` |
| `POST /api/copywriting/generate` | `optionalUser` | 可用系统 API Key |
| `POST /api/copywriting/generate/stream` | `optionalUser` | 同上 |

**修复建议：** 改为 `requireUser` + 余额/配额；或独立 API Key + 严格限流。

---

### 2.6 微信支付回调验签可被跳过 — 伪造充值

**位置：** `server/payment.js` 118–121；`server/index.js` 3302–3326

**现象：** 未配置微信平台证书时 `verifyNotifySignature` 直接 `return true`。回调处理仅匹配 `out_trade_no` 与 `pending` 状态即 `confirmRechargeOrder`，**未校验支付金额与订单金额是否一致**。

**影响：** 攻击者可伪造 `POST /api/payment/wechat/notify`，给用户或自己**免费充值**。

**修复建议：**
- 生产强制配置平台证书，验签失败一律拒绝；
- 校验金额、商户号、幂等（防重放）；
- 回调接口增加 IP 白名单（微信官方 IP 段）。

---

### 2.7 默认管理员弱口令

**位置：** `server/db.js` 814–818

**现象：** 首次初始化数据库自动创建 `admin` / `admin123`。

**修复建议：** 首次部署强制改密；或仅输出随机密码到控制台、禁止默认密码。

---

### 2.8 日程 API 完全公开 — 任意增删改

**位置：** `server/index.js` 5631–5678

**现象：** `GET/POST/PUT/DELETE /api/schedules` 均无 `requireUser` / `requireAdmin`。

**修复建议：** 至少 `requireAdmin`；若为用户日程则 `requireUser` + 归属校验。

---

## 三、中危问题（P1）

### 3.1 密钥与配置暴露风险

- `.gitignore` 仅忽略根目录 `.env`，**未忽略** `server/.env`（生产 PM2 实际加载路径）。
- 根目录 `.env` 中 `JWT_SECRET` 含可识别弱模式（启动时有警告，见 index.js 82–83）。
- `backups/*.sql` 在 `.gitignore` 中，但磁盘上可能含用户/管理员哈希，需限制目录权限（`chmod 700`）。

### 3.2 CORS 配置

- `credentials: true` 时，若 `CORS_ORIGINS=*`（`.env.example` 曾示例），存在跨站风险。
- **生产应明确域名白名单**，禁止 `*`。

### 3.3 推荐位状态可被任意修改

**位置：** `server/index.js` 4704–4708（`PUT /api/mall/recommendations/:id/status`）

**现象：** 无鉴权即可更新推荐状态。

### 3.4 健康检查接口信息泄露

**位置：** `GET /api/health`（约 5547 行）

**建议：** 仅内网访问或加认证，避免暴露内部依赖状态。

### 3.5 订单接口日志

**位置：** `server/index.js` 约 280 行

**现象：** 打印完整外部订单 API 响应，可能含 PII。

**建议：** 生产关闭或脱敏。

### 3.6 管理端限流绕过

全局限流对带有效管理员 JWT 的请求跳过（121–131 行）。JWT 一旦泄露，暴力操作不受全局限流约束（仍有部分 `authLimiter`）。

---

## 四、低危 / 加固项（P2）

| 项 | 说明 |
|----|------|
| Helmet CSP 关闭 | SPA 需要，可接受；确保 XSS 主要靠 DOMPurify（前端） |
| 聊天内容长度 5000 | 已有；建议对更多 JSON 字段做 schema 校验 |
| SQL 动态 UPDATE 列名 | `appeal_texts` 等由服务端白名单拼接，风险低 |
| 文件上传 | 主服务无用户可控路径上传，风险低 |
| `eval` / `child_process` | 主服务无；仅 `backup.js` / 脚本中有 `execFile` |
| 单文件 5888 行 | 安全修复易漏；建议拆分并启用 `server/routes/` |

---

## 五、已做得较好的部分

1. **JWT_SECRET 缺失则拒绝启动**（index.js 77–80）。
2. **管理员接口** 普遍 `requireAdmin` + 登录 `authLimiter`。
3. **用户资源接口** 如 `/api/user/:id` 校验 `req.userId === params.id`（754–757）。
4. **SQL** 主流 `pool.execute` + `?` 占位符；`lookupSessions` 使用 `escapeLike`。
5. **Helmet + HSTS**、聊天/登录分级限流。
6. **敏感字段加密**（`ENCRYPT_KEY` + AES，手机/API Key 等）。
7. **前端** 使用 DOMPurify（需确认所有用户 HTML 渲染路径均消毒）。

---

## 六、修复优先级清单

| 优先级 | 动作 | 预估工作量 |
|--------|------|------------|
| P0-1 | 用户登录改为 OTP/密码；删除 `bodyUserId` | 1–2 天 |
| P0-2 | 所有会话 API 统一归属校验；修复 `appeal-text` | 0.5–1 天 |
| P0-3 | `sessions/lookup` 强制登录 + 仅查本人 | 0.5 天 |
| P0-4 | 微信回调强制验签 + 金额校验 | 0.5 天 |
| P0-5 | 公开 AI / schedules 加鉴权 | 0.5 天 |
| P0-6 | 修改默认 admin 密码；轮换 JWT/ENCRYPT_KEY | 0.5 天 |
| P1 | `server/.env` 加入 gitignore；CORS 收紧；健康检查加保护 | 0.5 天 |
| P2 | 拆分 index.js，挂载 `sessionRoutes` | 2–3 天 |

---

## 七、快速自检命令（运维）

```bash
# 1. 无 Token 用 body.userId 调聊天（应返回 401，当前可能 200/402）
curl -s -X POST https://appeal.aikex.ink/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"userId":1,"sessionId":"<uuid>","content":"test"}'

# 2. 无 Token 读申诉文案（应 403，当前可能 200）
curl -s https://appeal.aikex.ink/api/sessions/<session-uuid>/appeal-text

# 3. 无 Token 全局搜索（应 401，当前可能 200）
curl -s 'https://appeal.aikex.ink/api/sessions/lookup?q=test'

# 4. 仅手机号登录（应失败，当前可能成功）
curl -s -X POST https://appeal.aikex.ink/api/user/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"13800138000"}'
```

---

## 八、说明

- 本报告基于静态代码审计，未对生产环境做渗透测试。
- 报告中**未列出**具体 `.env` 密钥内容；若仓库曾提交过 `server/.env`，应视为已泄露并**轮换** JWT、DB、支付、ARK 等密钥。
- 修复后建议复测上述 curl 用例并做一次回归。

---

*生成方式：代码审查 + 模式扫描（merchant-appeal 专用）*

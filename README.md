# 微信商户号申诉助手（merchant-appeal）开发文档
 
 ## 1. 项目简介
 
 本项目是一个“微信商户号申诉咨询/材料生成”应用，包含：
 
 - **前台用户端**：用户注册/登录、会话式收集信息、AI 咨询、生成申诉文案、充值与用量查看。
 - **后台管理端**：管理员登录、用户与会话管理、系统配置（DeepSeek Key/模型/倍率等）、充值订单审核、成功案例知识库管理。
 - **后端服务**：Express + MySQL，提供 REST API 与流式聊天 SSE，内置本地规则引擎作为 AI 兜底。
 
 运行形态：
 
 - 本地开发：Vite 前端（5173）代理到 Node 后端（3001）。
 - 生产部署：前端构建产物 `dist/` 由 Nginx 托管，Nginx 反代 `/api/` 到 Node 后端。
 
 ---
 
 ## 2. 技术栈
 
 - **前端**：React 18、React Router、Vite 6、TailwindCSS
 - **后端**：Node.js (ESM)、Express、helmet、cors、express-rate-limit、jsonwebtoken
 - **数据库**：MySQL（mysql2/promise）
 - **AI**：DeepSeek Chat Completions（可使用系统 Key 或用户自定义 Key）
 - **其它**：
   - `uuid`：会话ID
   - `bcryptjs`：管理员密码
   - `html2canvas`：前端页面截图/导出（用于材料/凭证展示等场景）
 
 ---
 
 ## 3. 目录结构
 
 ```
 merchant-appeal/
 ├── public/
 ├── src/
 │   ├── components/
 │   ├── pages/
 │   │   ├── ChatPage.jsx        # 用户端主页面
 │   │   ├── AdminLogin.jsx      # 后台登录
 │   │   └── AdminPage.jsx       # 后台管理控制台
 │   ├── App.jsx                 # 前端路由：/、/admin、/admin/dashboard
 │   ├── main.jsx
 │   └── index.css
 ├── server/
 │   ├── index.js                # 后端入口（Express）
 │   ├── db.js                   # DB 初始化/表结构/数据访问层（含加密迁移）
 │   ├── ai.js                   # DeepSeek 调用与后备规则引擎（部分流程）
 │   ├── localAI.js              # 本地规则引擎：信息收集/行业知识/敏感行业识别
 │   ├── knowledgeBase.js        # 内置知识库：违规类型/风险/材料清单/案例匹配
 │   ├── tokenizer.js            # token 统计与计费
 │   └── crypto.js               # 敏感信息加解密（配合 ENCRYPT_KEY）
 ├── dist/                       # 前端构建产物（生产环境）
 ├── .env.example
 ├── DEPLOY.md                   # 宝塔面板部署指南
 ├── vite.config.js
 └── package.json
 ```
 
 ---
 
 ## 4. 本地开发
 
 ### 4.1 环境要求
 
 - Node.js：建议 18+
 - MySQL：5.7+ 或 8.0+
 
 ### 4.2 安装依赖
 
 ```bash
 npm install
 ```
 
 ### 4.3 配置环境变量
 
 复制 `.env.example` 为 `.env`，按你的环境填写：
 
 - 数据库：`DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME`
 - 安全：`ENCRYPT_KEY`（AES-256 32字节十六进制=64位 hex）、`JWT_SECRET`
 - 服务：`PORT`（默认 3001）、`CORS_ORIGINS`
 - 限速：`RATE_LIMIT_MAX`、`CHAT_RATE_LIMIT_MAX`
 
 **注意**：后端启动时如果 `JWT_SECRET` 未配置，会提示警告并使用不安全默认值（仅建议本地临时调试）。
 
 ### 4.4 启动开发服务
 
 ```bash
 npm run dev
 ```
 
 - 前端：`http://localhost:5173`
 - 后端：`http://localhost:3001`
 
 Vite 已在 `vite.config.js` 中配置代理：`/api` -> `http://localhost:3001`。
 
 ---
 
 ## 5. 构建与生产启动
 
 ```bash
 npm run build
 npm run start
 ```
 
 - `build`：生成 `dist/`
 - `start`：仅启动后端（生产环境通常由 Nginx 托管 `dist/` 并反代 API）
 
 ---
 
 ## 6. 环境变量说明（.env）
 
 与 `.env.example` / `DEPLOY.md` 保持一致，核心项如下：
 
 - **数据库**
   - `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME`
   - `DB_CONNECTION_LIMIT`
 - **安全**
   - `ENCRYPT_KEY`：用于加密存储敏感配置（如 DeepSeek Key、支付配置、用户手机号/IP 等）
   - `JWT_SECRET`：用于签发管理员/用户 JWT
   - `JWT_EXPIRES_IN`：默认 `24h`
 - **服务**
   - `PORT`：后端端口（默认 3001）
   - `NODE_ENV`：`production`/`development`
   - `CORS_ORIGINS`：允许跨域来源（生产建议配置域名，支持逗号分隔）
 - **限速**
   - `RATE_LIMIT_MAX`：全局限速
   - `CHAT_RATE_LIMIT_MAX`：聊天接口限速
 
 ---
 
 ## 7. 核心流程与数据流（概览）
 
 ### 7.1 用户侧
 
 - 用户在 `/`（`ChatPage`）完成注册/登录。
 - 发起聊天：`POST /api/chat`
   - 强制要求已登录并具备付费能力（官方余额>0 或自定义 API Key）。
   - 创建或续用 `sessionId`。
   - 后端将消息写入 `messages`。
   - 调用 DeepSeek（系统 Key 或用户自定义 Key），并依据 token 计费扣余额（官方模式）。
 - 信息收集：会话 `sessions.collected_data` 与 `sessions.step` 存储收集进度。
 - 深度分析：`GET /api/sessions/:id/deep-analysis`（包含会员/月额度逻辑与缓存/落库）。
 - 申诉文案：`POST /api/sessions/:id/generate-appeal-text` 生成并保存 `appeal_texts`。
 
 ### 7.2 管理员侧
 
 - 登录：`POST /api/admin/login` 获取管理员 JWT。
 - 进入 `/admin/dashboard` 管理用户/会话/配置/充值订单/案例库。
 
 ---
 
 ## 8. 后端 API 概览（server/index.js）
 
 仅列出主要端点，具体入参/返回请以代码为准。
 
 ### 8.1 用户相关
 
 - `POST /api/user/register`
 - `POST /api/user/login`
 - `GET /api/user/:id`（需用户 JWT，仅本人）
 - `GET /api/user/:id/sessions`（需用户 JWT，仅本人）
 - `PUT /api/user/:id/api-mode`（需用户 JWT，仅本人；`official`/`custom`）
 - `GET /api/user/:id/usage`（需用户 JWT，仅本人；token 用量/统计/充值记录）
 
 ### 8.2 聊天与会话
 
 - `POST /api/chat`（聊天；需要 `userId`；并校验付费能力）
 - `POST /api/chat/stream`（SSE 流式聊天）
 - `GET /api/sessions/lookup`（搜索会话；可选用户 JWT）
 - `GET /api/sessions/:id/messages`（会话消息；可选用户 JWT，若会话绑定用户则校验归属）
 - `GET /api/sessions/:id/info`（会话收集信息与字段元数据）
 - `PUT /api/sessions/:id/field`（更新某个收集字段）
 - `GET /api/sessions/:id/analysis`（本地分析摘要，不消耗 DeepSeek）
 - `GET /api/sessions/:id/deep-analysis`（DeepSeek 深度分析，含会员/月额度逻辑）
 - `GET /api/sessions/:id/deep-analysis-result`（获取已保存的深度分析结果）
 
 ### 8.3 申诉文案
 
 - `POST /api/sessions/:id/generate-appeal-text`（生成并保存，支持 `force` 重新生成）
 - `GET /api/sessions/:id/appeal-text`（获取已生成文案）
 
 ### 8.4 充值
 
 - `GET /api/recharge/config`（公开：金额选项、二维码、说明）
 - `POST /api/recharge`（用户提交充值订单；需用户 JWT）
 - `GET /api/recharge/orders`（用户查看自己的充值记录；需用户 JWT）
 
 ### 8.5 管理员
 
 - `POST /api/admin/login`
 - `PUT /api/admin/password`（需管理员 JWT）
 - `GET /api/admin/users`（需管理员 JWT）
 - `DELETE /api/admin/users/:id`（需管理员 JWT）
 - `POST /api/admin/users/:id/balance`（需管理员 JWT；调整余额）
 - `GET /api/admin/stats`（需管理员 JWT）
 - `GET /api/admin/sessions`（需管理员 JWT）
 - `GET /api/admin/sessions/:id/messages`（需管理员 JWT）
 - `DELETE /api/admin/sessions/:id`（需管理员 JWT）
 - `POST /api/admin/sessions/:id/reply`（需管理员 JWT；管理员人工回复）
 
 ### 8.6 充值订单管理（管理员）
 
 - `GET /api/admin/recharge-orders`
 - `PUT /api/admin/recharge-orders/:id/confirm`
 - `PUT /api/admin/recharge-orders/:id/reject`
 
 ### 8.7 案例知识库（管理员）
 
 - `GET /api/admin/cases`
 - `GET /api/admin/cases/:id`
 - `POST /api/admin/cases/from-session`
 - `POST /api/admin/cases`
 - `PUT /api/admin/cases/:id`
 - `DELETE /api/admin/cases/:id`
 
 ---
 
 ## 9. 数据库说明（server/db.js）
 
 后端启动时会自动 `initDatabase()`：
 
 - 创建数据库（如不存在）
 - 创建/迁移表结构
 - 初始化系统配置项与支付配置项
 - 初始化默认管理员（首次运行）
 
 ### 9.1 主要表
 
 - `sessions`
   - `id`：会话 ID（uuid）
   - `user_id`：归属用户（可为空，历史兼容）
   - `collected_data`：JSON（信息收集结果）
   - `step`：信息收集进度
   - `deep_analysis_result`：缓存深度分析结果
 - `messages`
   - `session_id`、`role`（user/assistant/admin）、`content`
 - `users`
   - `phone`/`nickname`/`last_ip` 等字段采用加密存储
   - `phone_hash`：用于唯一索引与查询（避免明文手机号索引）
   - `balance`：官方模式扣费余额
   - `api_mode`：`official` / `custom`
   - `custom_api_key`：加密存储
 - `system_config`
   - 站点与 AI 配置（`deepseek_api_key` 为敏感字段，存储时加密）
 - `payment_config`
   - 微信/支付宝支付配置（敏感字段加密）
 - `recharge_orders`
   - 用户提交充值订单，管理员确认后入账
 - `token_usage`
   - token 与费用明细
 - `appeal_texts`
   - 申诉文案缓存
 - `success_cases`
   - 成功案例知识库
 - `user_actions`
   - 用户行为追踪（IP 加密存储）
 
 ### 9.2 默认管理员
 
 首次初始化会创建：
 
 - 用户名：`admin`
 - 密码：`admin123`
 
 **上线后必须第一时间在后台修改默认密码。**
 
 ---
 
 ## 10. 计费与配额（关键规则）
 
 - 聊天 `POST /api/chat`
   - **官方模式**：按 token 计费扣余额（倍率可在系统配置中调节 `cost_multiplier`）。
   - **自定义模式**：使用用户自定义 DeepSeek API Key，不扣平台余额。
 - 深度分析 `GET /api/sessions/:id/deep-analysis`
   - 存在“会员/月度次数（100次）”相关逻辑（以代码实现为准）。
 
 ---
 
 ## 11. 部署
 
 生产部署建议按 `DEPLOY.md`（宝塔面板）执行。核心要点：
 
 - 前端：`npm run build` 生成 `dist/`，由 Nginx 托管
 - 后端：PM2 守护运行 `server/index.js`
 - Nginx：反代 `/api/` 到 Node（3001）并处理 SPA `try_files`
 - `.env`：必须正确配置 DB 与安全密钥
 
 ---
 
 ## 12. 常见问题（排错）
 
 - **页面空白**
   - 检查 `dist/` 是否存在
   - Nginx root 是否指向 `dist/`
 - **接口 502**
   - 检查 Node 是否运行（PM2）
   - 检查端口、`.env` 是否正确
 - **数据库初始化失败**
   - 检查 MySQL 账号权限与 `DB_*` 配置
 - **AI 不回复 / 只提示未配置**
   - 后台 `system_config.deepseek_api_key` 是否已设置
   - 余额/自定义 Key 是否满足使用条件
 
 ---
 
 ## 13. 安全注意事项
 
 - 不要把 `.env` 提交到仓库。
 - 生产环境务必配置强随机 `ENCRYPT_KEY` 与 `JWT_SECRET`。
 - 默认管理员密码必须修改。
 - `CORS_ORIGINS` 生产环境建议配置为站点域名（不要长期 `*`）。

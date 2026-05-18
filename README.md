<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react" alt="React">
  <img src="https://img.shields.io/badge/AI-DeepSeek-7C3AED?style=for-the-badge" alt="DeepSeek">
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss" alt="TailwindCSS">
  <img src="https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql" alt="MySQL">
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License">
</p>

<h1 align="center">🛡️ merchant-appeal</h1>

<p align="center">
  <b>商家申诉平台 — AI 驱动的微信商户号申诉智能助手</b>
</p>

<p align="center">
  多 AI 模型驱动 · SSE 流式对话 · 行业自适应 · 风控逆向推演 · 自进化引擎 · Token 计费
</p>

---

## 📌 项目简介

merchant-appeal 是一款基于多 AI 模型的智能微信商户号申诉系统。通过 AI 对话自动收集商户信息，智能生成符合微信官方要求的申诉材料，大幅降低申诉门槛、提升通过率。具备自我进化能力，越用越聪明、越用越精准。

> 这不是一个 Demo，是一个可直接商用的申诉工具。

---

## ✨ 核心特性

- 🤖 **AI 智能对话引擎** — DeepSeek 等多模型驱动，自然语言理解，碎片化表达处理，信息随时修正
- 🔍 **统一智能提取** — 100% AI 提取字段，零正则零硬编码，反幻觉四重防线
- 🏭 **行业自适应系统** — 30+ 行业知识库，10+ 敏感行业检测，动态字段扩展
- 🔬 **深度分析引擎** — 风控逆向推演，12 种违规类型专业知识，智能风险评估
- 📋 **专业申诉材料生成** — 四层证据链，16 个成功案例模板，驳回预案，95017 话术
- ⚡ **SSE 流式传输** — AI 回复实时流出，首字节延迟 < 1 秒
- 💰 **Token 计费系统** — DeepSeek Token 统一计费，双模式（官方/自定义 API Key）
- 🧬 **自进化引擎 V3** — 自动分析对话质量 → 规则生成 → 效果评估 → 自动升降级
- 🏥 **模型健康检测** — 30 分钟巡检，故障自动切换，免费模型回退
- 🛠️ **全功能管理后台** — 用户/会话/配置/充值/案例库/进化引擎一站式管理
- 🔒 **全方位安全** — AES-256 加密 + JWT + helmet + rate-limit + CORS

---

## 🛠️ 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| **前端框架** | React 18 + React Router 6 | SPA 单页应用 |
| **UI 样式** | TailwindCSS 3.4 | 原子化 CSS |
| **构建工具** | Vite 6 | 极速构建 |
| **后端框架** | Express 4 | REST API + SSE |
| **数据库** | MySQL 8.0 (mysql2) | 数据持久化（25+ 表） |
| **AI 引擎** | 多模型（DeepSeek/智谱/通义/Moonshot 等 15+） | 对话/提取/报告/进化 |
| **进化引擎** | 自研 Evolution Engine V3 | 自动分析/规则生成/A/B 测试 |
| **安全** | helmet + cors + rate-limit + JWT + AES-256 | 全方位安全防护 |
| **Token 计算** | js-tiktoken | 精确 Token 计数 |

---

## 🚀 快速开始

### 前置条件

- Node.js 18+
- MySQL 5.7+ 或 8.0+
- DeepSeek API Key（从 https://platform.deepseek.com 获取）

### 安装步骤

```bash
git clone https://github.com/aiyangdie/merchant-appeal.git
cd merchant-appeal
npm install
```

### 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填写必填项：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=merchant_appeal

ENCRYPT_KEY=你的64位十六进制字符串
JWT_SECRET=你的随机字符串

PORT=3001
```

### 运行命令

```bash
npm run build
npm run start
```

开发模式：

```bash
npm run dev
```

### 访问系统

| 服务 | 地址 |
|------|------|
| 用户端 | http://localhost:3001 |
| 管理后台 | http://localhost:3001/admin |

管理后台默认账号：`admin` / `admin123`

登录管理后台 → 系统配置 → 填入 `deepseek_api_key` → 保存

---

## 📂 项目结构

```
merchant-appeal/
├── public/                          # 静态资源
├── src/                             # 前端源码（React 18 + TailwindCSS）
│   ├── components/                  # UI 组件（21 个）
│   │   ├── ChatMessage.jsx          # 聊天消息（Markdown + 延迟/Token 显示）
│   │   ├── InfoPanel.jsx            # 信息收集面板（9 组分类 + 动态扩展）
│   │   ├── AIAnalysisPanel.jsx      # AI 深度分析面板
│   │   ├── AppealGuidePanel.jsx     # 申诉指导面板
│   │   ├── AppealTextPanel.jsx      # 申诉文案面板
│   │   ├── TokenPanel.jsx           # Token 消耗可视化
│   │   ├── EvolutionPanel.jsx       # AI 进化引擎面板
│   │   ├── UserCenter.jsx           # 用户中心
│   │   └── ...                      # 其他组件
│   ├── pages/                       # 页面组件（4 个）
│   │   ├── ChatPage.jsx             # 主对话页面
│   │   ├── AdminPage.jsx            # 管理后台
│   │   ├── AdminLogin.jsx           # 管理员登录
│   │   └── ServicePage.jsx          # 客服服务页面
│   ├── App.jsx                      # 路由配置
│   └── main.jsx                     # 应用入口
├── server/                          # 后端源码（Express + MVC）
│   ├── app.js                       # Express 应用初始化
│   ├── index.js                     # 服务入口（100+ API 路由）
│   ├── ai.js                        # 多模型 AI 调用层
│   ├── localAI.js                   # 本地规则引擎
│   ├── knowledgeBase.js             # 行业知识库
│   ├── evolution.js                 # AI 自进化引擎 V3
│   ├── modelHealth.js               # 模型健康检测
│   ├── db.js                        # MySQL 数据访问层
│   ├── controllers/                 # MVC 控制器层
│   ├── models/                      # 数据模型层（10 个）
│   ├── services/                    # 业务服务层
│   ├── routes/                      # 路由层
│   ├── middleware/                   # 中间件（JWT/错误处理）
│   ├── config/                      # 配置层（数据库/种子数据）
│   ├── ai/                          # AI 子模块（LLM/RAG）
│   └── utils/                       # 工具库（加密/日志/JSON）
├── tests/                           # 测试（单元/集成）
├── scripts/                         # 辅助脚本
├── docs/                            # 文档
├── .env.example                     # 环境变量模板
├── Dockerfile                       # Docker 部署
├── docker-compose.yml               # Docker Compose
├── vite.config.js                   # Vite 构建配置
├── tailwind.config.js               # TailwindCSS 配置
├── package.json                     # v2.0.0
├── LICENSE                          # MIT 开源协议
└── README.md
```

---

## 🤝 贡献与许可证

欢迎贡献！请遵循以下流程：

1. **Fork** 本仓库
2. 创建特性分支: `git checkout -b feature/amazing-feature`
3. 提交更改: `git commit -m 'feat: add amazing feature'`
4. 推送分支: `git push origin feature/amazing-feature`
5. 提交 **Pull Request**

本项目基于 **MIT License** 开源协议。详见 [LICENSE](LICENSE)。

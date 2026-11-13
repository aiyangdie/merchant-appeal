<p align="center"><img src="assets/covers/01-merchant-appeal.jpg" alt="商户申诉助手 项目封面" width="100%"></p>

<h1 align="center">商户申诉助手 · Merchant Appeal</h1>

<p align="center">微信支付 / 商户号违规申诉的多轮对话收集、AI 诊断与材料生成平台</p>

## 简介

面向被限制、被投诉的微信支付商户：把散落在聊天里的申诉信息收拢成结构化材料，用 AI 先做一轮自查，再输出可提交的申诉文案与材料清单。后台额外集成了 AI 进化、AI 中枢与管理端助手，日常运维不必写代码。

## 功能

- **用户对话**：流式对话收集申诉背景、违规类型、交易凭证，边聊边补全材料
- **AI 诊断**：按申诉场景给出问题归因与补充建议，输出申诉文案草稿
- **AI 进化**：把真实对话沉淀为规则库，再注入 System Prompt，越用越贴合业务
- **管理端 AI 助手**：右下角悬浮入口，支持计划预览、确认执行、设置 / 充值 / 用户等操作
- **模型与中枢**：多厂商 OpenAI 兼容 API，健康检查、Key 导入、自然语言运维指令
- **闲鱼管家**：订单发货与改价（需自备 API Key）

## 技术栈

React 18 · Vite · Tailwind ｜ Node.js · Express · MySQL ｜ OpenAI 兼容多模型自动回退

## 快速开始

```bash
cp .env.example .env      # 填 MySQL、JWT_SECRET、DEEPSEEK_API_KEY 等
npm install
npm run dev
```

- 用户端：Vite 开发服务器（默认把 `/api` 代理到 `localhost:3001`）
- 管理端：`/admin`

自检脚本：

```bash
npm run test:unit     # 单元测试
npm run verify:all    # 全链路校验
```

## 项目结构

```
server/                 # Express 后端
  index.js              # 入口，启动进化定时器
  evolution.js          # AI 自进化引擎
  ai.js                 # 用户对话 Prompt
  ai/adminAgent.js      # 管理端 Agent
src/                    # React 前端
  pages/ChatPage.jsx
  pages/AdminPage.jsx
  components/EvolutionPanel.jsx
docs/                   # AI_EVOLUTION.md、superpowers 设计与实施计划
```

开发流程与协作约定见 [AGENTS.md](AGENTS.md)、[docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md)。

## 许可证

私有项目，授权与部署范围以仓库所有者约定为准。

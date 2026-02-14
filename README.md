# 🛡️ 微信商户号申诉专业助手

### Merchant Appeal Assistant — AI-Powered Smart Appeal Solution

> 基于 **多AI模型**的智能商户号申诉系统，具备**自我进化能力**。像真人顾问一样对话，自动收集信息、智能生成申诉材料，帮助商户高效解决微信支付风控问题。**越用越聪明、越用越精准、越用越赚钱。**

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![DeepSeek](https://img.shields.io/badge/AI-DeepSeek-7C3AED?style=for-the-badge)](https://deepseek.com/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://mysql.com/)
[![License](https://img.shields.io/badge/License-MIT-F59E0B?style=for-the-badge)](LICENSE)

---

## 📺 演示视频

> 🎬 完整功能演示视频，展示从对话收集到报告生成的全流程

<!-- 
  将视频上传到 YouTube/Bilibili 后，替换下面的链接：
  - YouTube: https://www.youtube.com/watch?v=YOUR_VIDEO_ID
  - Bilibili: https://www.bilibili.com/video/YOUR_VIDEO_ID
-->

[![演示视频](https://img.shields.io/badge/📺_观看演示视频-Bilibili-00A1D6?style=for-the-badge&logo=bilibili&logoColor=white)](https://www.bilibili.com/video/)
[![演示视频](https://img.shields.io/badge/📺_Watch_Demo-YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://www.youtube.com/)

<details>
<summary>📌 <b>演示视频目录（点击展开）</b></summary>

| 时间 | 内容 |
|------|------|
| 0:00 | 项目介绍与定位 |
| 0:30 | 用户注册与登录 |
| 1:00 | AI 智能对话收集信息 |
| 2:30 | 实时信息面板展示 |
| 3:00 | 行业自适应（动态字段扩展） |
| 4:00 | 深度分析报告（风控逆向推演） |
| 5:30 | 申诉文案一键生成 |
| 6:30 | 管理后台功能展示 |
| 7:30 | 充值与计费系统 |

</details>

---

## 📊 项目介绍 PPT

> 📑 项目完整介绍，适合汇报、路演、答辩使用

[![PPT下载](https://img.shields.io/badge/📑_项目介绍PPT-下载-4285F4?style=for-the-badge&logo=google-slides&logoColor=white)](docs/商户号申诉助手-项目介绍.pptx)

<details>
<summary>📌 <b>PPT 内容大纲（点击展开）</b></summary>

**第一部分：项目背景**
- 微信支付商户风控现状
- 商户申诉的痛点分析
- 市场需求与机会

**第二部分：产品方案**
- 系统架构设计
- AI 对话引擎原理
- DeepSeek 大模型集成方案

**第三部分：核心功能**
- 智能对话信息收集（16项+动态扩展）
- 12种违规类型专业知识库
- 16个真实成功案例模板
- 风控逆向推演分析
- 申诉材料自动生成

**第四部分：技术亮点**
- SSE 流式传输架构
- 反幻觉四重防线
- 行业自适应系统（30+行业）
- Token 精确计费系统

**第五部分：商业模式**
- Token 按量计费
- 双模式（官方/自定义API）
- 管理后台运营体系

</details>

---

## 🎯 项目定位

**这不是一个 Demo，是一个可直接商用的申诉工具。**

微信支付商户号被风控（冻结、封禁、限额、拦截）后，商户往往不知道怎么申诉、材料怎么写、重点在哪里。本系统通过 AI 对话收集信息，自动生成符合微信官方要求的申诉材料，大幅降低申诉门槛，提升通过率。

### 核心数据

| 指标 | 数据 |
|------|------|
| 覆盖行业 | **30+** 行业知识库 |
| 违规类型 | **12种** 专业知识（含申诉策略+材料清单+成功率预估） |
| 成功案例 | **16个** 真实案例模板（覆盖拦截/限额/关闭/冻结/封禁） |
| 敏感行业 | **10+** 敏感行业智能检测 |
| 信息收集 | **16项**基础 + 行业动态扩展字段 |
| DeepSeek调用 | **5处**（对话/提取/评估/报告/行业扩展） |

### 解决的核心痛点

| 痛点 | 本系统方案 |
|------|-----------|
| 商户不知道需要准备哪些材料 | AI 对话自动引导，像朋友聊天一样收集所有必要信息 |
| 申诉材料不专业、漏洞百出 | 基于行业知识库 + 成功案例，AI 生成严谨合规的申诉文案 |
| 不了解自己被处罚的原因和应对策略 | 12种违规类型专业知识 + 风控逆向推演分析 |
| 找专业顾问费用高昂 | Token 计费模式，成本低至几毛钱一次 |
| 模板化申诉千篇一律 | AI 根据每个商户的具体情况定制个性化申诉方案 |
| 被驳回后不知道怎么办 | 驳回预案 + 二次申诉策略 + 95017电话话术 |

---

## ✨ 核心特性

### 🤖 AI 智能对话引擎
- **DeepSeek 大模型驱动**：不是简单的问答机器人，是真正理解语义的 AI 顾问
- **自然语言理解**：用户说"钱取不出来"→自动识别为"资金冻结"，说"被封了"→"商户号封禁"
- **碎片化表达处理**：用户说话断断续续、前后矛盾、夹杂情绪，AI 都能准确理出有用信息
- **信息随时修正**：说错了随时改，AI 主动确认"之前是 XX，现在改成 YY 对吧？"

### 🔍 DeepSeek 统一智能提取
- **100% AI 提取**：所有字段提取由 DeepSeek API 完成，零正则、零硬编码
- **反幻觉四重防线**：对话 Prompt → 提取 Prompt → 报告 Prompt → 服务端校验
- **跨字段智能识别**：用户在回答 A 问题时顺带说了 B 的信息，AI 全部捕获
- **纠错检测**：自动识别"不是 XX 是 YY""之前说错了"等纠正意图

### 🏭 行业自适应系统
- **30+ 行业知识库**：电商、游戏、教育、医疗、金融等，每个行业有专属的申诉策略
- **10+ 敏感行业检测**：自动识别高风险行业（博彩、虚拟货币等），针对性处理
- **动态字段扩展**：根据行业自动增加特定信息收集项（如餐饮→食品安全许可证、游戏→版号）

### 🔬 深度分析引擎
- **风控逆向推演**：站在微信风控系统角度推演触发原因，反向设计反驳策略
- **12种违规类型**：交易异常、交易纠纷、跨类目、套现、欺诈、分销、赌博、色情、洗钱、内容违规、虚假交易、异地收款
- **智能风险评估**：多维度评分（处罚类型+违规原因+行业+投诉+申诉历史），自动预估成功率
- **个性化材料清单**：根据行业+违规原因动态生成，每项标注【必需/建议】+ 获取方式

### 📋 专业申诉材料生成
- **四层证据链**：主体合法性→经营真实性→交易真实性→问题已整改
- **16个成功案例模板**：覆盖餐饮、电商、游戏、直播、教育、代购、微商等
- **驳回预案**：自动生成二次申诉策略和增量证据方向
- **95017话术模板**：首次摸底+催审跟进两套电话话术
- **合规审核**：输出内容 100% 基于用户提供的真实信息，严禁编造

### ⚡ 极致性能体验
- **SSE 流式传输**：AI 回复实时流出，首字节延迟 < 1 秒
- **并行处理**：对话生成和字段提取并行执行，用户无感知
- **实时指标**：每条消息显示延迟、Token 用量、费用

### 💰 完整计费系统
- **DeepSeek Token 统一计费**：充值后使用，每次调用自动扣费
- **双模式支持**：官方模式（平台扣费）/ 自定义模式（用户自己的 API Key）
- **费用透明**：实时显示每条消息的 Token 消耗和费用

### 🛠️ 全功能管理后台
- **用户管理**：查看、删除用户，调整余额
- **会话监控**：实时查看所有对话，支持管理员人工回复
- **系统配置**：DeepSeek API Key、模型选择、费用倍率
- **充值审核**：用户充值订单审核确认
- **案例库管理**：维护成功申诉案例，提升 AI 生成质量

---

## 🏗️ 系统架构

```
用户浏览器                         服务端                           外部服务
┌──────────────┐              ┌─────────────────┐            ┌──────────────┐
│  React 18    │  SSE Stream  │  Express API    │            │ 多AI模型     │
│  TailwindCSS │◄────────────►│                 │◄──────────►│ DeepSeek     │
│  React Router│              │  ┌───────────┐  │            │ 智谱/通义/   │
└──────────────┘              │  │ 规则引擎   │  │            │ Moonshot等   │
                              │  │ (localAI)  │  │            └──────────────┘
                              │  └───────────┘  │
                              │  ┌───────────┐  │            ┌──────────────┐
                              │  │ 进化引擎V3 │  │◄──────────►│  MySQL 8.0   │
                              │  │ 自动学习   │  │            │  25+表       │
                              │  └───────────┘  │            └──────────────┘
                              │  ┌───────────┐  │
                              │  │ 模型健康   │  │
                              │  │ 自动切换   │  │
                              │  └───────────┘  │
                              └─────────────────┘
```

### AI 调用点（8 处）

| 调用场景 | 功能 | 模式 |
|----------|------|------|
| **对话生成** | 流式生成 AI 回复 | 立即流式输出 |
| **字段提取** | 从用户消息中提取结构化数据 | 与对话并行 |
| **完成度评估** | 判断信息是否充分 | 后台异步 |
| **报告生成** | 生成完整申诉材料 | 流式输出 |
| **行业扩展** | 动态生成额外信息收集项 | 触发式 |
| **对话分析** | 进化引擎质量评估 | 30分钟异步 |
| **规则生成** | 自动提炼最优规则 | 2小时异步 |
| **知识聚合** | 跨对话模式聚合 | 每日聚合 |

---

## 🚀 快速开始

### 环境要求

- **Node.js** 18+
- **MySQL** 5.7+ 或 8.0+
- **DeepSeek API Key**（从 https://platform.deepseek.com 获取）

### 1. 克隆项目

```bash
git clone https://github.com/aiyangdie/merchant-appeal.git
cd merchant-appeal
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填写以下必填项：

```env
# 数据库
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=merchant_appeal

# 安全密钥
ENCRYPT_KEY=你的64位十六进制字符串
JWT_SECRET=你的随机字符串

# 服务端口
PORT=3001
```

### 4. 构建并启动

```bash
npm run build    # 构建前端
npm run start    # 启动服务器
```

### 5. 访问系统

- **用户端**：http://localhost:3001
- **管理后台**：http://localhost:3001/admin（默认账号 `admin` / `admin123`）

### 6. 配置 DeepSeek

登录管理后台 → 系统配置 → 填入 `deepseek_api_key` → 保存

---

## 📁 项目结构

```
merchant-appeal/
├── public/                          # 静态资源
├── src/                             # 前端源码
│   ├── components/
│   │   ├── ChatMessage.jsx          # 聊天消息组件（含延迟/Token显示）
│   │   ├── InfoPanel.jsx            # 信息收集面板
│   │   ├── AIAnalysisPanel.jsx      # AI 分析面板
│   │   ├── AnalysisVisualView.jsx   # 分析可视化视图
│   │   ├── ReportCard.jsx           # 申诉报告卡片
│   │   ├── AppealTextPanel.jsx      # 申诉文案面板（含进度跟踪+反馈）
│   │   ├── TokenPanel.jsx           # Token消耗可视化面板
│   │   ├── UserCenter.jsx           # 用户中心（充值/用量）
│   │   └── ErrorBoundary.jsx        # 错误边界
│   ├── pages/
│   │   ├── ChatPage.jsx             # 主对话页面（含技术名片弹窗）
│   │   ├── AdminPage.jsx            # 管理后台（仪表盘+会话+用户+设置+Token+进化）
│   │   └── AdminLogin.jsx           # 管理员登录页
│   ├── App.jsx                      # 路由配置
│   ├── main.jsx                     # 入口
│   └── index.css                    # 全局样式（TailwindCSS）
├── server/                          # 后端源码
│   ├── index.js                     # Express 主入口（134K，100+API路由）
│   ├── ai.js                        # 多模型AI调用（提取/评估/扩展）
│   ├── localAI.js                   # 本地规则引擎（对话流程+知识库+报告）
│   ├── knowledgeBase.js             # 行业知识库+违规类型+材料清单
│   ├── evolution.js                 # AI自进化引擎V3（分析/规则/打标/聚合/A|B测试）
│   ├── modelHealth.js               # 模型健康检测+故障自动切换
│   ├── mall.js                      # 智能商城推荐引擎
│   ├── db.js                        # MySQL 数据访问层（25+表，自动建表+迁移）
│   ├── tokenizer.js                 # Token 统计与计费
│   └── crypto.js                    # AES-256 加解密
├── .env.example                     # 环境变量模板
├── DEPLOY.md                        # 生产部署指南（宝塔面板）
├── package.json
└── vite.config.js
```

---

## 🔧 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| **前端框架** | React 18 + React Router 6 | SPA 单页应用 |
| **UI 样式** | TailwindCSS 3.4 | 原子化 CSS |
| **构建工具** | Vite 6 | 极速构建 |
| **后端框架** | Express 4 | REST API + SSE |
| **数据库** | MySQL 8.0 (mysql2) | 数据持久化 |
| **AI 引擎** | 多模型(DeepSeek/智谱/通义/Moonshot等15+) | 对话/提取/报告/进化 |
| **进化引擎** | 自研 Evolution Engine V3 | 自动分析/规则生成/A|B测试 |
| **健康检测** | 自研 Model Health Monitor | 30分钟巡检/故障自动切换 |
| **安全** | helmet + cors + rate-limit + JWT + AES-256 | 全方位安全防护 |
| **Token 计算** | js-tiktoken | 精确 Token 计数 |

---

## 💻 API 接口概览

### 用户端

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/user/register` | 用户注册 |
| POST | `/api/user/login` | 用户登录 |
| POST | `/api/chat/stream` | SSE 流式 AI 对话 |
| GET | `/api/sessions/:id/info` | 获取会话收集信息 |
| PUT | `/api/sessions/:id/field` | 修改某个字段 |
| GET | `/api/sessions/:id/deep-analysis` | 深度分析报告 |
| POST | `/api/sessions/:id/generate-appeal-text` | 生成申诉文案 |
| POST | `/api/sessions/:id/appeal-feedback` | 标记申诉结果(通过/驳回) |
| GET | `/api/contact-card` | 获取技术人员名片(公开) |
| POST | `/api/recharge` | 用户充值 |
| GET | `/api/user/:id/usage` | 个人消费明细 |

### 管理端

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/login` | 管理员登录 |
| GET | `/api/admin/stats` | 仪表盘统计(含利润/模型健康/Token) |
| GET | `/api/admin/appeal-stats` | 申诉成功率统计(按行业/类型) |
| GET | `/api/admin/users` | 用户列表 |
| GET | `/api/admin/sessions` | 会话列表 |
| PUT | `/api/admin/recharge-orders/:id/confirm` | 确认充值 |
| POST/PUT/DELETE | `/api/admin/cases/*` | 案例库 CRUD |
| GET | `/api/admin/token-usage` | Token消耗统计 |
| GET/POST | `/api/admin/ai-models/*` | AI模型管理(CRUD/健康检测) |
| GET/POST | `/api/admin/ai-rules/*` | AI规则管理(审批/编辑) |
| GET | `/api/admin/evolution/*` | 进化引擎数据(分析/标签/聚类) |
| PUT | `/api/admin/system-config` | 系统配置(含技术名片) |

> 完整 100+ API 端点详见源码 `server/index.js`

---

## 🗄️ 数据库设计

系统启动时自动创建表结构，无需手动建表。

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `users` | 用户表 | phone(加密)、balance、api_mode |
| `sessions` | 会话表 | collected_data(JSON)、step |
| `messages` | 消息表 | role(user/assistant/admin)、content |
| `token_usage` | Token用量 | input/output_tokens、cost、type |
| `recharge_orders` | 充值订单 | amount、status |
| `success_cases` | 成功案例库 | industry、problem_type、strategy |
| `system_config` | 系统配置 | api_key(加密)、技术名片配置 |
| `appeal_texts` | 申诉文案 | 5段文案+appeal_status+user_feedback |
| `ai_models` | AI模型管理 | 15+模型、健康状态、自动切换 |
| `ai_rules` | AI进化规则库 | category、effectiveness_score |
| `conversation_analyses` | 对话分析结果 | 20+评分维度 |
| `conversation_tags` | 自动打标分类 | difficulty、outcome、quality |
| `knowledge_clusters` | 知识聚合簇 | 行业模式、违规模式、成功因素 |
| `learning_metrics` | 每日学习指标 | 完成率、满意度、规则变化 |
| `rule_change_log` | 规则审计日志 | action、before/after |
| `engine_health` | 引擎健康/熔断器 | 组件级监控 |
| `exploration_experiments` | A/B测试记录 | 实验性规则 |
| `mall_products` | 智能商城商品 | 推荐引擎 |
| `field_change_log` | 字段变更记录 | 审计追踪 |

---

## 🚢 生产部署

详见 [DEPLOY.md](DEPLOY.md)，核心步骤：

1. **服务器**：Linux + Node.js 18+ + MySQL 8.0 + Nginx
2. **构建**：`npm run build` 生成 `dist/`
3. **Nginx**：托管 `dist/` + 反代 `/api/` → Node:3001
4. **进程管理**：PM2 守护 `server/index.js`
5. **安全**：配置 HTTPS、强密钥、修改默认密码

---

## 🔒 安全机制

- **数据加密**：用户手机号、API Key 等敏感信息使用 AES-256 加密存储
- **JWT 认证**：用户和管理员分离的 JWT 认证体系
- **请求限速**：全局限速 + 聊天接口独立限速，防止滥用
- **安全头**：helmet 自动设置安全响应头
- **CORS 控制**：生产环境限制允许的跨域来源
- **反幻觉**：四层防线确保 AI 不编造任何信息

---

## 📊 计费规则

| 模式 | 说明 | 扣费 |
|------|------|------|
| **官方模式** | 使用平台 DeepSeek API Key | 按 Token 扣余额（倍率可调） |
| **自定义模式** | 用户自己的 API Key | 不扣平台余额 |

每条消息实时显示：输入 Token、输出 Token、费用。管理员可在后台调整费用倍率。

---

## ❓ 常见问题

<details>
<summary><b>页面空白</b></summary>
检查 dist/ 是否存在，Nginx root 是否指向 dist/
</details>

<details>
<summary><b>接口 502</b></summary>
检查 Node 进程是否运行（PM2），端口和 .env 配置是否正确
</details>

<details>
<summary><b>AI 不回复</b></summary>
管理后台检查 deepseek_api_key 是否已配置，用户余额是否充足
</details>

<details>
<summary><b>数据库初始化失败</b></summary>
检查 MySQL 账号权限和 DB_* 环境变量配置
</details>

---

## � 功能截图

<details>
<summary>📌 <b>点击展开查看截图</b></summary>

<!-- 将截图放入 docs/screenshots/ 目录，替换下方路径 -->

### 用户端 — AI 智能对话
> AI 像真人顾问一样引导商户逐步提供信息，自然对话、实时收集

![AI对话](docs/screenshots/chat.png)

### 用户端 — 实时信息面板
> 左侧实时展示已收集信息，支持手动修改任意字段

![信息面板](docs/screenshots/info-panel.png)

### 用户端 — 深度分析报告
> 风控逆向推演 + 四层证据链 + 行动计划时间线 + 95017话术

![深度分析](docs/screenshots/deep-analysis.png)

### 用户端 — 申诉文案生成
> 一键生成可直接提交微信的专业申诉文案

![申诉文案](docs/screenshots/appeal-text.png)

### 管理后台 — 数据概览
> 用户管理、会话监控、充值审核、系统配置一站式管理

![管理后台](docs/screenshots/admin.png)

</details>

---

## �🗺️ 路线图

### 已完成
- [x] AI 智能对话引擎（多模型驱动：DeepSeek/智谱/通义/Moonshot等15+）
- [x] 统一字段提取（反幻觉四重防线）
- [x] 行业自适应系统（30+ 行业 + 动态字段）
- [x] 12种违规类型专业知识库
- [x] 16个真实成功案例模板
- [x] 风控逆向推演 + 驳回预案
- [x] 95017电话策略 + 申诉渠道指南
- [x] 智能风险评估引擎
- [x] 申诉文案自动生成
- [x] Token 计费系统（双模式 + 可视化面板）
- [x] 全功能管理后台（仪表盘 + 品牌设计）
- [x] SSE 流式响应
- [x] **AI 自进化引擎 V3**（对话分析→规则生成→效果评估→自动升降级）
- [x] **模型健康检测**（30分钟巡检 + 故障自动切换 + 免费模型回退）
- [x] **申诉进度跟踪**（生成→提交→审核→通过/驳回 + 反馈闭环）
- [x] **成功率统计面板**（按行业/按违规类型 + 7天趋势 + 进化引擎学习）
- [x] **利润分析仪表盘**（充值收入/AI成本/毛利润/利润率）
- [x] **Token 超细化面板**（盈亏分析/IO比例/系统vs用户/按功能分类）
- [x] **技术人员名片系统**（管理员配置 + 用户端弹窗展示）
- [x] **AI 自动打标系统**（难度/用户类型/结果/行为模式）
- [x] **知识聚合簇**（行业模式/违规模式/成功因素/A|B实验）
- [x] **智能商城推荐**（基于用户画像的增值服务推荐）

### 规划中
- [ ] 微信小程序端
- [ ] 更多支付渠道对接
- [ ] 国际化多语言支持

---

## 🤝 贡献

欢迎提交 Issue 和 PR！

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m '添加某某功能'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 发起 Pull Request

---

## 📄 License

本项目采用 [MIT License](LICENSE) 开源协议。

---

## ⭐ Star History

如果这个项目对你有帮助，请给个 Star 支持一下！

**Made with ❤️ by [aiyang](https://github.com/aiyangdie)**

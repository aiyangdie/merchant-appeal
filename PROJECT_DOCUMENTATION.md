# 商户号申诉系统 - 完整项目文档

> 版本: 2.0.0
> 更新日期: 2026-04-13
> 状态: 已完成开发

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术架构](#2-技术架构)
3. [前端架构](#3-前端架构)
4. [后端架构](#4-后端架构)
5. [数据库设计](#5-数据库设计)
6. [API接口文档](#6-api接口文档)
7. [业务功能模块](#7-业务功能模块)
8. [AI服务模块](#8-ai服务模块)
9. [支付系统](#9-支付系统)
10. [部署指南](#10-部署指南)
11. [开发规范](#11-开发规范)
12. [常见问题](#12-常见问题)

---

## 1. 项目概述

### 1.1 项目简介

商户号申诉系统是一个基于AI大模型的智能商户号申诉辅助平台，帮助商户处理微信支付和支付宝商户号被风控、限制或封禁的问题。系统通过AI对话引导用户完成从账号类型识别到申诉材料准备的全流程。

### 1.2 核心功能

| 功能模块 | 描述 |
|---------|------|
| AI智能对话 | 基于大模型的7x24小时智能客服，引导用户完成申诉流程 |
| 账号诊断 | 自动识别商户号类型、风控状态、关联信息 |
| 材料管理 | 个性化材料清单生成、文件上传、状态跟踪 |
| 申诉文本生成 | AI自动生成专业的申诉报告和整改说明 |
| 进度跟踪 | 实时跟踪申诉状态，提供催办建议 |
| 知识库 | 内置商户号申诉专业知识库，支持RAG检索 |

### 1.3 支持的商户号类型

#### 微信支付商户号分类

| 类型 | 定义 | 特点 |
|------|------|------|
| 普通商户 | 商户自行申请入驻微信支付 | 可独立收款，收款能力强 |
| 特约商户(子商户) | 通过服务商协助入驻的商户 | 依赖服务商系统，需关联服务商 |
| 服务商 | 为特约商户提供支付服务的商户 | 不可直接收款，可发展下级商户 |
| 二级商户 | 通过电商平台入驻的商户 | 适用于电商场景 |

#### 支持的风控类型

- 涉嫌实时交易异常
- 涉嫌交易纠纷
- 涉嫌赌博
- 涉嫌从事未开放行业
- 涉嫌信用卡套现
- 涉嫌商户欺诈
- 涉嫌跨类目经营
- 涉嫌无资质经营
- 涉嫌多级分销返利
- 调单

### 1.4 技术特点

- **前后端分离**: React 18 + Express.js
- **AI驱动**: 支持多种大模型（OpenAI、DeepSeek等）
- **实时流式响应**: Server-Sent Events (SSE)
- **多支付渠道**: 微信支付、支付宝、Epay、CodePay
- **RAG知识库**: 基于向量检索的智能问答
- **响应式设计**: 完美适配移动端
- **安全可靠**: JWT认证、速率限制、数据加密

---

## 2. 技术架构

### 2.1 技术栈概览

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (React 18)                       │
│  Vite + TailwindCSS + React Router v6 + Axios              │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST + SSE
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      后端 (Node.js)                          │
│  Express.js + MySQL + JWT + Helmet                          │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   MySQL 数据库   │ │   AI 服务层     │ │   支付网关      │
│   (数据持久化)   │ │ (OpenAI/DeepSeek)│ │ (微信/支付宝)   │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 2.2 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.3.1 | UI框架 |
| Vite | 6.0.0 | 构建工具 |
| TailwindCSS | 3.4.15 | 原子化CSS |
| React Router | 6.28.0 | 路由管理 |
| Axios | 1.15.0 | HTTP客户端 |
| html2canvas | 1.4.1 | 截图生成 |

### 2.3 后端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | >=18.0.0 | 运行时 |
| Express | 4.21.0 | Web框架 |
| MySQL | 8.0+ | 数据库 |
| JWT | 9.0.3 | 身份认证 |
| bcryptjs | 3.0.3 | 密码加密 |
| winston | 3.19.0 | 日志管理 |

### 2.4 项目目录结构

```
merchant-appeal/
├── src/                          # 前端源码
│   ├── components/                # React组件
│   │   ├── ui/                   # 通用UI组件
│   │   │   ├── Button.jsx        # 按钮组件
│   │   │   ├── Input.jsx        # 输入框组件
│   │   │   ├── Card.jsx         # 卡片组件
│   │   │   ├── Avatar.jsx       # 头像组件
│   │   │   ├── Badge.jsx        # 徽章组件
│   │   │   ├── Modal.jsx        # 模态框组件
│   │   │   └── Spinner.jsx      # 加载组件
│   │   ├── layout/               # 布局组件
│   │   │   ├── PageHeader.jsx   # 页面头部
│   │   │   ├── PageContent.jsx  # 页面内容
│   │   │   ├── PageFooter.jsx   # 页面底部
│   │   │   └── Toast.jsx        # 吐司提示
│   │   ├── AIActivityPanel.jsx   # AI活动面板
│   │   ├── ChatMessage.jsx       # 聊天消息组件
│   │   └── ...
│   ├── pages/                    # 页面组件
│   │   ├── ChatPage.jsx         # 主聊天页面
│   │   ├── AdminPage.jsx        # 管理后台
│   │   ├── AdminLogin.jsx       # 管理员登录
│   │   └── ServicePage.jsx      # 服务页面
│   ├── styles/
│   │   └── tokens.css           # Design Tokens
│   ├── App.jsx                  # 根组件
│   ├── main.jsx                 # 入口文件
│   └── index.css                # 全局样式
│
├── server/                       # 后端源码
│   ├── ai/                      # AI服务
│   │   ├── core/
│   │   │   └── llm.js           # LLM调用封装
│   │   └── rag/
│   │       └── ragService.js    # RAG服务
│   ├── config/                  # 配置文件
│   │   ├── database.js          # 数据库配置
│   │   └── initDb.js           # 数据库初始化
│   ├── controllers/             # 控制器
│   │   ├── aiController.js      # AI控制器
│   │   ├── appealController.js   # 申诉控制器
│   │   ├── sessionController.js # 会话控制器
│   │   ├── userController.js    # 用户控制器
│   │   └── rechargeController.js# 充值控制器
│   ├── middleware/              # 中间件
│   │   ├── auth.js             # 认证中间件
│   │   └── errorHandler.js     # 错误处理
│   ├── models/                 # 数据模型
│   │   ├── User.js
│   │   ├── Session.js
│   │   ├── Message.js
│   │   └── Appeal.js
│   ├── routes/                 # 路由
│   │   ├── adminRoutes.js
│   │   ├── aiRoutes.js
│   │   ├── appealRoutes.js
│   │   ├── chatRoutes.js
│   │   ├── paymentRoutes.js
│   │   ├── sessionRoutes.js
│   │   └── userRoutes.js
│   ├── services/               # 业务服务
│   │   ├── appealService.js
│   │   ├── messageService.js
│   │   ├── sessionService.js
│   │   ├── userService.js
│   │   └── xianGuanService.js
│   ├── utils/                  # 工具函数
│   │   ├── crypto.js           # 加密工具
│   │   ├── logger.js           # 日志工具
│   │   └── jsonHelper.js       # JSON处理
│   ├── index.js                # 服务器入口
│   ├── ai.js                   # AI核心逻辑
│   ├── app.js                  # Express应用
│   ├── db.js                   # 数据库操作
│   ├── payment.js              # 支付处理
│   ├── tokenizer.js            # Token计算
│   └── evolution.js            # 自进化系统
│
├── public/                      # 静态资源
├── tests/                      # 测试文件
│   ├── integration/
│   └── unit/
├── docs/                       # 项目文档
├── scripts/                    # 脚本工具
├── init.sql                    # 数据库初始化
├── package.json
├── vite.config.js
└── tailwind.config.js
```

### 2.5 环境变量配置

```bash
# 服务器配置
PORT=3001
NODE_ENV=development

# JWT配置
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRES_IN=24h

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-password
DB_NAME=merchant_appeal

# AI配置
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
DEFAULT_MODEL=gpt-4o-mini

# 支付配置
WECHAT_APP_ID=wxxxx
WECHAT_MCH_ID=xxx
WECHAT_API_KEY=xxx
ALIPAY_APP_ID=xxx
ALIPAY_PRIVATE_KEY=xxx
EPAY_MERCHANT_ID=xxx
EPAY_API_KEY=xxx

# CORS配置
CORS_ORIGINS=*

# 邮件配置
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=xxx
SMTP_PASS=xxx
EMAIL_FROM=noreply@example.com
```

---

## 3. 前端架构

### 3.1 组件架构

#### 3.1.1 UI组件库

基于Design Tokens的模块化UI组件体系：

| 组件 | Props | 说明 |
|------|-------|------|
| Button | variant, size, icon, loading, disabled | 多状态按钮 |
| Input | label, error, helper, icon | 表单输入 |
| Card | variant, padding, hover | 卡片容器 |
| Avatar | src, size, shape, variant | 头像组件 |
| Badge | variant, size, dot | 徽章/标签 |
| Modal | isOpen, title, size, onClose | 模态框 |
| Spinner | size | 加载动画 |

#### 3.1.2 布局组件

| 组件 | 说明 |
|------|------|
| PageHeader | 粘性顶部导航栏 |
| PageContent | 自适应内容区域 |
| PageFooter | 底部导航栏 |
| Toast | 全局消息提示 |

### 3.2 Design Tokens 设计系统

```css
:root {
  /* 主题色 - 微信绿 */
  --color-primary: #07C160;
  --color-primary-hover: #06A854;
  --color-primary-active: #059048;
  --color-primary-light: #E8F8EE;
  --color-primary-dark: #055037;

  /* 辅助色 */
  --color-secondary: #576B95;
  --color-success: #07C160;
  --color-warning: #FF9900;
  --color-error: #FF3B30;
  --color-info: #1890FF;

  /* 阴影 */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 2px 8px rgba(0,0,0,0.06);
  --shadow-lg: 0 4px 16px rgba(0,0,0,0.08);

  /* 圆角 */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
}
```

### 3.3 路由配置

```jsx
// App.jsx 路由配置
<Routes>
  <Route path="/" element={<ChatPage />} />
  <Route path="/admin" element={<AdminLogin />} />
  <Route path="/admin/dashboard" element={<AdminPage />} />
  <Route path="/service/:orderNo" element={<ServicePage />} />
  <Route path="/recharge-success" element={<ChatPage />} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

### 3.4 页面说明

#### ChatPage (主聊天页面)
- AI智能对话界面
- 消息流式渲染
- Markdown内容解析
- 文件上传功能
- 申诉进度展示

#### ServicePage (服务页面)
- 专属顾问服务界面
- 订单关联聊天
- 快捷操作按钮
- 实时打字指示器

#### AdminPage (管理后台)
- 数据统计面板
- AI活动日志
- 用户管理
- 系统配置

#### AdminLogin (管理员登录)
- JWT认证
- 密码加密验证
- 登录状态管理

---

## 4. 后端架构

### 4.1 Express应用结构

```javascript
// server/index.js 架构
app = express()

// 安全中间件
├── helmet()              # HTTP安全头
├── cors()                # 跨域资源共享
├── rateLimit()           # 请求速率限制

// 解析中间件
├── express.json()        # JSON请求体
├── express.urlencoded() # URL编码
├── compression()         # 响应压缩

// API路由
├── /api/admin            # 管理员API
├── /api/ai              # AI对话API
├── /api/appeal          # 申诉API
├── /api/chat            # 聊天API
├── /api/payment         # 支付API
├── /api/session         # 会话API
└── /api/user            # 用户API

// 静态文件
└── /public              # 前端构建产物
```

### 4.2 中间件体系

#### 认证中间件 (auth.js)

```javascript
// JWT验证流程
1. 从请求头提取Authorization Bearer Token
2. 验证JWT签名和有效期
3. 附加用户信息到req.user
4. 角色检查(user/admin)
```

#### 错误处理中间件 (errorHandler.js)

```javascript
// 统一错误响应格式
{
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": {} // 可选的详细错误信息
  }
}
```

### 4.3 数据库操作 (db.js)

提供100+数据库操作函数：

| 类别 | 函数数量 | 示例 |
|------|---------|------|
| 用户管理 | ~15 | getUserByPhone, verifyAdmin |
| 会话管理 | ~15 | createSession, getMessages |
| 消息管理 | ~10 | addMessage, getAllSessions |
| 申诉管理 | ~10 | saveAppealText, updateAppealStatus |
| 充值管理 | ~10 | createRechargeOrder, confirmRechargeOrder |
| Token统计 | ~10 | recordTokenUsage, getUserTokenUsage |
| 系统配置 | ~10 | getSystemConfigs, updateSystemConfigs |

---

## 5. 数据库设计

### 5.1 ER图

```
┌──────────┐       ┌──────────┐       ┌──────────────┐
│  users   │──────<│ sessions │──────<│chat_messages │
└──────────┘       └──────────┘       └──────────────┘
      │                  │
      │                  │
      ▼                  ▼
┌──────────┐       ┌──────────────┐
│  orders  │       │merchant_info │
└──────────┘       └──────────────┘
      │                  │
      │                  │
      ▼                  ▼
┌──────────────┐  ┌───────────────┐
│appeal_records│  │appeal_materials│
└──────────────┘  └───────────────┘
```

### 5.2 核心表结构

#### users 用户表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| username | VARCHAR(50) | 用户名(唯一) |
| password | VARCHAR(255) | 密码(bcrypt加密) |
| phone | VARCHAR(20) | 手机号 |
| email | VARCHAR(100) | 邮箱 |
| role | ENUM | user/admin |
| balance | DECIMAL | 余额 |
| api_mode | ENUM | api调用的AI模式 |
| created_at | TIMESTAMP | 创建时间 |

#### sessions 会话表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| session_id | VARCHAR(64) | 会话ID(唯一) |
| user_id | INT | 用户ID |
| order_no | VARCHAR(64) | 订单号 |
| status | ENUM | active/closed/completed |

#### chat_messages 消息表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| session_id | INT | 会话ID |
| role | ENUM | user/assistant/system |
| content | TEXT | 消息内容 |
| metadata | JSON | 附加信息(模型、token等) |

#### appeal_records 申诉记录表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| session_id | INT | 会话ID |
| appeal_type | VARCHAR(50) | 申诉类型 |
| appeal_status | ENUM | pending/submitted/reviewing/approved/rejected |
| submitted_at | TIMESTAMP | 提交时间 |
| reviewed_at | TIMESTAMP | 审核时间 |

---

## 6. API接口文档

### 6.1 认证接口

#### POST /api/user/register
用户注册

**请求体:**
```json
{
  "phone": "13800138000",
  "password": "123456",
  "code": "1234"
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "userId": 1,
    "token": "eyJhbGciOiJIUzI1NiJ9..."
  }
}
```

#### POST /api/user/login
用户登录

**请求体:**
```json
{
  "phone": "13800138000",
  "password": "123456"
}
```

### 6.2 AI对话接口

#### POST /api/ai/chat
AI对话

**请求体:**
```json
{
  "message": "我的商户号被限制收款了怎么办",
  "sessionId": "sess_xxx",
  "userId": 1,
  "stream": false
}
```

**响应(非流式):**
```json
{
  "reply": "您好，商户号被限制收款可能有以下原因...",
  "sessionId": "sess_xxx",
  "tokens": {
    "inputTokens": 150,
    "outputTokens": 300
  }
}
```

#### POST /api/ai/chat/stream
AI流式对话

**请求头:**
```
Accept: text/event-stream
```

**响应:**
```
data: {"type":"start"}
data: {"type":"token","content":"您好"}
data: {"type":"token","content":"，"}
data: {"type":"token","content":"商"}
...
data: {"type":"done","tokens":{"inputTokens":150,"outputTokens":300}}
```

### 6.3 会话管理接口

#### GET /api/session/:id/messages
获取会话消息

**响应:**
```json
{
  "messages": [
    {"role": "user", "content": "问题", "created_at": "..."},
    {"role": "assistant", "content": "回答", "created_at": "..."}
  ]
}
```

#### POST /api/session/:id/generate-appeal-text
生成申诉文本

**响应:**
```json
{
  "appealText": "## 申诉报告\n\n### 一、商户基本情况\n...",
  "status": "generated"
}
```

### 6.4 支付接口

#### POST /api/payment/recharge
创建充值订单

**请求体:**
```json
{
  "amount": 100,
  "channel": "wechat"
}
```

**响应:**
```json
{
  "orderId": "R2024010100001",
  "payUrl": "weixin://wxpay/xxx",
  "qrCode": "base64..."
}
```

### 6.5 管理员接口

#### POST /api/admin/login
管理员登录

#### GET /api/admin/stats
获取统计数据

#### GET /api/admin/users
用户列表

#### PUT /api/admin/users/:id/balance
调整用户余额

---

## 7. 业务功能模块

### 7.1 申诉流程

```
用户输入商户号
      │
      ▼
┌─────────────┐
│  账号诊断   │ ──> 识别商户类型、风控状态
└─────────────┘
      │
      ▼
┌─────────────┐
│  风控识别   │ ──> 确定违规类型和严重程度
└─────────────┘
      │
      ▼
┌─────────────┐
│  材料准备   │ ──> 生成个性化材料清单
└─────────────┘
      │
      ▼
┌─────────────┐
│  申诉提交   │ ──> 生成申诉报告、整改说明
└─────────────┘
      │
      ▼
┌─────────────┐
│  进度跟踪   │ ──> 监控申诉状态
└─────────────┘
```

### 7.2 申诉材料清单

#### 基础信息材料

| 材料名称 | 必需 |
|---------|------|
| 商户号 | 是 |
| 公司名称 | 是 |
| 法人姓名 | 是 |
| 法人身份证号 | 是 |
| 法人手机号 | 是 |
| 联系人姓名 | 是 |
| 联系人手机号 | 是 |

#### 证照文件

| 材料名称 | 必需 |
|---------|------|
| 营业执照 | 是 |
| 法人身份证正反面 | 是 |
| 法人手持身份证照 | 是 |
| 经营场所证明 | 条件必需 |

#### 整改材料

| 材料名称 | 必需 |
|---------|------|
| 整改说明 | 是 |
| 整改证明材料 | 建议提供 |

### 7.3 订单服务流程

```
1. 用户下单购买服务
         │
         ▼
2. 创建充值订单(待支付)
         │
         ▼
3. 支付成功回调
         │
         ▼
4. 创建服务订单
         │
         ▼
5. 生成服务链接(/service/:orderNo)
         │
         ▼
6. 用户通过链接进入专属服务页面
```

---

## 8. AI服务模块

### 8.1 LLM调用架构

```javascript
// server/ai/core/llm.js
class LLMService {
  // 支持多模型配置
  models = [
    { name: 'gpt-4o', provider: 'openai' },
    { name: 'gpt-4o-mini', provider: 'openai' },
    { name: 'deepseek-chat', provider: 'deepseek' }
  ]

  // 模型健康检查
  async checkModelHealth(model) {}

  // 自动切换
  async callWithFallback(prompt, preferredModel) {}

  // 流式调用
  async *streamChat(model, messages) {}
}
```

### 8.2 RAG知识库检索

```javascript
// server/ai/rag/ragService.js
class RAGService {
  // 文档向量化
  async indexDocument(text, metadata) {}

  // 相似度检索
  async retrieve(query, topK = 5) {}

  // 生成增强上下文
  async buildContext(query, conversationHistory) {}
}
```

### 8.3 自进化系统

```javascript
// server/evolution.js
class EvolutionEngine {
  // 对话分析
  async analyzeConversation(session) {}

  // 规则生成
  async generateRules(analyses) {}

  // 规则效果评估
  async evaluateRuleEffectiveness(ruleId) {}

  // 自动规则优化
  async autoPromoteRules() {}
}
```

---

## 9. 支付系统

### 9.1 支付渠道

| 渠道 | 状态 | 说明 |
|------|------|------|
| 微信支付 | ✅ 支持 | 原生微信支付 |
| 支付宝 | ✅ 支持 | 沙箱/正式环境 |
| Epay | ✅ 支持 | 第三方聚合 |
| CodePay | ✅ 支持 | 码支付 |

### 9.2 支付流程

```
1. 前端调用 /api/payment/recharge
         │
         ▼
2. 后端创建支付订单
         │
         ▼
3. 调用支付渠道获取支付参数
         │
         ▼
4. 返回支付二维码/链接
         │
         ▼
5. 用户扫码支付
         │
         ▼
6. 支付渠道回调通知
         │
         ▼
7. 后端验证并更新订单状态
```

### 9.3 回调通知处理

```javascript
// 微信支付回调
POST /api/payment/wechat/notify

// 支付宝回调
POST /api/payment/alipay/notify

// Epay回调
POST /api/payment/epay/notify
```

---

## 10. 部署指南

### 10.1 开发环境部署

```bash
# 1. 克隆项目
git clone <repo-url>
cd merchant-appeal

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑.env填写配置

# 4. 初始化数据库
mysql -u root -p < init.sql

# 5. 启动开发服务器
npm run dev
```

### 10.2 Docker部署

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 10.3 生产环境部署

```bash
# 1. 构建前端
npm run build

# 2. 配置Nginx反向代理

# 3. 使用PM2启动后端
pm2 start server/index.js --name merchant-appeal

# 4. 配置SSL证书
```

### 10.4 性能优化建议

- 启用Redis缓存热点数据
- 配置CDN加速静态资源
- 使用Nginx gzip压缩
- 数据库读写分离
- 配置适当的连接池大小

---

## 11. 开发规范

### 11.1 前端规范

#### 组件规范

```jsx
// 1. 使用函数组件 + Hooks
// 2. 组件文件使用PascalCase
// 3. Props使用camelCase
// 4. 事件处理函数使用handle前缀

// Good
const UserCard = ({ userName, onEdit }) => {
  const handleEdit = () => onEdit(userName)
  return <div>...</div>
}

// Bad
const user_card = (props) => {
  const editHandler = () => props.on_edit(props.user_name)
  return <div>...</div>
}
```

#### 样式规范

```css
/* 1. 优先使用TailwindCSS */
/* 2. 自定义样式使用CSS变量 */
/* 3. 响应式设计使用移动优先 */

/* Good */
.button-primary {
  background-color: var(--color-primary);
  padding: var(--space-3) var(--space-4);
}

/* Bad */
.button-primary {
  background-color: #07C160;
  padding: 12px 16px;
}
```

### 11.2 后端规范

#### API设计原则

```
1. RESTful风格
2. 使用名词而非动词: /users 而非 /getUsers
3. 使用复数形式: /users 而非 /user
4. 层级关系: /users/{id}/orders
5. 错误状态码: 4xx客户端错误, 5xx服务端错误
```

#### 错误处理

```javascript
// 统一错误响应
const errorResponse = (res, code, message, details = null) => {
  res.status(code).json({
    success: false,
    error: { code, message, details }
  })
}

// 使用示例
if (!user) {
  return errorResponse(res, 404, 'USER_NOT_FOUND')
}
```

### 11.3 Git提交规范

```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式(不影响功能)
refactor: 重构
perf: 性能优化
test: 测试相关
chore: 构建/工具相关
```

---

## 12. 常见问题

### 12.1 数据库连接失败

**问题**: 连接MySQL时报错 "Connection refused"

**解决**:
1. 检查MySQL服务是否运行
2. 确认端口3306未被占用
3. 检查用户名密码是否正确
4. 确认数据库已创建

### 12.2 AI模型调用失败

**问题**: 调用OpenAI API时报错

**解决**:
1. 检查API Key是否正确配置
2. 确认网络能够访问OpenAI
3. 检查账户余额是否充足
4. 查看模型健康状态

### 12.3 支付回调失败

**问题**: 支付成功但订单未更新

**解决**:
1. 检查回调地址是否可达
2. 确认签名验证通过
3. 查看服务器日志排查原因
4. 联系支付渠道技术支持

### 12.4 前端构建失败

**问题**: npm run build 报错

**解决**:
1. 删除node_modules重新安装
2. 检查Node版本(需要>=18)
3. 确认vite配置正确
4. 查看具体错误信息

---

## 附录

### A. 常用命令

```bash
# 开发
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本

# 测试
npm test            # 运行测试
npm run test:watch  # 监听模式

# 代码质量
npm run lint        # ESLint检查
```

### B. 环境变量清单

| 变量名 | 必需 | 说明 |
|--------|------|------|
| JWT_SECRET | 是 | JWT签名密钥(>=32字符) |
| DB_HOST | 是 | 数据库主机 |
| DB_USER | 是 | 数据库用户名 |
| DB_PASSWORD | 是 | 数据库密码 |
| OPENAI_API_KEY | 是 | OpenAI API密钥 |

### C. 联系方式

- 技术支持: support@example.com
- 商务合作: business@example.com

---

*本文档最后更新于 2026-04-13*

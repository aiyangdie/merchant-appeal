# 商户号申诉专业助手 (Merchant Appeal Assistant)

## 目录

1. [项目概述](#1-项目概述)
2. [技术架构](#2-技术架构)
3. [项目结构](#3-项目结构)
4. [数据库设计](#4-数据库设计)
5. [核心服务层](#5-核心服务层)
6. [API接口文档](#6-api接口文档)
7. [前端组件](#7-前端组件)
8. [业务逻辑](#8-业务逻辑)
9. [部署指南](#9-部署指南)
10. [开发指南](#10-开发指南)

---

## 1. 项目概述

### 1.1 项目定位

商户号申诉专业助手是一个基于 **AI 大模型**的智能商户号申诉系统，旨在帮助商户高效解决微信支付、支付宝等平台的风控问题（冻结、封禁、限额、拦截等）。

**核心价值**：像真人顾问一样对话，自动收集信息、智能生成申诉材料，大幅降低申诉门槛，提升通过率。

### 1.2 项目版本

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0.0 | 2026-04-12 | 初始版本，AI对话引擎 + 申诉材料生成 |
| v2.0.0 | 2026-04-13 | MVC架构重构 + 新增申诉流程管理 + 材料清单系统 |

### 1.3 核心数据

| 指标 | 数据 |
|------|------|
| 覆盖行业 | **30+** 行业知识库 |
| 违规类型 | **12种** 专业知识 |
| 成功案例 | **16个** 真实案例模板 |
| 信息收集项 | **16项** 基础 + 行业动态扩展 |

### 1.4 技术指标

| 指标 | 数据 |
|------|------|
| 前端框架 | React 18 + TailwindCSS 3.4 + Vite 6 |
| 后端框架 | Express 4 + MVC架构 |
| 数据库 | MySQL 8.0 (4张核心业务表) |
| AI模型 | DeepSeek + 智谱 + 通义 + Moonshot 等15+模型 |
| 构建工具 | Vite 6 |

---

## 2. 技术架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户层                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │   Web端     │  │  小程序端   │  │   API接口   │           │
│  │  (React)   │  │   (规划中)  │  │   (REST)   │           │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘           │
└─────────┼─────────────────┼─────────────────┼───────────────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────────┐
│                         网关层                                   │
│              ┌──────────────┴──────────────┐                    │
│              │     API Gateway             │                    │
│              │  (认证、限流、日志、路由)   │                    │
│              └──────────────┬──────────────┘                    │
└─────────────────────────────┼───────────────────────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────────┐
│                       业务逻辑层                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │   商户      │  │   申诉      │  │   材料      │           │
│  │   诊断      │  │   流程      │  │   管理      │           │
│  │   服务      │  │   服务      │  │   服务      │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │   知识库    │  │   时间线    │  │   AI对话   │           │
│  │   服务      │  │   服务      │  │   引擎      │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
└─────────────────────────────┼───────────────────────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────────┐
│                        数据访问层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │  Merchant   │  │   Appeal    │  │  Material   │           │
│  │  Model     │  │   Model     │  │   Model    │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
└─────────────────────────────┼───────────────────────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────────┐
│                       基础设施层                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │   MySQL    │  │   Redis    │  │   文件存储  │           │
│  │   8.0      │  │   (可选)   │  │   (OSS)    │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
└───────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈详情

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 前端框架 | React | 18.3.1 | SPA 单页应用 |
| UI 样式 | TailwindCSS | 3.4.15 | 原子化 CSS |
| 状态管理 | React hooks | - | 内置状态管理 |
| 路由 | React Router | 6.28.0 | 页面路由 |
| 构建工具 | Vite | 6.0.0 | 极速构建 |
| 后端框架 | Express | 4.21.0 | REST API + SSE |
| 数据库 | MySQL | 8.0 | 数据持久化 |
| 文件上传 | Multer | 1.4.5-lts.1 | multipart/form-data |
| 安全 | helmet/cors/JWT | - | 全方位安全防护 |
| 日志 | Winston | 3.19.0 | 日志记录 |

### 2.3 API路由架构

```
/api
├── /chat              # AI对话相关
│   └── /stream        # SSE流式对话
├── /session           # 会话管理
│   └── /:id          # 会话详情
├── /user              # 用户管理
│   ├── /register      # 用户注册
│   ├── /login        # 用户登录
│   └── /:id          # 用户详情
├── /admin             # 管理后台
│   ├── /login        # 管理员登录
│   ├── /stats        # 统计面板
│   └── /...          # 管理功能
├── /merchant          # 商户管理 (v2.0新增)
│   ├── /diagnose     # 商户诊断
│   └── /:merchantId  # 商户详情
├── /appeals           # 申诉管理 (v2.0新增)
│   ├── /             # 创建申诉
│   ├── /:id          # 申诉详情
│   ├── /:id/submit   # 提交申诉
│   ├── /:id/cancel   # 取消申诉
│   └── /:id/materials # 材料清单
├── /materials         # 材料管理 (v2.0新增)
│   └── /:id/upload   # 上传材料
└── /knowledge         # 知识库 (v2.0新增)
    ├── /merchant-types    # 商户类型知识
    ├── /risk-types        # 风控类型知识
    └── /faqs              # 常见问题
```

---

## 3. 项目结构

### 3.1 目录结构

```
merchant-appeal/
├── public/                              # 静态资源
│   └── vite.svg                        # Vite Logo
├── src/                                 # 前端源码
│   ├── components/                      # UI组件
│   │   ├── AIActivityPanel.jsx        # AI活动监控
│   │   ├── AIAnalysisPanel.jsx        # AI分析面板
│   │   ├── AIModelsPanel.jsx           # AI模型管理
│   │   ├── AnalysisVisualView.jsx       # 分析可视化
│   │   ├── AppealGuidePanel.jsx        # 申诉指导面板
│   │   ├── AppealProgressPanel.jsx      # 申诉进度面板 (v2.0)
│   │   ├── AppealSubmitPanel.jsx        # 申诉提交面板 (v2.0)
│   │   ├── AppealTextPanel.jsx          # 申诉文案面板
│   │   ├── BackupPanel.jsx              # 备份管理
│   │   ├── ChatMessage.jsx              # 聊天消息
│   │   ├── ComplaintDocPanel.jsx         # 投诉材料
│   │   ├── ContactCardsPanel.jsx         # 联系人名片
│   │   ├── ErrorBoundary.jsx           # 错误边界
│   │   ├── EvolutionPanel.jsx           # 进化引擎面板
│   │   ├── InfoPanel.jsx                # 信息收集面板
│   │   ├── MallPanel.jsx               # 商城面板
│   │   ├── MaterialChecklistPanel.jsx    # 材料清单面板 (v2.0)
│   │   ├── MerchantDiagnosisPanel.jsx    # 商户诊断面板 (v2.0)
│   │   ├── MonitorPanel.jsx             # 监控面板
│   │   ├── QualityDashboard.jsx         # 质量仪表盘
│   │   ├── ReportCard.jsx               # 报告卡片
│   │   ├── TokenPanel.jsx               # Token面板
│   │   ├── TypingIndicator.jsx           # 输入动画
│   │   ├── UserAvatar.jsx              # 用户头像
│   │   └── UserCenter.jsx               # 用户中心
│   ├── pages/                           # 页面级组件
│   │   ├── AdminLogin.jsx              # 管理登录
│   │   ├── AdminPage.jsx                # 管理后台
│   │   ├── ChatPage.jsx                 # 主对话页
│   │   └── ServicePage.jsx              # 客服页面
│   ├── App.jsx                          # 路由配置
│   ├── main.jsx                         # 应用入口
│   └── index.css                        # 全局样式
├── server/                              # 后端源码
│   ├── ai/                             # AI子模块
│   │   ├── core/
│   │   │   └── llm.js                 # LLM调用核心
│   │   └── rag/
│   │       └── ragService.js           # RAG检索服务
│   ├── config/                         # 配置层
│   │   ├── database.js                 # 数据库连接
│   │   ├── initDb.js                   # 数据库初始化
│   │   ├── migrations.js               # 数据迁移 (v2.0)
│   │   └── seedData.js                 # 种子数据
│   ├── controllers/                     # 控制器层
│   │   ├── aiController.js             # AI控制器
│   │   ├── appealController.js         # 申诉控制器
│   │   ├── rechargeController.js        # 充值控制器
│   │   ├── sessionController.js        # 会话控制器
│   │   └── userController.js           # 用户控制器
│   ├── middleware/                      # 中间件层
│   │   ├── auth.js                     # JWT认证
│   │   └── errorHandler.js             # 错误处理
│   ├── models/                         # 数据模型层 (v2.0扩展)
│   │   ├── Appeal.js                  # 申诉模型(旧)
│   │   ├── KnowledgeBase.js            # 知识库模型
│   │   ├── Material.js                # 材料模型 (v2.0)
│   │   ├── Merchant.js                 # 商户模型 (v2.0)
│   │   ├── Message.js                 # 消息模型
│   │   ├── NewAppeal.js               # 申诉模型 (v2.0)
│   │   ├── Order.js                   # 订单模型
│   │   ├── Product.js                # 商品模型
│   │   ├── RechargeOrder.js          # 充值订单
│   │   ├── Session.js                # 会话模型
│   │   ├── SystemConfig.js          # 系统配置
│   │   ├── Timeline.js              # 时间线模型 (v2.0)
│   │   ├── TokenUsage.js            # Token用量
│   │   └── User.js                  # 用户模型
│   ├── routes/                       # 路由层 (v2.0扩展)
│   │   ├── adminRoutes.js           # 管理后台路由
│   │   ├── aiRoutes.js              # AI路由
│   │   ├── appealRoutes.js           # 申诉路由 (v2.0)
│   │   ├── chatRoutes.js            # 对话路由
│   │   ├── index.js                 # 路由汇总
│   │   ├── knowledgeRoutes.js        # 知识库路由 (v2.0)
│   │   ├── materialRoutes.js         # 材料路由 (v2.0)
│   │   ├── merchantRoutes.js        # 商户路由 (v2.0)
│   │   ├── paymentRoutes.js         # 支付路由
│   │   ├── sessionRoutes.js         # 会话路由
│   │   └── userRoutes.js           # 用户路由
│   ├── services/                     # 业务服务层 (v2.0核心)
│   │   ├── appealFlowService.js     # 申诉流程服务 (v2.0)
│   │   ├── appealService.js        # 申诉服务(旧)
│   │   ├── emailService.js         # 邮件服务
│   │   ├── materialService.js       # 材料管理服务 (v2.0)
│   │   ├── merchantDiagnosisService.js # 商户诊断服务 (v2.0)
│   │   ├── messageService.js       # 消息服务
│   │   ├── sessionService.js       # 会话服务
│   │   ├── timelineService.js      # 时间线服务 (v2.0)
│   │   ├── userService.js         # 用户服务
│   │   └── xianGuanService.js     # 闲鱼服务
│   ├── utils/                       # 工具库
│   │   ├── crypto.js              # AES加密
│   │   ├── enhancedLogger.js      # 增强日志
│   │   ├── jsonHelper.js         # JSON处理
│   │   └── logger.js             # 日志工具
│   ├── app.js                      # Express应用入口
│   ├── index.js                   # 服务端入口
│   ├── ai.js                      # AI调用层
│   ├── localAI.js                 # 本地规则引擎
│   ├── knowledgeBase.js           # 知识库
│   ├── evolution.js              # 进化引擎
│   ├── modelHealth.js            # 模型健康检测
│   ├── mall.js                   # 商城引擎
│   ├── monitor.js                # 监控服务
│   ├── backup.js               # 备份服务
│   ├── payment.js              # 支付服务
│   ├── cache.js               # 缓存服务
│   ├── db-optimize.js         # 数据库优化
│   ├── tokenizer.js           # Token计算
│   └── start.bat              # 启动脚本
├── uploads/                      # 上传文件目录
│   └── materials/              # 材料上传目录
├── docs/                        # 项目文档
├── tests/                       # 测试目录
├── .env.example                # 环境变量模板
├── package.json                # 项目配置
├── vite.config.js             # Vite配置
├── tailwind.config.js         # TailwindCSS配置
├── postcss.config.js          # PostCSS配置
└── index.html                 # HTML入口
```

### 3.2 前端组件说明

| 组件 | 文件路径 | 功能描述 |
|------|---------|---------|
| 商户诊断面板 | `src/components/MerchantDiagnosisPanel.jsx` | 商户号输入、格式验证、诊断结果显示、风控状态展示 |
| 材料清单面板 | `src/components/MaterialChecklistPanel.jsx` | 分类展示材料、Tab切换、上传组件、完整度进度条 |
| 申诉提交面板 | `src/components/AppealSubmitPanel.jsx` | 材料确认清单、提交须知、确认对话框、提交状态管理 |
| 申诉进度面板 | `src/components/AppealProgressPanel.jsx` | 审核状态展示、时间线组件、催办按钮、联系客服入口 |
| AI分析面板 | `src/components/AIAnalysisPanel.jsx` | 深度分析报告展示 |
| 信息收集面板 | `src/components/InfoPanel.jsx` | 已收集信息展示、手动修改支持 |

---

## 4. 数据库设计

### 4.1 核心业务表 (v2.0新增)

#### merchants - 商户信息表

```sql
CREATE TABLE merchants (
    id              TEXT PRIMARY KEY,           -- 主键ID
    merchant_id     TEXT UNIQUE NOT NULL,       -- 商户号（mchid，10位数字）
    name            TEXT,                       -- 商户名称
    merchant_type   TEXT NOT NULL,               -- 商户类型（普通商户/特约商户/服务商/二级商户）
    subject_type    TEXT NOT NULL,               -- 主体类型（企业/个体工商户/党政机关/事业单位）
    business_scene  TEXT,                       -- 经营场景（JSON数组）
    app_ids         TEXT,                       -- 关联AppID列表（JSON数组）
    settlement_cycle TEXT DEFAULT 'T+1',         -- 结算周期
    risk_status     TEXT DEFAULT 'NORMAL',     -- 风控状态（NORMAL/LIMITED/CLOSED）
    risk_level      TEXT DEFAULT '',            -- 风控等级（high/medium/low）
    risk_reasons    TEXT,                       -- 风控原因（JSON数组）
    contact_name    TEXT DEFAULT '',            -- 联系人姓名
    contact_phone   TEXT DEFAULT '',           -- 联系人电话
    contact_email   TEXT DEFAULT '',          -- 联系人邮箱
    business_address TEXT DEFAULT '',          -- 经营地址
    license_number  TEXT DEFAULT '',          -- 营业执照号
    license_expiry  TEXT DEFAULT '',           -- 营业执照有效期
    created_at      TEXT NOT NULL,             -- 创建时间
    updated_at      TEXT NOT NULL              -- 更新时间
);
```

#### appeals - 申诉记录表

```sql
CREATE TABLE appeals (
    id                  TEXT PRIMARY KEY,       -- 主键ID
    merchant_id         TEXT NOT NULL,         -- 商户ID（关联merchants表）
    risk_type           TEXT NOT NULL,         -- 风控类型
    risk_details        TEXT DEFAULT '',       -- 风控详情
    status              TEXT NOT NULL,         -- 申诉状态
    progress            INTEGER DEFAULT 0,     -- 进度（0-100）
    submitter_name      TEXT NOT NULL,        -- 提交人姓名
    submitter_phone     TEXT NOT NULL,        -- 提交人电话
    submitter_email     TEXT DEFAULT '',      -- 提交人邮箱
    appeal_reason       TEXT DEFAULT '',      -- 申诉理由
    improvement_measures TEXT DEFAULT '',     -- 整改措施
    submitted_at        TEXT,                  -- 提交时间
    reviewed_at         TEXT,                  -- 审核时间
    completed_at        TEXT,                  -- 完成时间
    reviewer_name       TEXT DEFAULT '',       -- 审核员姓名
    reviewer_notes      TEXT DEFAULT '',       -- 审核备注
    external_appeal_id  TEXT DEFAULT '',      -- 外部申诉ID（微信）
    created_at          TEXT NOT NULL,         -- 创建时间
    updated_at          TEXT NOT NULL          -- 更新时间
);
```

#### materials - 材料清单表

```sql
CREATE TABLE materials (
    id              TEXT PRIMARY KEY,       -- 主键ID
    appeal_id       TEXT NOT NULL,         -- 申诉ID（关联appeals表）
    type            TEXT NOT NULL,         -- 材料类型
    name            TEXT NOT NULL,         -- 材料名称
    required        INTEGER NOT NULL,      -- 是否必需（0/1）
    status          TEXT NOT NULL,         -- 状态（pending/uploaded/verified/rejected）
    file_path       TEXT DEFAULT '',        -- 文件路径
    file_name       TEXT DEFAULT '',        -- 文件名
    file_size       INTEGER DEFAULT 0,    -- 文件大小
    mime_type       TEXT DEFAULT '',       -- MIME类型
    upload_url      TEXT DEFAULT '',       -- 访问URL
    uploaded_at     TEXT,                  -- 上传时间
    verified_at     TEXT,                  -- 验证时间
    verifier_notes  TEXT DEFAULT '',       -- 审核备注
    created_at      TEXT NOT NULL,         -- 创建时间
    updated_at      TEXT NOT NULL          -- 更新时间
);
```

#### timeline - 时间线记录表

```sql
CREATE TABLE timeline (
    id              TEXT PRIMARY KEY,       -- 主键ID
    appeal_id       TEXT NOT NULL,         -- 申诉ID（关联appeals表）
    event           TEXT NOT NULL,         -- 事件描述
    status          TEXT NOT NULL,         -- 状态
    operator        TEXT DEFAULT '',        -- 操作人
    operator_type   TEXT DEFAULT 'system', -- 操作人类型（user/admin/system）
    details         TEXT,                   -- 详细信息（JSON）
    timestamp       TEXT NOT NULL,         -- 发生时间
    created_at      TEXT NOT NULL          -- 创建时间
);
```

### 4.2 材料类型枚举

| 类型代码 | 类型名称 | 所属分类 |
|---------|---------|---------|
| MERCHANT_ID | 商户号 | 基础信息 |
| CONTACT_INFO | 联系方式 | 基础信息 |
| BUSINESS_LICENSE | 营业执照 | 证照文件 |
| ID_CARD_FRONT | 身份证正面 | 证照文件 |
| ID_CARD_BACK | 身份证反面 | 证照文件 |
| ID_CARD_HANDHELD | 手持身份证照 | 证照文件 |
| STORE_PHOTO | 经营场所照片 | 经营证明 |
| LOCATION_SCREENSHOT | 定位截图 | 经营证明 |
| TRANSACTION_RECEIPT | 交易小票 | 经营证明 |
| IMPROVEMENT_PLAN | 整改计划 | 整改材料 |
| COMMITMENT_LETTER | 承诺书 | 整改材料 |

### 4.3 申诉状态枚举

| 状态值 | 状态名称 | 说明 |
|--------|---------|------|
| not_started | 未开始 | 申诉尚未开始 |
| preparing | 准备中 | 材料准备阶段 |
| submitted | 已提交 | 申诉已提交审核 |
| reviewing | 审核中 | 正在审核 |
| approved | 已通过 | 申诉通过 |
| rejected | 已驳回 | 申诉被驳回 |
| cancelled | 已取消 | 用户取消申诉 |

---

## 5. 核心服务层

### 5.1 商户诊断服务 (merchantDiagnosisService)

**文件路径**: `server/services/merchantDiagnosisService.js`

**功能说明**:
- 验证商户号格式（10位数字）
- 分析商户风控状态
- 返回诊断结果和建议

**核心方法**:

```javascript
// 商户诊断
async diagnose(merchantId: string): Promise<DiagnosisResult>

// 获取商户详情
async getMerchantDetails(merchantId: string): Promise<MerchantDetails>

// 更新商户信息
async updateMerchant(merchantId: string, updateData: object): Promise<MerchantDetails>
```

**诊断结果结构**:

```typescript
interface DiagnosisResult {
  merchantId: string;           // 商户号
  merchantType: string;         // 商户类型
  subjectType: string;         // 主体类型
  businessScene: string[];     // 经营场景
  settlementCycle: string;     // 结算周期
  appIdCount: number;          // 关联AppID数量
  riskStatus: string;          // 风控状态
  riskLevel: string;           // 风控等级
  riskReasons: string[];        // 风控原因
  isValid: boolean;             // 是否有效
  errorMessage?: string;        // 错误信息（如有）
}
```

### 5.2 申诉流程服务 (appealFlowService)

**文件路径**: `server/services/appealFlowService.js`

**功能说明**:
- 创建申诉记录
- 提交申诉（需材料完整）
- 取消申诉
- 获取申诉详情
- 获取申诉列表

**核心方法**:

```javascript
// 创建申诉
async createAppeal(dto: CreateAppealDTO): Promise<AppealFlowResult>

// 提交申诉
async submitAppeal(appealId: string): Promise<AppealFlowResult>

// 取消申诉
async cancelAppeal(appealId: string): Promise<AppealFlowResult>

// 获取申诉详情
async getAppealDetails(appealId: string): Promise<AppealDetails>

// 获取申诉列表
async getAppeals(filters: AppealFilters): Promise<AppealListResult>

// 计算材料完整度
async calculateCompletionRate(appealId: string): Promise<number>
```

**创建申诉参数**:

```typescript
interface CreateAppealDTO {
  merchantId: string;           // 商户号
  riskType: string;            // 风控类型
  riskDetails?: string;        // 风控详情
  submitterName: string;       // 提交人姓名
  submitterPhone: string;      // 提交人电话
  submitterEmail?: string;     // 提交人邮箱
  appealReason?: string;       // 申诉理由
  improvementMeasures?: string; // 整改措施
}
```

**申诉流程状态机**:

```
[创建] → [准备中] → [已提交] → [审核中] → [已通过]
                      ↓                      ↓
                [已取消]              [已驳回] → [重新申诉]
```

### 5.3 材料管理服务 (materialService)

**文件路径**: `server/services/materialService.js`

**功能说明**:
- 根据风控类型生成材料清单
- 上传材料文件
- 验证材料格式和大小
- 计算材料完整度

**核心方法**:

```javascript
// 生成材料清单
async generateMaterialChecklist(appealId: string, riskType: string, merchantType: string): Promise<void>

// 获取材料清单
async getMaterialChecklist(riskType: string, merchantType: string): Promise<ChecklistCategory[]>

// 上传材料
async uploadMaterial(materialId: string, fileData: FileData): Promise<Material>

// 获取材料统计
async getMaterialStats(appealId: string): Promise<MaterialStats>

// 计算完整度
async calculateCompletionRate(appealId: string): Promise<number>
```

**材料配置结构**:

```typescript
const MATERIAL_CONFIG = {
  basic: [
    // 基础信息材料
  ],
  license: [
    // 证照文件材料
  ],
  business: [
    // 经营证明材料
  ],
  improvement: [
    // 整改材料（根据风控类型判断是否必需）
  ]
}
```

### 5.4 时间线服务 (timelineService)

**文件路径**: `server/services/timelineService.js`

**功能说明**:
- 记录申诉操作时间线
- 获取时间线历史
- 格式化时间显示

**核心方法**:

```javascript
// 记录事件
async recordEvent(event: TimelineEvent): Promise<Timeline>

// 获取时间线
async getTimeline(appealId: string): Promise<Timeline[]>

// 获取格式化时间线
async getTimelineFormatted(appealId: string): Promise<FormattedTimeline[]>
```

---

## 6. API接口文档

### 6.1 商户接口

#### 商户诊断

```
POST /api/merchant/diagnose
```

**请求参数**:

```json
{
  "merchantId": "1234567890"
}
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "merchantId": "1234567890",
    "merchantType": "普通商户",
    "subjectType": "企业",
    "businessScene": ["线下门店", "小程序"],
    "settlementCycle": "T+1",
    "appIdCount": 2,
    "riskStatus": "LIMITED",
    "riskLevel": "medium",
    "riskReasons": ["涉嫌交易异常"],
    "isValid": true
  },
  "message": "诊断成功"
}
```

#### 获取商户详情

```
GET /api/merchant/:merchantId
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "id": "merchant_xxx",
    "merchantId": "1234567890",
    "name": "测试商户",
    "merchantType": "普通商户",
    "subjectType": "企业",
    "riskStatus": "LIMITED",
    "appeals": [
      {
        "id": "appeal_xxx",
        "status": "reviewing",
        "riskType": "涉嫌交易异常",
        "submittedAt": "2026-04-13T10:00:00Z"
      }
    ]
  }
}
```

### 6.2 申诉接口

#### 创建申诉

```
POST /api/appeals
```

**请求参数**:

```json
{
  "merchantId": "1234567890",
  "riskType": "TRANSACTION_ANOMALY",
  "riskDetails": "近期交易量波动较大",
  "submitterName": "张三",
  "submitterPhone": "13800138000",
  "submitterEmail": "zhangsan@example.com",
  "appealReason": "业务正常开展，促销活动导致",
  "improvementMeasures": "已优化促销活动方案"
}
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "id": "appeal_xxx",
    "merchantId": "1234567890",
    "status": "preparing",
    "progress": 0,
    "createdAt": "2026-04-13T10:00:00Z"
  },
  "message": "申诉创建成功，请按照材料清单准备申诉材料"
}
```

#### 获取申诉详情

```
GET /api/appeals/:id
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "id": "appeal_xxx",
    "merchantId": "1234567890",
    "merchant": {
      "name": "测试商户",
      "merchantType": "普通商户"
    },
    "riskType": "涉嫌交易异常",
    "status": "reviewing",
    "progress": 50,
    "submitterName": "张三",
    "materials": [...],
    "timeline": [...],
    "completionRate": 80
  }
}
```

#### 提交申诉

```
POST /api/appeals/:id/submit
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "id": "appeal_xxx",
    "status": "submitted",
    "progress": 30,
    "submittedAt": "2026-04-13T10:30:00Z"
  },
  "message": "申诉提交成功，预计1-7个工作日内完成审核"
}
```

#### 获取材料清单

```
GET /api/appeals/:appealId/materials
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "appealId": "appeal_xxx",
    "completionRate": 60,
    "checklist": [
      {
        "category": "基础信息",
        "items": [
          {
            "id": "material_xxx",
            "type": "MERCHANT_ID",
            "name": "商户号",
            "required": true,
            "status": "uploaded"
          }
        ]
      }
    ]
  }
}
```

### 6.3 材料接口

#### 上传材料

```
POST /api/materials/:id/upload
Content-Type: multipart/form-data
```

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| file | File | 是 | 上传的文件 |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "id": "material_xxx",
    "status": "uploaded",
    "fileName": "营业执照.jpg",
    "fileUrl": "/uploads/materials/xxx.jpg",
    "uploadedAt": "2026-04-13T10:00:00Z"
  },
  "message": "上传成功"
}
```

### 6.4 知识库接口

#### 获取商户类型知识

```
GET /api/knowledge/merchant-types
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "ordinary": {
      "name": "普通商户",
      "description": "商户自行申请入驻微信支付...",
      "features": ["可独立收款", "收款能力较强"],
      "advantages": [...],
      "limitations": [...]
    }
  }
}
```

#### 获取风控类型知识

```
GET /api/knowledge/risk-types/:riskType
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "type": "TRANSACTION_ANOMALY",
    "name": "涉嫌实时交易异常",
    "description": "商户交易行为触发风控策略...",
    "commonReasons": [...],
    "suggestedMaterials": [...],
    "improvementSuggestions": [...]
  }
}
```

#### 获取常见问题

```
GET /api/knowledge/faqs
```

**响应示例**:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "question": "商户号申诉需要多长时间？",
      "answer": "普通申诉一般1-7个工作日..."
    }
  ]
}
```

### 6.5 错误码定义

| 错误码 | 说明 |
|--------|------|
| E001 | 参数错误 |
| E002 | 认证失败 |
| E003 | 权限不足 |
| E004 | 资源不存在 |
| E005 | 资源已存在 |
| E101 | 服务器内部错误 |
| E102 | 数据库错误 |
| E103 | 外部服务调用失败 |
| E104 | 文件存储错误 |
| E201 | 商户号不存在 |
| E202 | 商户号已存在 |
| E203 | 申诉不存在 |
| E204 | 申诉状态不允许此操作 |
| E205 | 材料不完整 |
| E206 | 材料格式错误 |

---

## 7. 前端组件

### 7.1 商户诊断面板 (MerchantDiagnosisPanel)

**文件路径**: `src/components/MerchantDiagnosisPanel.jsx`

**功能说明**: 商户号输入、格式验证、诊断结果显示

**组件Props**:

```typescript
interface MerchantDiagnosisPanelProps {
  onDiagnosisComplete?: (result: DiagnosisResult) => void;  // 诊断完成回调
  onStartAppeal?: (result: DiagnosisResult) => void;        // 开始申诉回调
}
```

**UI结构**:

```
┌─────────────────────────────────────────┐
│  商户号诊断                              │
├─────────────────────────────────────────┤
│  输入商户号（mchid）                     │
│  ┌─────────────────────────────────┐    │
│  │ 请输入10位商户号                  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [开始诊断]                              │
├─────────────────────────────────────────┤
│  诊断结果区域（诊断后显示）               │
│  ┌─────────────────────────────────┐    │
│  │ ✓ 商户号类型：普通商户           │    │
│  │ ✓ 主体类型：企业                 │    │
│  │ ⚠ 风控状态：存在限制             │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [重新诊断]    [开始申诉]                │
└─────────────────────────────────────────┘
```

**状态管理**:

```javascript
const [merchantId, setMerchantId] = useState('');        // 商户号输入
const [loading, setLoading] = useState(false);             // 加载状态
const [error, setError] = useState('');                  // 错误信息
const [diagnosisResult, setDiagnosisResult] = useState(null); // 诊断结果
```

### 7.2 材料清单面板 (MaterialChecklistPanel)

**文件路径**: `src/components/MaterialChecklistPanel.jsx`

**功能说明**: 分类展示材料清单、文件上传、完整度指示

**组件Props**:

```typescript
interface MaterialChecklistPanelProps {
  appealId: string;                        // 申诉ID
  materials?: Material[];                  // 材料列表
  completionRate?: number;                  // 完整度百分比
  onUploadComplete?: (material: Material) => void; // 上传完成回调
}
```

**Tab分类**:

| Tab Key | Tab名称 | 材料类型 |
|---------|--------|---------|
| basic | 基础信息 | MERCHANT_ID, CONTACT_INFO |
| license | 证照文件 | BUSINESS_LICENSE, ID_CARD_FRONT, ID_CARD_BACK, ID_CARD_HANDHELD |
| business | 经营证明 | STORE_PHOTO, LOCATION_SCREENSHOT, TRANSACTION_RECEIPT |
| improvement | 整改材料 | IMPROVEMENT_PLAN, COMMITMENT_LETTER |

**状态图标**:

| 状态 | 图标 | 颜色 |
|------|------|------|
| pending | 空心圆圈 | gray |
| uploaded | 绿色勾选 | green |
| verified | 绿色勾选 | green |
| rejected | 红色叉号 | red |

### 7.3 申诉提交面板 (AppealSubmitPanel)

**文件路径**: `src/components/AppealSubmitPanel.jsx`

**功能说明**: 材料确认清单展示、提交须知、确认对话框

**组件Props**:

```typescript
interface AppealSubmitPanelProps {
  appeal: Appeal;                          // 申诉对象
  materials?: Material[];                 // 材料列表
  onSubmitSuccess?: (result: SubmitResult) => void; // 提交成功回调
  onCancel?: () => void;                  // 取消回调
}
```

**提交前检查**:

```javascript
const completedCount = materials.filter(
  m => m.status === 'uploaded' || m.status === 'verified'
).length;
const allCompleted = completedCount === totalCount;
```

**确认对话框**:

```
┌─────────────────────────────────────────┐
│  确认提交申诉？                          │
│                                         │
│  提交后将进入审核流程，                  │
│  请确保所有材料真实有效                  │
│                                         │
│   [取消]            [确认提交]           │
│                                         │
└─────────────────────────────────────────┘
```

### 7.4 申诉进度面板 (AppealProgressPanel)

**文件路径**: `src/components/AppealProgressPanel.jsx`

**功能说明**: 审核状态展示、进度时间线、催办功能

**组件Props**:

```typescript
interface AppealProgressPanelProps {
  appealId: string;                        // 申诉ID
  status?: string;                         // 当前状态
  timeline?: TimelineEvent[];             // 时间线事件
}
```

**进度步骤**:

```
[创建申诉] → [材料准备] → [提交申诉] → [审核中] → [完成]
     ●─────────────●─────────────●─────────────○─────────────○
```

**状态配置**:

| 状态 | 图标 | 颜色 |
|------|------|------|
| not_started | 空心圆○ | gray |
| preparing | 沙漏⏳ | blue |
| submitted | 沙漏⏳ | orange |
| reviewing | 沙漏⏳ | orange |
| approved | 勾选✓ | green |
| rejected | 叉号✗ | red |
| cancelled | 空心圆○ | gray |

---

## 8. 业务逻辑

### 8.1 申诉完整流程

```
┌─────────────────────────────┐
│      1. 商户诊断            │
│  输入商户号 → 验证格式       │
│  → 查询风控状态 → 返回诊断结果│
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│      2. 创建申诉            │
│  选择风控类型 → 填写提交人   │
│  信息 → 创建申诉记录         │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│      3. 材料准备            │
│  根据风控类型生成材料清单   │
│  → 上传材料 → 验证完整度    │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│      4. 提交申诉            │
│  检查材料完整度 → 确认提交   │
│  → 更新状态 → 记录时间线    │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│      5. 审核进度           │
│  查看审核状态 → 时间线展示  │
│  → 催办功能 → 联系客服     │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│      6. 审核结果            │
│  通过 → 申诉完成            │
│  驳回 → 查看原因 → 重新申诉  │
└─────────────────────────────┘
```

### 8.2 材料完整度计算

```javascript
calculateCompletionRate(materials) {
  const requiredMaterials = materials.filter(m => m.required);
  const completedMaterials = requiredMaterials.filter(
    m => m.status === 'uploaded' || m.status === 'verified'
  );

  return Math.round(
    (completedMaterials.length / requiredMaterials.length) * 100
  );
}
```

### 8.3 整改材料判断逻辑

```javascript
isImprovementRequired(riskType) {
  const typesRequiringImprovement = [
    'TRANSACTION_DISPUTE',    // 涉嫌交易纠纷
    'MERCHANT_FRAUD',         // 涉嫌商户欺诈
    'CROSS_CATEGORY',         // 涉嫌跨类目经营
    'NO_QUALIFICATION',        // 涉嫌无资质经营
    '涉嫌交易纠纷',
    '涉嫌商户欺诈',
    '涉嫌跨类目经营',
    '涉嫌无资质经营'
  ];

  return typesRequiringImprovement.some(
    type => riskType && riskType.includes(type)
  );
}
```

### 8.4 风控等级分析

```javascript
analyzeRiskStatus(merchant) {
  const status = merchant.risk_status || 'UNKNOWN';
  const reasons = merchant.risk_reasons || [];

  let level = 'normal';

  if (status === 'LIMITED') {
    // 高风险：涉及赌博、欺诈等
    level = reasons.some(r =>
      r.includes('赌') || r.includes('欺诈')
    ) ? 'high' : 'medium';
  } else if (status === 'CLOSED') {
    level = 'high';
  }

  return {
    status: status === 'UNKNOWN' ? 'NORMAL' : status,
    level,
    reasons
  };
}
```

---

## 9. 部署指南

### 9.1 环境要求

| 环境 | 版本要求 |
|------|---------|
| Node.js | 18+ |
| MySQL | 8.0+ |
| npm | 8+ |

### 9.2 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/aiyangdie/merchant-appeal.git
cd merchant-appeal

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填写数据库配置

# 4. 构建前端
npm run build

# 5. 启动服务
npm run start
```

### 9.3 环境变量配置

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=merchant_appeal

# 服务端口
PORT=3001

# JWT密钥
JWT_SECRET=your_jwt_secret

# 加密密钥
ENCRYPT_KEY=your_encrypt_key
```

### 9.4 Nginx配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/merchant-appeal/dist;
        try_files $uri $uri/ /index.html;
    }

    # API代理
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 9.5 PM2进程管理

```bash
# 启动服务
pm2 start server/index.js --name merchant-appeal

# 查看状态
pm2 status merchant-appeal

# 查看日志
pm2 logs merchant-appeal

# 重启服务
pm2 restart merchant-appeal
```

---

## 10. 开发指南

### 10.1 项目启动

```bash
# 开发模式（前端热重载 + 后端热重载）
npm run dev

# 单独启动前端开发服务器
npm run dev:client

# 单独启动后端（支持热重载）
npm run dev:server
```

### 10.2 目录规范

```
server/
├── controllers/      # 控制器：处理请求/响应
├── models/           # 数据模型：数据结构和CRUD
├── services/        # 业务逻辑：复杂业务处理
├── routes/         # 路由定义：URL映射
├── middleware/     # 中间件：认证、错误处理等
├── config/         # 配置文件：数据库、中间件配置
├── utils/          # 工具函数：通用辅助函数
└── ai/            # AI模块：LLM调用、RAG等
```

### 10.3 代码风格

- **命名规范**：
  - 变量/函数：camelCase
  - 类名：PascalCase
  - 常量：UPPER_SNAKE_CASE
  - 文件名：camelCase.js

- **注释规范**：
  - 函数说明使用 JSDoc
  - 复杂逻辑添加行内注释
  - 代码块分隔使用分节注释

### 10.4 API设计原则

1. **RESTful规范**：使用HTTP方法语义
2. **统一响应格式**：
   ```json
   {
     "success": true/false,
     "data": {},
     "message": "",
     "error": { "code": "", "message": "" }
   }
   ```
3. **错误处理**：所有接口都有错误处理
4. **日志记录**：关键操作记录日志

### 10.5 测试

```bash
# 运行所有测试
npm test

# 运行测试并监听变化
npm run test:watch

# 运行CI测试
npm run test:ci
```

### 10.6 新增功能流程

1. **数据库层**：在 `server/config/migrations.js` 添加表结构
2. **Model层**：在 `server/models/` 创建数据模型
3. **Service层**：在 `server/services/` 实现业务逻辑
4. **Route层**：在 `server/routes/` 定义API路由
5. **Controller层**：在 `server/controllers/` 处理请求响应
6. **前端组件**：在 `src/components/` 创建UI组件

---

## 附录

### A. 术语表

| 术语 | 说明 |
|------|------|
| mchid | 商户号ID，微信支付分配的10位数字 |
| appid | 应用ID，微信开放平台为应用分配的唯一标识 |
| sub_mchid | 子商户号，特约商户的商户号 |
| T+0/T+1/T+7 | 结算周期，表示交易后多少天结算 |
| 调单 | 微信要求商户提供交易凭证核实 |
| 风控 | 风险控制，平台对商户的异常行为进行限制 |

### B. 常用链接

| 链接 | 用途 |
|------|------|
| https://pay.weixin.qq.com | 微信支付商户平台 |
| https://kf.qq.com | 腾讯客服 |
| https://platform.deepseek.com | DeepSeek API平台 |

### C. 更新日志

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| 1.0.0 | 2026-04-12 | 初始版本，包含AI对话引擎和申诉材料生成 |
| 2.0.0 | 2026-04-13 | MVC架构重构，新增申诉流程管理、材料清单系统、知识库API |

---

**文档版本**: v2.0.0
**最后更新**: 2026-04-13
**维护团队**: 商户号申诉开发团队

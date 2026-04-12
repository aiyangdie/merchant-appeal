# 商户号申诉智能服务系统 - 后端开发文档

**文档版本**: V1.0
**编写日期**: 2026-04-13
**面向角色**: 后端开发者
**产品经理**: AI产品经理

---

## 1. 技术栈概述

### 1.1 核心技术选型

| 技术 | 选择 | 版本 | 说明 |
|-----|------|------|------|
| 运行时 | Node.js | 20.x LTS | 服务端运行 |
| 开发语言 | TypeScript | 5.x | 类型安全 |
| Web框架 | Express / NestJS | 5.x / 10.x | API服务 |
| ORM | Prisma / TypeORM | 5.x / 2.x | 数据库操作 |
| 数据库 | MySQL | 8.0 | 主业务数据 |
| 缓存 | Redis | 7.x | 缓存/会话 |
| 消息队列 | Bull / RabbitMQ | 6.x | 异步任务 |
| 文件存储 | 阿里云OSS | - | 文件存储 |
| AI服务 | OpenAI / Anthropic | - | 大模型API |
| 向量数据库 | Pinecone / Qdrant | - | 知识库向量 |
| 日志 | Winston / Pino | - | 日志系统 |
| 验证 | Joi / Zod | - | 数据验证 |
| API文档 | Swagger / tsoa | - | 接口文档 |
| 容器化 | Docker / Kubernetes | - | 容器编排 |
| CI/CD | GitHub Actions | - | 持续集成 |

### 1.2 技术架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         后端技术架构                                 │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          负载均衡层                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                    │
│  │ Nginx     │  │  API GW   │  │  K8s LB   │                    │
│  │ 静态资源  │  │  路由/限流 │  │  负载均衡  │                    │
│  └────────────┘  └────────────┘  └────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           API服务层                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Express / NestJS                          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │
│  │  │ 路由层   │ │ 中间件   │ │ 控制器   │ │ 服务层   │       │   │
│  │  │ Routes  │ │Middleware│ │Controller│ │ Service  │       │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      业务服务层                             │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │
│  │  │ 用户服务 │ │ 订单服务 │ │ AI服务   │ │ 支付服务 │       │   │
│  │  │Customer  │ │  Order   │ │   AI     │ │   Pay    │       │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │
│  │  │ 消息服务 │ │ 文件服务 │ │ 知识库   │ │ 学习服务 │       │   │
│  │  │   Msg    │ │  File    │ │    KB    │ │  Learn   │       │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           数据层                                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐   │
│  │ MySQL     │  │ Redis     │  │ MongoDB   │  │   OSS     │   │
│  │ 主业务数据 │  │ 缓存/会话  │  │ 日志/聊天  │  │ 文件存储  │   │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘   │
│  ┌────────────┐                                                      │
│  │ Vector DB │  (知识库向量检索)                                       │
│  └────────────┘                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           AI层                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐   │
│  │ GPT-4 API │  │Claude API │  │ Embedding  │  │ RAG Engine │   │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 项目结构

### 2.1 目录结构

```
merchant-appeal-backend/
├── src/
│   ├── app.ts                        # 应用入口
│   ├── server.ts                     # 服务启动
│   │
│   ├── config/                       # 配置目录
│   │   ├── index.ts                 # 配置入口
│   │   ├── database.ts              # 数据库配置
│   │   ├── redis.ts                 # Redis配置
│   │   ├── ai.ts                    # AI服务配置
│   │   ├── oss.ts                   # OSS配置
│   │   └── payment.ts               # 支付配置
│   │
│   ├── modules/                     # 模块目录（NestJS风格）
│   │   │
│   │   ├── common/                  # 公共模块
│   │   │   ├── decorators/          # 装饰器
│   │   │   │   ├── auth.decorator.ts
│   │   │   │   ├── roles.decorator.ts
│   │   │   │   └── .../
│   │   │   ├── filters/             # 异常过滤器
│   │   │   │   ├── http-exception.filter.ts
│   │   │   │   └── .../
│   │   │   ├── interceptors/        # 拦截器
│   │   │   │   ├── logging.interceptor.ts
│   │   │   │   └── transform.interceptor.ts
│   │   │   ├── guards/             # 守卫
│   │   │   │   ├── auth.guard.ts
│   │   │   │   └── roles.guard.ts
│   │   │   ├── middleware/          # 中间件
│   │   │   │   ├── logger.middleware.ts
│   │   │   │   └── cors.middleware.ts
│   │   │   ├── pipes/              # 管道
│   │   │   │   ├── validation.pipe.ts
│   │   │   │   └── transform.pipe.ts
│   │   │   └── utils/              # 工具函数
│   │   │       └── response.util.ts
│   │   │
│   │   ├── auth/                    # 认证模块
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/         # 认证策略
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── local.strategy.ts
│   │   │   └── dto/
│   │   │       ├── login.dto.ts
│   │   │       └── register.dto.ts
│   │   │
│   │   ├── user/                    # 用户模块
│   │   │   ├── user.module.ts
│   │   │   ├── user.controller.ts
│   │   │   ├── user.service.ts
│   │   │   └── entity/
│   │   │       └── user.entity.ts
│   │   │
│   │   ├── customer/                # 客户模块
│   │   │   ├── customer.module.ts
│   │   │   ├── customer.controller.ts
│   │   │   ├── customer.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-customer.dto.ts
│   │   │   │   ├── update-customer.dto.ts
│   │   │   │   └── query-customer.dto.ts
│   │   │   └── entity/
│   │   │       └── customer.entity.ts
│   │   │
│   │   ├── order/                  # 订单模块
│   │   │   ├── order.module.ts
│   │   │   ├── order.controller.ts
│   │   │   ├── order.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-order.dto.ts
│   │   │   │   ├── update-order.dto.ts
│   │   │   │   └── query-order.dto.ts
│   │   │   └── entity/
│   │   │       ├── order.entity.ts
│   │   │       └── order-item.entity.ts
│   │   │
│   │   ├── product/               # 商品模块
│   │   │   ├── product.module.ts
│   │   │   ├── product.controller.ts
│   │   │   ├── product.service.ts
│   │   │   └── entity/
│   │   │       └── product.entity.ts
│   │   │
│   │   ├── chat/                   # AI对话模块
│   │   │   ├── chat.module.ts
│   │   │   ├── chat.controller.ts
│   │   │   ├── chat.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── send-message.dto.ts
│   │   │   │   └── chat-history.dto.ts
│   │   │   ├── entity/
│   │   │   │   └── conversation.entity.ts
│   │   │   └── ai/
│   │   │       ├── ai-chat.service.ts    # AI对话核心
│   │   │       ├── intent-recognition.ts  # 意图识别
│   │   │       ├── entity-extraction.ts   # 实体提取
│   │   │       └── prompt-templates.ts    # Prompt模板
│   │   │
│   │   ├── document/              # 材料文档模块
│   │   │   ├── document.module.ts
│   │   │   ├── document.controller.ts
│   │   │   ├── document.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── generate-document.dto.ts
│   │   │   │   └── query-document.dto.ts
│   │   │   ├── entity/
│   │   │   │   └── document.entity.ts
│   │   │   └── generator/
│   │   │       ├── appeal-statement.generator.ts
│   │   │       ├── rectification-report.generator.ts
│   │   │       └── commitment-letter.generator.ts
│   │   │
│   │   ├── payment/              # 支付模块
│   │   │   ├── payment.module.ts
│   │   │   ├── payment.controller.ts
│   │   │   ├── payment.service.ts
│   │   │   ├── wechat/
│   │   │   │   └── wechat-pay.service.ts
│   │   │   └── alipay/
│   │   │       └── alipay.service.ts
│   │   │
│   │   ├── xianyu/              # 闲鱼模块
│   │   │   ├── xianyu.module.ts
│   │   │   ├── xianyu.controller.ts
│   │   │   ├── xianyu.service.ts
│   │   │   ├── webhook/
│   │   │   │   └── message.webhook.ts
│   │   │   └── dto/
│   │   │       └── webhook.dto.ts
│   │   │
│   │   ├── knowledge/           # 知识库模块
│   │   │   ├── knowledge.module.ts
│   │   │   ├── knowledge.controller.ts
│   │   │   ├── knowledge.service.ts
│   │   │   ├── entity/
│   │   │   │   └── knowledge.entity.ts
│   │   │   └── vector/
│   │   │       ├── embedding.service.ts
│   │   │       └── vector-search.service.ts
│   │   │
│   │   ├── learning/            # 学习模块
│   │   │   ├── learning.module.ts
│   │   │   ├── learning.service.ts
│   │   │   └── entity/
│   │   │       └── learning-log.entity.ts
│   │   │
│   │   └── stats/              # 统计模块
│   │       ├── stats.module.ts
│   │       ├── stats.controller.ts
│   │       └── stats.service.ts
│   │
│   ├── entities/               # 独立实体目录（如不使用NestJS模块化）
│   │   ├── customer.entity.ts
│   │   ├── order.entity.ts
│   │   ├── product.entity.ts
│   │   ├── conversation.entity.ts
│   │   ├── document.entity.ts
│   │   └── knowledge.entity.ts
│   │
│   ├── database/               # 数据库相关
│   │   ├── migrations/        # 数据库迁移
│   │   └── seeds/             # 种子数据
│   │
│   ├── queues/                 # 队列任务
│   │   ├── queue.module.ts
│   │   └── processors/
│   │       ├── document.processor.ts
│   │       └── notification.processor.ts
│   │
│   ├── shared/                 # 共享服务
│   │   ├── logger/
│   │   │   └── logger.service.ts
│   │   ├── cache/
│   │   │   └── cache.service.ts
│   │   └── file/
│   │       └── file.service.ts
│   │
│   ├── types/                  # 全局类型
│   │   └── index.d.ts
│   │
│   └── constants/              # 常量
│       └── index.ts
│
├── prisma/                    # Prisma ORM
│   └── schema.prisma
│
├── test/                       # 测试
│   ├── unit/
│   └── e2e/
│
├── scripts/                    # 脚本
│   └── seed.ts
│
├── .env.example
├── .eslintrc.js
├── .prettierrc
├── tsconfig.json
├── nest-cli.json (如果使用NestJS)
├── package.json
└── README.md
```

---

## 3. 数据库设计

### 3.1 Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

enum MerchantIdType {
  wechat
  alipay
  both
}

enum MerchantType {
  普通商户
  特约商户
  服务商
  二级商户
}

enum SubjectType {
  企业
  个体工商户
  党政机关
  事业单位
  其他组织
}

enum RiskLevel {
  warning
  limited
  closed
}

enum CustomerStatus {
  potential
  consulting
  intentional
  purchased
  completed
  failed
}

enum OrderStatus {
  pending
  confirmed
  cancelled
  refunded
}

enum PayStatus {
  unpaid
  paid
  refunding
  refunded
}

enum PayMethod {
  wechat
  alipay
  xianyu
  bank
}

enum DeliveryStatus {
  undelivered
  delivered
  confirmed
}

enum OrderType {
  product
  custom
  package
}

model User {
  id            Int       @id @default(autoincrement())
  username      String    @unique
  password      String
  nickname      String
  avatar        String?
  role          String    @default("staff")
  permissions   Json      @default("[]")
  isActive      Boolean   @default(true)
  lastLoginAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?

  @@map("users")
}

model Customer {
  id                Int             @id @default(autoincrement())
  xianyuNick        String          @map("xianyu_nick")
  xianyuUserId      String?         @map("xianyu_user_id")
  wechatOpenid      String?         @map("wechat_openid")
  merchantId        String?         @map("merchant_id")
  merchantIdType    MerchantIdType  @default(wechat) @map("merchant_id_type")
  merchantType      MerchantType?   @map("merchant_type")
  subjectType       SubjectType?    @map("subject_type")
  companyName       String?         @map("company_name")
  legalPerson       String?         @map("legal_person")
  legalPersonId    String?         @map("legal_person_id")
  phone             String?
  riskType          String?         @map("risk_type")
  riskLevel         RiskLevel?      @map("risk_level")
  riskDetails       String?         @map("risk_details")
  infoStatus        CustomerStatus  @default(pending) @map("info_status")
  customerStatus    CustomerStatus  @default(potential) @map("customer_status")
  source            String?
  tags              Json            @default("[]")
  internalNotes     String?         @map("internal_notes")
  lastContactAt     DateTime?       @map("last_contact_at")
  nextFollowupAt    DateTime?       @map("next_followup_at")
  createdAt         DateTime        @default(now()) @map("created_at")
  updatedAt         DateTime        @updatedAt @map("updated_at")
  deletedAt         DateTime?       @map("deleted_at")

  orders            Order[]
  conversations     Conversation[]
  documents         Document[]
  appealResults     AppealResult[]

  @@index([xianyuNick])
  @@index([merchantId])
  @@index([phone])
  @@index([customerStatus])
  @@index([createdAt])
  @@map("customers")
}

model Product {
  id              Int           @id @default(autoincrement())
  productNo       String        @unique @map("product_no")
  name            String
  subtitle        String?
  description     String?       @db.Text
  productType     OrderType     @default(product) @map("product_type")
  price           Decimal       @db.Decimal(10, 2)
  costPrice       Decimal?      @map("cost_price") @db.Decimal(10, 2)
  profit          Decimal?      @db.Decimal(10, 2)
  riskTypes       Json          @default("[]") @map("risk_types")
  includes        Json          @default("[]")
  deliveryType    DeliveryStatus @default(auto) @map("delivery_type")
  deliveryContent Json           @default("[]") @map("delivery_content")
  xianyuItemId    String?       @map("xianyu_item_id")
  xianyuStatus    String        @default("draft") @map("xianyu_status")
  stock           Int           @default(999)
  salesCount      Int           @default(0) @map("sales_count")
  rating          Decimal       @default(5.00) @db.Decimal(3, 2)
  isActive        Boolean       @default(true) @map("is_active")
  sortOrder       Int           @default(0) @map("sort_order")
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")
  deletedAt       DateTime?     @map("deleted_at")

  orderItems      OrderItem[]

  @@index([productType])
  @@index([price])
  @@index([isActive])
  @@map("products")
}

model Order {
  id                Int           @id @default(autoincrement())
  orderNo           String        @unique @map("order_no")
  customerId        Int           @map("customer_id")
  productId         Int?          @map("product_id")
  orderType         OrderType     @default(product) @map("order_type")
  status            OrderStatus   @default(pending)
  totalAmount       Decimal       @db.Decimal(10, 2) @map("total_amount")
  discountAmount    Decimal       @default(0.00) @map("discount_amount") @db.Decimal(10, 2)
  payAmount         Decimal       @db.Decimal(10, 2) @map("pay_amount")
  payStatus         PayStatus     @default(unpaid) @map("pay_status")
  payMethod         PayMethod?    @map("pay_method")
  payTime           DateTime?     @map("pay_time")
  payTransactionId  String?       @map("pay_transaction_id")
  deliveryStatus    DeliveryStatus @default(undelivered) @map("delivery_status")
  deliverTime       DateTime?     @map("deliver_time")
  deliveryMethod    DeliveryStatus? @map("delivery_method")
  customerNote      String?       @map("customer_note") @db.Text
  adminNote         String?       @map("admin_note") @db.Text
  appealStatus      String?       @map("appeal_status")
  appealSubmitTime  DateTime?     @map("appeal_submit_time")
  appealResultTime  DateTime?     @map("appeal_result_time")
  createdAt         DateTime      @default(now()) @map("created_at")
  updatedAt         DateTime      @updatedAt @map("updated_at")
  deletedAt         DateTime?     @map("deleted_at")

  customer          Customer      @relation(fields: [customerId], references: [id])
  product           Product?      @relation(fields: [productId], references: [id])
  orderItems        OrderItem[]

  @@index([orderNo])
  @@index([customerId])
  @@index([status])
  @@index([payStatus])
  @@index([createdAt])
  @@map("orders")
}

model OrderItem {
  id            Int       @id @default(autoincrement())
  orderId       Int       @map("order_id")
  productId     Int?      @map("product_id")
  materialType  String?   @map("material_type")
  fileUrl       String?   @map("file_url")
  price         Decimal?  @db.Decimal(10, 2)
  createdAt     DateTime  @default(now()) @map("created_at")

  order         Order     @relation(fields: [orderId], references: [id])
  product       Product?  @relation(fields: [productId], references: [id])

  @@map("order_items")
}

model Conversation {
  id            Int       @id @default(autoincrement())
  customerId    Int?      @map("customer_id")
  sessionId     String?   @map("session_id")
  platform      String    @default("web")
  role          String
  content       String    @db.Text
  contentType   String    @default("text") @map("content_type")
  intent        String?
  entities      Json      @default("{}")
  messageType   String    @default("chat") @map("message_type")
  isAiGenerated Boolean   @default(true) @map("is_ai_generated")
  modelUsed     String?   @map("model_used")
  tokensUsed    Int?      @map("tokens_used")
  feedback      String?   @default("null")
  adminId       Int?      @map("admin_id")
  createdAt     DateTime  @default(now()) @map("created_at")

  customer      Customer? @relation(fields: [customerId], references: [id])

  @@index([customerId])
  @@index([sessionId])
  @@index([createdAt])
  @@index([intent])
  @@map("conversations")
}

model Document {
  id              Int       @id @default(autoincrement())
  customerId      Int       @map("customer_id")
  orderId         Int?      @map("order_id")
  docType         String    @map("doc_type")
  docName         String?   @map("doc_name")
  fileUrl         String?   @map("file_url")
  fileSize        BigInt?   @map("file_size")
  fileType        String?   @map("file_type")
  storagePath     String?   @map("storage_path")
  docStatus       String    @default("generating") @map("doc_status")
  generationType  String    @default("ai") @map("generation_type")
  aiPrompt        String?   @map("ai_prompt") @db.Text
  reviewNote      String?   @map("review_note") @db.Text
  reviewedBy      Int?      @map("reviewed_by")
  reviewedAt      DateTime? @map("reviewed_at")
  version         Int       @default(1)
  parentId        Int?      @map("parent_id")
  isFinal         Boolean   @default(false) @map("is_final")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")

  customer        Customer  @relation(fields: [customerId], references: [id])

  @@index([customerId])
  @@index([orderId])
  @@index([docType])
  @@index([docStatus])
  @@index([createdAt])
  @@map("documents")
}

model Knowledge {
  id            Int       @id @default(autoincrement())
  category      String
  title         String
  content       String    @db.Text
  summary       String?   @db.VarChar(512)
  keywords      Json      @default("[]")
  embedding     Bytes?    @db.LongBlob
  riskTypes     Json      @default("[]") @map("risk_types")
  useScenarios  Json      @default("[]") @map("use_scenarios")
  successRate   Decimal?  @db.Decimal(5, 2) @map("success_rate")
  useCount      Int       @default(0) @map("use_count")
  successCount  Int       @default(0) @map("success_count")
  rating        Decimal   @default(5.00) @db.Decimal(3, 2)
  source        String?
  isActive      Boolean   @default(true) @map("is_active")
  isPublic      Boolean   @default(true) @map("is_public")
  adminId       Int?      @map("admin_id")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
  deletedAt     DateTime? @map("deleted_at")

  @@index([category])
  @@index([riskTypes])
  @@index([isActive])
  @@index([useCount])
  @@map("knowledge_base")
}

model MaterialTemplate {
  id              Int       @id @default(autoincrement())
  tempType        String    @map("temp_type")
  tempName        String    @map("temp_name")
  tempCode        String?   @map("temp_code")
  description     String?   @db.Text
  content         String    @db.Text
  variables       Json      @default("[]")
  defaultValues   Json      @default("{}") @map("default_values")
  riskTypes       Json      @default("[]") @map("risk_types")
  productTypes    Json      @default("[]") @map("product_types")
  isActive        Boolean   @default(true) @map("is_active")
  isDefault       Boolean   @default(false) @map("is_default")
  version         Int       @default(1)
  useCount        Int       @default(0) @map("use_count")
  successCount    Int       @default(0) @map("success_count")
  successRate     Decimal?  @db.Decimal(5, 2) @map("success_rate")
  promptTemplate  String?   @db.Text @map("prompt_template")
  adminId         Int?      @map("admin_id")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")

  @@index([tempType])
  @@index([isActive])
  @@index([isDefault])
  @@map("material_templates")
}

model AppealResult {
  id                    Int       @id @default(autoincrement())
  customerId            Int       @map("customer_id")
  orderId               Int?      @map("order_id")
  appealType            String    @default("self") @map("appeal_type")
  appealChannel         String?   @map("appeal_channel")
  submitTime            DateTime? @map("submit_time")
  result                String?
  resultTime            DateTime? @map("result_time")
  resultReason          String?   @map("result_reason") @db.Text
  feedback              String?   @db.Text
  improvementSuggestions String?  @map("improvement_suggestions") @db.Text
  documents             Json      @default("[]")
  isLearned             Boolean   @default(false) @map("is_learned")
  learnedAt             DateTime? @map("learned_at")
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  customer              Customer  @relation(fields: [customerId], references: [id])

  @@index([customerId])
  @@index([result])
  @@index([submitTime])
  @@index([isLearned])
  @@map("appeal_results")
}

model LearningLog {
  id                    Int       @id @default(autoincrement())
  learnType             String    @map("learn_type")
  sourceId              Int?      @map("source_id")
  sourceType            String?   @map("source_type")
  content               String?   @db.Text
  extractedKnowledge    String?   @map("extracted_knowledge") @db.Text
  targetType            String?   @map("target_type")
  targetId              Int?      @map("target_id")
  changes               Json      @default("{}")
  status                String    @default("pending")
  reviewedBy            Int?      @map("reviewed_by")
  reviewedAt            DateTime? @map("reviewed_at")
  appliedAt             DateTime? @map("applied_at")
  adminNote             String?   @map("admin_note") @db.Text
  createdAt             DateTime  @default(now()) @map("created_at")

  @@index([learnType])
  @@index([status])
  @@index([createdAt])
  @@map("learning_logs")
}
```

---

## 4. 核心模块开发

### 4.1 客户模块

```typescript
// modules/customer/customer.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common'
import { CustomerService } from './customer.service'
import { CreateCustomerDto } from './dto/create-customer.dto'
import { UpdateCustomerDto } from './dto/update-customer.dto'
import { QueryCustomerDto } from './dto/query-customer.dto'
import { JwtAuthGuard } from '../common/guards/auth.guard'
import { ApiResponse, paginatedResponse } from '../common/utils/response.util'

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  async findAll(@Query() query: QueryCustomerDto) {
    const [customers, total] = await this.customerService.findAll(query)

    return paginatedResponse(customers, {
      page: query.page,
      pageSize: query.pageSize,
      total,
    })
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const customer = await this.customerService.findById(id)
    return ApiResponse.success(customer)
  }

  @Post()
  async create(@Body() createCustomerDto: CreateCustomerDto) {
    const customer = await this.customerService.create(createCustomerDto)
    return ApiResponse.success(customer, '创建成功')
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    const customer = await this.customerService.update(id, updateCustomerDto)
    return ApiResponse.success(customer, '更新成功')
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.customerService.delete(id)
    return ApiResponse.success(null, '删除成功')
  }

  @Put(':id/info-status')
  async updateInfoStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('info_status') infoStatus: string,
  ) {
    const customer = await this.customerService.updateInfoStatus(id, infoStatus)
    return ApiResponse.success(customer, '状态更新成功')
  }

  @Get(':id/conversations')
  async getConversations(@Param('id', ParseIntPipe) id: number) {
    const conversations = await this.customerService.getConversations(id)
    return ApiResponse.success(conversations)
  }

  @Get(':id/documents')
  async getDocuments(@Param('id', ParseIntPipe) id: number) {
    const documents = await this.customerService.getDocuments(id)
    return ApiResponse.success(documents)
  }

  @Post(':id/notes')
  async addNote(
    @Param('id', ParseIntPipe) id: number,
    @Body('note') note: string,
  ) {
    const customer = await this.customerService.addNote(id, note)
    return ApiResponse.success(customer, '备注添加成功')
  }
}
```

```typescript
// modules/customer/customer.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../shared/prisma.service'
import { CreateCustomerDto } from './dto/create-customer.dto'
import { UpdateCustomerDto } from './dto/update-customer.dto'
import { QueryCustomerDto } from './dto/query-customer.dto'
import { Prisma } from '@prisma/client'

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryCustomerDto) {
    const { page = 1, pageSize = 20, keyword, customerStatus, riskLevel, startDate, endDate } = query

    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
    }

    if (keyword) {
      where.OR = [
        { xianyuNick: { contains: keyword } },
        { merchantId: { contains: keyword } },
        { phone: { contains: keyword } },
        { companyName: { contains: keyword } },
      ]
    }

    if (customerStatus) {
      where.customerStatus = customerStatus as any
    }

    if (riskLevel) {
      where.riskLevel = riskLevel as any
    }

    if (startDate) {
      where.createdAt = { ...where.createdAt as any, gte: new Date(startDate) }
    }

    if (endDate) {
      where.createdAt = { ...where.createdAt as any, lte: new Date(endDate) }
    }

    const [customers, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              orders: true,
              conversations: true,
              documents: true,
            },
          },
        },
      }),
      this.prisma.customer.count({ where }),
    ])

    return [customers, total]
  }

  async findById(id: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id, deletedAt: null },
      include: {
        orders: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        conversations: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        documents: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!customer) {
      throw new NotFoundException('客户不存在')
    }

    return customer
  }

  async create(createCustomerDto: CreateCustomerDto) {
    const customer = await this.prisma.customer.create({
      data: createCustomerDto,
    })
    return customer
  }

  async update(id: number, updateCustomerDto: UpdateCustomerDto) {
    await this.findById(id)

    const customer = await this.prisma.customer.update({
      where: { id },
      data: updateCustomerDto,
    })
    return customer
  }

  async delete(id: number) {
    await this.findById(id)

    await this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  async updateInfoStatus(id: number, infoStatus: string) {
    await this.findById(id)

    const customer = await this.prisma.customer.update({
      where: { id },
      data: { infoStatus: infoStatus as any },
    })
    return customer
  }

  async getConversations(id: number) {
    await this.findById(id)

    return this.prisma.conversation.findMany({
      where: { customerId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getDocuments(id: number) {
    await this.findById(id)

    return this.prisma.document.findMany({
      where: { customerId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    })
  }

  async addNote(id: number, note: string) {
    const customer = await this.findById(id)

    const updatedNote = customer.internalNotes
      ? `${customer.internalNotes}\n[${new Date().toISOString()}] ${note}`
      : `[${new Date().toISOString()}] ${note}`

    return this.prisma.customer.update({
      where: { id },
      data: { internalNotes: updatedNote },
    })
  }
}
```

```typescript
// modules/customer/dto/create-customer.dto.ts
import { IsString, IsOptional, IsEnum, IsPhoneNumber } from 'class-validator'

export class CreateCustomerDto {
  @IsString()
  xianyuNick: string

  @IsOptional()
  @IsString()
  xianyuUserId?: string

  @IsOptional()
  @IsString()
  wechatOpenid?: string

  @IsOptional()
  @IsString()
  merchantId?: string

  @IsOptional()
  @IsEnum(['wechat', 'alipay', 'both'])
  merchantIdType?: 'wechat' | 'alipay' | 'both'

  @IsOptional()
  @IsEnum(['普通商户', '特约商户', '服务商', '二级商户'])
  merchantType?: string

  @IsOptional()
  @IsEnum(['企业', '个体工商户', '党政机关', '事业单位', '其他组织'])
  subjectType?: string

  @IsOptional()
  @IsString()
  companyName?: string

  @IsOptional()
  @IsString()
  legalPerson?: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsString()
  riskType?: string

  @IsOptional()
  @IsEnum(['warning', 'limited', 'closed'])
  riskLevel?: 'warning' | 'limited' | 'closed'

  @IsOptional()
  @IsString()
  source?: string
}
```

### 4.2 订单模块

```typescript
// modules/order/order.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common'
import { OrderService } from './order.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { QueryOrderDto } from './dto/query-order.dto'
import { JwtAuthGuard } from '../common/guards/auth.guard'
import { ApiResponse, paginatedResponse } from '../common/utils/response.util'

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  async findAll(@Query() query: QueryOrderDto) {
    const [orders, total] = await this.orderService.findAll(query)

    return paginatedResponse(orders, {
      page: query.page,
      pageSize: query.pageSize,
      total,
    })
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const order = await this.orderService.findById(id)
    return ApiResponse.success(order)
  }

  @Post()
  async create(@Body() createOrderDto: CreateOrderDto) {
    const order = await this.orderService.create(createOrderDto)
    return ApiResponse.success(order, '订单创建成功')
  }

  @Post(':id/confirm')
  async confirm(@Param('id', ParseIntPipe) id: number) {
    const order = await this.orderService.confirm(id)
    return ApiResponse.success(order, '订单已确认')
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason?: string,
  ) {
    const order = await this.orderService.cancel(id, reason)
    return ApiResponse.success(order, '订单已取消')
  }

  @Post(':id/pay')
  async pay(
    @Param('id', ParseIntPipe) id: number,
    @Body('pay_method') payMethod: 'wechat' | 'alipay',
  ) {
    const result = await this.orderService.initiatePayment(id, payMethod)
    return ApiResponse.success(result)
  }

  @Post(':id/deliver')
  async deliver(@Param('id', ParseIntPipe) id: number) {
    const order = await this.orderService.deliver(id)
    return ApiResponse.success(order, '交付成功')
  }

  @Post(':id/refund')
  async refund(
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason: string,
  ) {
    const result = await this.orderService.refund(id, reason)
    return ApiResponse.success(result, '退款申请已提交')
  }

  @Get(':id/documents')
  async getDocuments(@Param('id', ParseIntPipe) id: number) {
    const documents = await this.orderService.getDocuments(id)
    return ApiResponse.success(documents)
  }
}
```

```typescript
// modules/order/order.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../shared/prisma.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { QueryOrderDto } from './dto/query-order.dto'
import { PaymentService } from '../payment/payment.service'
import { Prisma } from '@prisma/client'

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
  ) {}

  async findAll(query: QueryOrderDto) {
    const { page = 1, pageSize = 20, status, payStatus, customerId, startDate, endDate } = query

    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
    }

    if (status) {
      where.status = status as any
    }

    if (payStatus) {
      where.payStatus = payStatus as any
    }

    if (customerId) {
      where.customerId = customerId
    }

    if (startDate) {
      where.createdAt = { ...where.createdAt as any, gte: new Date(startDate) }
    }

    if (endDate) {
      where.createdAt = { ...where.createdAt as any, lte: new Date(endDate) }
    }

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              xianyuNick: true,
              merchantId: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ])

    return [orders, total]
  }

  async findById(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id, deletedAt: null },
      include: {
        customer: true,
        product: true,
        orderItems: true,
      },
    })

    if (!order) {
      throw new NotFoundException('订单不存在')
    }

    return order
  }

  async create(createOrderDto: CreateOrderDto) {
    const orderNo = `ORD${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    const order = await this.prisma.order.create({
      data: {
        ...createOrderDto,
        orderNo,
        totalAmount: createOrderDto.totalAmount || 0,
        payAmount: createOrderDto.payAmount || 0,
      },
    })

    return order
  }

  async confirm(id: number) {
    const order = await this.findById(id)

    if (order.status !== 'pending') {
      throw new BadRequestException('订单状态不允许确认')
    }

    return this.prisma.order.update({
      where: { id },
      data: { status: 'confirmed' },
    })
  }

  async cancel(id: number, reason?: string) {
    const order = await this.findById(id)

    if (order.status === 'refunded') {
      throw new BadRequestException('已退款的订单无法取消')
    }

    return this.prisma.order.update({
      where: { id },
      data: {
        status: 'cancelled',
        adminNote: reason ? `${order.adminNote || ''}\n取消原因: ${reason}` : order.adminNote,
      },
    })
  }

  async initiatePayment(id: number, payMethod: 'wechat' | 'alipay') {
    const order = await this.findById(id)

    if (order.payStatus === 'paid') {
      throw new BadRequestException('订单已支付')
    }

    if (payMethod === 'wechat') {
      return this.paymentService.createWechatPayOrder(order)
    } else {
      return this.paymentService.createAlipayOrder(order)
    }
  }

  async deliver(id: number) {
    const order = await this.findById(id)

    if (order.payStatus !== 'paid') {
      throw new BadRequestException('订单未支付，无法交付')
    }

    return this.prisma.order.update({
      where: { id },
      data: {
        deliveryStatus: 'delivered',
        deliverTime: new Date(),
      },
    })
  }

  async refund(id: number, reason: string) {
    const order = await this.findById(id)

    if (order.payStatus !== 'paid') {
      throw new BadRequestException('订单未支付，无法退款')
    }

    if (payMethod === 'wechat') {
      return this.paymentService.createWechatRefund(order, reason)
    } else {
      return this.paymentService.createAlipayRefund(order, reason)
    }
  }

  async getDocuments(id: number) {
    await this.findById(id)

    return this.prisma.document.findMany({
      where: { orderId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    })
  }
}
```

### 4.3 AI对话模块

```typescript
// modules/chat/chat.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common'
import { ChatService } from './chat.service'
import { SendMessageDto } from './dto/send-message.dto'
import { JwtAuthGuard } from '../common/guards/auth.guard'
import { ApiResponse } from '../common/utils/response.util'

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async send(@Body() sendMessageDto: SendMessageDto) {
    const result = await this.chatService.sendMessage(sendMessageDto)
    return ApiResponse.success(result)
  }

  @Get('history/:customerId')
  async getHistory(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query('session_id') sessionId?: string,
  ) {
    const messages = await this.chatService.getHistory(customerId, sessionId)
    return ApiResponse.success(messages)
  }

  @Post('feedback')
  async submitFeedback(
    @Body('message_id') messageId: number,
    @Body('feedback') feedback: 'like' | 'dislike',
  ) {
    await this.chatService.submitFeedback(messageId, feedback)
    return ApiResponse.success(null, '反馈已提交')
  }

  @Post('intent')
  async recognizeIntent(@Body('content') content: string) {
    const result = await this.chatService.recognizeIntent(content)
    return ApiResponse.success(result)
  }

  @Get('sessions/:customerId')
  async getSessions(@Param('customerId', ParseIntPipe) customerId: number) {
    const sessions = await this.chatService.getSessions(customerId)
    return ApiResponse.success(sessions)
  }
}
```

```typescript
// modules/chat/chat.service.ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../shared/prisma.service'
import { SendMessageDto } from './dto/send-message.dto'
import { AIChatService } from './ai/ai-chat.service'
import { IntentRecognition } from './ai/intent-recognition'
import { RedisService } from '../../shared/redis.service'

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiChatService: AIChatService,
    private readonly intentRecognition: IntentRecognition,
    private readonly redisService: RedisService,
  ) {}

  async sendMessage(dto: SendMessageDto) {
    const { customerId, content, sessionId } = dto

    const finalSessionId = sessionId || `session_${customerId}_${Date.now()}`

    const userMessage = await this.prisma.conversation.create({
      data: {
        customerId,
        sessionId: finalSessionId,
        role: 'user',
        content,
        messageType: 'chat',
        isAiGenerated: false,
      },
    })

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    })

    const context = await this.getConversationContext(customerId, finalSessionId)

    const intentResult = await this.intentRecognition.recognize(content)

    let aiContent: string
    let suggestions: string[] = []

    if (intentResult.intent === 'collect_info') {
      aiContent = await this.aiChatService.handleInfoCollection(
        content,
        intentResult.entities,
        customer,
        context,
      )
    } else if (intentResult.intent === 'query_appeal_status') {
      aiContent = await this.aiChatService.handleAppealQuery(
        customer,
        context,
      )
    } else if (intentResult.intent === 'product_inquiry') {
      aiContent = await this.aiChatService.handleProductInquiry(
        content,
        intentResult.entities,
        context,
      )
    } else {
      aiContent = await this.aiChatService.chat(
        content,
        customer,
        context,
      )
      suggestions = ['请问您的商户号是被限制收款了，还是完全无法使用？', '请提供一下您的商户号和营业执照信息']
    }

    const aiMessage = await this.prisma.conversation.create({
      data: {
        customerId,
        sessionId: finalSessionId,
        role: 'assistant',
        content: aiContent,
        messageType: 'chat',
        isAiGenerated: true,
        modelUsed: 'gpt-4',
        intent: intentResult.intent,
        entities: intentResult.entities,
      },
    })

    await this.redisService.push(`chat:session:${finalSessionId}`, {
      userMessage,
      aiMessage,
    })

    return {
      message: aiMessage,
      session_id: finalSessionId,
      suggestions,
    }
  }

  async getHistory(customerId: number, sessionId?: string) {
    const where: any = { customerId }

    if (sessionId) {
      where.sessionId = sessionId
    }

    return this.prisma.conversation.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    })
  }

  async submitFeedback(messageId: number, feedback: 'like' | 'dislike') {
    await this.prisma.conversation.update({
      where: { id: messageId },
      data: { feedback },
    })
  }

  async recognizeIntent(content: string) {
    return this.intentRecognition.recognize(content)
  }

  async getSessions(customerId: number) {
    const sessions = await this.prisma.conversation.groupBy({
      by: ['sessionId'],
      where: { customerId },
      _count: true,
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    const result = []
    for (const session of sessions) {
      const lastMessage = await this.prisma.conversation.findFirst({
        where: { sessionId: session.sessionId },
        orderBy: { createdAt: 'desc' },
      })

      result.push({
        session_id: session.sessionId,
        message_count: session._count,
        last_message: lastMessage?.content,
        updated_at: lastMessage?.createdAt,
      })
    }

    return result
  }

  private async getConversationContext(customerId: number, sessionId: string): Promise<string> {
    const messages = await this.prisma.conversation.findMany({
      where: { customerId, sessionId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return messages
      .reverse()
      .map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
      .join('\n')
  }
}
```

```typescript
// modules/chat/ai/intent-recognition.ts
import { Injectable } from '@nestjs/common'

interface IntentResult {
  intent: string
  entities: Record<string, any>
  confidence: number
}

@Injectable()
export class IntentRecognition {
  private readonly intents = {
    greeting: ['你好', '您好', '嗨', 'hi', 'hello', '在吗', '在不在'],
    collect_info: ['商户号', '营业执照', '身份证', '法人', '公司名称', '联系方式'],
    appeal_status: ['申诉', '进度', '状态', '结果', '审核', '通过', '驳回'],
    product_inquiry: ['价格', '多少钱', '服务', '套餐', '怎么收费', '有什么服务'],
    payment: ['支付', '付款', '微信', '支付宝', '购买', '下单'],
    complaint: ['没用', '不行', '垃圾', '骗子', '投诉'],
  }

  async recognize(content: string): Promise<IntentResult> {
    const lowerContent = content.toLowerCase()

    for (const [intent, keywords] of Object.entries(this.intents)) {
      for (const keyword of keywords) {
        if (lowerContent.includes(keyword)) {
          return {
            intent: this.mapIntent(intent),
            entities: this.extractEntities(content),
            confidence: 0.8,
          }
        }
      }
    }

    return {
      intent: 'general',
      entities: this.extractEntities(content),
      confidence: 0.5,
    }
  }

  private mapIntent(intent: string): string {
    const mapping: Record<string, string> = {
      greeting: 'greeting',
      collect_info: 'collect_info',
      appeal_status: 'query_appeal_status',
      product_inquiry: 'product_inquiry',
      payment: 'payment',
      complaint: 'complaint',
    }
    return mapping[intent] || 'general'
  }

  private extractEntities(content: string): Record<string, any> {
    const entities: Record<string, any> = {}

    const merchantIdMatch = content.match(/mch[_\d]+|商户号[：:]?\s*(\w+)/i)
    if (merchantIdMatch) {
      entities.merchantId = merchantIdMatch[1] || merchantIdMatch[0]
    }

    const phoneMatch = content.match(/1[3-9]\d{9}/)
    if (phoneMatch) {
      entities.phone = phoneMatch[0]
    }

    const companyMatch = content.match(/(公司|企业|店铺)[：:]?\s*([^\s,，]+)/)
    if (companyMatch) {
      entities.companyName = companyMatch[2]
    }

    return entities
  }
}
```

```typescript
// modules/chat/ai/ai-chat.service.ts
import { Injectable } from '@nestjs/common'
import { OpenAIService } from '../../shared/ai/openai.service'
import { KnowledgeService } from '../knowledge/knowledge.service'
import { PromptTemplates } from './prompt-templates'

@Injectable()
export class AIChatService {
  constructor(
    private readonly openAIService: OpenAIService,
    private readonly knowledgeService: KnowledgeService,
    private readonly promptTemplates: PromptTemplates,
  ) {}

  async chat(
    userMessage: string,
    customer: any,
    context: string,
  ): Promise<string> {
    const systemPrompt = this.promptTemplates.getChatSystemPrompt()

    const knowledge = await this.knowledgeService.searchRelevant(userMessage, 3)

    const userPrompt = `
当前客户信息：
- 闲鱼昵称：${customer?.xianyuNick || '未知'}
- 商户号：${customer?.merchantId || '未提供'}
- 风控类型：${customer?.riskType || '未知'}
- 风控等级：${customer?.riskLevel || '未知'}
- 信息收集状态：${customer?.infoStatus || '未知'}

对话历史：
${context || '（暂无历史对话）'}

相关知识：
${knowledge.map(k => `- ${k.title}: ${k.content}`).join('\n')}

用户消息：${userMessage}

请以专业、耐心的态度回复用户，帮助解答关于商户号申诉的问题。
`

    return this.openAIService.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])
  }

  async handleInfoCollection(
    userMessage: string,
    entities: Record<string, any>,
    customer: any,
    context: string,
  ): Promise<string> {
    const prompt = this.promptTemplates.getInfoCollectionPrompt()

    const response = await this.openAIService.chat([
      { role: 'system', content: prompt },
      { role: 'user', content: `用户消息：${userMessage}\n\n已提取实体：${JSON.stringify(entities)}\n\n当前客户信息：${JSON.stringify(customer)}` },
    ])

    return response
  }

  async handleAppealQuery(customer: any, context: string): Promise<string> {
    const orders = customer?.orders || []

    if (orders.length === 0) {
      return '您好，您目前还没有进行中的申诉订单。如果您需要申诉，请先购买我们的服务。'
    }

    const latestOrder = orders[0]

    const statusMessages = {
      pending: '您的订单正在处理中，请稍候。',
      confirmed: '您的订单已确认，正在准备申诉材料。',
      paid: '付款已确认，材料生成中。',
      delivered: '材料已生成完毕，您可以下载使用了。',
      completed: '申诉已完成，祝您申诉顺利！',
    }

    return statusMessages[latestOrder.status] || '您的订单状态是：' + latestOrder.status
  }

  async handleProductInquiry(
    userMessage: string,
    entities: Record<string, any>,
    context: string,
  ): Promise<string> {
    const prompt = `你是一个专业的商户号申诉服务顾问。用户正在询问我们的服务套餐信息。

请根据用户的问题，介绍我们的服务套餐：

**基础版（299-499元）**
- 申诉说明
- 材料清单
- 基础指导

**标准版（799-1299元）**
- 完整材料包
- 全程指导
- 进度跟踪

**高端版（1999-2999元）**
- 1v1服务
- 加急处理
- 无限次修改

请根据用户的需求（如风控类型、紧急程度）推荐合适的套餐。
用户消息：${userMessage}
`

    return this.openAIService.chat([
      { role: 'system', content: prompt },
    ])
  }
}
```

```typescript
// modules/chat/ai/prompt-templates.ts
import { Injectable } from '@nestjs/common'

@Injectable()
export class PromptTemplates {
  getChatSystemPrompt(): string {
    return `你是商户号申诉智能服务系统的AI客服助手。你的职责是：
1. 友好、专业地回答用户关于商户号申诉的问题
2. 收集客户必要的信息（商户号、营业执照等）
3. 根据用户情况推荐合适的服务套餐
4. 引导用户完成咨询和购买流程

回复原则：
- 使用友好、专业的语气
- 不要透露具体的申诉成功秘诀
- 对于敏感问题，引导用户通过正式渠道解决
- 适当使用emoji增加亲和力（但不要过度）
- 回复控制在200字以内
- 遇到无法回答的问题，承认不知道并建议咨询人工客服`
  }

  getInfoCollectionPrompt(): string {
    return `你是一个信息收集助手。你的任务是根据用户的消息，提取并整理客户信息。

需要收集的信息包括：
1. 商户号（微信支付mchid或支付宝商户ID）
2. 营业执照名称
3. 法人姓名
4. 联系电话
5. 主要经营类目
6. 风控原因（如果用户知道的话）
7. 风控类型（收款限制/功能限制/完全封禁）

对于用户的回复，你应该：
1. 感谢用户提供的信息
2. 确认已收集到的信息
3. 指出还缺少哪些必要信息
4. 使用友好的方式引导用户提供剩余信息`
  }

  getDocumentGenerationPrompt(docType: string): string {
    const templates: Record<string, string> = {
      appeal_statement: `你是一个专业的商户号申诉文档撰写专家。请根据客户提供的信息，生成一份申诉说明文档。

文档要求：
- 语言专业、逻辑清晰
- 态度诚恳、实事求是
- 针对性强，不要套用通用模板
- 突出客户的整改意愿和措施

请使用以下格式：
【申诉说明】
一、商户基本信息
二、风控原因说明
三、整改措施
四、申诉请求`,
      rectification_report: `你是一个专业的整改方案撰写专家。请根据客户的风控类型和情况，生成一份详细的整改说明。

文档要求：
- 整改措施具体可行
- 时间节点明确
- 责任人清晰
- 有具体的数据支撑（如有）

请使用以下格式：
【整改说明】
一、问题分析
二、整改目标
三、具体整改措施
四、整改进度安排
五、预防措施`,
      commitment_letter: `你是一个专业的法律文书撰写专家。请根据客户的申诉情况，生成一份承诺书。

承诺书要求：
- 语言严谨、规范
- 承诺内容具体明确
- 有法律效力意识

请使用以下格式：
【承诺书】
兹承诺：
一、（具体承诺事项）
二、（违约责任）
三、（承诺期限）

承诺人：[商户名称]
日期：[日期]`,
    }

    return templates[docType] || templates.appeal_statement
  }
}
```

### 4.4 材料生成模块

```typescript
// modules/document/document.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Res,
  UseGuards,
} from '@nestjs/common'
import { Response } from 'express'
import { DocumentService } from './document.service'
import { GenerateDocumentDto } from './dto/generate-document.dto'
import { QueryDocumentDto } from './dto/query-document.dto'
import { JwtAuthGuard } from '../common/guards/auth.guard'
import { ApiResponse, paginatedResponse } from '../common/utils/response.util'

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Get()
  async findAll(@Query() query: QueryDocumentDto) {
    const [documents, total] = await this.documentService.findAll(query)

    return paginatedResponse(documents, {
      page: query.page,
      pageSize: query.pageSize,
      total,
    })
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const document = await this.documentService.findById(id)
    return ApiResponse.success(document)
  }

  @Post('generate')
  async generate(@Body() generateDto: GenerateDocumentDto) {
    const document = await this.documentService.generate(generateDto)
    return ApiResponse.success(document, '文档生成中...')
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: any,
  ) {
    const document = await this.documentService.update(id, updateData)
    return ApiResponse.success(document, '更新成功')
  }

  @Post(':id/review')
  async review(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: 'approved' | 'rejected',
    @Body('note') note?: string,
  ) {
    const document = await this.documentService.review(id, status, note)
    return ApiResponse.success(document, '审核完成')
  }

  @Post(':id/regenerate')
  async regenerate(
    @Param('id', ParseIntPipe) id: number,
    @Body('requirements') requirements?: string,
  ) {
    const document = await this.documentService.regenerate(id, requirements)
    return ApiResponse.success(document, '重新生成中...')
  }

  @Get(':id/download')
  async download(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const fileStream = await this.documentService.getDownloadStream(id)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    fileStream.pipe(res)
  }

  @Get('templates')
  async getTemplates() {
    const templates = await this.documentService.getTemplates()
    return ApiResponse.success(templates)
  }
}
```

```typescript
// modules/document/document.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../shared/prisma.service'
import { GenerateDocumentDto } from './dto/generate-document.dto'
import { QueryDocumentDto } from './dto/query-document.dto'
import { AppealStatementGenerator } from './generator/appeal-statement.generator'
import { RectificationReportGenerator } from './generator/rectification-report.generator'
import { CommitmentLetterGenerator } from './generator/commitment-letter.generator'
import { FileService } from '../../shared/file.service'
import { Prisma } from '@prisma/client'

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appealStatementGenerator: AppealStatementGenerator,
    private readonly rectificationReportGenerator: RectificationReportGenerator,
    private readonly commitmentLetterGenerator: CommitmentLetterGenerator,
    private readonly fileService: FileService,
  ) {}

  async findAll(query: QueryDocumentDto) {
    const { page = 1, pageSize = 20, customerId, orderId, docType, docStatus } = query

    const where: Prisma.DocumentWhereInput = {
      deletedAt: null,
    }

    if (customerId) where.customerId = customerId
    if (orderId) where.orderId = orderId
    if (docType) where.docType = docType
    if (docStatus) where.docStatus = docStatus

    const [documents, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { id: true, xianyuNick: true },
          },
        },
      }),
      this.prisma.document.count({ where }),
    ])

    return [documents, total]
  }

  async findById(id: number) {
    const document = await this.prisma.document.findUnique({
      where: { id, deletedAt: null },
      include: {
        customer: true,
      },
    })

    if (!document) {
      throw new NotFoundException('文档不存在')
    }

    return document
  }

  async generate(dto: GenerateDocumentDto) {
    const { customerId, orderId, docType, requirements } = dto

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    })

    if (!customer) {
      throw new NotFoundException('客户不存在')
    }

    const document = await this.prisma.document.create({
      data: {
        customerId,
        orderId,
        docType,
        docStatus: 'generating',
        generationType: 'ai',
      },
    })

    this.processDocumentGeneration(document.id, customer, docType, requirements).catch(
      console.error,
    )

    return document
  }

  private async processDocumentGeneration(
    documentId: number,
    customer: any,
    docType: string,
    requirements?: string,
  ) {
    try {
      let content: string
      let docName: string

      switch (docType) {
        case 'appeal_statement':
          content = await this.appealStatementGenerator.generate(customer, requirements)
          docName = `申诉说明_${customer.xianyuNick}_${Date.now()}.docx`
          break
        case 'rectification_report':
          content = await this.rectificationReportGenerator.generate(customer, requirements)
          docName = `整改说明_${customer.xianyuNick}_${Date.now()}.docx`
          break
        case 'commitment_letter':
          content = await this.commitmentLetterGenerator.generate(customer, requirements)
          docName = `承诺书_${customer.xianyuNick}_${Date.now()}.docx`
          break
        default:
          throw new Error(`不支持的文档类型: ${docType}`)
      }

      const fileUrl = await this.fileService.uploadDocx(content, docName)

      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          docStatus: 'generated',
          fileUrl,
          docName,
        },
      })
    } catch (error) {
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          docStatus: 'rejected',
          reviewNote: error.message,
        },
      })
    }
  }

  async update(id: number, data: Partial<any>) {
    await this.findById(id)

    return this.prisma.document.update({
      where: { id },
      data,
    })
  }

  async review(id: number, status: 'approved' | 'rejected', note?: string) {
    const document = await this.findById(id)

    return this.prisma.document.update({
      where: { id },
      data: {
        docStatus: status,
        reviewNote: note,
        reviewedAt: new Date(),
      },
    })
  }

  async regenerate(id: number, requirements?: string) {
    const document = await this.findById(id)
    const customer = document.customer

    const parentDocument = await this.prisma.document.update({
      where: { id },
      data: { parentId: id },
    })

    const newDocument = await this.prisma.document.create({
      data: {
        customerId: document.customerId,
        orderId: document.orderId,
        docType: document.docType,
        docStatus: 'generating',
        generationType: 'ai',
        parentId: parentDocument.id,
        version: document.version + 1,
      },
    })

    this.processDocumentGeneration(newDocument.id, customer, document.docType, requirements).catch(
      console.error,
    )

    return newDocument
  }

  async getDownloadStream(id: number) {
    const document = await this.findById(id)

    if (!document.fileUrl) {
      throw new NotFoundException('文件不存在')
    }

    return this.fileService.getFileStream(document.fileUrl)
  }

  async getTemplates() {
    return this.prisma.materialTemplate.findMany({
      where: { isActive: true },
      orderBy: { useCount: 'desc' },
    })
  }
}
```

### 4.5 支付模块

```typescript
// modules/payment/payment.service.ts
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../shared/prisma.service'
import { WechatPayService } from './wechat/wechat-pay.service'
import { AlipayService } from './alipay/alipay.service'
import { Order } from '@prisma/client'

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wechatPayService: WechatPayService,
    private readonly alipayService: AlipayService,
    private readonly configService: ConfigService,
  ) {}

  async createWechatPayOrder(order: Order) {
    const wechatOrder = await this.wechatPayService.createOrder({
      out_trade_no: order.orderNo,
      total_fee: Number(order.payAmount) * 100,
      body: `商户号申诉服务 - ${order.orderNo}`,
      notify_url: `${this.configService.get('APP_URL')}/api/pay/callback/wechat`,
    })

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        payMethod: 'wechat',
      },
    })

    return {
      pay_url: wechatOrder.code_url,
      qrcode: wechatOrder.code_url,
    }
  }

  async createAlipayOrder(order: Order) {
    const alipayOrder = await this.alipayService.createOrder({
      out_trade_no: order.orderNo,
      total_amount: Number(order.payAmount),
      subject: `商户号申诉服务 - ${order.orderNo}`,
      notify_url: `${this.configService.get('APP_URL')}/api/pay/callback/alipay`,
    })

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        payMethod: 'alipay',
      },
    })

    return {
      pay_url: alipayOrder,
    }
  }

  async handleWechatCallback(callbackData: any) {
    const signValid = this.wechatPayService.verifySign(callbackData)

    if (!signValid) {
      throw new Error('签名验证失败')
    }

    if (callbackData.result_code === 'SUCCESS') {
      const order = await this.prisma.order.findUnique({
        where: { orderNo: callbackData.out_trade_no },
      })

      if (order && order.payStatus === 'unpaid') {
        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            payStatus: 'paid',
            payTime: new Date(),
            payTransactionId: callbackData.transaction_id,
          },
        })
      }
    }
  }

  async handleAlipayCallback(callbackData: any) {
    const signValid = this.alipayService.verifySign(callbackData)

    if (!signValid) {
      throw new Error('签名验证失败')
    }

    if (callbackData.trade_status === 'TRADE_SUCCESS') {
      const order = await this.prisma.order.findUnique({
        where: { orderNo: callbackData.out_trade_no },
      })

      if (order && order.payStatus === 'unpaid') {
        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            payStatus: 'paid',
            payTime: new Date(),
            payTransactionId: callbackData.trade_no,
          },
        })
      }
    }
  }

  async createWechatRefund(order: Order, reason: string) {
    const refund = await this.wechatPayService.createRefund({
      out_trade_no: order.orderNo,
      total_fee: Number(order.payAmount) * 100,
      refund_fee: Number(order.payAmount) * 100,
      refund_desc: reason,
    })

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        payStatus: 'refunding',
      },
    })

    return {
      refund_id: refund.refund_id,
      status: 'refund_pending',
    }
  }

  async createAlipayRefund(order: Order, reason: string) {
    const refund = await this.alipayService.createRefund({
      out_trade_no: order.orderNo,
      refund_amount: Number(order.payAmount),
      refund_reason: reason,
    })

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        payStatus: 'refunding',
      },
    })

    return {
      refund_id: refund.refund_id,
      status: 'refund_pending',
    }
  }
}
```

---

## 5. 共享服务

### 5.1 Prisma服务

```typescript
// shared/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
```

### 5.2 Redis服务

```typescript
// shared/redis.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common'
import Redis from 'ioredis'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis({
      host: configService.get('REDIS_HOST'),
      port: configService.get('REDIS_PORT'),
      password: configService.get('REDIS_PASSWORD'),
    })
  }

  async onModuleDestroy() {
    await this.client.quit()
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key)
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setex(key, ttl, value)
    } else {
      await this.client.set(key, value)
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key)
  }

  async push(key: string, data: any): Promise<void> {
    await this.client.rpush(key, JSON.stringify(data))
  }

  async lrange(key: string, start: number, stop: number): Promise<any[]> {
    const result = await this.client.lrange(key, start, stop)
    return result.map(item => JSON.parse(item))
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds)
  }
}
```

### 5.3 文件服务

```typescript
// shared/file.service.ts
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as OSS from 'ali-oss'
import { Readable } from 'stream'

@Injectable()
export class FileService {
  private client: OSS

  constructor(private readonly configService: ConfigService) {
    this.client = new OSS({
      region: configService.get('OSS_REGION'),
      accessKeyId: configService.get('OSS_ACCESS_KEY_ID'),
      accessKeySecret: configService.get('OSS_ACCESS_KEY_SECRET'),
      bucket: configService.get('OSS_BUCKET'),
    })
  }

  async uploadFile(file: Buffer, filename: string, directory: string = 'uploads'): Promise<string> {
    const key = `${directory}/${Date.now()}_${filename}`

    await this.client.put(key, file)

    return `https://${this.configService.get('OSS_BUCKET')}.oss-${this.configService.get('OSS_REGION')}.aliyuncs.com/${key}`
  }

  async uploadDocx(content: string, filename: string): Promise<string> {
    const buffer = Buffer.from(content, 'utf-8')
    return this.uploadFile(buffer, filename, 'documents')
  }

  async getFileStream(url: string): Promise<Readable> {
    const response = await this.client.get(url.replace(this.getOssDomain(), ''))
    return response.content as Readable
  }

  async deleteFile(url: string): Promise<void> {
    const key = url.replace(this.getOssDomain(), '')
    await this.client.delete(key)
  }

  private getOssDomain(): string {
    const bucket = this.configService.get('OSS_BUCKET')
    const region = this.configService.get('OSS_REGION')
    return `https://${bucket}.oss-${region}.aliyuncs.com/`
  }
}
```

### 5.4 OpenAI服务

```typescript
// shared/ai/openai.service.ts
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

@Injectable()
export class OpenAIService {
  private client: OpenAI

  constructor(private readonly configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: configService.get('OPENAI_API_KEY'),
    })
  }

  async chat(messages: Message[], temperature: number = 0.7): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages,
      temperature,
      max_tokens: 2000,
    })

    return response.choices[0]?.message?.content || ''
  }

  async embedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    })

    return response.data[0]?.embedding || []
  }
}
```

---

## 6. 中间件与守卫

### 6.1 JWT认证守卫

```typescript
// modules/common/guards/auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const token = this.extractTokenFromHeader(request)

    if (!token) {
      throw new UnauthorizedException('未提供认证令牌')
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('JWT_SECRET'),
      })

      request.user = payload
    } catch {
      throw new UnauthorizedException('令牌无效或已过期')
    }

    return true
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') || []
    return type === 'Bearer' ? token : undefined
  }
}
```

### 6.2 角色守卫

```typescript
// modules/common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, SetMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

export const ROLES_KEY = 'roles'
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredRoles) {
      return true
    }

    const { user } = context.switchToHttp().getRequest()

    return requiredRoles.some(role => user.role === role)
  }
}
```

### 6.3 日志中间件

```typescript
// modules/common/middleware/logger.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP')

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req
    const userAgent = req.get('user-agent') || ''

    const startTime = Date.now()

    res.on('finish', () => {
      const { statusCode } = res
      const contentLength = res.get('content-length')
      const duration = Date.now() - startTime

      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${contentLength || 0}b - ${duration}ms - ${ip} ${userAgent}`,
      )
    })

    next()
  }
}
```

### 6.4 异常过滤器

```typescript
// modules/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Response } from 'express'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = '服务器内部错误'

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const exceptionResponse = exception.getResponse()
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || message
    } else if (exception instanceof Error) {
      message = exception.message
      this.logger.error(`Unexpected error: ${exception.message}`, exception.stack)
    }

    response.status(status).json({
      code: status,
      message,
      error: {
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    })
  }
}
```

---

## 7. 配置与环境

### 7.1 环境变量示例

```env
# .env.example

# 应用配置
NODE_ENV=development
APP_NAME=merchant-appeal-backend
APP_URL=http://localhost:3000
APP_PORT=3000

# 数据库配置
DATABASE_URL=mysql://root:password@localhost:3306/merchant_appeal

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT配置
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# OpenAI配置
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_API_BASE=https://api.openai.com/v1

# 阿里云OSS配置
OSS_ACCESS_KEY_ID=your-access-key-id
OSS_ACCESS_KEY_SECRET=your-access-key-secret
OSS_BUCKET=merchant-appeal
OSS_REGION=oss-cn-hangzhou

# 微信支付配置
WECHAT_APP_ID=your-app-id
WECHAT_MCH_ID=your-merchant-id
WECHAT_API_KEY=your-api-key
WECHAT_CERT_PATH=/path/to/apiclient_cert.pem

# 支付宝配置
ALIPAY_APP_ID=your-app-id
ALIPAY_PRIVATE_KEY=your-private-key
ALIPAY_PUBLIC_KEY=alipay-public-key

# 闲鱼配置
XIANYU_APP_KEY=your-app-key
XIANYU_APP_SECRET=your-app-secret
```

### 7.2 配置文件

```typescript
// config/database.ts
import { registerAs } from '@nestjs/config'

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
}))
```

```typescript
// config/ai.ts
import { registerAs } from '@nestjs/config'

export const aiConfig = registerAs('ai', () => ({
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiApiBase: process.env.OPENAI_API_BASE || 'https://api.openai.com/v1',
  model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
  temperature: 0.7,
  maxTokens: 2000,
}))
```

---

## 8. API接口文档

### 8.1 客户管理API

```
基础路径: /api/v1/customers

GET    /customers              获取客户列表 (分页)
GET    /customers/:id         获取客户详情
POST   /customers              创建客户
PUT    /customers/:id          更新客户
DELETE /customers/:id          删除客户
PUT    /customers/:id/info-status   更新信息收集状态
GET    /customers/:id/conversations 获取客户对话历史
GET    /customers/:id/documents    获取客户文档列表
POST   /customers/:id/notes         添加客户备注

请求示例:
GET /api/v1/customers?page=1&pageSize=20&keyword=张三&customerStatus=consulting

响应示例:
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [...],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### 8.2 订单管理API

```
基础路径: /api/v1/orders

GET    /orders                 获取订单列表 (分页)
GET    /orders/:id             获取订单详情
POST   /orders                 创建订单
POST   /orders/:id/confirm     确认订单
POST   /orders/:id/cancel      取消订单
POST   /orders/:id/pay         发起支付
POST   /orders/:id/deliver     交付订单
POST   /orders/:id/refund      申请退款
GET    /orders/:id/documents   获取订单文档
```

### 8.3 AI对话API

```
基础路径: /api/v1/chat

POST   /chat                   发送消息并获取AI回复
GET    /chat/history/:customerId  获取对话历史
POST   /chat/feedback          提交对话反馈
POST   /chat/intent            意图识别
GET    /chat/sessions/:customerId  获取会话列表

请求示例:
POST /api/v1/chat
{
  "customer_id": 1,
  "content": "我的商户号被风控了",
  "session_id": "session_1_1234567890"
}

响应示例:
{
  "code": 200,
  "message": "success",
  "data": {
    "message": {
      "id": 10,
      "role": "assistant",
      "content": "您好，我是商户号申诉咨询助手...",
      "created_at": "2024-01-15T10:30:00Z"
    },
    "session_id": "session_1_1234567890",
    "suggestions": ["请问您的商户号是被限制收款了？"]
  }
}
```

### 8.4 材料生成API

```
基础路径: /api/v1/documents

GET    /documents              获取文档列表 (分页)
GET    /documents/:id           获取文档详情
POST   /documents/generate      生成文档
PUT    /documents/:id           更新文档
POST   /documents/:id/review    审核文档
POST   /documents/:id/regenerate 重新生成
GET    /documents/:id/download  下载文档
GET    /documents/templates     获取模板列表

请求示例:
POST /api/v1/documents/generate
{
  "customer_id": 1,
  "doc_type": "appeal_statement",
  "requirements": "客户投诉频繁，需要强调已采取的整改措施"
}
```

---

## 9. 开发规范

### 9.1 命名规范

```typescript
// 文件命名
// 控制器: customer.controller.ts
// 服务: customer.service.ts
// 模块: customer.module.ts
// DTO: create-customer.dto.ts
// 实体: customer.entity.ts

// 类命名 (PascalCase)
class CustomerService {}
class CreateCustomerDto {}

// 函数/方法命名 (camelCase)
async findAll() {}
async createCustomer() {}

// 变量命名 (camelCase)
const customerList: Customer[] = []
const isActive: boolean = true

// 常量命名 (UPPER_SNAKE_CASE)
const MAX_PAGE_SIZE = 100
const DEFAULT_PAGE = 1

// 数据库字段命名 (snake_case)
customerId, xianyuNick, createdAt
```

### 9.2 Git提交规范

```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 重构
perf: 性能优化
test: 测试相关
chore: 构建/工具/依赖

格式:
<type>(<scope>): <subject>

示例:
feat(customer): 添加客户批量导入功能
fix(chat): 修复AI回复延迟问题
docs(api): 更新API接口文档
refactor(order): 重构订单状态流转逻辑
```

### 9.3 错误处理规范

```typescript
// 使用自定义异常
import { NotFoundException, BadRequestException } from '@nestjs/common'

// 控制器中抛出
throw new NotFoundException('客户不存在')
throw new BadRequestException('订单状态不允许此操作')

// 服务中处理
async findById(id: number) {
  const customer = await this.prisma.customer.findUnique({ where: { id } })

  if (!customer) {
    throw new NotFoundException('客户不存在')
  }

  return customer
}
```

---

## 10. 部署与运维

### 10.1 Docker配置

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

### 10.2 docker-compose配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://db:3306/merchant_appeal
      - REDIS_HOST=redis
    depends_on:
      - db
      - redis
    restart: unless-stopped

  db:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=password
      - MYSQL_DATABASE=merchant_appeal
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  mysql_data:
  redis_data:
```

---

## 11. 参考资料

| 资源 | 链接 |
|-----|------|
| NestJS | https://docs.nestjs.com |
| Prisma | https://prisma.io/docs |
| TypeScript | https://www.typescriptlang.org |
| Express | https://expressjs.com |
| Redis | https://redis.io/docs |
| OpenAI | https://platform.openai.com |
| 阿里云OSS | https://help.aliyun.com/product/31815 |

---

## 12. 文档修订记录

| 版本 | 日期 | 修订内容 | 修订人 |
|-----|------|---------|-------|
| V1.0 | 2026-04-13 | 初始版本 | AI产品经理 |

# 商户号申诉智能服务系统 - 技术设计文档

**文档版本**: V1.0
**编写日期**: 2026-04-13
**文档状态**: 初稿

---

## 1. 系统架构设计

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                          客户端层                                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │ Web管理后台│  │H5移动端   │  │ 闲鱼APP   │  │ 微信小程序│    │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘    │
└────────┼───────────────┼───────────────┼───────────────┼────────────┘
         │               │               │               │
         ▼               ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          网关层                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Nginx / API Gateway                      │    │
│  │            (负载均衡 / 限流 / SSL终端 / 路由)                │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          服务层                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │ 用户服务   │  │ 订单服务   │  │ AI服务    │  │ 支付服务  │     │
│  │ User Svc  │  │ Order Svc  │  │ AI Svc    │  │ Pay Svc   │     │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │ 消息服务   │  │ 文件服务   │  │ 知识库服务│  │ 学习服务  │     │
│  │ Msg Svc   │  │ File Svc   │  │ KB Svc    │  │ Learn Svc │     │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          数据层                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │ MySQL     │  │ Redis     │  │ MongoDB   │  │ OSS       │     │
│  │ 主业务数据  │  │ 缓存/会话  │  │ 日志/聊天  │  │ 文件存储  │     │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │
│  ┌────────────┐                                                      │
│  │ Vector DB │  (知识库向量检索)                                      │
│  └────────────┘                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          AI层                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │ GPT-4 API │  │Claude API │  │ Embedding  │  │ RAG Engine │     │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心模块架构

#### 1.2.1 AI对话系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AI对话系统架构                                │
└─────────────────────────────────────────────────────────────────────┘

  用户输入
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        输入处理层                                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                    │
│  │ 敏感词过滤 │  │ 意图识别   │  │ 实体提取   │                    │
│  │ Content    │  │ Intent     │  │ Entity     │                    │
│  │ Filter     │  │ Recognition│  │ Extraction │                    │
│  └────────────┘  └────────────┘  └────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        对话管理层                                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                    │
│  │ 会话管理   │  │ 上下文管理 │  │ 状态机    │                    │
│  │ Session    │  │ Context    │  │ State      │                    │
│  │ Manager    │  │ Manager    │  │ Machine    │                    │
│  └────────────┘  └────────────┘  └────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        知识库层                                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                    │
│  │ 知识检索   │  │ 案例匹配   │  │ 模板匹配   │                    │
│  │ KB Search  │  │ Case Match │  │ Template   │                    │
│  │            │  │            │  │ Match      │                    │
│  └────────────┘  └────────────┘  └────────────┘                    │
│                                    │                                │
│                                    ▼                                │
│                      ┌─────────────────────┐                        │
│                      │    Vector Search    │                        │
│                      │   (语义相似度匹配)   │                        │
│                      └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        AI生成层                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Prompt Engineering                       │    │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐  │    │
│  │  │ System    │ │ Context   │ │ Knowledge  │ │ User      │  │    │
│  │  │ Prompt    │ │ Prompt    │ │ Context   │ │ Input     │  │    │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                    │                                │
│                                    ▼                                │
│                      ┌─────────────────────┐                        │
│                      │   LLM (GPT-4/Claude)│                        │
│                      └─────────────────────┘                        │
│                                    │                                │
│                                    ▼                                │
│                      ┌─────────────────────┐                        │
│                      │    Output Parser     │                        │
│                      │   (输出结构化解析)    │                        │
│                      └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                              AI回复输出
```

#### 1.2.2 材料生成系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                       材料生成系统架构                                │
└─────────────────────────────────────────────────────────────────────┘

  材料生成请求
     │
     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        请求解析层                                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                    │
│  │ 客户信息   │  │ 风控类型   │  │ 材料类型   │                    │
│  │ 解析       │  │ 分析       │  │ 确定       │                    │
│  └────────────┘  └────────────┘  └────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        模板匹配层                                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                    │
│  │ 模板库    │  │ 变量替换   │  │ 样式应用   │                    │
│  │ Template  │  │ Variable   │  │ Style      │                    │
│  │ Library   │  │ Replace    │  │ Apply      │                    │
│  └────────────┘  └────────────┘  └────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        AI增强层                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                    │
│  │ 内容优化   │  │ 个性化定制 │  │ 合规检查   │                    │
│  │ AI Content│  │ AI         │  │ Compliance │                    │
│  │ Polish    │  │ Personalize│  │ Check      │                    │
│  └────────────┘  └────────────┘  └────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        文档输出层                                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                    │
│  │ Word生成   │  │ PDF转换   │  │ 文件存储   │                    │
│  │ DOCX Gen  │  │ PDF Conv   │  │ File Store │                    │
│  └────────────┘  └────────────┘  └────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                           材料文件输出
```

---

## 2. 数据库设计

### 2.1 ER图概述

```
┌─────────────────────────────────────────────────────────────────────┐
│                           数据库ER图                                 │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   customers  │         │    orders    │         │   products   │
├──────────────┤         ├──────────────┤         ├──────────────┤
│ id (PK)      │──┐   ┌──│ id (PK)      │    ┌───│ id (PK)      │
│ xianyu_nick  │  │   │  │ customer_id  │───→│   │ name         │
│ merchant_id  │  │   │  │ product_id   │    │   │ price        │
│ merchant_type│ │   │  │ status       │    │   │ description  │
│ subject_type │  │   │  │ amount       │    │   │ created_at   │
│ legal_person │  │   │  │ pay_status   │    │   │ updated_at   │
│ phone        │  │   │  │ created_at   │    │   └──────────────┘
│ risk_type    │  │   │  │ updated_at   │    │
│ risk_level   │  │   │  │ paid_at      │    │
│ info_status  │  │   │  │ delivered_at │    │
│ created_at   │  │   │  └──────────────┘    │
│ updated_at   │  │   │         │            │
└──────────────┘  │   │         │            │
       │          │   │         ▼            │
       │          │   │  ┌──────────────┐    │
       │          │   │  │ order_items │    │
       │          │   │  ├──────────────┤    │
       │          │   │  │ id (PK)      │    │
       │          │   │  │ order_id (FK)│────┘
       │          │   │  │ material_type│
       │          │   │  │ file_url     │
       │          │   │  │ created_at   │
       │          │   │  └──────────────┘
       │          │   │
       │          │   │
       │          │   │
       │          │   │
       │          │   │
       │          │   │
       │          │   │
       │          │   │
       │          │   │
       │          │   │
       │          │   │
       │          │   │
       ▼          │   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           附加实体                                   │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  documents   │         │ conversations│         │knowledge_base│
├──────────────┤         ├──────────────┤         ├──────────────┤
│ id (PK)      │         │ id (PK)      │         │ id (PK)      │
│ customer_id  │────────→│ customer_id  │         │ category     │
│ doc_type     │         │ role         │         │ title        │
│ doc_name     │         │ content      │         │ content      │
│ file_url     │         │ created_at   │         │ embedding    │
│ created_at   │         │ updated_at   │         │ use_count    │
│ updated_at   │         │ is_ai        │         │ success_rate │
└──────────────┘         └──────────────┘         │ created_at   │
       │                                          │ updated_at   │
       │                                          └──────────────┘
       │                                                  │
       ▼                                                  ▼
┌──────────────┐                                 ┌──────────────┐
│ appeal_result │                                 │ material_temp│
├──────────────┤                                 ├──────────────┤
│ id (PK)      │                                 │ id (PK)      │
│ customer_id  │                                 │ temp_type    │
│ order_id     │                                 │ temp_name    │
│ result       │                                 │ content      │
│ appeal_date  │                                 │ variables    │
│ status       │                                 │ is_active    │
│ feedback     │                                 │ created_at   │
│ created_at   │                                 │ updated_at   │
└──────────────┘                                 └──────────────┘
```

### 2.2 数据表详细设计

#### 2.2.1 customers（客户表）

```sql
CREATE TABLE customers (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '客户ID',
    xianyu_nick     VARCHAR(64) COMMENT '闲鱼昵称',
    xianyu_user_id  VARCHAR(64) COMMENT '闲鱼用户ID',
    wechat_openid   VARCHAR(64) COMMENT '微信OpenID',
    merchant_id     VARCHAR(64) COMMENT '商户号(微信mchid/支付宝商户ID)',
    merchant_id_type ENUM('wechat', 'alipay', 'both') DEFAULT 'wechat' COMMENT '商户号类型',
    merchant_type   ENUM('普通商户', '特约商户', '服务商', '二级商户') COMMENT '商户类型',
    subject_type    ENUM('企业', '个体工商户', '党政机关', '事业单位', '其他组织') COMMENT '主体类型',
    company_name     VARCHAR(256) COMMENT '公司/店铺名称',
    legal_person     VARCHAR(64) COMMENT '法人姓名',
    legal_person_id  VARCHAR(256) COMMENT '法人身份证号(加密存储)',
    phone            VARCHAR(32) COMMENT '联系电话',
    risk_type        VARCHAR(128) COMMENT '风控类型',
    risk_level       ENUM('warning', 'limited', 'closed') COMMENT '风险等级',
    risk_details     TEXT COMMENT '风控详情',
    info_status      ENUM('pending', 'collecting', 'completed', 'insufficient') DEFAULT 'pending' COMMENT '信息收集状态',
    customer_status  ENUM('potential', 'consulting', 'intentional', 'purchased', 'completed', 'failed') DEFAULT 'potential' COMMENT '客户状态',
    source           VARCHAR(32) COMMENT '客户来源',
    tags             JSON COMMENT '客户标签',
    internal_notes   TEXT COMMENT '内部备注',
    last_contact_at  DATETIME COMMENT '最后联系时间',
    next_followup_at DATETIME COMMENT '下次跟进时间',
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at       DATETIME COMMENT '删除时间',

    INDEX idx_xianyu_nick (xianyu_nick),
    INDEX idx_merchant_id (merchant_id),
    INDEX idx_phone (phone),
    INDEX idx_customer_status (customer_status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户表';
```

#### 2.2.2 orders（订单表）

```sql
CREATE TABLE orders (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '订单ID',
    order_no            VARCHAR(64) UNIQUE COMMENT '订单号',
    customer_id         BIGINT UNSIGNED NOT NULL COMMENT '客户ID',
    product_id          BIGINT UNSIGNED COMMENT '商品ID',
    order_type          ENUM('product', 'custom', 'package') DEFAULT 'product' COMMENT '订单类型',
    status              ENUM('pending', 'confirmed', 'cancelled', 'refunded') DEFAULT 'pending' COMMENT '订单状态',
    total_amount        DECIMAL(10, 2) UNSIGNED COMMENT '订单总额',
    discount_amount     DECIMAL(10, 2) UNSIGNED DEFAULT 0.00 COMMENT '优惠金额',
    pay_amount          DECIMAL(10, 2) UNSIGNED COMMENT '实付金额',
    pay_status          ENUM('unpaid', 'paid', 'refunding', 'refunded') DEFAULT 'unpaid' COMMENT '支付状态',
    pay_method          ENUM('wechat', 'alipay', 'xianyu', 'bank') COMMENT '支付方式',
    pay_time            DATETIME COMMENT '支付时间',
    pay_transaction_id  VARCHAR(128) COMMENT '支付流水号',
    delivery_status     ENUM('undelivered', 'delivered', 'confirmed') DEFAULT 'undelivered' COMMENT '交付状态',
    deliver_time        DATETIME COMMENT '交付时间',
    delivery_method     ENUM('auto', 'manual') COMMENT '交付方式',
    customer_note       TEXT COMMENT '客户备注',
    admin_note          TEXT COMMENT '管理员备注',
    appeal_status       ENUM('not_submitted', 'submitted', 'approved', 'rejected', 'unknown') COMMENT '申诉状态',
    appeal_submit_time  DATETIME COMMENT '申诉提交时间',
    appeal_result_time DATETIME COMMENT '申诉结果时间',
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at          DATETIME COMMENT '删除时间',

    INDEX idx_order_no (order_no),
    INDEX idx_customer_id (customer_id),
    INDEX idx_status (status),
    INDEX idx_pay_status (pay_status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';
```

#### 2.2.3 products（商品表）

```sql
CREATE TABLE products (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '商品ID',
    product_no      VARCHAR(64) UNIQUE COMMENT '商品编号',
    name            VARCHAR(256) NOT NULL COMMENT '商品名称',
    subtitle        VARCHAR(512) COMMENT '商品副标题',
    description     TEXT COMMENT '商品描述',
    product_type    ENUM('basic', 'standard', 'premium', 'custom') COMMENT '商品类型',
    price           DECIMAL(10, 2) UNSIGNED NOT NULL COMMENT '售价',
    cost_price      DECIMAL(10, 2) UNSIGNED COMMENT '成本价',
    profit          DECIMAL(10, 2) COMMENT '利润',
    risk_types      JSON COMMENT '适用风控类型',
    includes        JSON COMMENT '包含内容',
    delivery_type   ENUM('auto', 'manual', 'mixed') DEFAULT 'auto' COMMENT '交付方式',
    delivery_content JSON COMMENT '交付内容清单',
    xianyu_item_id  VARCHAR(128) COMMENT '闲鱼商品ID',
    xianyu_status   ENUM('draft', 'onsale', 'soldout', 'deleted') DEFAULT 'draft' COMMENT '闲鱼上架状态',
    stock           INT DEFAULT 999 COMMENT '库存',
    sales_count     INT DEFAULT 0 COMMENT '销量',
    rating          DECIMAL(3, 2) DEFAULT 5.00 COMMENT '评分',
    is_active       TINYINT(1) DEFAULT 1 COMMENT '是否上架',
    sort_order      INT DEFAULT 0 COMMENT '排序',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at      DATETIME COMMENT '删除时间',

    INDEX idx_product_type (product_type),
    INDEX idx_price (price),
    INDEX idx_is_active (is_active),
    INDEX idx_xianyu_item_id (xianyu_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品表';
```

#### 2.2.4 conversations（对话记录表）

```sql
CREATE TABLE conversations (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '对话ID',
    customer_id     BIGINT UNSIGNED COMMENT '客户ID',
    session_id      VARCHAR(128) COMMENT '会话ID',
    platform        ENUM('xianyu', 'wechat', 'web', 'admin') COMMENT '对话平台',
    role            ENUM('user', 'assistant', 'system') NOT NULL COMMENT '发言角色',
    content         TEXT NOT NULL COMMENT '对话内容',
    content_type    ENUM('text', 'image', 'file', 'template') DEFAULT 'text' COMMENT '内容类型',
    intent          VARCHAR(64) COMMENT '识别意图',
    entities        JSON COMMENT '提取的实体',
    message_type    ENUM('chat', 'info_request', 'info_response', 'recommendation', 'closing') COMMENT '消息类型',
    is_ai_generated TINYINT(1) DEFAULT 1 COMMENT '是否AI生成',
    model_used      VARCHAR(64) COMMENT '使用的AI模型',
    tokens_used     INT COMMENT '消耗的tokens',
    feedback        ENUM('like', 'dislike', 'null') DEFAULT 'null' COMMENT '用户反馈',
    admin_id        BIGINT UNSIGNED COMMENT '处理的管理员ID',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    INDEX idx_customer_id (customer_id),
    INDEX idx_session_id (session_id),
    INDEX idx_created_at (created_at),
    INDEX idx_intent (intent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对话记录表';
```

#### 2.2.5 documents（文档材料表）

```sql
CREATE TABLE documents (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '文档ID',
    customer_id     BIGINT UNSIGNED NOT NULL COMMENT '客户ID',
    order_id        BIGINT UNSIGNED COMMENT '关联订单ID',
    doc_type        ENUM('appeal_statement', 'rectification_report', 'commitment_letter',
                         'situation_explanation', 'material_list', 'supplementary_note',
                         'business_license', 'id_card', 'door_photo', 'interior_photo',
                         'transaction_receipt', 'other') NOT NULL COMMENT '文档类型',
    doc_name        VARCHAR(256) COMMENT '文档名称',
    file_url        VARCHAR(512) COMMENT '文件OSS地址',
    file_size       BIGINT COMMENT '文件大小',
    file_type       VARCHAR(32) COMMENT '文件MIME类型',
    storage_path    VARCHAR(512) COMMENT '存储路径',
    doc_status      ENUM('generating', 'generated', 'reviewed', 'approved', 'rejected') DEFAULT 'generating' COMMENT '文档状态',
    generation_type ENUM('template', 'ai', 'mixed') DEFAULT 'ai' COMMENT '生成方式',
    ai_prompt       TEXT COMMENT '使用的AI提示词',
    review_note     TEXT COMMENT '审核备注',
    reviewed_by     BIGINT UNSIGNED COMMENT '审核人',
    reviewed_at     DATETIME COMMENT '审核时间',
    version         INT DEFAULT 1 COMMENT '版本号',
    parent_id       BIGINT UNSIGNED COMMENT '父文档ID(用于版本管理)',
    is_final        TINYINT(1) DEFAULT 0 COMMENT '是否为最终版本',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at      DATETIME COMMENT '删除时间',

    INDEX idx_customer_id (customer_id),
    INDEX idx_order_id (order_id),
    INDEX idx_doc_type (doc_type),
    INDEX idx_doc_status (doc_status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文档材料表';
```

#### 2.2.6 knowledge_base（知识库表）

```sql
CREATE TABLE knowledge_base (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '知识ID',
    category        ENUM('policy', 'procedure', 'case', 'template', 'faq', ' guideline') NOT NULL COMMENT '知识类别',
    title           VARCHAR(256) NOT NULL COMMENT '标题',
    content         TEXT NOT NULL COMMENT '知识内容',
    summary         VARCHAR(512) COMMENT '摘要',
    keywords        JSON COMMENT '关键词',
    embedding       VECTOR(1536) COMMENT '向量嵌入',
    risk_types      JSON COMMENT '关联的风控类型',
    use_scenarios   JSON COMMENT '适用场景',
    success_rate    DECIMAL(5, 2) COMMENT '成功率',
    use_count       INT DEFAULT 0 COMMENT '使用次数',
    success_count   INT DEFAULT 0 COMMENT '成功次数',
    rating          DECIMAL(3, 2) DEFAULT 5.00 COMMENT '评分',
    source          VARCHAR(64) COMMENT '来源',
    is_active       TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    is_public       TINYINT(1) DEFAULT 1 COMMENT '是否公开',
    admin_id        BIGINT UNSIGNED COMMENT '创建/维护人',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at      DATETIME COMMENT '删除时间',

    INDEX idx_category (category),
    INDEX idx_risk_types (risk_types),
    INDEX idx_is_active (is_active),
    INDEX idx_use_count (use_count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识库表';
```

#### 2.2.7 material_templates（材料模板表）

```sql
CREATE TABLE material_templates (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '模板ID',
    temp_type       ENUM('appeal_statement', 'rectification_report', 'commitment_letter',
                         'situation_explanation', 'material_list', 'supplementary_note') NOT NULL COMMENT '模板类型',
    temp_name       VARCHAR(256) NOT NULL COMMENT '模板名称',
    temp_code       VARCHAR(64) COMMENT '模板代码',
    description     TEXT COMMENT '模板描述',
    content         TEXT NOT NULL COMMENT '模板内容(Prompt或模板语法)',
    variables       JSON COMMENT '变量定义',
    default_values  JSON COMMENT '默认值',
    risk_types      JSON COMMENT '适用风控类型',
    product_types   JSON COMMENT '适用商品类型',
    is_active       TINYINT(1) DEFAULT 1 COMMENT '是否启用',
    is_default      TINYINT(1) DEFAULT 0 COMMENT '是否为默认模板',
    version         INT DEFAULT 1 COMMENT '版本号',
    use_count       INT DEFAULT 0 COMMENT '使用次数',
    success_count   INT DEFAULT 0 COMMENT '成功次数',
    success_rate    DECIMAL(5, 2) COMMENT '成功率',
    prompt_template TEXT COMMENT 'AI生成时的Prompt模板',
    admin_id        BIGINT UNSIGNED COMMENT '创建/维护人',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted_at      DATETIME COMMENT '删除时间',

    INDEX idx_temp_type (temp_type),
    INDEX idx_is_active (is_active),
    INDEX idx_is_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='材料模板表';
```

#### 2.2.8 appeal_results（申诉结果表）

```sql
CREATE TABLE appeal_results (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
    customer_id     BIGINT UNSIGNED NOT NULL COMMENT '客户ID',
    order_id        BIGINT UNSIGNED COMMENT '关联订单ID',
    appeal_type     ENUM('self', 'assisted') DEFAULT 'self' COMMENT '申诉类型',
    appeal_channel  ENUM('wechat', 'alipay', 'both') COMMENT '申诉渠道',
    submit_time     DATETIME COMMENT '提交时间',
    result          ENUM('pending', 'approved', 'rejected', 'withdrawn') COMMENT '申诉结果',
    result_time     DATETIME COMMENT '结果时间',
    result_reason   TEXT COMMENT '结果原因',
    feedback        TEXT COMMENT '客户反馈',
    improvement_suggestions TEXT COMMENT '改进建议',
    documents       JSON COMMENT '提交的文档列表',
    is_learned      TINYINT(1) DEFAULT 0 COMMENT '是否已学习',
    learned_at      DATETIME COMMENT '学习时间',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    INDEX idx_customer_id (customer_id),
    INDEX idx_result (result),
    INDEX idx_submit_time (submit_time),
    INDEX idx_is_learned (is_learned)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='申诉结果表';
```

#### 2.2.9 learning_logs（学习日志表）

```sql
CREATE TABLE learning_logs (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '日志ID',
    learn_type      ENUM('case', 'feedback', 'result', 'policy', 'manual') NOT NULL COMMENT '学习类型',
    source_id       BIGINT UNSIGNED COMMENT '来源ID',
    source_type     VARCHAR(64) COMMENT '来源类型',
    content         TEXT COMMENT '学习内容',
    extracted_knowledge TEXT COMMENT '提取的知识',
    target_type     ENUM('knowledge', 'template', 'strategy', 'prompt') COMMENT '目标类型',
    target_id       BIGINT UNSIGNED COMMENT '目标ID',
    changes         JSON COMMENT '变更内容',
    status          ENUM('pending', 'applied', 'rejected', 'archived') DEFAULT 'pending' COMMENT '状态',
    reviewed_by     BIGINT UNSIGNED COMMENT '审核人',
    reviewed_at     DATETIME COMMENT '审核时间',
    applied_at      DATETIME COMMENT '应用时间',
    admin_note      TEXT COMMENT '管理员备注',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    INDEX idx_learn_type (learn_type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学习日志表';
```

---

## 3. API接口设计

### 3.1 API设计规范

#### 3.1.1 RESTful规范

```
URL设计规范：
- 资源命名：使用名词复数形式
- HTTP方法：GET(查询), POST(创建), PUT(更新), DELETE(删除)
- 版本控制：/api/v1/

示例：
GET    /api/v1/customers          - 获取客户列表
GET    /api/v1/customers/:id      - 获取单个客户
POST   /api/v1/customers          - 创建客户
PUT    /api/v1/customers/:id      - 更新客户
DELETE /api/v1/customers/:id      - 删除客户

POST   /api/v1/orders              - 创建订单
GET    /api/v1/orders/:id          - 获取订单详情
PUT    /api/v1/orders/:id/pay      - 支付订单
```

#### 3.1.2 统一响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": { },
  "timestamp": "2026-04-13T10:30:00Z",
  "request_id": "req_xxxxx"
}

错误响应：
{
  "code": 400,
  "message": "参数错误",
  "error": {
    "field": "merchant_id",
    "reason": "商户号格式不正确"
  },
  "timestamp": "2026-04-13T10:30:00Z",
  "request_id": "req_xxxxx"
}
```

### 3.2 核心API列表

#### 3.2.1 客户管理API

| 方法 | 路径 | 说明 | 优先级 |
|-----|------|------|-------|
| GET | /api/v1/customers | 获取客户列表 | P0 |
| GET | /api/v1/customers/:id | 获取客户详情 | P0 |
| POST | /api/v1/customers | 创建客户 | P0 |
| PUT | /api/v1/customers/:id | 更新客户 | P0 |
| DELETE | /api/v1/customers/:id | 删除客户 | P1 |
| PUT | /api/v1/customers/:id/info-status | 更新信息收集状态 | P0 |
| POST | /api/v1/customers/:id/notes | 添加客户备注 | P1 |
| GET | /api/v1/customers/:id/conversations | 获取客户对话历史 | P0 |
| GET | /api/v1/customers/:id/documents | 获取客户文档列表 | P0 |

#### 3.2.2 订单管理API

| 方法 | 路径 | 说明 | 优先级 |
|-----|------|------|-------|
| GET | /api/v1/orders | 获取订单列表 | P0 |
| GET | /api/v1/orders/:id | 获取订单详情 | P0 |
| POST | /api/v1/orders | 创建订单 | P0 |
| PUT | /api/v1/orders/:id | 更新订单 | P1 |
| POST | /api/v1/orders/:id/confirm | 确认订单 | P0 |
| POST | /api/v1/orders/:id/cancel | 取消订单 | P1 |
| POST | /api/v1/orders/:id/pay | 支付订单 | P0 |
| POST | /api/v1/orders/:id/deliver | 交付订单 | P0 |
| GET | /api/v1/orders/:id/documents | 获取订单文档 | P0 |

#### 3.2.3 AI对话API

| 方法 | 路径 | 说明 | 优先级 |
|-----|------|------|-------|
| POST | /api/v1/chat | 发送消息并获取AI回复 | P0 |
| GET | /api/v1/chat/history/:customer_id | 获取对话历史 | P0 |
| POST | /api/v1/chat/feedback | 提交对话反馈 | P1 |
| POST | /api/v1/chat/intent | 意图识别 | P1 |
| GET | /api/v1/chat/sessions/:customer_id | 获取会话列表 | P1 |

#### 3.2.4 材料生成API

| 方法 | 路径 | 说明 | 优先级 |
|-----|------|------|-------|
| POST | /api/v1/documents/generate | 生成文档 | P0 |
| GET | /api/v1/documents/:id | 获取文档详情 | P0 |
| GET | /api/v1/documents/:id/download | 下载文档 | P0 |
| PUT | /api/v1/documents/:id | 更新文档 | P1 |
| POST | /api/v1/documents/:id/review | 审核文档 | P1 |
| POST | /api/v1/documents/:id/regenerate | 重新生成 | P1 |
| GET | /api/v1/documents/templates | 获取模板列表 | P1 |

#### 3.2.5 支付API

| 方法 | 路径 | 说明 | 优先级 |
|-----|------|------|-------|
| POST | /api/v1/pay/wechat | 微信支付 | P0 |
| POST | /api/v1/pay/alipay | 支付宝支付 | P0 |
| POST | /api/v1/pay/callback/wechat | 微信支付回调 | P0 |
| POST | /api/v1/pay/callback/alipay | 支付宝回调 | P0 |
| POST | /api/v1/pay/refund | 申请退款 | P1 |
| GET | /api/v1/pay/status/:order_id | 查询支付状态 | P1 |

#### 3.2.6 闲鱼API

| 方法 | 路径 | 说明 | 优先级 |
|-----|------|------|-------|
| POST | /api/v1/xianyu/webhook | 闲鱼消息回调 | P0 |
| POST | /api/v1/xianyu/reply | 发送闲鱼消息 | P0 |
| GET | /api/v1/xianyu/goods | 获取闲鱼商品列表 | P1 |
| POST | /api/v1/xianyu/goods/publish | 发布商品 | P2 |
| POST | /api/v1/xianyu/goods/:id/offline | 下架商品 | P2 |

#### 3.2.7 知识库API

| 方法 | 路径 | 说明 | 优先级 |
|-----|------|------|-------|
| GET | /api/v1/knowledge | 搜索知识库 | P0 |
| GET | /api/v1/knowledge/:id | 获取知识详情 | P1 |
| POST | /api/v1/knowledge | 添加知识 | P1 |
| PUT | /api/v1/knowledge/:id | 更新知识 | P1 |
| POST | /api/v1/knowledge/:id/learn | 标记为已学习 | P2 |
| GET | /api/v1/knowledge/cases | 获取成功案例 | P1 |

#### 3.2.8 统计API

| 方法 | 路径 | 说明 | 优先级 |
|-----|------|------|-------|
| GET | /api/v1/stats/overview | 数据概览 | P1 |
| GET | /api/v1/stats/customers | 客户统计 | P1 |
| GET | /api/v1/stats/orders | 订单统计 | P1 |
| GET | /api/v1/stats/appeals | 申诉统计 | P1 |
| GET | /api/v1/stats/revenue | 营收统计 | P1 |
| GET | /api/v1/stats/conversion | 转化漏斗 | P1 |

---

## 4. 安全设计

### 4.1 安全架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                           安全架构                                  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         网络安全层                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │ WAF防火墙  │  │ DDoS防护  │  │ 负载均衡  │  │ SSL终端  │     │
│  │ Web应用   │  │ 流量清洗  │  │ 多节点    │  │ HTTPS    │     │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         应用安全层                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │ 身份认证   │  │ 权限控制  │  │ Token管理 │  │ CSRF防护  │     │
│  │ JWT/OAuth │  │ RBAC/ABAC │  │ 过期刷新  │  │ Token验证 │     │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                     │
│  │ 参数校验   │  │ SQL注入   │  │ XSS防护   │                     │
│  │ 严格类型  │  │ ORM转义  │  │ 转义输出  │                     │
│  └────────────┘  └────────────┘  └────────────┘                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         数据安全层                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │ 数据加密   │  │ 敏感脱敏  │  │ 备份恢复  │  │ 审计日志  │     │
│  │ AES-256  │  │ 动态脱敏  │  │ 异地容灾  │  │ 操作记录  │     │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 敏感数据处理

```javascript
// 敏感字段加密示例
const sensitiveFields = {
  legal_person_id: {
    algorithm: 'AES-256-GCM',
    encrypt: true,
    display: '**** **** **** ****',  // 只显示前4后4
    storage: 'encrypted'              // 加密存储
  },
  merchant_id: {
    encrypt: false,
    display: 'full',                 // 商户号可完整显示
    storage: 'plain'                  // 明文存储
  },
  phone: {
    algorithm: 'AES-256-GCM',
    encrypt: true,
    display: '138****5678',           // 手机号脱敏
    storage: 'encrypted'              // 加密存储
  }
};

// 数据访问权限控制
const accessControl = {
  'customer.legal_person_id': ['admin', 'owner'],     // 只有管理员可查看
  'customer.merchant_id': ['admin', 'staff', 'owner'], // 员工可查看
  'customer.phone': ['admin', 'staff', 'owner'],       // 员工可查看
  'customer.internal_notes': ['admin', 'owner']        // 只有管理员可查看
};
```

---

## 5. 部署架构

### 5.1 部署拓扑图

```
┌─────────────────────────────────────────────────────────────────────┐
│                          全球加速层                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    CDN (内容分发网络)                         │    │
│  │            静态资源加速 / HTTPS证书 / 就近访问                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            负载均衡层                                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    SLB (负载均衡器)                           │    │
│  │              健康检查 / 流量分发 / SSL卸载                     │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            Kubernetes集群                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      API服务 (多副本)                         │   │
│  │    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │   │
│  │    │ api-1   │  │ api-2   │  │ api-3   │  │ api-n   │    │   │
│  │    └──────────┘  └──────────┘  └──────────┘  └──────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      AI服务 (GPU节点)                        │   │
│  │    ┌──────────┐  ┌──────────┐                               │   │
│  │    │ ai-svc-1 │  │ ai-svc-2 │  (大模型推理服务)               │   │
│  │    └──────────┘  └──────────┘                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    WebSocket服务 (长连接)                    │   │
│  │    ┌──────────┐  ┌──────────┐                               │   │
│  │    │ ws-1    │  │ ws-2    │                               │   │
│  │    └──────────┘  └──────────┘                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                    │                               │
                    ▼                               ▼
┌─────────────────────────────┐   ┌───────────────────────────────────┐
│        数据库层              │   │            缓存/消息层             │
│  ┌───────────────────────┐  │   │  ┌───────────────────────────┐   │
│  │ MySQL 主从复制          │  │   │  │ Redis Cluster (主从)     │   │
│  │ ┌────────┐ ┌────────┐  │  │   │  │ 缓存 / 会话 / 消息队列   │   │
│  │ │Master │ │ Slave  │  │  │   │  └───────────────────────────┘   │
│  │ └────────┘ └────────┘  │  │   │  ┌───────────────────────────┐   │
│  └───────────────────────┘  │   │  │ Kafka/RabbitMQ          │   │
│  ┌───────────────────────┐  │   │  │ 异步消息 / 日志收集       │   │
│  │ MongoDB 副本集         │  │   │  └───────────────────────────┘   │
│  │ 日志存储               │  │   │                                   │
│  └───────────────────────┘  │   │                                   │
└─────────────────────────────┘   └───────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            存储层                                    │
│  ┌───────────────────────┐  ┌───────────────────────────────────┐  │
│  │ 阿里云 OSS             │  │ 向量数据库 (Pinecone/Milvus)      │  │
│  │ 文档存储 / 静态资源     │  │ 知识库向量检索                    │  │
│  └───────────────────────┘  └───────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 环境配置

| 环境 | 用途 | 配置 |
|-----|------|------|
| Development | 开发环境 | 本地/Docker |
| Testing | 测试环境 | 2核4G × 2节点 |
| Staging | 预发布环境 | 4核8G × 2节点 |
| Production | 生产环境 | 8核16G × n节点 |

---

## 6. 监控与运维

### 6.1 监控体系

```
┌─────────────────────────────────────────────────────────────────────┐
│                           监控体系                                  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          基础设施监控                                │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │ 服务器监控 │  │ 网络监控  │  │ 容器监控  │  │ 日志监控  │     │
│  │ CPU/内存  │  │ 流量/延迟 │  │ Pod/Node  │  │ ELK Stack │     │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          应用监控                                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │ 接口监控  │  │ 错误监控  │  │ 性能监控  │  │ 业务监控  │     │
│  │ 响应时间  │  │ 异常率    │  │ APM链路  │  │ 转化率   │     │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          AI监控                                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │ 模型调用  │  │ Token消耗  │  │ 生成质量  │  │ 知识库效果 │     │
│  │ 成功率   │  │ 成本统计  │  │ 成功率   │  │ 检索准确率 │     │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          告警通知                                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │ 钉钉/企业微信│  │ 邮件通知  │  │ 短信通知  │  │ 电话告警  │     │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 核心告警指标

| 指标类别 | 指标名称 | 阈值 | 告警级别 |
|---------|---------|------|---------|
| 可用性 | API成功率 | <99% | 严重 |
| 可用性 | 服务宕机 | 发生 | 紧急 |
| 性能 | API响应时间 | >3s | 警告 |
| 性能 | AI响应时间 | >10s | 警告 |
| AI成本 | Token日消耗 | >预算120% | 警告 |
| 业务 | 支付失败率 | >5% | 警告 |
| 业务 | 申诉成功率 | <50% | 警告 |

---

## 7. 附录

### 7.1 技术术语

| 术语 | 说明 |
|-----|------|
| JWT | JSON Web Token, 用于身份认证 |
| RBAC | Role-Based Access Control, 基于角色的权限控制 |
| WAF | Web Application Firewall, Web应用防火墙 |
| CDN | Content Delivery Network, 内容分发网络 |
| APM | Application Performance Monitoring, 应用性能监控 |
| RAG | Retrieval-Augmented Generation, 检索增强生成 |

### 7.2 第三方服务

| 服务 | 用途 | 官网 |
|-----|------|------|
| 阿里云 | 云服务器/OSS | https://www.aliyun.com |
| 微信支付 | 支付接口 | https://pay.weixin.qq.com |
| 支付宝 | 支付接口 | https://open.alipay.com |
| OpenAI | GPT-4 API | https://openai.com |
| Anthropic | Claude API | https://anthropic.com |
| Pinecone | 向量数据库 | https://www.pinecone.io |

# 商户号申诉智能服务系统 - 完整项目文档

**文档版本**: V1.0
**编写日期**: 2026-04-13
**项目负责人**: AI产品经理
**项目所有者**: 艾阳老板
**文档状态**: 完整版

---

## 目录

1. [项目概述](#1-项目概述)
2. [商业模式与业务流程](#2-商业模式与业务流程)
3. [产品功能架构](#3-产品功能架构)
4. [市场分析与用户画像](#4-市场分析与用户画像)
5. [技术架构设计](#5-技术架构设计)
6. [数据库设计](#6-数据库设计)
7. [API接口设计](#7-api接口设计)
8. [前端开发规范](#8-前端开发规范)
9. [后端开发规范](#9-后端开发规范)
10. [UI设计规范](#10-ui设计规范)
11. [安全设计方案](#11-安全设计方案)
12. [部署架构](#12-部署架构)
13. [开发计划](#13-开发计划)
14. [运维与监控](#14-运维与监控)
15. [风险与应对](#15-风险与应对)
16. [成本预算](#16-成本预算)
17. [附录](#17-附录)

---

## 1. 项目概述

### 1.1 项目背景

随着微信支付/支付宝商户号风控日益严格，大量商户面临商户号被限制、封禁的问题。传统申诉流程复杂，需要准备大量材料，且申诉成功率低。市场需求强烈需要一个智能化的解决方案。

艾阳老板在闲鱼平台拥有丰富的客户资源，希望通过技术手段建立一个完整的智能服务体系：**从获客、咨询、材料生成到交易付款的全链路自动化**。

### 1.2 项目目标

**核心目标**：打造一个基于AI的商户号申诉智能服务平台，实现从客户获取、需求沟通、申诉材料自动生成到付费购买的全流程闭环。

**业务目标**：
- 闲鱼自动获客，降低获客成本
- AI 7×24小时自动咨询服务，提升响应效率
- AI自动生成专业申诉材料，提高申诉成功率
- 在线交易支付，自动化交付
- 系统持续自我学习优化，越用越智能

### 1.3 项目定位

- **产品定位**: B端服务（面向有商户号申诉需求的C端小商户）
- **目标用户**: 淘宝/闲鱼小卖家、微商、个体工商户
- **核心价值**: 专业、省时、高效
- **差异化**: AI自动化 + 专业知识库 + 持续学习

### 1.4 核心优势

| 优势维度 | 描述 |
|---------|------|
| **AI自动化** | 7×24小时自动回复，自动生成申诉材料 |
| **专业知识库** | 内置商户号申诉专业知识体系 |
| **自我学习** | 每次交互都在学习，越用越智能 |
| **交易闭环** | 咨询、付费、交付一体化 |
| **闲鱼直连** | 与闲鱼平台无缝对接，自动获取客户 |

---

## 2. 商业模式与业务流程

### 2.1 商业模式图

```
┌─────────────┐    获客    ┌─────────────┐   咨询   ┌─────────────┐
│   闲鱼用户   │ ────────> │  AI客服系统  │ ───────> │  订单系统   │
└─────────────┘           └─────────────┘          └──────┬──────┘
                                                          │
                                                          ▼
┌─────────────┐   付款    ┌─────────────┐   交付    ┌─────────────┐
│   客户付款   │ <─────── │  支付系统   │  <────── │  材料生成   │
└─────────────┘           └─────────────┘          └─────────────┘
```

### 2.2 完整业务流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                           完整业务流程                                │
└─────────────────────────────────────────────────────────────────────┘

[闲鱼获客阶段]
──────────────────────────────────────────────────────────────────────
     │
     ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│ 客户搜索     │ ───> │ AI自动回复   │ ───> │ 引导留联系方式 │
│ "商户号被风控"│      │ 咨询问题     │      │ 引导加微信    │
└─────────────┘      └─────────────┘      └──────┬──────┘
                                                 │
[信息收集阶段]                                    │
─────────────────────────────────────────────────┼──────────────────
                                                 ▼
                                          ┌─────────────┐
                                          │ 微信/电话    │
                                          │ 深度沟通     │
                                          └──────┬──────┘
                                                 │
                                                 ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│ AI收集信息   │ <── │ 发送信息收集  │ <── │ 了解客户需求  │
│ 自动录入    │      │ 清单         │      │ 确认风控情况  │
└──────┬──────┘      └─────────────┘      └─────────────┘
       │
       │ 客户提交营业执照、身份证、商户号等信息
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│ [AI材料生成阶段]                                                     │
│                                                                      │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐         │
│  │ AI分析      │ ───> │ 智能生成    │ ───> │ 材料预览     │         │
│  │ 风控类型    │      │ 申诉材料    │      │ 客户确认     │         │
│  └─────────────┘      └─────────────┘      └──────┬──────┘         │
│                                                    │                │
└────────────────────────────────────────────────────┼────────────────┘
                                                     │ 客户确认满意
                                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ [付费购买阶段]                                                        │
│                                                                      │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐         │
│  │ 推送商品链接 │ ───> │ 客户付款    │ ───> │ 支付回调     │         │
│  │ 微信/支付宝  │      │             │      │ 确认付款     │         │
│  └─────────────┘      └─────────────┘      └──────┬──────┘         │
│                                                    │                │
└────────────────────────────────────────────────────┼────────────────┘
                                                     │ 付款成功
                                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ [材料交付阶段]                                                        │
│                                                                      │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐         │
│  │ 自动交付    │ ───> │ 材料下载    │ ───> │ 提交指导     │         │
│  │ 完整材料包  │      │ 链接发送    │      │ 申诉提交     │         │
│  └─────────────┘      └─────────────┘      └──────┬──────┘         │
│                                                    │                │
└────────────────────────────────────────────────────┼────────────────┘
                                                     │ 客户自行提交
                                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ [售后服务阶段]                                                        │
│                                                                      │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐         │
│  │ 进度跟踪    │ ───> │ 结果反馈    │ ───> │ 成功案例入库 │         │
│  │ 提醒客户    │      │ 更新状态    │      │ 知识库学习   │         │
│  └─────────────┘      └─────────────┘      └─────────────┘         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 简化流程（Phase 1）

```
客户 ──> 闲鱼咨询 ──> AI接待 ──> 信息收集 ──> 材料生成 ──> 发送报价 ──> 客户付款 ──> 交付材料 ──> 客户自行提交
         │              │           │           │           │           │
         └──────────────┴───────────┴───────────┴───────────┴───────────┘
                                     │
                              自动化程度逐步提升
```

### 2.4 定价策略

| 服务套餐 | 价格区间 | 包含内容 | 目标客户 |
|---------|---------|---------|---------|
| 基础版 | 299-499元 | 申诉说明 + 材料清单 + 基础指导 | 简单风控 |
| 标准版 | 799-1299元 | 完整材料包 + 全程指导 + 进度跟踪 | 一般风控 |
| 高端版 | 1999-2999元 | 1v1服务 + 加急 + 无限次修改 | 严重风控 |
| 定制版 | 4999+元 | 定制方案 + 陪同申诉 + 成功率保障 | 企业客户 |

### 2.5 预期收益

**保守估计**：
- 月咨询量：100-200人
- 转化率：15-25%
- 客单价：800-1200元
- **月收入：12,000-60,000元**

**乐观估计**：
- 月咨询量：500-1000人
- 转化率：20-30%
- 客单价：1000-1500元
- **月收入：100,000-450,000元**

---

## 3. 产品功能架构

### 3.1 整体架构图

```
┌────────────────────────────────────────────────────────────────────┐
│                         商户号申诉智能服务系统                         │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   闲鱼获客    │  │   AI客服    │  │   订单管理   │              │
│  │   模块       │  │   模块      │  │   模块       │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                      │
│         ▼                 ▼                 ▼                      │
│  ┌─────────────────────────────────────────────────────┐           │
│  │                    核心业务层                        │           │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐   │           │
│  │  │ 客户信息   │  │  AI材料    │  │  知识库    │   │           │
│  │  │ 收集管理   │  │  生成引擎   │  │  学习系统   │   │           │
│  │  └────────────┘  └────────────┘  └────────────┘   │           │
│  └─────────────────────────────────────────────────────┘           │
│                              │                                     │
│                              ▼                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   支付系统   │  │   材料库    │  │   数据分析   │              │
│  │   模块       │  │   管理      │  │   模块       │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 3.2 核心功能模块

#### 3.2.1 闲鱼获客模块

| 功能 | 优先级 | 说明 |
|-----|-------|------|
| 闲鱼账号登录 | P0 | 授权登录闲鱼账号 |
| 客户消息接收 | P0 | 自动接收闲鱼用户消息 |
| 自动回复 | P0 | 根据关键词自动回复 |
| 闲鱼商品自动上架 | P1 | 自动发布服务商品 |
| 闲鱼商品自动下架 | P1 | 根据库存/状态自动下架 |
| 客户行为追踪 | P1 | 记录客户浏览、咨询行为 |

#### 3.2.2 AI客服模块

| 功能 | 优先级 | 说明 |
|-----|-------|------|
| 意图识别 | P0 | 识别客户咨询意图 |
| 多轮对话 | P0 | 支持上下文连贯的多轮对话 |
| 寒暄回复 | P0 | 友好自然的开场白和结束语 |
| 咨询引导 | P0 | 引导客户提供必要信息 |
| 申诉进度查询 | P1 | 查询申诉状态并回复 |
| 敏感词过滤 | P0 | 过滤违规内容 |
| 对话记忆 | P0 | 记住关键客户信息 |

#### 3.2.3 客户信息管理模块

| 功能 | 优先级 | 说明 |
|-----|-------|------|
| 客户信息录入 | P0 | 手动/自动录入客户信息 |
| 客户信息存储 | P0 | 安全存储客户隐私数据 |
| 客户画像生成 | P0 | 基于对话自动生成客户画像 |
| 客户分类管理 | P1 | 按状态/价值/类型分类 |
| 信息补全提醒 | P1 | 提醒客户补全缺失信息 |
| 数据导出 | P1 | 支持导出客户数据 |

#### 3.2.4 AI材料生成模块

| 功能 | 优先级 | 说明 |
|-----|-------|------|
| 申诉说明生成 | P0 | 根据风控类型生成申诉说明 |
| 整改说明生成 | P0 | 生成针对性的整改说明 |
| 整改承诺书生成 | P0 | 生成标准承诺书模板 |
| 材料清单生成 | P0 | 生成需要准备的材料清单 |
| 个性化定制 | P0 | 根据具体情况定制内容 |
| 文档导出 | P0 | 支持Word/PDF格式导出 |
| 模板管理 | P1 | 管理申诉材料模板 |
| 历史版本管理 | P1 | 保留材料生成历史 |

#### 3.2.5 订单管理模块

| 功能 | 优先级 | 说明 |
|-----|-------|------|
| 商品管理 | P0 | 管理服务商品（定价/描述） |
| 订单创建 | P0 | 自动/手动创建订单 |
| 订单支付 | P0 | 集成支付功能 |
| 订单状态管理 | P0 | 跟踪订单全流程 |
| 交付管理 | P0 | 材料自动/手动交付 |
| 退款处理 | P1 | 支持退款申请 |
| 订单统计 | P1 | 订单数据分析 |

#### 3.2.6 支付系统模块

| 功能 | 优先级 | 说明 |
|-----|-------|------|
| 微信支付 | P0 | 集成微信支付收款 |
| 支付宝支付 | P0 | 集成支付宝收款 |
| 闲鱼支付 | P1 | 支持闲鱼内支付 |
| 支付回调 | P0 | 处理支付成功回调 |
| 对账管理 | P1 | 交易对账功能 |
| 发票管理 | P2 | 电子发票开具 |

#### 3.2.7 知识库学习模块

| 功能 | 优先级 | 说明 |
|-----|-------|------|
| 申诉案例库 | P0 | 积累成功申诉案例 |
| 知识图谱 | P0 | 构建商户号知识图谱 |
| 话术学习 | P0 | 学习优秀客服话术 |
| 材料模板优化 | P0 | 根据反馈优化模板 |
| 意图识别优化 | P1 | 优化对话意图识别 |
| 行业知识更新 | P1 | 更新政策法规知识 |
| 失败案例分析 | P1 | 分析申诉失败原因 |

#### 3.2.8 数据分析模块

| 功能 | 优先级 | 说明 |
|-----|-------|------|
| 客户分析 | P1 | 客户画像和行为分析 |
| 转化漏斗 | P1 | 咨询→下单→付款转化 |
| 营收分析 | P1 | 收入统计和趋势 |
| 材料分析 | P1 | 申诉成功率统计 |
| 客服质检 | P2 | 对话质量评估 |
| 实时监控大屏 | P2 | 业务数据实时展示 |

### 3.3 AI对话策略

```
阶段1：开场白
"您好，我是商户号申诉咨询助手。请问您是遇到了微信支付/支付宝
 商户号被风控的问题吗？"

阶段2：问题确认
"请问您的商户号是被限制收款了，还是完全无法使用了？"

阶段3：信息收集
"为了更好地帮助您，请提供以下信息：
 1. 商户号（微信支付mchid或支付宝商户ID）
 2. 营业执照名称
 3. 法人姓名
 4. 主要经营类目
 5. 风控原因（如果知道的话）"

阶段4：方案推荐
"根据您的情况，我们推荐以下服务方案：..."

阶段5：引导下单
"如果您需要我们的服务，可以点击下方链接购买..."
```

---

## 4. 市场分析与用户画像

### 4.1 目标市场

**市场规模**：
- 微信支付商户数千万，其中大量曾遭遇风控
- 支付宝商户同样面临商户号管理问题
- 申诉需求持续存在且增长

**目标用户特征**：
- 闲鱼活跃用户
- 小微商户/个体工商户
- 有紧急商户号申诉需求
- 愿意为专业服务付费

### 4.2 典型用户画像

**用户画像1：小李（淘宝卖家）**

| 属性 | 描述 |
|-----|------|
| 职业 | 淘宝店主 |
| 痛点 | 店铺被风控，支付宝收款受限 |
| 需求 | 快速恢复账号正常使用 |
| 付费意愿 | 500-2000元 |
| 决策周期 | 1-3天 |

**用户画像2：张姐（微商）**

| 属性 | 描述 |
|-----|------|
| 职业 | 微信分销商 |
| 痛点 | 收款功能被限制，客户无法付款 |
| 需求 | 尽快解封，恢复正常经营 |
| 付费意愿 | 300-1000元 |
| 决策周期 | 1-7天 |

**用户画像3：王老板（线下门店）**

| 属性 | 描述 |
|-----|------|
| 职业 | 餐饮/零售店主 |
| 痛点 | 门店收款码被风控，顾客无法支付 |
| 需求 | 专业申诉材料，一次通过 |
| 付费意愿 | 1000-3000元 |
| 决策周期 | 3-7天 |

---

## 5. 技术架构设计

### 5.1 整体技术架构

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

### 5.2 AI对话系统架构

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

### 5.3 材料生成系统架构

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

### 5.4 技术选型表

| 层级 | 技术选型 | 说明 |
|-----|---------|------|
| 前端框架 | React 18 + TypeScript | 后台管理系统 |
| 移动端 | 微信小程序 / H5 | 客户移动端 |
| 后端框架 | Node.js + Express/Koa | API服务 |
| 数据库 | MySQL 8.0 | 业务数据存储 |
| 缓存 | Redis | 会话缓存 |
| 文件存储 | 阿里云OSS | 材料文件存储 |
| AI大模型 | GPT-4 / Claude-3 | 核心AI能力 |
| AI向量库 | Pinecone / Milvus | 知识库检索 |
| 闲鱼对接 | 闲鱼开放平台API | 消息收发 |
| 支付 | 微信支付 / 支付宝 | 收款 |

---

## 6. 数据库设计

### 6.1 数据表概览

| 表名 | 说明 | 核心字段 |
|-----|------|---------|
| customers | 客户表 | id, xianyu_nick, merchant_id, risk_type, customer_status |
| orders | 订单表 | id, order_no, customer_id, product_id, pay_status, delivery_status |
| products | 商品表 | id, name, price, product_type, risk_types, is_active |
| conversations | 对话记录表 | id, customer_id, role, content, intent, is_ai_generated |
| documents | 文档材料表 | id, customer_id, order_id, doc_type, file_url, doc_status |
| knowledge_base | 知识库表 | id, category, title, content, embedding, use_count |
| material_templates | 材料模板表 | id, temp_type, temp_name, content, variables |
| appeal_results | 申诉结果表 | id, customer_id, result, appeal_channel, feedback |
| learning_logs | 学习日志表 | id, learn_type, source_type, content, status |
| users | 用户表 | id, username, password, role, permissions |

### 6.2 客户表 (customers)

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

### 6.3 订单表 (orders)

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

### 6.4 商品表 (products)

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

### 6.5 对话记录表 (conversations)

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

### 6.6 文档材料表 (documents)

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

### 6.7 知识库表 (knowledge_base)

```sql
CREATE TABLE knowledge_base (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '知识ID',
    category        ENUM('policy', 'procedure', 'case', 'template', 'faq', 'guideline') NOT NULL COMMENT '知识类别',
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

### 6.8 材料模板表 (material_templates)

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

### 6.9 申诉结果表 (appeal_results)

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

### 6.10 学习日志表 (learning_logs)

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

## 7. API接口设计

### 7.1 API设计规范

#### RESTful规范

```
URL设计规范：
- 资源命名：使用名词复数形式
- HTTP方法：GET(查询), POST(创建), PUT(更新), DELETE(删除)
- 版本控制：/api/v1/

示例：
GET    /api/v1/customers          - 获取客户列表
GET    /api/v1/customers/:id      - 获取单个客户
POST   /api/v1/customers           - 创建客户
PUT    /api/v1/customers/:id      - 更新客户
DELETE /api/v1/customers/:id       - 删除客户

POST   /api/v1/orders              - 创建订单
GET    /api/v1/orders/:id          - 获取订单详情
PUT    /api/v1/orders/:id/pay      - 支付订单
```

#### 统一响应格式

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

### 7.2 客户管理API

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

### 7.3 订单管理API

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

### 7.4 AI对话API

| 方法 | 路径 | 说明 | 优先级 |
|-----|------|------|-------|
| POST | /api/v1/chat | 发送消息并获取AI回复 | P0 |
| GET | /api/v1/chat/history/:customer_id | 获取对话历史 | P0 |
| POST | /api/v1/chat/feedback | 提交对话反馈 | P1 |
| POST | /api/v1/chat/intent | 意图识别 | P1 |
| GET | /api/v1/chat/sessions/:customer_id | 获取会话列表 | P1 |

### 7.5 材料生成API

| 方法 | 路径 | 说明 | 优先级 |
|-----|------|------|-------|
| POST | /api/v1/documents/generate | 生成文档 | P0 |
| GET | /api/v1/documents/:id | 获取文档详情 | P0 |
| GET | /api/v1/documents/:id/download | 下载文档 | P0 |
| PUT | /api/v1/documents/:id | 更新文档 | P1 |
| POST | /api/v1/documents/:id/review | 审核文档 | P1 |
| POST | /api/v1/documents/:id/regenerate | 重新生成 | P1 |
| GET | /api/v1/documents/templates | 获取模板列表 | P1 |

### 7.6 支付API

| 方法 | 路径 | 说明 | 优先级 |
|-----|------|------|-------|
| POST | /api/v1/pay/wechat | 微信支付 | P0 |
| POST | /api/v1/pay/alipay | 支付宝支付 | P0 |
| POST | /api/v1/pay/callback/wechat | 微信支付回调 | P0 |
| POST | /api/v1/pay/callback/alipay | 支付宝回调 | P0 |
| POST | /api/v1/pay/refund | 申请退款 | P1 |
| GET | /api/v1/pay/status/:order_id | 查询支付状态 | P1 |

### 7.7 闲鱼API

| 方法 | 路径 | 说明 | 优先级 |
|-----|------|------|-------|
| POST | /api/v1/xianyu/webhook | 闲鱼消息回调 | P0 |
| POST | /api/v1/xianyu/reply | 发送闲鱼消息 | P0 |
| GET | /api/v1/xianyu/goods | 获取闲鱼商品列表 | P1 |
| POST | /api/v1/xianyu/goods/publish | 发布商品 | P2 |
| POST | /api/v1/xianyu/goods/:id/offline | 下架商品 | P2 |

### 7.8 知识库API

| 方法 | 路径 | 说明 | 优先级 |
|-----|------|------|-------|
| GET | /api/v1/knowledge | 搜索知识库 | P0 |
| GET | /api/v1/knowledge/:id | 获取知识详情 | P1 |
| POST | /api/v1/knowledge | 添加知识 | P1 |
| PUT | /api/v1/knowledge/:id | 更新知识 | P1 |
| POST | /api/v1/knowledge/:id/learn | 标记为已学习 | P2 |
| GET | /api/v1/knowledge/cases | 获取成功案例 | P1 |

### 7.9 统计API

| 方法 | 路径 | 说明 | 优先级 |
|-----|------|------|-------|
| GET | /api/v1/stats/overview | 数据概览 | P1 |
| GET | /api/v1/stats/customers | 客户统计 | P1 |
| GET | /api/v1/stats/orders | 订单统计 | P1 |
| GET | /api/v1/stats/appeals | 申诉统计 | P1 |
| GET | /api/v1/stats/revenue | 营收统计 | P1 |
| GET | /api/v1/stats/conversion | 转化漏斗 | P1 |

---

## 8. 前端开发规范

### 8.1 技术栈

| 技术 | 选择 | 版本 | 说明 |
|-----|------|------|------|
| 核心框架 | React | 18.x | 核心UI框架 |
| 开发语言 | TypeScript | 5.x | 类型安全 |
| UI组件库 | Ant Design | 5.x | 企业级UI组件 |
| 移动端组件 | Ant Design Mobile | 5.x | 移动端H5 |
| 状态管理 | Zustand | 4.x | 轻量级状态管理 |
| 路由管理 | React Router | 6.x | SPA路由 |
| HTTP客户端 | Axios | 1.x | API请求 |
| 构建工具 | Vite | 5.x | 快速构建 |
| CSS方案 | Tailwind CSS + CSS Modules | - | 原子CSS + 模块化 |
| 图表库 | @ant-design/charts | 1.x | 图表组件 |
| 表单 | React Hook Form + Zod | - | 高性能表单 |

### 8.2 项目结构

```
merchant-appeal-frontend/
├── public/
│   ├── favicon.ico
│   └── index.html
│
├── src/
│   ├── assets/
│   │   ├── images/
│   │   └── styles/
│   │       ├── variables.css
│   │       ├── reset.css
│   │       └── global.css
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Card/
│   │   │   ├── Modal/
│   │   │   ├── Table/
│   │   │   ├── Form/
│   │   │   ├── Upload/
│   │   │   ├── StatusTag/
│   │   │   └── Loading/
│   │   │
│   │   ├── layout/
│   │   │   ├── BasicLayout/
│   │   │   ├── BlankLayout/
│   │   │   ├── Header/
│   │   │   ├── Sidebar/
│   │   │   └── Footer/
│   │   │
│   │   └── business/
│   │       ├── CustomerCard/
│   │       ├── OrderCard/
│   │       ├── ChatBubble/
│   │       ├── DocumentPreview/
│   │       ├── StatsCard/
│   │       └── Timeline/
│   │
│   ├── pages/
│   │   ├── Dashboard/
│   │   ├── customers/
│   │   │   ├── List/
│   │   │   ├── Detail/
│   │   │   └── Create/
│   │   ├── orders/
│   │   │   ├── List/
│   │   │   ├── Detail/
│   │   │   └── Refund/
│   │   ├── chat/
│   │   │   ├── ChatLayout/
│   │   │   ├── ChatWindow/
│   │   │   ├── CustomerList/
│   │   │   └── MessageInput/
│   │   ├── documents/
│   │   │   ├── List/
│   │   │   ├── Generate/
│   │   │   ├── Preview/
│   │   │   └── Templates/
│   │   ├── products/
│   │   ├── stats/
│   │   ├── settings/
│   │   └── login/
│   │
│   ├── services/
│   │   ├── api/
│   │   │   ├── customer.ts
│   │   │   ├── order.ts
│   │   │   ├── chat.ts
│   │   │   ├── document.ts
│   │   │   ├── product.ts
│   │   │   ├── stats.ts
│   │   │   ├── auth.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── http/
│   │   │   ├── axios.ts
│   │   │   ├── request.ts
│   │   │   ├── response.ts
│   │   │   └── errorHandler.ts
│   │   │
│   │   └── websocket/
│   │       ├── socket.ts
│   │       └── useChatSocket.ts
│   │
│   ├── stores/
│   │   ├── userStore.ts
│   │   ├── customerStore.ts
│   │   ├── orderStore.ts
│   │   ├── chatStore.ts
│   │   └── appStore.ts
│   │
│   ├── hooks/
│   │   ├── useRequest.ts
│   │   ├── usePagination.ts
│   │   ├── useModal.ts
│   │   ├── useDict.ts
│   │   └── usePermission.ts
│   │
│   ├── utils/
│   │   ├── format.ts
│   │   ├── validate.ts
│   │   ├── storage.ts
│   │   ├── clipboard.ts
│   │   └── download.ts
│   │
│   ├── constants/
│   │   ├── index.ts
│   │   ├── enums.ts
│   │   └── routes.ts
│   │
│   ├── types/
│   │   ├── global.d.ts
│   │   ├── customer.ts
│   │   ├── order.ts
│   │   ├── chat.ts
│   │   └── document.ts
│   │
│   ├── router/
│   │   ├── index.tsx
│   │   ├── routes.ts
│   │   ├── guards.ts
│   │   └── LazyLoad.tsx
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── .env
├── .env.development
├── .env.production
├── .eslintrc.js
├── .prettierrc
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

### 8.3 核心组件示例

#### Button组件

```typescript
// components/common/Button/index.tsx
import React from 'react'
import { Button as AntButton, ButtonProps } from 'antd'
import classNames from 'classnames'
import styles from './index.module.css'

interface CustomButtonProps extends ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'text'
  size?: 'sm' | 'md' | 'lg'
}

export const Button: React.FC<CustomButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}) => {
  return (
    <AntButton
      className={classNames(styles.button, styles[variant], styles[size], className)}
      {...props}
    >
      {children}
    </AntButton>
  )
}

export default Button
```

#### StatsCard组件

```typescript
// components/business/StatsCard/index.tsx
import React from 'react'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import classNames from 'classnames'
import styles from './index.module.css'

interface StatsCardProps {
  title: string
  value: string | number
  prefix?: React.ReactNode
  suffix?: string
  trend?: { value: number; isPositive: boolean }
  loading?: boolean
  onClick?: () => void
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title, value, prefix, suffix, trend, loading = false, onClick,
}) => {
  return (
    <div className={classNames(styles.card, onClick && styles.clickable)} onClick={onClick}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        {trend && (
          <span className={classNames(styles.trend, trend.isPositive ? styles.positive : styles.negative)}>
            {trend.isPositive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <div className={styles.content}>
        {prefix && <span className={styles.prefix}>{prefix}</span>}
        <span className={styles.value}>{value}</span>
        {suffix && <span className={styles.suffix}>{suffix}</span>}
      </div>
    </div>
  )
}
```

#### ChatBubble组件

```typescript
// components/business/ChatBubble/index.tsx
import React from 'react'
import { Avatar } from 'antd'
import classNames from 'classnames'
import styles from './index.module.css'

interface ChatBubbleProps {
  role: 'user' | 'assistant' | 'system'
  content: string
  avatar?: string
  timestamp?: string
  feedback?: 'like' | 'dislike' | null
  onFeedback?: (type: 'like' | 'dislike') => void
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  role, content, avatar, timestamp, feedback, onFeedback,
}) => {
  const isUser = role === 'user'

  return (
    <div className={classNames(styles.bubbleContainer, isUser ? styles.userBubble : styles.assistantBubble)}>
      {!isUser && <Avatar src={avatar || '/static/avatar-assistant.png'} className={styles.avatar} />}

      <div className={styles.bubbleWrapper}>
        <div className={classNames(styles.bubble, isUser ? styles.userBubbleContent : styles.assistantBubbleContent)}>
          {content}
        </div>

        {role === 'assistant' && (
          <div className={styles.actions}>
            {timestamp && <span className={styles.timestamp}>{timestamp}</span>}
            {feedback && (
              <div className={styles.feedback}>
                <span className={classNames(styles.feedbackItem, feedback === 'like' && styles.active)} onClick={() => onFeedback?.('like')}>👍</span>
                <span className={classNames(styles.feedbackItem, feedback === 'dislike' && styles.active)} onClick={() => onFeedback?.('dislike')}>👎</span>
              </div>
            )}
          </div>
        )}
      </div>

      {isUser && <Avatar src={avatar || '/static/avatar-user.png'} className={styles.avatar} />}
    </div>
  )
}
```

### 8.4 HTTP请求封装

```typescript
// services/http/axios.ts
import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { message } from 'antd'

const baseURL = import.meta.env.VITE_API_BASE_URL

export const axiosInstance: AxiosInstance = axios.create({
  baseURL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}, (error) => Promise.reject(error))

axiosInstance.interceptors.response.use((response: AxiosResponse) => {
  const { code, data, message: msg } = response.data

  if (code === 200) {
    return data
  }

  if (code === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    return Promise.reject(new Error('未授权'))
  }

  message.error(msg || '请求失败')
  return Promise.reject(new Error(msg || '请求失败'))
}, (error) => {
  if (error.response) {
    const { status, data } = error.response
    switch (status) {
      case 400: message.error(data.message || '参数错误'); break
      case 401:
        localStorage.removeItem('token')
        window.location.href = '/login'
        message.error('登录已过期')
        break
      case 403: message.error('没有权限'); break
      case 404: message.error('请求资源不存在'); break
      case 500: message.error('服务器错误'); break
      default: message.error(data.message || '网络错误')
    }
  } else {
    message.error('网络连接失败')
  }
  return Promise.reject(error)
})
```

### 8.5 API服务定义

```typescript
// services/api/customer.ts
import { axiosInstance } from '../http/axios'
import type { Customer, PaginationParams, PaginatedResponse } from './types'

export interface CustomerListParams extends PaginationParams {
  keyword?: string
  customer_status?: string
  risk_level?: string
  start_date?: string
  end_date?: string
}

export interface CreateCustomerData {
  xianyu_nick: string
  merchant_id?: string
  merchant_type?: string
  subject_type?: string
  phone?: string
  [key: string]: any
}

export const customerApi = {
  list: (params: CustomerListParams) => {
    return axiosInstance.get<PaginatedResponse<Customer[]>>('/customers', { params })
  },
  getById: (id: number) => {
    return axiosInstance.get<Customer>(`/customers/${id}`)
  },
  create: (data: CreateCustomerData) => {
    return axiosInstance.post<Customer>('/customers', data)
  },
  update: (id: number, data: Partial<Customer>) => {
    return axiosInstance.put<Customer>(`/customers/${id}`, data)
  },
  delete: (id: number) => {
    return axiosInstance.delete(`/customers/${id}`)
  },
  updateInfoStatus: (id: number, info_status: string) => {
    return axiosInstance.put(`/customers/${id}/info-status`, { info_status })
  },
  getConversations: (id: number) => {
    return axiosInstance.get(`/customers/${id}/conversations`)
  },
  getDocuments: (id: number) => {
    return axiosInstance.get(`/customers/${id}/documents`)
  },
  addNote: (id: number, note: string) => {
    return axiosInstance.post(`/customers/${id}/notes`, { note })
  },
}
```

### 8.6 状态管理

```typescript
// stores/userStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserInfo {
  id: number
  username: string
  nickname: string
  avatar?: string
  role: 'admin' | 'staff' | 'owner'
  permissions: string[]
}

interface UserState {
  token: string | null
  userInfo: UserInfo | null
  isAuthenticated: boolean
  setToken: (token: string) => void
  setUserInfo: (userInfo: UserInfo) => void
  logout: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      token: null,
      userInfo: null,
      isAuthenticated: false,
      setToken: (token) => set({ token, isAuthenticated: true }),
      setUserInfo: (userInfo) => set({ userInfo, isAuthenticated: true }),
      logout: () => set({ token: null, userInfo: null, isAuthenticated: false }),
    }),
    { name: 'user-storage', partialize: (state) => ({ token: state.token, userInfo: state.userInfo }) }
  )
)
```

### 8.7 路由配置

```typescript
// router/routes.ts
import type { RouteObject } from 'react-router-dom'

export interface RouteConfig extends RouteObject {
  title?: string
  icon?: React.ReactNode
  permission?: string[]
  isMenu?: boolean
  children?: RouteConfig[]
}

export const routes: RouteConfig[] = [
  { path: '/login', title: '登录', isMenu: false },
  {
    path: '/',
    title: '首页',
    isMenu: true,
    children: [
      { path: '/dashboard', title: '仪表盘', isMenu: true },
      {
        path: '/customers',
        title: '客户管理',
        isMenu: true,
        children: [
          { path: '/customers/list', title: '客户列表', isMenu: true },
          { path: '/customers/create', title: '新建客户', isMenu: false },
          { path: '/customers/:id', title: '客户详情', isMenu: false },
        ],
      },
      {
        path: '/orders',
        title: '订单管理',
        isMenu: true,
        children: [
          { path: '/orders/list', title: '订单列表', isMenu: true },
          { path: '/orders/:id', title: '订单详情', isMenu: false },
        ],
      },
      { path: '/chat', title: 'AI对话', isMenu: true },
      {
        path: '/documents',
        title: '材料中心',
        isMenu: true,
        children: [
          { path: '/documents/list', title: '材料列表', isMenu: true },
          { path: '/documents/generate', title: '生成材料', isMenu: true },
          { path: '/documents/templates', title: '模板管理', isMenu: true },
        ],
      },
      { path: '/products', title: '商品管理', isMenu: true },
      {
        path: '/stats',
        title: '统计报表',
        isMenu: true,
        children: [
          { path: '/stats/overview', title: '数据概览', isMenu: true },
          { path: '/stats/customers', title: '客户分析', isMenu: true },
          { path: '/stats/orders', title: '订单分析', isMenu: true },
          { path: '/stats/revenue', title: '营收分析', isMenu: true },
        ],
      },
      {
        path: '/settings',
        title: '系统设置',
        isMenu: true,
        children: [
          { path: '/settings/account', title: '账号管理', isMenu: true },
          { path: '/settings/roles', title: '角色权限', isMenu: true },
          { path: '/settings/payment', title: '支付配置', isMenu: true },
          { path: '/settings/xianyu', title: '闲鱼配置', isMenu: true },
        ],
      },
    ],
  },
]
```

### 8.8 页面开发示例

```typescript
// pages/Dashboard/index.tsx
import React, { useEffect } from 'react'
import { Row, Col, Card, Spin } from 'antd'
import { UserOutlined, DollarOutlined, RiseOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { StatsCard } from '@/components/business/StatsCard'
import { RecentOrders } from './components/RecentOrders'
import { CustomerTrend } from './components/CustomerTrend'
import { OrderDistribution } from './components/OrderDistribution'
import { useDashboard } from './hooks/useDashboard'
import styles from './index.module.css'

export const Dashboard: React.FC = () => {
  const { stats, loading, fetchStats } = useDashboard()

  useEffect(() => { fetchStats() }, [fetchStats])

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h1 className={styles.title}>仪表盘</h1>
        <span className={styles.date}>
          {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      <Spin spinning={loading}>
        <Row gutter={[24, 24]} className={styles.statsRow}>
          <Col xs={24} sm={12} lg={6}>
            <StatsCard title="总客户数" value={stats?.total_customers || 0} prefix={<UserOutlined />} trend={{ value: 12, isPositive: true }} onClick={() => window.location.href = '/customers/list'} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatsCard title="本月收入" value={stats?.monthly_revenue || 0} prefix="¥" trend={{ value: 8.3, isPositive: true }} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatsCard title="转化率" value={stats?.conversion_rate || 0} suffix="%" trend={{ value: 3.2, isPositive: true }} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatsCard title="申诉成功率" value={stats?.appeal_success_rate || 0} suffix="%" trend={{ value: 5.1, isPositive: true }} />
          </Col>
        </Row>

        <Row gutter={[24, 24]} className={styles.chartsRow}>
          <Col xs={24} lg={14}>
            <Card title="客户趋势" className={styles.chartCard}>
              <CustomerTrend data={stats?.customer_trend || []} />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title="订单状态分布" className={styles.chartCard}>
              <OrderDistribution data={stats?.order_distribution || []} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[24, 24]}>
          <Col span={24}>
            <Card title="最新订单" extra={<a href="/orders/list" className={styles.moreLink}>查看更多</a>}>
              <RecentOrders orders={stats?.recent_orders || []} />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  )
}

export default Dashboard
```

### 8.9 常用Hooks

```typescript
// hooks/usePagination.ts
import { useState, useCallback } from 'react'

interface UsePaginationOptions {
  defaultPageSize?: number
  onChange?: (page: number, pageSize: number) => void
}

export const usePagination = (options?: UsePaginationOptions) => {
  const { defaultPageSize = 20, onChange } = options || {}
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  const changePage = useCallback((newPage: number, newPageSize?: number) => {
    if (newPageSize && newPageSize !== pageSize) {
      setPageSize(newPageSize)
      setPage(1)
      onChange?.(1, newPageSize)
    } else {
      setPage(newPage)
      onChange?.(newPage, pageSize)
    }
  }, [pageSize, onChange])

  const reset = useCallback(() => {
    setPage(1)
    setPageSize(defaultPageSize)
  }, [defaultPageSize])

  return { page, pageSize, changePage, reset, pagination: { current: page, pageSize, onChange: changePage } }
}
```

---

## 9. 后端开发规范

### 9.1 技术栈

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

### 9.2 项目结构

```
merchant-appeal-backend/
├── src/
│   ├── app.ts
│   ├── server.ts
│   │
│   ├── config/
│   │   ├── index.ts
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   ├── ai.ts
│   │   ├── oss.ts
│   │   └── payment.ts
│   │
│   ├── modules/
│   │   ├── common/
│   │   │   ├── decorators/
│   │   │   ├── filters/
│   │   │   ├── interceptors/
│   │   │   ├── guards/
│   │   │   ├── middleware/
│   │   │   ├── pipes/
│   │   │   └── utils/
│   │   │
│   │   ├── auth/
│   │   ├── user/
│   │   ├── customer/
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
│   │   ├── order/
│   │   ├── product/
│   │   ├── chat/
│   │   │   ├── chat.module.ts
│   │   │   ├── chat.controller.ts
│   │   │   ├── chat.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── send-message.dto.ts
│   │   │   │   └── chat-history.dto.ts
│   │   │   ├── entity/
│   │   │   │   └── conversation.entity.ts
│   │   │   └── ai/
│   │   │       ├── ai-chat.service.ts
│   │   │       ├── intent-recognition.ts
│   │   │       ├── entity-extraction.ts
│   │   │       └── prompt-templates.ts
│   │   │
│   │   ├── document/
│   │   ├── payment/
│   │   ├── xianyu/
│   │   ├── knowledge/
│   │   ├── learning/
│   │   └── stats/
│   │
│   ├── shared/
│   │   ├── prisma.service.ts
│   │   ├── redis.service.ts
│   │   ├── file.service.ts
│   │   └── ai/
│   │       └── openai.service.ts
│   │
│   ├── types/
│   │   └── index.d.ts
│   │
│   └── constants/
│       └── index.ts
│
├── prisma/
│   └── schema.prisma
│
├── test/
│   ├── unit/
│   └── e2e/
│
├── scripts/
│   └── seed.ts
│
├── .env.example
├── .eslintrc.js
├── .prettierrc
├── tsconfig.json
├── nest-cli.json
└── package.json
```

### 9.3 Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
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
  @@map("customers")
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
  createdAt         DateTime      @default(now()) @map("created_at")
  updatedAt         DateTime      @updatedAt @map("updated_at")
  deletedAt         DateTime?     @map("deleted_at")

  customer          Customer      @relation(fields: [customerId], references: [id])
  product           Product?      @relation(fields: [productId], references: [id])
  orderItems        OrderItem[]

  @@map("orders")
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
  createdAt     DateTime  @default(now()) @map("created_at")

  customer      Customer? @relation(fields: [customerId], references: [id])

  @@index([customerId])
  @@index([sessionId])
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
  docStatus       String    @default("generating") @map("doc_status")
  generationType  String    @default("ai") @map("generation_type")
  version         Int       @default(1)
  parentId        Int?      @map("parent_id")
  isFinal         Boolean   @default(false) @map("is_final")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")

  customer        Customer  @relation(fields: [customerId], references: [id])

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
  successRate   Decimal?  @db.Decimal(5, 2) @map("success_rate")
  useCount      Int       @default(0) @map("use_count")
  successCount  Int       @default(0) @map("success_count")
  rating        Decimal   @default(5.00) @db.Decimal(3, 2)
  isActive      Boolean   @default(true) @map("is_active")
  isPublic      Boolean   @default(true) @map("is_public")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
  deletedAt     DateTime? @map("deleted_at")

  @@map("knowledge_base")
}

model Product {
  id              Int           @id @default(autoincrement())
  productNo       String        @unique @map("product_no")
  name            String
  subtitle        String?
  description     String?       @db.Text
  productType     OrderType     @default(product) @map("product_type")
  price           Decimal       @db.Decimal(10, 2)
  riskTypes       Json          @default("[]") @map("risk_types")
  includes        Json          @default("[]")
  deliveryType    DeliveryStatus @default(auto) @map("delivery_type")
  stock           Int           @default(999)
  salesCount      Int           @default(0) @map("sales_count")
  rating          Decimal       @default(5.00) @db.Decimal(3, 2)
  isActive        Boolean       @default(true) @map("is_active")
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")
  deletedAt       DateTime?     @map("deleted_at")

  orderItems      OrderItem[]

  @@map("products")
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

enum OrderType {
  product
  custom
  package
}

enum DeliveryStatus {
  undelivered
  delivered
  confirmed
}
```

### 9.4 控制器示例

```typescript
// modules/customer/customer.controller.ts
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, ParseIntPipe, UseGuards
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
    return paginatedResponse(customers, { page: query.page, pageSize: query.pageSize, total })
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
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateCustomerDto: UpdateCustomerDto) {
    const customer = await this.customerService.update(id, updateCustomerDto)
    return ApiResponse.success(customer, '更新成功')
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.customerService.delete(id)
    return ApiResponse.success(null, '删除成功')
  }

  @Put(':id/info-status')
  async updateInfoStatus(@Param('id', ParseIntPipe) id: number, @Body('info_status') infoStatus: string) {
    const customer = await this.customerService.updateInfoStatus(id, infoStatus)
    return ApiResponse.success(customer, '状态更新成功')
  }
}
```

### 9.5 服务层示例

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

    const where: Prisma.CustomerWhereInput = { deletedAt: null }

    if (keyword) {
      where.OR = [
        { xianyuNick: { contains: keyword } },
        { merchantId: { contains: keyword } },
        { phone: { contains: keyword } },
      ]
    }

    if (customerStatus) where.customerStatus = customerStatus as any
    if (riskLevel) where.riskLevel = riskLevel as any

    const [customers, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { orders: true, conversations: true, documents: true } } },
      }),
      this.prisma.customer.count({ where }),
    ])

    return [customers, total]
  }

  async findById(id: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id, deletedAt: null },
      include: {
        orders: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 10 },
        conversations: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 20 },
        documents: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
      },
    })

    if (!customer) throw new NotFoundException('客户不存在')
    return customer
  }

  async create(createCustomerDto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: createCustomerDto })
  }

  async update(id: number, updateCustomerDto: UpdateCustomerDto) {
    await this.findById(id)
    return this.prisma.customer.update({ where: { id }, data: updateCustomerDto })
  }

  async delete(id: number) {
    await this.findById(id)
    return this.prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  async updateInfoStatus(id: number, infoStatus: string) {
    await this.findById(id)
    return this.prisma.customer.update({ where: { id }, data: { infoStatus: infoStatus as any } })
  }
}
```

### 9.6 AI对话服务示例

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

    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } })
    const context = await this.getConversationContext(customerId, finalSessionId)
    const intentResult = await this.intentRecognition.recognize(content)

    let aiContent: string
    let suggestions: string[] = []

    if (intentResult.intent === 'collect_info') {
      aiContent = await this.aiChatService.handleInfoCollection(content, intentResult.entities, customer, context)
    } else if (intentResult.intent === 'query_appeal_status') {
      aiContent = await this.aiChatService.handleAppealQuery(customer, context)
    } else if (intentResult.intent === 'product_inquiry') {
      aiContent = await this.aiChatService.handleProductInquiry(content, intentResult.entities, context)
    } else {
      aiContent = await this.aiChatService.chat(content, customer, context)
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

    await this.redisService.push(`chat:session:${finalSessionId}`, { userMessage, aiMessage })

    return { message: aiMessage, session_id: finalSessionId, suggestions }
  }

  async getHistory(customerId: number, sessionId?: string) {
    const where: any = { customerId }
    if (sessionId) where.sessionId = sessionId

    return this.prisma.conversation.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    })
  }

  async submitFeedback(messageId: number, feedback: 'like' | 'dislike') {
    await this.prisma.conversation.update({ where: { id: messageId }, data: { feedback } })
  }

  async recognizeIntent(content: string) {
    return this.intentRecognition.recognize(content)
  }

  private async getConversationContext(customerId: number, sessionId: string): Promise<string> {
    const messages = await this.prisma.conversation.findMany({
      where: { customerId, sessionId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return messages.reverse().map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`).join('\n')
  }
}
```

### 9.7 意图识别示例

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
          return { intent: this.mapIntent(intent), entities: this.extractEntities(content), confidence: 0.8 }
        }
      }
    }

    return { intent: 'general', entities: this.extractEntities(content), confidence: 0.5 }
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
    if (merchantIdMatch) entities.merchantId = merchantIdMatch[1] || merchantIdMatch[0]

    const phoneMatch = content.match(/1[3-9]\d{9}/)
    if (phoneMatch) entities.phone = phoneMatch[0]

    const companyMatch = content.match(/(公司|企业|店铺)[：:]?\s*([^\s,，]+)/)
    if (companyMatch) entities.companyName = companyMatch[2]

    return entities
  }
}
```

### 9.8 Prompt模板示例

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

### 9.9 共享服务示例

```typescript
// shared/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect() }
  async onModuleDestroy() { await this.$disconnect() }
}
```

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

  async onModuleDestroy() { await this.client.quit() }

  async get(key: string): Promise<string | null> { return this.client.get(key) }
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) await this.client.setex(key, ttl, value)
    else await this.client.set(key, value)
  }
  async del(key: string): Promise<void> { await this.client.del(key) }
  async push(key: string, data: any): Promise<void> { await this.client.rpush(key, JSON.stringify(data)) }
  async lrange(key: string, start: number, stop: number): Promise<any[]> {
    const result = await this.client.lrange(key, start, stop)
    return result.map(item => JSON.parse(item))
  }
}
```

### 9.10 守卫示例

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

    if (!token) throw new UnauthorizedException('未提供认证令牌')

    try {
      const payload = await this.jwtService.verifyAsync(token, { secret: this.configService.get('JWT_SECRET') })
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

---

## 10. UI设计规范

### 10.1 色彩系统

```
主色 (Primary)
─────────────
#2563EB - 主按钮、活跃状态、关键操作
#1D4ED8 - 主色hover状态
#1E40AF - 主色active状态
#3B82F6 - 主色浅色（背景、标签）

辅助色 (Secondary)
─────────────────
#059669 - 成功状态、已完成、通过
#047857 - 成功hover
#10B981 - 成功浅色背景

警告色 (Warning)
───────────────
#D97706 - 警告、待处理
#B45309 - 警告hover
#F59E0B - 警告浅色背景

错误色 (Error)
─────────────
#DC2626 - 错误、失败、拒绝
#B91C1C - 错误hover
#EF4444 - 错误浅色背景

信息色 (Info)
─────────────
#0891B2 - 信息提示
#0E7490 - 信息深色
#06B6D4 - 信息浅色

中性色 (Neutral)
───────────────
#111827 - 主要文字
#374151 - 次要文字
#6B7280 - 辅助文字
#9CA3AF - 禁用文字
#F9FAFB - 页面背景
#F3F4F6 - 卡片背景
#E5E7EB - 分割线
#D1D5DB - 边框
```

### 10.2 字体系统

```
字体 scale (基于1.25比例)
──────────────────────────────────────────────────
Display XL    48px / 56px    标题大字号、Hero区域
Display L     36px / 44px    页面主标题
Display M     28px / 36px    区块标题
Heading 1     24px / 32px    卡片标题
Heading 2     20px / 28px    章节标题
Heading 3     16px / 24px    子标题
Body L        16px / 24px     正文大字号
Body M        14px / 22px     正文标准
Body S        13px / 20px     正文小字号
Caption       12px / 16px     辅助说明、标签
Overline      11px / 16px     特殊标注（全大写）
```

### 10.3 间距系统

```
spacing scale (基于4px)
──────────────────────────────────────────────────
0    0px      - 紧凑布局
1    4px      - 图标与文字间距
2    8px      - 标签内间距、紧凑元素
3    12px     - 组件内间距
4    16px     - 标准间距
5    20px     - 卡片内边距
6    24px     - 区块间距
8    32px     - 大区块间距
10   40px     - 页面边距（移动端）
12   48px     - 页面边距（桌面端）
16   64px     - 大区块分隔
20   80px     - 页面顶部/底部留白
```

### 10.4 圆角系统

```
border-radius scale
──────────────────────────────────────────────────
none    0px      - 分割线、硬边元素
sm      4px      - 小按钮、输入框、标签
md      8px      - 卡片、弹窗、容器
lg      12px     - 大卡片、特色容器
xl      16px     - 模态框、特色模块
full    9999px   - 圆形头像、药丸按钮
```

### 10.5 阴影系统

```
shadow scale
──────────────────────────────────────────────────
shadow-sm    0 1px 2px rgba(0,0,0,0.05)           - 输入框、标签
shadow-md    0 4px 6px -1px rgba(0,0,0,0.1)       - 卡片、浮层、下拉菜单
shadow-lg    0 10px 15px -3px rgba(0,0,0,0.1)     - 弹窗、模态框
shadow-xl    0 20px 25px -5px rgba(0,0,0,0.1)     - 重要提示、特殊模态
shadow-inner 0 2px 4px rgba(0,0,0,0.06) inset    - 输入框内阴影
```

### 10.6 动效规范

```
动效时长
──────────────────────────────────────────────────
instant    50ms    - 状态切换（复选框、开关）
fast       100ms   - 微交互（hover、点击反馈）
normal     200ms   - 标准过渡（展开、收起）
slow       300ms   - 页面元素进入
slower     500ms   - 大区块动画、模态框

缓动函数
──────────────────────────────────────────────────
ease-out      cubic-bezier(0, 0, 0.2, 1)   - 元素进入、展开
ease-in       cubic-bezier(0.4, 0, 1, 1)   - 元素退出、收起
ease-in-out   cubic-bezier(0.4, 0, 0.2, 1) - 来回切换
spring        cubic-bezier(0.175, 0.885, 0.32, 1.275) - 弹性效果
```

### 10.7 响应式断点

```
响应式断点
──────────────────────────────────────────────────
移动端     < 768px    - 手机竖屏
平板       768px+     - 平板、手机横屏
桌面端     1024px+    - 小桌面
大桌面     1280px+    - 标准桌面
超大桌面   1536px+    - 大屏显示器
```

### 10.8 管理后台布局

```
┌─────────────────────────────────────────────────────────────────────┐
│ Header (64px)                                                        │
│ ┌──────────┬──────────────────────────────────────────┬───────────┐│
│ │ Logo     │  面包屑 / 页面标题                        │ 消息│用户││
│ └──────────┴──────────────────────────────────────────┴───────────┘│
├─────────┬───────────────────────────────────────────────────────────┤
│ Sidebar │ Main Content Area                                         │
│ (220px) │ ┌─────────────────────────────────────────────────────┐ │
│         │ │ Page Header (页面标题 + 操作按钮)                   │ │
│ ┌─────┐ │ └─────────────────────────────────────────────────────┘ │
│ │     │ │ ┌─────────────────────────────────────────────────────┐ │
│ │ Nav │ │ │                                                     │ │
│ │     │ │ │                                                     │ │
│ │     │ │ │               Content Area                          │ │
│ │     │ │ │                                                     │ │
│ │     │ │ │                                                     │ │
│ │     │ │ └─────────────────────────────────────────────────────┘ │
│ │     │ │ ┌─────────────────────────────────────────────────────┐ │
│ │     │ │ │ Pagination / Footer                                │ │
│ └─────┘ │ └─────────────────────────────────────────────────────┘ │
└─────────┴───────────────────────────────────────────────────────────┘

响应式断点:
- >= 1200px: 完整布局 (sidebar + content)
- 768px - 1199px: 折叠sidebar (icon-only, 64px)
- < 768px: 隐藏sidebar (汉堡菜单触发)
```

### 10.9 典型页面模板

#### 列表页模板

```
┌─────────────────────────────────────────────────────────────────────┐
│ [页面标题]                                    [+ 新建] [筛选] [导出] │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 快捷筛选标签: [全部] [咨询中] [已下单] [已付款] [已完成]        │ │
│ └─────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 搜索框: [🔍 搜索客户名称/商户号...]              日期范围筛选 ▼  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ │ 全选 □ │ 列1标题 ▽ │ 列2标题 ▽ │ 列3标题 ▽ │ 列4标题 ▽ │ 操作  │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ □   │ 内容    │ 内容    │ 内容    │ [查看] [编辑] [删除] │ │
│ └─────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ [◀ 上一页]  第 1/10 页  [下一页 ▶]    共 256 条  [20条/页 ▾]        │
└─────────────────────────────────────────────────────────────────────┘
```

#### 详情页模板

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← 返回列表    客户详情                              [编辑] [删除]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────┐  ┌─────────────────────┐                │
│  │ 基本信息卡片          │  │ 状态追踪卡片          │                │
│  │ ┌────┐               │  │ ● 已完成 2024-01-15  │                │
│  │ │头像│ 姓名/昵称     │  │ ● 已付款 2024-01-14  │                │
│  │ └────┘ 商户号: xxx   │  │ ● 已下单 2024-01-13  │                │
│  │       联系方式: xxx   │  │ ○ 咨询中 2024-01-12  │                │
│  │       创建时间: xxx   │  │                      │                │
│  └─────────────────────┘  └─────────────────────┘                │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ [基本信息] [对话记录] [订单记录] [文档材料] [跟进记录]         │ │
│  ├───────────────────────────────────────────────────────────────┤ │
│  │                                                               │ │
│  │                     Tab 内容区域                               │ │
│  │                                                               │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 10.10 组件状态规范

#### 按钮状态

```
按钮 States
──────────────────────────────────────────────────
Default   正常状态
Hover     背景变深10%，cursor: pointer
Active    背景变深15%，scale(0.98)
Disabled  opacity: 0.5, cursor: not-allowed
Loading   显示spinner，文字"处理中..."
```

#### 输入框状态

```
输入框 States
──────────────────────────────────────────────────
Default   边框 #D1D5DB
Focus     边框 #2563EB，box-shadow: 0 0 0 3px rgba(37,99,235,0.1)
Error     边框 #DC2626，右侧显示错误图标和文字
Success   边框 #059669，右侧显示成功图标
Disabled  背景 #F3F4F6，文字变淡
```

#### 状态标签

```
状态标签规范
──────────────────────────────────────────────────

待处理 (Pending)
├── 背景: #FEF3C7 (淡黄)
└── 文字: #B45309 (深橙)

进行中 (In Progress)
├── 背景: #DBEAFE (淡蓝)
└── 文字: #1D4ED8 (深蓝)

已完成 (Completed)
├── 背景: #D1FAE5 (淡绿)
└── 文字: #047857 (深绿)

失败/拒绝 (Failed/Rejected)
├── 背景: #FEE2E2 (淡红)
└── 文字: #B91C1C (深红)

已取消 (Cancelled)
├── 背景: #F3F4F6 (灰色)
└── 文字: #6B7280 (深灰)
```

---

## 11. 安全设计方案

### 11.1 安全架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         网络安全层                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │ WAF防火墙  │  │ DDoS防护  │  │ 负载均衡  │  │ SSL终端  │     │
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

### 11.2 敏感数据处理

```javascript
// 敏感字段加密示例
const sensitiveFields = {
  legal_person_id: {
    algorithm: 'AES-256-GCM',
    encrypt: true,
    display: '**** **** **** ****',  // 只显示前4后4
    storage: 'encrypted'              // 加密存储
  },
  phone: {
    algorithm: 'AES-256-GCM',
    encrypt: true,
    display: '138****5678',           // 手机号脱敏
    storage: 'encrypted'              // 加密存储
  },
  merchant_id: {
    encrypt: false,
    display: 'full',                 // 商户号可完整显示
    storage: 'plain'                  // 明文存储
  }
};

// 数据访问权限控制
const accessControl = {
  'customer.legal_person_id': ['admin', 'owner'],
  'customer.merchant_id': ['admin', 'staff', 'owner'],
  'customer.phone': ['admin', 'staff', 'owner'],
  'customer.internal_notes': ['admin', 'owner']
};
```

---

## 12. 部署架构

### 12.1 部署拓扑图

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
│  │                    SLB (负载均衡器)                          │    │
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
│  │                      API服务 (多副本)                        │   │
│  │    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │   │
│  │    │ api-1   │  │ api-2   │  │ api-3   │  │ api-n   │   │   │
│  │    └──────────┘  └──────────┘  └──────────┘  └──────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      AI服务 (GPU节点)                       │   │
│  │    ┌──────────┐  ┌──────────┐                              │   │
│  │    │ ai-svc-1 │  │ ai-svc-2 │  (大模型推理服务)             │   │
│  │    └──────────┘  └──────────┘                              │   │
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
│  └───────────────────────┘  │   │  │  │ Kafka/RabbitMQ          │   │
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

### 12.2 环境配置

| 环境 | 用途 | 配置 |
|-----|------|------|
| Development | 开发环境 | 本地/Docker |
| Testing | 测试环境 | 2核4G × 2节点 |
| Staging | 预发布环境 | 4核8G × 2节点 |
| Production | 生产环境 | 8核16G × n节点 |

---

## 13. 开发计划

### 13.1 阶段概览

```
Phase 1: MVP版本          Phase 2: 智能化版本         Phase 3: 自动化版本
┌─────────────────┐       ┌─────────────────┐        ┌─────────────────┐
│   4-6周        │       │   6-8周         │        │   8-12周        │
├─────────────────┤       ├─────────────────┤        ├─────────────────┤
│ 基础对话能力    │  -->  │ 闲鱼消息对接     │  -->  │ 全自动获客      │
│ 手动上下架     │       │ 智能对话优化     │        │ AI自我学习      │
│ 基础材料生成   │       │ 知识库建设       │        │ 多租户支持      │
└─────────────────┘       └─────────────────┘        └─────────────────┘
       │                         │                          │
       ▼                         ▼                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           交付目标                                  │
├─────────────────────────────────────────────────────────────────────┤
│  验证核心业务流程    │    提升AI自动化程度    │    实现商业化运营    │
│  打磨产品MVP        │    完善用户体验       │    规模化复制        │
└─────────────────────────────────────────────────────────────────────┘
```

### 13.2 Phase 1详细任务

```
第1周：项目基础设施
─────────────────────────────────────────────────────────────────────
□ 项目脚手架搭建（2天）
□ 数据库设计与创建（2天）
□ 基础框架搭建（3天）
□ 闲鱼消息接收初步（1天）

第2周：AI对话系统
─────────────────────────────────────────────────────────────────────
□ AI服务框架搭建（2天）
□ 意图识别实现（3天）
□ 多轮对话实现（3天）
□ 敏感词过滤（1天）

第3周：订单与支付
─────────────────────────────────────────────────────────────────────
□ 订单服务开发（3天）
□ 微信支付接入（3天）
□ 支付宝接入（3天）
□ 支付通知系统（1天）

第4周：材料生成系统
─────────────────────────────────────────────────────────────────────
□ 材料模板管理（3天）
□ 申诉说明生成（3天）
□ 整改说明生成（3天）
□ 材料下载功能（2天）

第5周：管理后台
─────────────────────────────────────────────────────────────────────
□ 后台框架搭建（2天）
□ 客户管理页面（3天）
□ 订单管理页面（2天）
□ 数据看板页面（2天）
□ 基础权限管理（1天）

第6周：联调与测试
─────────────────────────────────────────────────────────────────────
□ 前后端联调（3天）
□ AI对话测试（2天）
□ 支付流程测试（2天）
□ 系统优化（2天）
□ 部署上线（1天）
```

### 13.3 Phase 2详细任务

```
第7-8周：闲鱼深度对接
─────────────────────────────────────────────────────────────────────
□ 闲鱼消息系统重构（4天）
□ 闲鱼自动回复系统（3天）
□ 闲鱼商品管理系统（3天）

第9-10周：AI智能化提升
─────────────────────────────────────────────────────────────────────
□ 客户画像系统（4天）
□ 智能推荐系统（3天）
□ 咨询引导优化（3天）

第11-12周：知识库系统
─────────────────────────────────────────────────────────────────────
□ 知识库架构（4天）
□ 向量数据库集成（3天）
□ 案例库建设（3天）

第13-14周：自动化与优化
─────────────────────────────────────────────────────────────────────
□ 订单自动化交付（3天）
□ 闲鱼商品自动化（3天）
□ 数据分析体系（4天）
```

### 13.4 Phase 3详细任务

```
第15-18周：AI自我学习系统
─────────────────────────────────────────────────────────────────────
□ 学习框架设计（4天）
□ 案例自动入库（4天）
□ Prompt自动优化（4天）
□ 模型微调准备（4天）

第19-22周：多租户支持
─────────────────────────────────────────────────────────────────────
□ 租户架构设计（4天）
□ 租户管理后台（4天）
□ 计费系统（4天）

第23-26周：高级自动化
─────────────────────────────────────────────────────────────────────
□ 全流程自动化（6天）
□ 智能质检系统（3天）
□ 预测分析系统（5天）

第27-28周：优化与商业化
─────────────────────────────────────────────────────────────────────
□ 系统优化（4天）
□ 商业化准备（3天）
□ 运维体系完善（2天）
```

### 13.5 艾阳老板的角色

```
Phase 1（MVP阶段）：
─────────────────────────────────────────────────────────────────────
[需要艾阳老板参与]
□ 闲鱼商品手动上下架（必须人工操作）
□ 客户信息补充（AI收集不全时人工跟进）
□ 重要决策确认（功能优先级、定价等）
□ 亲自与客户沟通（复杂问题处理）

[AI系统负责]
✓ AI自动接待咨询
✓ AI自动收集客户信息
✓ AI自动生成材料
✓ AI自动发送报价

Phase 2（智能化阶段）：
─────────────────────────────────────────────────────────────────────
[需要艾阳老板参与]
□ 闲鱼商品上下架（系统触发，人工确认）
□ 特殊客户人工跟进
□ 知识库内容审核
□ 整体业务策略把控

[AI系统负责]
✓ 闲鱼消息自动收发
✓ 智能客户画像
✓ 自动化材料生成
✓ 自动订单交付

Phase 3（自动化阶段）：
─────────────────────────────────────────────────────────────────────
[需要艾阳老板参与]
□ 业务策略调整
□ 重大决策
□ 新客户人工对接（高价值客户）
□ 整体运营监控

[AI系统负责]
✓ 全自动闲鱼运营
✓ 全流程自动化
✓ AI自我学习优化
✓ 多租户运营管理
```

---

## 14. 运维与监控

### 14.1 监控体系

```
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
```

### 14.2 核心告警指标

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

## 15. 风险与应对

### 15.1 业务风险

| 风险 | 影响 | 应对措施 |
|-----|------|---------|
| 闲鱼平台政策变化 | 消息接口可能失效 | 预留人工处理流程，保持灵活性 |
| AI生成材料被拒 | 申诉失败影响口碑 | 严格审核AI生成内容，添加人工复核 |
| 客户信息泄露 | 法律风险和信任危机 | 加强数据安全，最小化数据收集 |
| 恶意竞争/投诉 | 影响业务正常开展 | 保持服务质量，储备备用方案 |

### 15.2 技术风险

| 风险 | 影响 | 应对措施 |
|-----|------|---------|
| 大模型API成本上升 | 运营成本增加 | 优化Prompt，减少调用次数 |
| 闲鱼API变更 | 需要重新对接 | 关注平台动态，预留开发资源 |
| 系统稳定性 | 影响用户体验 | 加强监控，做好容灾备份 |

---

## 16. 成本预算

### 16.1 人力资源规划

| 角色 | Phase 1 | Phase 2 | Phase 3 |
|-----|---------|---------|---------|
| 前端开发 | 1人 | 1-2人 | 2人 |
| 后端开发 | 1人 | 1-2人 | 2人 |
| AI工程师 | 0.5人 | 1人 | 1-2人 |
| 产品经理 | 0.5人 | 0.5人 | 0.5人 |
| 测试 | 0.5人 | 1人 | 1-2人 |
| 运维 | 0.5人 | 1人 | 1人 |

### 16.2 成本预算明细

| 阶段 | 人力成本 | 第三方成本 | 其他成本 | 总计 |
|-----|---------|-----------|---------|------|
| Phase 1 | 6万 | 1万 | 0.5万 | 7.5万 |
| Phase 2 | 10万 | 2万 | 1万 | 13万 |
| Phase 3 | 15万 | 3万 | 2万 | 20万 |
| **总计** | **31万** | **6万** | **3.5万** | **40.5万** |

> 第三方成本主要包括：云服务器、AI API调用、短信服务等

---

## 17. 附录

### 17.1 术语表

| 术语 | 说明 |
|-----|------|
| 商户号 | 微信支付/支付宝分配的商户唯一标识 |
| mchid | 微信支付商户号 |
| 风控 | 风险控制，平台对异常商户的管控措施 |
| 调单 | 平台要求商户提供交易凭证 |
| 间连/直连 | 通过服务商/直接对接微信支付 |
| RAG | 检索增强生成，AI知识库技术 |
| Agent | AI代理，能够执行复杂任务的AI系统 |
| JWT | JSON Web Token, 用于身份认证 |
| RBAC | Role-Based Access Control, 基于角色的权限控制 |
| WAF | Web Application Firewall, Web应用防火墙 |
| CDN | Content Delivery Network, 内容分发网络 |
| APM | Application Performance Monitoring, 应用性能监控 |

### 17.2 参考资料

| 资源 | 链接 |
|-----|------|
| React | https://react.dev |
| TypeScript | https://www.typescriptlang.org |
| Ant Design | https://ant.design |
| NestJS | https://docs.nestjs.com |
| Prisma | https://prisma.io/docs |
| Vite | https://vitejs.dev |
| 阿里云OSS | https://help.aliyun.com/product/31815 |
| 微信支付 | https://pay.weixin.qq.com |
| 支付宝 | https://open.alipay.com |
| OpenAI | https://platform.openai.com |

### 17.3 文档清单

| 文档 | 状态 | 位置 |
|-----|------|------|
| 产品需求文档（PRD） | 完成 | docs/PRD.md |
| 技术设计文档 | 完成 | docs/TECH_DESIGN.md |
| 开发计划文档 | 完成 | docs/DEVELOPMENT_PLAN.md |
| UI/UX设计文档 | 完成 | docs/UI_UX_DESIGN.md |
| 前端开发文档 | 完成 | docs/FRONTEND_DEV.md |
| 后端开发文档 | 完成 | docs/BACKEND_DEV.md |
| 项目综合文档 | 完成 | docs/PROJECT.md |

---

## 文档修订记录

| 版本 | 日期 | 修订内容 | 修订人 |
|-----|------|---------|-------|
| V1.0 | 2026-04-13 | 初始版本 | AI产品经理 |

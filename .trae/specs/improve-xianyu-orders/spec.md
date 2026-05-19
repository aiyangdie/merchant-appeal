# 闲鱼订单详情增强 & 管理后台订单管理 Spec

## Why
当前闲鱼订单显示信息过于简陋——前端用户绑定订单后只能看到买家昵称、商品标题、图片、金额、状态，缺少下单时间、收货地址、物流信息、SKU规格、退款状态等关键字段。管理后台虽然已有「订单管理」tab，但显示的是AI申诉服务订单，没有闲鱼订单的查看和管理能力。

## What Changes
- **BREAKING**: 无破坏性变更
- 后端 `mapOrderFields()` 扩展映射字段：新增 `order_time`, `pay_time`, `consign_type`, `consign_time`, `express_name`, `waybill_no`, `receiver_name`, `receiver_full_address`, `sku_text`, `refund_status`, `total_amount`, `express_fee` 等
- 后端新增管理端 API `GET /api/admin/xianyu-orders`：支持分页、状态筛选、搜索，`requireAdmin` 鉴权
- 后端 `xianyu-api.js` 新增 `getAllOrders()` 方法：支持 `order_status`、`refund_status`、`page_no`、`page_size`、`update_time` 等完整参数
- 前端 ChatPage 订单列表卡片增强：显示下单时间、收货人、发货状态标签、退款状态标签、SKU规格
- 前端 ChatPage 已绑定订单卡片增强：同上扩展字段
- 前端 AdminPage 新增「闲鱼订单」子tab或增强现有「订单管理」tab：表格展示所有闲鱼订单，支持按状态/退款状态筛选，支持搜索订单号/买家

## Impact
- Affected specs: N/A (新功能)
- Affected code:
  - `server/xianyu-api.js` — `mapOrderFields()`, 新增 `getAllOrders()`
  - `server/index.js` — 新增 `GET /api/admin/xianyu-orders` 路由
  - `src/pages/ChatPage.jsx` — 订单列表/已绑定订单卡片UI
  - `src/pages/AdminPage.jsx` — 新增/增强闲鱼订单管理页面
  - `src/utils/orderUtils.js` — 新增 `formatOrderStatus`, `formatRefundStatus` 等工具函数

## ADDED Requirements

### Requirement: 扩展订单字段映射
系统 SHALL 在 `mapOrderFields()` 中映射闲管家 API 返回的所有关键字段，确保前端能展示完整的订单信息。

#### Scenario: 映射订单基本字段
- **WHEN** `mapOrderFields(order)` 被调用
- **THEN** 返回对象包含: `order_no`, `buyer_nick`, `order_time`(毫秒时间戳), `order_status`(整数), `refund_status`(整数), `order_type`(整数), `total_amount`(分), `pay_amount`(分), `pay_time`(毫秒时间戳)

#### Scenario: 映射商品字段
- **WHEN** 订单中包含 goods 数组
- **THEN** 返回对象包含: `goods: { title, images[], quantity, price, sku_text, product_id, item_id }`

#### Scenario: 映射收货信息
- **WHEN** 订单中包含收货人信息
- **THEN** 返回对象包含: `receiver_name`, `receiver_mobile`, `receiver_full_address`(拼接 prov+city+area+town+address)

#### Scenario: 映射物流信息
- **WHEN** 订单已发货
- **THEN** 返回对象包含: `consign_type`(发货类型 1=物流 2=虚拟), `consign_time`(毫秒时间戳), `express_name`, `waybill_no`

### Requirement: 管理后台闲鱼订单列表 API
系统 SHALL 提供管理后台专用的闲鱼订单查询 API。

#### Scenario: 管理员查询所有闲鱼订单
- **WHEN** 管理员调用 `GET /api/admin/xianyu-orders?page=1&pageSize=50`
- **THEN** 返回 `{ success: true, data: { list: [...], total: N, page: N, pageSize: N } }`
- **AND** 所有订单经过 `mapOrderFields()` 映射

#### Scenario: 按订单状态筛选
- **WHEN** 管理员调用 `GET /api/admin/xianyu-orders?order_status=12` (12=待发货)
- **THEN** 仅返回待发货订单

#### Scenario: 按退款状态筛选
- **WHEN** 管理员调用 `GET /api/admin/xianyu-orders?refund_status=1` (1=待处理)
- **THEN** 仅返回有退款申请的订单

#### Scenario: 搜索订单
- **WHEN** 管理员调用 `GET /api/admin/xianyu-orders?keyword=张三`
- **THEN** 返回买家昵称或订单号匹配的订单

#### Scenario: 非管理员访问被拒绝
- **WHEN** 普通用户调用 `GET /api/admin/xianyu-orders`
- **THEN** 返回 403 错误

### Requirement: 前端订单卡片增强显示
系统 SHALL 在用户端订单面板中显示更完整的订单信息。

#### Scenario: 订单列表卡片
- **WHEN** 用户查看闲鱼订单列表
- **THEN** 每张卡片显示: 商品图片、商品标题、SKU规格（如有）、买家昵称、下单时间、金额、订单状态标签（待发货/已发货/已完成/已退款）、退款状态标签（如有退款）

#### Scenario: 已绑定订单详情卡片
- **WHEN** 用户已绑定某订单
- **THEN** 卡片显示: 商品图片、商品标题、SKU规格、买家昵称、买家手机号（脱敏）、收货地址、下单时间、金额、订单状态、发货物流信息（如已发货）、退款状态（如退款中）

### Requirement: 管理后台闲鱼订单管理页面
系统 SHALL 在管理后台提供闲鱼订单的完整管理视图。

#### Scenario: 闲鱼订单表格
- **WHEN** 管理员访问「订单管理」tab → 「闲鱼订单」子tab
- **THEN** 表格列显示: 订单号、商品图片(缩略图)、商品标题、SKU规格、买家、收货人、收货地址、金额、下单时间、订单状态、发货状态、退款状态

#### Scenario: 状态筛选
- **WHEN** 管理员点击筛选按钮
- **THEN** 可按订单状态（全部/待付款/待发货/已发货/已完成/已退款/已关闭）和退款状态（全部/待处理/退款成功/已拒绝）筛选

#### Scenario: 订单搜索
- **WHEN** 管理员在搜索框输入关键词
- **THEN** 表格按订单号或买家昵称模糊搜索

#### Scenario: 翻页
- **WHEN** 订单数据超过每页显示数量
- **THEN** 显示分页控件，支持上一页/下一页
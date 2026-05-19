# Tasks: 闲鱼订单详情增强 & 管理后台订单管理

- [x] Task 1: 后端 - 扩展 `mapOrderFields()` 映射完整订单字段
  - [x] 1.1 编辑 `server/xianyu-api.js`，在 `mapOrderFields()` 中新增字段映射：`order_no`, `order_time`, `pay_time`, `order_status`, `refund_status`, `order_type`, `total_amount`(分→保留分原始值), `pay_amount`(分), `receiver_name`, `receiver_mobile`, `receiver_full_address`(拼接 prov+city+area+town+address), `consign_type`, `consign_time`, `express_name`, `waybill_no`, `express_fee`, `buyer_nick`, `seller_remark`
  - [x] 1.2 扩展 goods 对象映射：`title`, `images[]`, `quantity`, `price`, `sku_text`, `product_id`, `item_id`
  - [x] 1.3 修复时间戳处理：所有 Unix 秒时间戳转为毫秒（`< 1e12` 检测 ×1000）
  - [x] 1.4 修复金额处理：`total_amount`/`pay_amount` 等以「分」为单位的字段保留原始值，由前端工具函数统一转换为元
  - **验证**: 重启后端，`GET /api/orders/from-system` 返回的订单包含所有新增字段

- [x] Task 2: 后端 - `xianyu-api.js` 新增 `getAllOrders()` 方法
  - [x] 2.1 新增 `getAllOrders(options)` 函数，支持参数：`order_status`, `refund_status`, `keyword`, `page_no`, `page_size`, `start_time`, `end_time`
  - [x] 2.2 将参数映射到闲管家 API `/api/open/order/list` 请求体（注意参数名映射：`page_no`→`pageNum`, `page_size`→`pageSize`）
  - [x] 2.3 返回结果自动通过 `mapOrderFields()` 映射
  - **验证**: 调用 `getAllOrders({ order_status: 12, page_size: 10 })` 返回待发货订单

- [x] Task 3: 后端 - 新增管理端 API `GET /api/admin/xianyu-orders`
  - [x] 3.1 在 `server/index.js` 中添加路由，使用 `requireAdmin` 中间件
  - [x] 3.2 路由解析查询参数：`page`, `pageSize`, `order_status`, `refund_status`, `keyword`
  - [x] 3.3 调用 `xianyuApi.getAllOrders()` 获取数据
  - [x] 3.4 返回 `{ success: true, data: { list, total, page, pageSize } }`
  - **验证**: `curl -H "Authorization: Bearer <admin-token>" http://localhost:3001/api/admin/xianyu-orders` 返回订单列表

- [x] Task 4: 前端 - `orderUtils.js` 新增订单状态/退款状态工具函数
  - [x] 4.1 新增 `ORDER_STATUS_MAP` 常量：11=待付款, 12=待发货, 21=已发货, 22=已完成, 23=已退款, 24=已关闭
  - [x] 4.2 新增 `REFUND_STATUS_MAP` 常量：0=未申请, 1=待处理, 2=待退货, 3=待收货, 4=退款关闭, 5=退款成功, 6=已拒绝
  - [x] 4.3 新增 `formatOrderStatusLabel(status)` 函数，返回中文标签和样式类
  - [x] 4.4 新增 `formatRefundStatusLabel(status)` 函数，返回中文标签和样式类
  - [x] 4.5 新增 `formatFullAddress(order)` 函数，使用 `receiver_full_address` 或拼接字段
  - [x] 4.6 新增 `formatConsignLabel(consignType)` 函数：1→物流发货, 2→虚拟发货
  - **验证**: 导入并调用各函数，返回正确的中文标签

- [x] Task 5: 前端 - ChatPage 订单列表卡片增强
  - [x] 5.1 编辑 `src/pages/ChatPage.jsx`，在订单列表卡片中新增显示：SKU规格（`goods.sku_text`）、下单时间（`formatTime(order_time)`）、订单状态标签（`formatOrderStatusLabel`）
  - [x] 5.2 退款中的订单显示退款状态标签
  - [x] 5.3 调整卡片布局适配合更多信息（保持紧凑风格）
  - **验证**: 打开前台，点击「绑定闲鱼订单」面板，订单卡片显示更多字段

- [x] Task 6: 前端 - ChatPage 已绑定订单详情卡片增强
  - [x] 6.1 编辑 `src/pages/ChatPage.jsx`，已绑定订单卡片新增：SKU规格、收货地址、下单时间、发货状态+物流信息（如已发货）、退款状态（如有退款）
  - [x] 6.2 金额显示使用 `formatOrderAmount()` 统一格式化
  - [x] 6.3 收货人手机号脱敏显示（中间4位用****替代）
  - **验证**: 绑定一个订单后，详情卡片显示完整信息

- [x] Task 7: 前端 - AdminPage 闲鱼订单管理子Tab
  - [x] 7.1 编辑 `src/pages/AdminPage.jsx`，在「订单管理」tab下新增「AI申诉订单」/「闲鱼订单」两个子tab切换
  - [x] 7.2 新增闲鱼订单状态变量：`xianyuOrders`, `xianyuLoading`, `xianyuPage`, `xianyuTotal`, `xianyuFilter`(order_status/refund_status/keyword)
  - [x] 7.3 新增 `fetchXianyuOrders()` 函数调用 `GET /api/admin/xianyu-orders`
  - [x] 7.4 渲染闲鱼订单表格：订单号、商品缩略图(40×40)、商品标题、SKU规格、买家、收货人、收货地址(截断)、金额(¥xx.xx)、下单时间、订单状态(彩色标签)、发货状态、退款状态
  - [x] 7.5 添加状态筛选栏：订单状态（全部/待付款/待发货/已发货/已完成/已退款/已关闭）+ 退款状态（全部/待处理/退款中/退款成功/已拒绝）
  - [x] 7.6 添加搜索框：支持按订单号/买家昵称搜索
  - [x] 7.7 添加分页控件：显示"共 N 条，第 X/Y 页"，上一页/下一页按钮
  - **验证**: 进入管理后台→订单管理→闲鱼订单 子tab，表格显示所有闲鱼订单，筛选和搜索正常

# Task Dependencies
- [Task 2] depends on [Task 1]（getAllOrders 依赖 mapOrderFields 的完整映射）
- [Task 3] depends on [Task 2]（管理API依赖 getAllOrders）
- [Task 4] 无依赖，可与 Task 1-3 并行
- [Task 5] depends on [Task 1], [Task 4]（前端卡片依赖后端字段+工具函数）
- [Task 6] depends on [Task 1], [Task 4]（同上）
- [Task 7] depends on [Task 3], [Task 4]（管理页面依赖管理API+工具函数）
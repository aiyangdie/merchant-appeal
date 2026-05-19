# Checklist: 闲鱼订单详情增强 & 管理后台订单管理

## 后端验证

- [x] 1. `mapOrderFields()` 返回对象包含 `order_no`, `order_time`, `pay_time`, `order_status`, `refund_status`, `order_type`, `total_amount`, `pay_amount`
- [x] 2. `mapOrderFields()` 返回对象包含 `goods: { title, images[], quantity, price, sku_text, product_id, item_id }`
- [x] 3. `mapOrderFields()` 返回对象包含 `receiver_name`, `receiver_mobile`, `receiver_full_address`
- [x] 4. `mapOrderFields()` 返回对象包含 `consign_type`, `consign_time`, `express_name`, `waybill_no`
- [x] 5. 时间戳转换正确：Unix秒戳 → 毫秒（< 1e12 ×1000）
- [x] 6. 金额字段保留原始分值，未在前端除以100
- [x] 7. `getAllOrders()` 函数存在且支持 `order_status`, `refund_status`, `page_no`, `page_size` 参数
- [x] 8. `GET /api/admin/xianyu-orders` 路由存在，使用 `requireAdmin` 鉴权
- [x] 9. `GET /api/admin/xianyu-orders?page=1&pageSize=20` 返回 `{ success: true, data: { list, total, page, pageSize } }`
- [x] 10. `GET /api/admin/xianyu-orders?order_status=12` 仅返回待发货订单
- [x] 11. `GET /api/admin/xianyu-orders?keyword=昵称` 返回匹配订单
- [x] 12. 非admin用户访问 `/api/admin/xianyu-orders` 返回403
- [x] 13. `GET /api/orders/from-system` 返回订单仍正常工作并包含扩展字段

## 前端工具函数验证

- [x] 14. `orderUtils.js` 导出 `formatOrderStatusLabel`, `formatRefundStatusLabel`, `formatFullAddress`, `formatConsignLabel`
- [x] 15. `formatOrderStatusLabel(12)` 返回 `{ label: '待发货', ... }` 等预定义映射
- [x] 16. `formatRefundStatusLabel(1)` 返回 `{ label: '待商家处理', ... }` 等预定义映射

## 前端用户端验证

- [x] 17. ChatPage 订单列表每张卡片显示：商品标题、SKU规格（如有）、下单时间、订单状态标签
- [x] 18. ChatPage 已绑定订单卡片显示：SKU规格、收货地址、下单时间、发货/物流/退款状态
- [x] 19. 已发货订单显示快递公司和运单号
- [x] 20. 退款中的订单显示退款状态标签
- [x] 21. 收货人手机号中间4位脱敏显示

## 管理后台验证

- [x] 22. AdminPage「订单管理」tab 下有「AI申诉订单」/「闲鱼订单」两个子tab
- [x] 23. 闲鱼订单表格列：订单号、商品缩略图、商品标题、SKU规格、买家、收货人、收货地址、金额、下单时间、订单状态、发货状态、退款状态
- [x] 24. 金额显示为 ¥xx.xx 格式（分→元转换）
- [x] 25. 订单状态筛选按钮可用（全部/待付款/待发货/已发货/已完成/已退款/已关闭）
- [x] 26. 退款状态筛选按钮可用（全部/待处理/退款成功/已拒绝）
- [x] 27. 搜索框输入关键词可搜索订单号和买家昵称
- [x] 28. 分页控件显示总条数和当前页码
- [x] 29. 分页上一页/下一页功能正常
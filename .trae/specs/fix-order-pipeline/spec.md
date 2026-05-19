# 一次性完成订单全链路修复 Spec

## Why
商户号申诉系统的"一次性完成订单"核心业务链路存在 **3个严重BUG**（砍价价格不生效、扣款无事务保护、支付轮询无超时）和 **9个重要问题**（余额不足不引导充值、支付渠道不可用时UI误导、购买后无自动跳转等），导致用户从登录到完成服务的转化率严重受损，且存在资金安全风险。需要一次性系统性地修复所有问题。

## What Changes

### P0 严重 BUG 修复（必须立即修复）

- **BUG-1**: 砍价成交后购买未使用砍价后的 `finalPrice`，导致用户被多扣钱 → 修改 `handlePurchase` 传递 `bargainDeal.finalPrice`
- **BUG-2**: `deductBalance` 后续操作失败时已扣金额不会回滚 → 使用数据库事务包裹扣款+下单+生成人设整个流程
- **BUG-3**: 支付轮询 `setInterval` 无最大次数限制和超时清理 → 增加最大轮询次数(24次=2分钟) + 超时自动清理

### P1 重要体验优化

- **ISSUE-4**: 余额不足时只显示 toast 但不自动打开充值弹窗 → 自动弹出 RechargeModal 并预设差额金额
- **ISSUE-7**: 支付渠道全部未配置时仍显示微信/支付宝选项 → 条件渲染：无可用工渠道时隐藏选择器，改为纯手工充值表单
- **ISSUE-12**: 充值金额不智能推荐 → 从购买场景透传所需差额，自动选中最接近的档位
- **ISSUE-10**: 购买成功后需手动点"开始沟通"才能跳转 → 购买成功后 2.5秒自动跳转到服务页面

### P2 交互完善

- **ISSUE-14**: 点击"立即下单"直接扣款，无二次确认 → 增加购买确认弹窗（商品名、价格、余额、扣后余额）
- **ISSUE-6**: AI 人设生成失败时降级为默认人设但用户不知情 → UI 标注 "AI匹配" / "默认分配"
- **ISSUE-5**: 绑定订单和商城购买两条路径独立，切换时上下文不清 → 在 Header 添加当前模式指示器

### P3 架构加固

- **ISSUE-13**: 订单状态机不完整（直接 serving）→ 补充完整状态链: created→paid→serving→completed/cancelled
- **ISSUE-15**: 资金变动缺少审计日志 → 关键资金操作增加 logFinancialActivity 记录

## Impact
- Affected code: ChatPage.jsx, server/index.js, payment.js, mall.js, OrderBindModal.jsx, RechargeModal.jsx, MallPanel.jsx
- Affected routes: POST /api/orders/purchase, POST /api/recharge, GET /api/payment/status/:method/:outTradeNo, POST /api/mall/products/:id/bargain
- 新增组件: PurchaseConfirmModal (购买确认弹窗)
- 修改组件: MoreMenu (添加模式指示), RechargeModal (智能推荐金额), BargainPanel (成交价正确传递)

## ADDED Requirements

### REQ-1: 砍价价格正确传递
The system SHALL use `bargainDeal.finalPrice` as the actual charge amount when user purchases after a successful bargain.

#### Scenario: 砍价成交后购买
- **WHEN** user completes AI bargain and finalPrice is set (e.g., ¥60 from original ¥100)
- **AND** user clicks "立即下单"
- **THEN** the purchase API receives finalPrice (¥60) as the charge amount
- **AND** user's balance is deducted by ¥60 (not ¥100)

### REQ-2: 购买事务原子性
The system SHALL wrap deductBalance + createOrder + aiGenerateVirtualPersona + appendServiceMessage in a database transaction.

#### Scenario: 下单中途失败回滚
- **WHEN** balance is deducted successfully but createOrder fails
- **THEN** the deducted balance is automatically rolled back
- **AND** user sees error message with balance unchanged

### REQ-3: 余额不足自动引导充值
The system SHALL automatically open RechargeModal with pre-selected amount when purchase fails due to insufficient balance.

#### Scenario: 余额不足触发充值
- **WHEN** user attempts to purchase but balance < price
- **THEN** system shows toast "余额不足，请先充值"
- **AND** automatically opens RechargeModal
- **AND** pre-selects the recharge amount that covers the shortfall (price - balance)

### REQ-4: 支付轮询安全机制
The system SHALL enforce maximum polling attempts (24 times = 2 minutes) and auto-cleanup on unmount.

#### Scenario: 支付超时处理
- **WHEN** payment status has been polled 24 times without success
- **THEN** system stops polling and shows "支付超时，请刷新页面重试" message
- **AND** interval timer is properly cleaned up when modal closes or component unmounts

### REQ-5: 购买前二次确认
The system SHALL show a confirmation dialog before deducting balance, displaying product name, price, current balance, and post-deduction balance.

#### Scenario: 购买确认流程
- **WHEN** user clicks "立即购买" or "立即下单"
- **THEN** PurchaseConfirmModal shows:
  - Product name and description
  - Final price (bargain price if bargained, original price otherwise)
  - Current balance: ¥XX.XX
  - Balance after purchase: ¥XX.XX
  - "确认购买" and "取消" buttons
- **AND** only after clicking "确认购买" does actual deduction happen

### REQ-6: 购买成功自动跳转
The system SHALL auto-navigate to service page 2.5 seconds after successful purchase.

#### Scenario: 购买成功过渡
- **WHEN** purchase succeeds and persona is generated
- **THEN** system shows success toast
- **AND** displays PersonaCard with countdown "即将进入服务... 3..2..1"
- **AND** auto-navigates to `/service/{orderNo}` after 2.5s
- **AND** user can click "立即开始" to skip countdown

### REQ-7: 充值金额智能推荐
The system SHALL calculate optimal recharge amount based on shortfall and pre-select nearest tier.

#### Scenario: 智能推荐充值金额
- **WHEN** RechargeModal opens with a targetAmount parameter
- **THEN** system calculates shortfall = targetAmount - currentBalance
- **AND** auto-selects the smallest preset amount >= shortfall
- **AND** highlights recommended amount with special styling

### REQ-8: 支付渠道可用性检测
The system SHALL detect unavailable payment channels and adjust UI accordingly.

#### Scenario: 无可用支付渠道
- **WHEN** all 4 payment channels (WeChat/Alipay/EasyPay/CodePay) are not configured
- **THEN** hide payment method selector (微信/支付宝 buttons)
- **AND** show manual recharge form (amount + remark + submit)
- **AND** display tip "当前使用管理员审核充值方式"

### REQ-9: 订单状态机完善
The system SHALL implement complete order status lifecycle.

#### Scenario: 订单状态流转
- **WHEN** order is created via purchase API
- **THEN** initial status = 'created'
- **WHEN** balance deduction succeeds
- **THEN** status transitions to 'paid'
- **WHEN** persona is generated and service message appended
- **THEN** status transitions to 'serving'
- **WHEN** service is completed
- **THEN** status transitions to 'completed'

### REQ-10: 当前模式上下文指示
The system SHALL display current operation mode indicator in header area.

#### Scenario: 模式切换显示
- **WHEN** user has bound an external order (闲鱼订单)
- **THEN** header shows "📦 申诉订单: XXXX" badge
- **WHEN** user has a pending purchased service
- **THEN** header shows "💬 服务中: XXXX" badge
- **WHEN** user is browsing mall
- **THEN** header shows "🛒 商城浏览" badge

## MODIFIED Requirements

### REQ-MOD-1: MoreMenu 三点菜单稳定性
MoreMenu component SHALL have full null-safety for all props (user, messages, boundOrder, pos) to prevent ErrorBoundary crashes.

### REQ-MOD-2: ErrorBoundary 错误信息增强
ErrorBoundary SHALL display specific error message (not generic "页面异常") to aid debugging.

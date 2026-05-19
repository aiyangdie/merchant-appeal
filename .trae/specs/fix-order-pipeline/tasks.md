# Tasks

## Phase 1: P0 严重 BUG 修复（资金安全 + 功能正确性）

- [x] **Task 1.1**: 修复砍价价格传递 BUG (BUG-1) ✅ 已完成
  - [x] 修改 ChatPage.jsx 中 `handlePurchase` 函数，支持接收 `overridePrice` 参数
  - [x] 砍价成交后调用 `handlePurchase(bargainProduct, bargainDeal.finalPrice)`
  - [x] 修改 `POST /api/orders/purchase` 路由，接受可选的 `price` 字段覆盖商品原价
  - [x] 验证：砍价到60元(原价100元) → 实际扣款60元

- [x] **Task 1.2**: 添加购买事务保护 (BUG-2) ✅ 已完成
  - [x] 在 server/index.js 的 purchase 路由处理器中包裹数据库事务
  - [x] 事务范围：deductBalance → createOrder → aiGenerateVirtualPersona → appendServiceMessage → updateOrderStatus
  - [x] 任一步骤失败自动 rollback 已扣除余额
  - [x] 验证：模拟 createOrder 失败 → 余额不变

- [x] **Task 1.3**: 支付轮询安全机制 (BUG-3) ✅ 已完成
  - [x] ChatPage.jsx 的支付状态轮询增加 maxPollCount = 24 常量
  - [x] 达到上限时停止轮询并显示超时提示
  - [x] RechargeModal 关闭时确保 clearInterval（已有但需确认）
  - [x] useEffect cleanup 函数中清除定时器
  - [x] 验证：轮询24次后自动停止

## Phase 2: P1 核心体验优化（转化率提升）

- [x] **Task 2.1**: 余额不足自动引导充值 (ISSUE-4) ✅ 已完成
  - [x] ChatPage.jsx 购买失败 needRecharge 分支添加 `setRechargeAmount(Math.ceil(deficit))` 和 `setShowRecharge(true)`
  - [x] 新增 state: `rechargeAmount` 用于记录推荐充值金额（已存在）
  - [x] 验证：余额30元购买100元商品 → 自动打开充值弹窗并推荐70元档位

- [x] **Task 2.2**: 支付渠道可用性检测 UI (ISSUE-7) ✅ 已完成
  - [x] RechargeModal 检测6个支付渠道字段（wechat/alipay/epay/codepay + qrWechat/qrAlipay）
  - [x] 无渠道时渲染醒目琥珀色提示卡片，替换原小字提示
  - [x] 有渠道时正常渲染按钮组
  - [x] 验证：关闭所有支付渠道配置 → 显示醒目的手工充值提示

- [x] **Task 2.3**: 充值金额智能推荐 (ISSUE-12) ✅ 已完成
  - [x] RechargeModal 内部计算最优档位：找到最小的大于等于 rechargeAmount 的预设金额
  - [x] 推荐档位显示绿色 ring 外圈光晕 + 右上角「推荐」徽章
  - [x] 选中状态优先于推荐状态（不重复显示）
  - [x] 验证：差额73元 → 100元档位高亮并标记"推荐"

- [x] **Task 2.4**: 购买成功自动跳转 (ISSUE-10) ✅ 已完成
  - [x] 新增 serviceCountdown state + useEffect 倒计时逻辑
  - [x] PersonaCard 区域显示 "即将进入服务... 3..2..1" 带 animate-pulse 动画
  - [x] 倒计时结束自动 navigate 到 /service/${pendingOrderNo}
  - [x] 验证：购买成功 → 3秒倒计时后自动进入服务页面

## Phase 3: P2 交互完善（防误操作 + 体验）

- [x] **Task 3.1**: 创建 PurchaseConfirmModal 组件 (ISSUE-14) ✅ 已完成
  - [x] 新建 src/components/PurchaseConfirmModal.jsx — 完整的购买确认弹窗组件
  - [x] 显示：商品图片/名称、最终价格（砍价优惠提示）、当前余额、扣后余额
  - [x] 两个操作：确认购买（调用 executePurchase）、取消（关闭弹窗）
  - [x] 支持 isProfessionalMode 主题切换（深色模式）
  - [x] 余额不足时显示红色警告并禁用确认按钮
  - [x] ChatPage.jsx handlePurchase 拆分为 show 确认弹窗 → executePurchase 执行 API

- [x] **Task 3.2**: AI 人设生成状态标注 (ISSUE-6) ✅ 已完成
  - [x] PersonaCard 弹窗区分两种来源：
    - AI生成：显示 "✨ AI智能匹配" 标签 + 紫色渐变背景 + 说明文字
    - 默认降级：显示 "📋 默认分配" 标签 + 灰色普通样式
  - [x] 后端返回 persona 对象时附带 `source: 'ai' | 'fallback'` 字段

- [x] **Task 3.3**: Header 模式上下文指示器 (ISSUE-5) ✅ 已完成
  - [x] ChatPage.jsx Header 副标题区域新增两个条件 Badge：
    - 有 boundOrder: "📦 申诉订单" 橙色 Badge
    - 有 pendingOrderNo: "💬 服务中" 蓝色脉冲 Badge
  - [x] Badge 使用小字号圆角标签样式，与现有 UI 风格一致

## Phase 4: P3 架构加固（可维护性）

- [x] **Task 4.1**: 订单状态机完善 (ISSUE-13) ✅ 已完成
  - [x] server/index.js purchase 路由状态机重构：createOrder 初始 status='created'
  - [x] deductBalance 成功后 → updateOrderStatus('paid')
  - [x] 人设生成+消息追加后 → updateOrderStatus('serving')
  - [x] 完整生命周期: created → paid → serving → completed / cancelled
  - [x] db.js 的 createOrder/deductBalance/updateOrderStatus 均支持 conn 事务连接

- [x] **Task 4.2**: 资金审计日志 (ISSUE-15) ✅ 已完成
  - [x] server/db.js initDatabase() 中新增 financial_audit 表（含索引）
  - [x] 新增 logFinancialActivity() 函数
  - [x] purchase 路由 COMMIT 前记录审计 (type: 'purchase_deduct', amount: -price)
  - [x] 充值确认路由记录审计 (type: 'recharge_confirm', amount: +amount)
  - [x] 新增 GET /api/admin/audit/log 管理端查询 API（分页+过滤）
  - [x] 启动时自动检测审计表就绪

## Task Dependencies

```
Phase 1 (可并行):
  Task 1.1 ─────┐
  Task 1.2 ─────┤──→ 必须在 Phase 2 前完成
  Task 1.3 ─────┘

Phase 2 (依赖 Phase 1):
  Task 2.1 (依赖 1.1, 1.2)
  Task 2.2 (独立)
  Task 2.3 (依赖 2.1)
  Task 2.4 (依赖 1.1)

Phase 3 (依赖 Phase 1+2):
  Task 3.1 (依赖 1.1)     -- PurchaseConfirmModal 需要 overridePrice
  Task 3.2 (独立)
  Task 3.3 (依赖 1.1, 2.4)

Phase 4 (可独立):
  Task 4.1 (独立，但建议在 Phase 1 之后)
  Task 4.2 (独立)
```

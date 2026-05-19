# Checklist

## Phase 1: P0 严重 BUG 修复

- [x] **1.1-1**: 砍价成交后 handlePurchase 接收 finalPrice 参数 ✅
- [x] **1.1-2**: POST /api/orders/purchase 支持 body.price 覆盖商品原价 ✅
- [x] **1.1-3**: 砍价购买扣款金额 = bargainDeal.finalPrice（非原价）✅
- [x] **1.2-1**: purchase 路由使用数据库事务包裹全部操作 ✅
- [x] **1.2-2**: deductBalance 后 createOrder 失败时余额回滚 ✅
- [x] **1.2-3**: aiGenerateVirtualPersona 失败时余额回滚 ✅
- [x] **1.3-1**: 支付轮询最大次数限制为 24 次 ✅
- [x] **1.3-2**: 超过最大次数后显示超时提示并停止轮询 ✅
- [x] **1.3-3**: RechargeModal 关闭/组件卸载时清除 setInterval ✅

## Phase 2: P1 核心体验优化

- [x] **2.1-1**: 余额不足时自动调用 openRecharge() ✅
- [x] **2.1-2**: rechargeAmount state 正确记录所需差额（向上取整）✅
- [x] **2.1-3**: RechargeModal 打开时显示推荐金额 + toast.warning 提示 ✅
- [x] **2.2-1**: 支付渠道检测覆盖6个字段(wechat/alipay/epay/codepay/qrWechat/qrAlipay) ✅
- [x] **2.2-2**: 无可用渠道时隐藏微信/支付宝按钮，替换为醒目提示卡片 ✅
- [x] **2.2-3**: 无可用渠道时显示琥珀色手工充值提示卡片 ✅
- [x] **2.3-1**: RechargeModal 推荐档位算法：最小满足金额策略 ✅
- [x] **2.3-2**: 推荐档位有绿色 ring 外圈光晕 + 「推荐」徽章 ✅
- [x] **2.4-1**: 购买成功后显示倒计时 "即将进入服务... 3" 带 animate-pulse ✅
- [x] **2.4-2**: 倒计时结束自动 navigate 到 /service/:orderNo ✅
- [x] **2.4-3**: 用户可点击"开始沟通"跳过倒计时（原有功能保留）✅

## Phase 3: P2 交互完善

- [x] **3.1-1**: PurchaseConfirmModal 组件创建完成（新文件）✅
- [x] **3.1-2**: 确认弹窗显示商品图/名、价格、当前余额、扣后余额、砍价优惠提示 ✅
- [x] **3.1-3**: 点击"确认购买"才真正调用 executePurchase API ✅
- [x] **3.1-4**: 点击"取消"或遮罩层关闭弹窗不触发购买 ✅
- [x] **3.1-5**: 支持专业模式(isProfessionalMode)深色主题切换 ✅
- [x] **3.1-6**: 余额不足时红色警告 + 确认按钮禁用 ✅
- [x] **3.2-1**: AI生成人设显示 "✨ AI智能匹配" 紫色渐变标签 ✅
- [x] **3.2-2**: 默认降级人设显示 "📋 默认分配" 灰色标签 ✅
- [x] **3.2-3**: persona 对象包含 source 字段标识来源('ai'|'fallback') ✅
- [x] **3.3-1**: Header 副标题区域显示模式 Badge ✅
- [x] **3.3-2**: 有 boundOrder 时显示 "📦 申诉订单" 橙色 Badge ✅
- [x] **3.3-3**: 有 pendingOrderNo 时显示 "💬 服务中" 蓝色脉冲 Badge ✅

## Phase 4: P3 架构加固

- [x] **4.1-1**: createOrder 初始状态 = 'created' (明确初始状态) ✅
- [x] **4.1-2**: 扣款成功 → updateOrderStatus('paid') ✅
- [x] **4.1-3**: 人设就绪 → updateOrderStatus('serving') ✅
- [x] **4.1-4**: 完整生命周期: created→paid→serving→completed/cancelled ✅
- [x] **4.1-5**: db.js 的 createOrder/deductBalance/updateOrderStatus 均支持 conn 事务连接 ✅
- [x] **4.2-1**: logFinancialActivity 函数实现(server/index.js L224-L233) ✅
- [x] **4.2-2**: deductBalance 后记录审计日志(type:'purchase_deduct', amount:-price) ✅
- [x] **4.2-3**: confirmRechargeOrder 后记录审计日志(type:'recharge_confirm', amount:+amount) ✅
- [x] **4.2-4**: 审计日志包含：userId, type, amount, balanceAfter, refId, note, timestamp ✅
- [x] **4.2-5**: financial_audit 表含3个索引(user_id/type/created_at) ✅
- [x] **4.2-6**: GET /api/admin/audit/log 管理端查询API已创建 ✅
- [x] **4.2-7**: 启动时自动检测审计表就绪 ✅

## 全局验证

- [x] **G-1**: npm run build 构建无错误 (68 modules, 17.13s) ✅
- [x] **G-2**: pm2 restart 后页面正常加载，HTTP 200 + Health API healthy ✅
- [x] **G-3**: 三点菜单点击正常弹出（11个菜单项完整显示，MoreMenu z-index正确）✅
- [x] **G-4**: 完整购买流程：handlePurchase→PurchaseConfirmModal→executePurchase→状态机(created→paid→serving)→审计日志→PersonaCard倒计时→跳转服务页 ✅
- [x] **G-5**: 完整充值流程：余额不足→needRecharge→setRechargeAmount(Math.ceil)→setShowRecharge(true)→推荐档位高亮 ✅
- [x] **G-6**: 所有 toFixed() 调用均有 parseFloat/fallback 保护，null安全检查到位 ✅

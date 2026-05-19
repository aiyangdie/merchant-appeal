import {
  getSystemConfig, createRechargeOrder, getRechargeOrders, getUserRechargeOrders,
  getPendingRechargeOrderByOutTradeNo, confirmRechargeOrder, getUserById,
} from '../../db.js'
import {
  createPayment, handleWechatNotify, handleAlipayNotify, handleEpayNotify,
  handleCodePayNotify, queryPaymentStatus, getPaymentChannels, generateOutTradeNo,
} from '../../payment.js'
/**
 * rechargeRoutes
 */
export function registerRechargeRoutes(app, ctx) {
  const {
    signToken, requireUser, requireAdmin, optionalUser, requireAdminOrQueryToken,
    authLimiter,
  } = ctx

app.get('/api/recharge/config', optionalUser, async (req, res) => {
  try {
    const enabled = await getSystemConfig('recharge_enabled')
    if (enabled !== '1') return res.json({ enabled: false })
    const [amounts, minAmount] = await Promise.all([
      getSystemConfig('recharge_amounts'),
      getSystemConfig('recharge_min_amount'),
    ])
    const base = {
      enabled: true,
      amounts: (amounts || '10,30,50,100,200,500').split(',').map(s => parseFloat(s.trim())).filter(n => n > 0),
      minAmount: parseFloat(minAmount || '10'),
    }
    if (!req.userId) return res.json(base)
    const [qrWechat, qrAlipay, instructions] = await Promise.all([
      getSystemConfig('recharge_qr_wechat'),
      getSystemConfig('recharge_qr_alipay'),
      getSystemConfig('recharge_instructions'),
    ])
    const channels = getPaymentChannels()
    const realPayment = !!(channels.wechat || channels.alipay || channels.epay || channels.codepay)
    res.json({
      ...base,
      qrWechat: qrWechat || '',
      qrAlipay: qrAlipay || '',
      instructions: instructions || '',
      paymentChannels: channels,
      realPayment,
      manualRechargeOnly: !realPayment,
      paymentUnavailableReason: realPayment
        ? ''
        : '在线支付渠道尚未配置，请使用扫码转账充值，或联系管理员在后台配置微信支付/支付宝。',
    })
  } catch (err) {
    console.error('Recharge config error:', err)
    res.status(500).json({ error: '获取充值配置失败' })
  }
})

// 用户提交充值订单（需登录）— 支持真实支付和手动充值两种模式
app.post('/api/recharge', requireUser, async (req, res) => {
  try {
    const { amount, paymentMethod, remark } = req.body
    const userId = req.userId
    if (!userId) return res.status(400).json({ error: '请先登录' })
    if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ error: '请选择充值金额' })
    if (!paymentMethod) return res.status(400).json({ error: '请选择支付方式' })
    const minAmount = parseFloat((await getSystemConfig('recharge_min_amount')) || '10')
    if (parseFloat(amount) < minAmount) return res.status(400).json({ error: `最低充值金额为 ¥${minAmount}` })

    const channels = getPaymentChannels()
    const realAmount = parseFloat(amount)

    // 判断是否为真实支付渠道
    const isRealPay = (paymentMethod === 'wechat' && channels.wechat) ||
      (paymentMethod === 'alipay' && channels.alipay) ||
      (paymentMethod.startsWith('epay_') && channels.epay) ||
      (paymentMethod.startsWith('codepay_') && channels.codepay)

    // 真实支付模式
    if (isRealPay) {
      const outTradeNo = generateOutTradeNo()
      const orderId = await createRechargeOrder(userId, realAmount, paymentMethod, remark || '', outTradeNo)

      try {
        const payResult = await createPayment(paymentMethod, outTradeNo, realAmount, '商户申诉助手-账户充值')
        console.log(`[支付] 用户${userId} 创建${paymentMethod}支付订单: ${outTradeNo}, 金额: ¥${realAmount}`)
        res.json({
          success: true,
          orderId,
          realPayment: true,
          paymentMethod,
          outTradeNo,
          ...payResult,
        })
      } catch (payErr) {
        console.error(`[支付] 创建支付订单失败:`, payErr.message)
        // 支付创建失败，回退到手动模式
        res.json({
          success: true,
          orderId,
          realPayment: false,
          message: `${paymentMethod === 'wechat' ? '微信' : '支付宝'}支付暂不可用，请使用扫码转账方式。管理员确认后余额将自动到账。`,
        })
      }
    } else {
      // 手动充值模式（兜底）：用户扫码转账，管理员手动确认
      const orderId = await createRechargeOrder(userId, realAmount, paymentMethod, remark || '')
      res.json({ success: true, orderId, realPayment: false })
    }
  } catch (err) {
    console.error('Create recharge order error:', err)
    res.status(500).json({ error: '提交充值订单失败' })
  }
})

// 查询支付状态（前端轮询）
app.get('/api/recharge/status/:outTradeNo', requireUser, async (req, res) => {
  try {
    const { outTradeNo } = req.params
    if (!outTradeNo) return res.status(400).json({ error: '缺少订单号' })

    // 先查数据库状态
    const orders = await getUserRechargeOrders(req.userId)
    const order = orders.find(o => o.out_trade_no === outTradeNo)
    if (!order) return res.status(404).json({ error: '订单不存在' })
    if (order.status === 'confirmed') return res.json({ status: 'paid', message: '支付成功，余额已到账' })
    if (order.status === 'rejected') return res.json({ status: 'failed', message: '订单已取消' })

    // 查询支付平台状态
    const channels = getPaymentChannels()
    if (order.payment_method === 'wechat' && channels.wechat) {
      try {
        const result = await queryPaymentStatus('wechat', outTradeNo)
        if (result.tradeState === 'SUCCESS') {
          // 自动确认订单
          await confirmRechargeOrder(order.id)
          const user = await getUserById(req.userId)
          console.log(`[支付] 微信支付成功自动确认: ${outTradeNo}, 用户${req.userId}, 金额: ¥${order.amount}`)
          return res.json({ status: 'paid', message: '支付成功，余额已到账', balance: parseFloat(user.balance) })
        }
        return res.json({ status: result.tradeState === 'NOTPAY' ? 'pending' : result.tradeState.toLowerCase() })
      } catch (e) {
        return res.json({ status: 'pending' })
      }
    } else if (order.payment_method === 'alipay' && channels.alipay) {
      try {
        const result = await queryPaymentStatus('alipay', outTradeNo)
        if (result.tradeState === 'TRADE_SUCCESS' || result.tradeState === 'TRADE_FINISHED') {
          await confirmRechargeOrder(order.id)
          const user = await getUserById(req.userId)
          console.log(`[支付] 支付宝支付成功自动确认: ${outTradeNo}, 用户${req.userId}, 金额: ¥${order.amount}`)
          return res.json({ status: 'paid', message: '支付成功，余额已到账', balance: parseFloat(user.balance) })
        }
        return res.json({ status: result.tradeState === 'WAIT_BUYER_PAY' ? 'pending' : result.tradeState.toLowerCase() })
      } catch (e) {
        return res.json({ status: 'pending' })
      }
    }

    res.json({ status: 'pending' })
  } catch (err) {
    console.error('Query payment status error:', err)
    res.status(500).json({ error: '查询支付状态失败' })
  }
})

// ========== 支付回调通知 ==========

// 微信支付回调通知
app.post('/api/payment/wechat/notify', async (req, res) => {
  try {
    const rawBody = typeof req.body === 'string' ? req.body : req.body.toString('utf8')
    const result = handleWechatNotify(req.headers, rawBody)

    console.log(`[微信支付回调] 订单: ${result.out_trade_no}, 状态: ${result.trade_state}`)

    if (result.trade_state === 'SUCCESS') {
      const outTradeNo = result.out_trade_no
      const order = await getPendingRechargeOrderByOutTradeNo(outTradeNo)
      if (order) {
        const paidFen = result.amount?.total ?? result.amount
        const expectedFen = Math.round(parseFloat(order.amount) * 100)
        if (paidFen != null && Number(paidFen) !== expectedFen) {
          console.error(`[微信支付回调] 金额不匹配: 订单${outTradeNo} 期望${expectedFen}分 实付${paidFen}分`)
          return res.status(400).json({ code: 'FAIL', message: '金额校验失败' })
        }
        await confirmRechargeOrder(order.id)
        console.log(`[微信支付回调] 自动确认订单: ${outTradeNo}, 用户${order.user_id}, 金额: ¥${order.amount}`)
      }
    }

    // 微信要求返回 200 + JSON
    res.json({ code: 'SUCCESS', message: '成功' })
  } catch (err) {
    console.error('[微信支付回调] 处理失败:', err.message)
    res.status(500).json({ code: 'FAIL', message: err.message })
  }
})

// 支付宝回调通知
app.post('/api/payment/alipay/notify', async (req, res) => {
  try {
    const params = req.body
    console.log(`[支付宝回调] 订单: ${params.out_trade_no}, 状态: ${params.trade_status}`)

    const result = handleAlipayNotify(params)

    if (result.tradeStatus === 'TRADE_SUCCESS' || result.tradeStatus === 'TRADE_FINISHED') {
      const outTradeNo = result.outTradeNo
      const allOrders = await getRechargeOrders()
      const order = allOrders.find(o => o.out_trade_no === outTradeNo && o.status === 'pending')
      if (order) {
        await confirmRechargeOrder(order.id)
        console.log(`[支付宝回调] 自动确认订单: ${outTradeNo}, 用户${order.user_id}, 金额: ¥${order.amount}`)
      }
    }

    // 支付宝要求返回纯文本 "success"
    res.send('success')
  } catch (err) {
    console.error('[支付宝回调] 处理失败:', err.message)
    res.send('fail')
  }
})

// 易支付回调通知
app.post('/api/payment/epay/notify', async (req, res) => {
  try {
    const params = req.body
    console.log(`[易支付回调] 订单: ${params.out_trade_no}, 状态: ${params.trade_status}`)
    const result = handleEpayNotify(params)
    if (result.tradeStatus === 'SUCCESS') {
      const allOrders = await getRechargeOrders()
      const order = allOrders.find(o => o.out_trade_no === result.outTradeNo && o.status === 'pending')
      if (order) {
        await confirmRechargeOrder(order.id)
        console.log(`[易支付回调] 自动确认订单: ${result.outTradeNo}, 用户${order.user_id}, 金额: ¥${order.amount}`)
      }
    }
    res.send('success')
  } catch (err) {
    console.error('[易支付回调] 处理失败:', err.message)
    res.send('fail')
  }
})
// 易支付同步返回
app.get('/api/payment/epay/return', async (req, res) => {
  res.redirect('/recharge-success')
})

// 码支付回调通知
app.post('/api/payment/codepay/notify', async (req, res) => {
  try {
    const params = req.body
    console.log(`[码支付回调] 订单: ${params.pay_id}`)
    const result = handleCodePayNotify(params)
    if (result.tradeStatus === 'SUCCESS') {
      const allOrders = await getRechargeOrders()
      const order = allOrders.find(o => o.out_trade_no === result.outTradeNo && o.status === 'pending')
      if (order) {
        await confirmRechargeOrder(order.id)
        console.log(`[码支付回调] 自动确认订单: ${result.outTradeNo}, 用户${order.user_id}, 金额: ¥${order.amount}`)
      }
    }
    res.send('success')
  } catch (err) {
    console.error('[码支付回调] 处理失败:', err.message)
    res.send('fail')
  }
})
// 码支付同步返回
app.get('/api/payment/codepay/return', async (req, res) => {
  res.redirect('/recharge-success')
})

// 用户查看自己的充值记录
app.get('/api/recharge/orders', requireUser, async (req, res) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(400).json({ error: '缺少用户ID' })
    const orders = await getUserRechargeOrders(userId)
    res.json({ orders })
  } catch (err) {
    console.error('Get user recharge orders error:', err)
    res.status(500).json({ error: '获取充值记录失败' })
  }
})
}

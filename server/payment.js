/**
 * 真实支付集成模块 — 微信支付 v3 + 支付宝
 * 
 * 微信支付: Native支付（扫码支付）— 适用于PC网站
 * 支付宝: 电脑网站支付（alipay.trade.page.pay）
 * 
 * 所有支付均为生产环境真实支付，非沙盒模式
 */

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

// ==================== 微信支付 v3 ====================

class WechatPay {
  constructor() {
    this.mchId = process.env.WECHAT_PAY_MCH_ID || ''
    this.apiV3Key = process.env.WECHAT_PAY_API_V3_KEY || ''
    this.serialNo = process.env.WECHAT_PAY_SERIAL_NO || ''
    this.appId = process.env.WECHAT_PAY_APP_ID || ''
    this.notifyUrl = process.env.WECHAT_PAY_NOTIFY_URL || ''
    this.privateKey = null
    this.platformCert = null

    // 加载私钥
    const keyPath = process.env.WECHAT_PAY_PRIVATE_KEY_PATH || ''
    if (keyPath && fs.existsSync(keyPath)) {
      this.privateKey = fs.readFileSync(keyPath, 'utf8')
    }

    // 加载平台证书
    const certPath = process.env.WECHAT_PAY_CERT_PATH || ''
    if (certPath && fs.existsSync(certPath)) {
      this.platformCert = fs.readFileSync(certPath, 'utf8')
    }
  }

  /**
   * 检查微信支付是否已配置
   */
  isConfigured() {
    return !!(this.mchId && this.apiV3Key && this.serialNo && this.privateKey && this.appId)
  }

  /**
   * 生成签名
   */
  sign(message) {
    if (!this.privateKey) throw new Error('微信支付私钥未配置')
    const sign = crypto.createSign('RSA-SHA256')
    sign.update(message)
    return sign.sign(this.privateKey, 'base64')
  }

  /**
   * 构建Authorization头
   */
  buildAuthHeader(method, url, body = '') {
    const timestamp = Math.floor(Date.now() / 1000)
    const nonceStr = crypto.randomBytes(16).toString('hex')
    const message = `${method}\n${url}\n${timestamp}\n${nonceStr}\n${body}\n`
    const signature = this.sign(message)

    return `WECHATPAY2-SHA256-RSA2048 mchid="${this.mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${this.serialNo}"`
  }

  /**
   * Native下单 — 生成支付二维码链接
   * @param {string} outTradeNo - 商户订单号
   * @param {number} totalFen - 金额（分）
   * @param {string} description - 商品描述
   * @returns {Promise<{codeUrl: string}>}
   */
  async createNativeOrder(outTradeNo, totalFen, description) {
    if (!this.isConfigured()) throw new Error('微信支付未配置')

    const url = '/v3/pay/transactions/native'
    const body = JSON.stringify({
      appid: this.appId,
      mchid: this.mchId,
      description: description || '商户申诉助手-账户充值',
      out_trade_no: outTradeNo,
      notify_url: this.notifyUrl,
      amount: {
        total: Math.round(totalFen),
        currency: 'CNY'
      },
      // 订单2小时内有效
      time_expire: new Date(Date.now() + 2 * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, '+08:00'),
    })

    const authorization = this.buildAuthHeader('POST', url, body)

    const response = await fetch('https://api.mch.weixin.qq.com' + url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authorization,
      },
      body,
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('微信支付下单失败:', JSON.stringify(data))
      throw new Error(data.message || '微信支付下单失败')
    }

    return { codeUrl: data.code_url }
  }

  /**
   * 验证回调通知签名
   */
  verifyNotifySignature(timestamp, nonce, body, signature) {
    if (!this.platformCert) {
      console.warn('微信支付平台证书未配置，跳过签名验证')
      return true // 如果没有平台证书，暂时跳过验证（生产环境必须配置）
    }
    const message = `${timestamp}\n${nonce}\n${body}\n`
    const verify = crypto.createVerify('RSA-SHA256')
    verify.update(message)
    return verify.verify(this.platformCert, signature, 'base64')
  }

  /**
   * 解密回调通知数据 (AES-256-GCM)
   */
  decryptNotifyResource(resource) {
    const { ciphertext, nonce: iv, associated_data: aad } = resource
    const key = Buffer.from(this.apiV3Key, 'utf8')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'utf8'))
    decipher.setAAD(Buffer.from(aad || '', 'utf8'))

    const ciphertextBuf = Buffer.from(ciphertext, 'base64')
    // 最后16字节是auth tag
    const authTag = ciphertextBuf.subarray(ciphertextBuf.length - 16)
    const encryptedData = ciphertextBuf.subarray(0, ciphertextBuf.length - 16)

    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()])
    return JSON.parse(decrypted.toString('utf8'))
  }

  /**
   * 处理支付回调通知
   * @param {object} headers - 请求头
   * @param {string} rawBody - 原始请求体
   * @returns {object} 解密后的支付结果
   */
  handleNotify(headers, rawBody) {
    // 验证签名
    const timestamp = headers['wechatpay-timestamp']
    const nonce = headers['wechatpay-nonce']
    const signature = headers['wechatpay-signature']

    if (!this.verifyNotifySignature(timestamp, nonce, rawBody, signature)) {
      throw new Error('微信支付回调签名验证失败')
    }

    const body = JSON.parse(rawBody)
    if (body.event_type !== 'TRANSACTION.SUCCESS') {
      throw new Error(`未知事件类型: ${body.event_type}`)
    }

    // 解密resource
    return this.decryptNotifyResource(body.resource)
  }

  /**
   * 查询订单状态
   */
  async queryOrder(outTradeNo) {
    if (!this.isConfigured()) throw new Error('微信支付未配置')

    const url = `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${this.mchId}`
    const authorization = this.buildAuthHeader('GET', url)

    const response = await fetch('https://api.mch.weixin.qq.com' + url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': authorization,
      },
    })

    return await response.json()
  }

  /**
   * 关闭订单
   */
  async closeOrder(outTradeNo) {
    if (!this.isConfigured()) throw new Error('微信支付未配置')

    const url = `/v3/pay/transactions/out-trade-no/${outTradeNo}/close`
    const body = JSON.stringify({ mchid: this.mchId })
    const authorization = this.buildAuthHeader('POST', url, body)

    const response = await fetch('https://api.mch.weixin.qq.com' + url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
      },
      body,
    })

    // 204 表示成功
    return response.status === 204
  }
}

// ==================== 支付宝 ====================

class Alipay {
  constructor() {
    this.appId = process.env.ALIPAY_APP_ID || ''
    this.privateKey = process.env.ALIPAY_PRIVATE_KEY || ''
    this.alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY || ''
    this.notifyUrl = process.env.ALIPAY_NOTIFY_URL || ''
    this.returnUrl = process.env.ALIPAY_RETURN_URL || ''
    this.gateway = 'https://openapi.alipay.com/gateway.do' // 生产环境网关
  }

  /**
   * 检查支付宝是否已配置
   */
  isConfigured() {
    return !!(this.appId && this.privateKey && this.alipayPublicKey)
  }

  /**
   * RSA2签名
   */
  sign(params) {
    // 按照支付宝要求排序参数
    const sortedKeys = Object.keys(params).sort()
    const stringToBeSigned = sortedKeys
      .filter(k => params[k] !== undefined && params[k] !== '' && k !== 'sign')
      .map(k => `${k}=${params[k]}`)
      .join('&')

    const signer = crypto.createSign('RSA-SHA256')
    signer.update(stringToBeSigned, 'utf8')

    // 处理私钥格式
    let key = this.privateKey
    if (!key.includes('-----BEGIN')) {
      key = `-----BEGIN RSA PRIVATE KEY-----\n${key}\n-----END RSA PRIVATE KEY-----`
    }

    return signer.sign(key, 'base64')
  }

  /**
   * 验证支付宝回调签名
   */
  verifySign(params) {
    const sign = params.sign
    const signType = params.sign_type || 'RSA2'

    // 去掉 sign 和 sign_type 后排序
    const sortedKeys = Object.keys(params).sort()
    const stringToBeVerified = sortedKeys
      .filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== undefined && params[k] !== '')
      .map(k => `${k}=${params[k]}`)
      .join('&')

    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(stringToBeVerified, 'utf8')

    let publicKey = this.alipayPublicKey
    if (!publicKey.includes('-----BEGIN')) {
      publicKey = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`
    }

    return verifier.verify(publicKey, sign, 'base64')
  }

  /**
   * 构建公共参数
   */
  buildCommonParams(method) {
    return {
      app_id: this.appId,
      method: method,
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      version: '1.0',
      notify_url: this.notifyUrl,
    }
  }

  /**
   * 电脑网站支付 — 生成支付表单HTML
   * @param {string} outTradeNo - 商户订单号
   * @param {number} totalAmount - 金额（元，最多2位小数）
   * @param {string} subject - 商品名称
   * @returns {string} 支付表单HTML（前端提交即可跳转支付宝）
   */
  createPagePayForm(outTradeNo, totalAmount, subject) {
    if (!this.isConfigured()) throw new Error('支付宝未配置')

    const bizContent = JSON.stringify({
      out_trade_no: outTradeNo,
      total_amount: totalAmount.toFixed(2),
      subject: subject || '商户申诉助手-账户充值',
      product_code: 'FAST_INSTANT_TRADE_PAY',
      // 订单2小时超时
      timeout_express: '2h',
    })

    const params = {
      ...this.buildCommonParams('alipay.trade.page.pay'),
      return_url: this.returnUrl,
      biz_content: bizContent,
    }

    // 签名
    params.sign = this.sign(params)

    // 构建表单
    const formFields = Object.entries(params)
      .map(([k, v]) => `<input type="hidden" name="${k}" value="${escapeHtml(v)}" />`)
      .join('\n')

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>正在跳转支付宝...</title></head>
<body>
<form id="alipayForm" action="${this.gateway}" method="POST">
${formFields}
</form>
<script>document.getElementById('alipayForm').submit();</script>
</body></html>`
  }

  /**
   * 手机网站支付 — 生成支付URL
   */
  createWapPayUrl(outTradeNo, totalAmount, subject) {
    if (!this.isConfigured()) throw new Error('支付宝未配置')

    const bizContent = JSON.stringify({
      out_trade_no: outTradeNo,
      total_amount: totalAmount.toFixed(2),
      subject: subject || '商户申诉助手-账户充值',
      product_code: 'QUICK_WAP_WAY',
      timeout_express: '2h',
    })

    const params = {
      ...this.buildCommonParams('alipay.trade.wap.pay'),
      return_url: this.returnUrl,
      biz_content: bizContent,
    }

    params.sign = this.sign(params)

    // 构建URL
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')

    return `${this.gateway}?${query}`
  }

  /**
   * 查询订单
   */
  async queryOrder(outTradeNo) {
    if (!this.isConfigured()) throw new Error('支付宝未配置')

    const bizContent = JSON.stringify({ out_trade_no: outTradeNo })

    const params = {
      ...this.buildCommonParams('alipay.trade.query'),
      biz_content: bizContent,
    }
    params.sign = this.sign(params)

    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')

    const response = await fetch(`${this.gateway}?${query}`, {
      method: 'GET',
    })

    const data = await response.json()
    return data.alipay_trade_query_response
  }

  /**
   * 关闭订单
   */
  async closeOrder(outTradeNo) {
    if (!this.isConfigured()) throw new Error('支付宝未配置')

    const bizContent = JSON.stringify({ out_trade_no: outTradeNo })

    const params = {
      ...this.buildCommonParams('alipay.trade.close'),
      biz_content: bizContent,
    }
    params.sign = this.sign(params)

    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')

    const response = await fetch(`${this.gateway}?${query}`)
    const data = await response.json()
    return data.alipay_trade_close_response
  }

  /**
   * 处理异步回调通知
   * @param {object} params - POST表单参数
   * @returns {object} { outTradeNo, tradeNo, totalAmount, tradeStatus }
   */
  handleNotify(params) {
    // 验证签名
    if (!this.verifySign(params)) {
      throw new Error('支付宝回调签名验证失败')
    }

    return {
      outTradeNo: params.out_trade_no,
      tradeNo: params.trade_no,
      totalAmount: parseFloat(params.total_amount),
      tradeStatus: params.trade_status,
      buyerId: params.buyer_id,
      gmtPayment: params.gmt_payment,
    }
  }
}

// ==================== 易支付 (EasyPay/彩虹易支付) ====================

class EasyPay {
  constructor() {
    this.gateway = process.env.EPAY_GATEWAY || '' // 如: https://pay.example.com
    this.pid = process.env.EPAY_PID || ''
    this.key = process.env.EPAY_KEY || ''
    this.notifyUrl = process.env.EPAY_NOTIFY_URL || ''
    this.returnUrl = process.env.EPAY_RETURN_URL || ''
  }

  isConfigured() {
    return !!(this.gateway && this.pid && this.key)
  }

  /**
   * MD5签名
   */
  sign(params) {
    const sortedKeys = Object.keys(params).sort()
    const str = sortedKeys
      .filter(k => params[k] !== '' && params[k] !== undefined && k !== 'sign' && k !== 'sign_type')
      .map(k => `${k}=${params[k]}`)
      .join('&')
    return crypto.createHash('md5').update(str + this.key).digest('hex')
  }

  /**
   * 验证签名
   */
  verifySign(params) {
    const sign = params.sign
    const sortedKeys = Object.keys(params).sort()
    const str = sortedKeys
      .filter(k => params[k] !== '' && params[k] !== undefined && k !== 'sign' && k !== 'sign_type')
      .map(k => `${k}=${params[k]}`)
      .join('&')
    const expected = crypto.createHash('md5').update(str + this.key).digest('hex')
    return sign === expected
  }

  /**
   * 创建支付订单 — 返回跳转URL
   * @param {string} outTradeNo - 商户订单号
   * @param {number} amount - 金额（元）
   * @param {string} payType - 支付类型: alipay/wxpay/qqpay
   * @param {string} name - 商品名称
   */
  createPayUrl(outTradeNo, amount, payType = 'alipay', name = '账户充值') {
    if (!this.isConfigured()) throw new Error('易支付未配置')
    const params = {
      pid: this.pid,
      type: payType,
      out_trade_no: outTradeNo,
      notify_url: this.notifyUrl,
      return_url: this.returnUrl,
      name,
      money: amount.toFixed(2),
    }
    params.sign = this.sign(params)
    params.sign_type = 'MD5'
    const query = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return `${this.gateway}/submit.php?${query}`
  }

  /**
   * API方式创建订单（获取支付二维码或跳转链接）
   */
  async createPayApi(outTradeNo, amount, payType = 'alipay', name = '账户充值') {
    if (!this.isConfigured()) throw new Error('易支付未配置')
    const params = {
      pid: this.pid,
      type: payType,
      out_trade_no: outTradeNo,
      notify_url: this.notifyUrl,
      name,
      money: amount.toFixed(2),
    }
    params.sign = this.sign(params)
    params.sign_type = 'MD5'
    try {
      const query = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
      const res = await fetch(`${this.gateway}/mapi.php?${query}`)
      const data = await res.json()
      if (data.code === 1) {
        return { success: true, payUrl: data.payurl || data.qrcode || data.urlscheme, tradeNo: data.trade_no }
      }
      return { success: false, error: data.msg || '创建订单失败' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }

  /**
   * 查询订单
   */
  async queryOrder(outTradeNo) {
    if (!this.isConfigured()) throw new Error('易支付未配置')
    const params = { act: 'order', pid: this.pid, out_trade_no: outTradeNo }
    params.sign = this.sign(params)
    params.sign_type = 'MD5'
    const query = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    const res = await fetch(`${this.gateway}/api.php?${query}`)
    return await res.json()
  }

  /**
   * 处理回调
   */
  handleNotify(params) {
    if (!this.verifySign(params)) throw new Error('易支付签名验证失败')
    return {
      outTradeNo: params.out_trade_no,
      tradeNo: params.trade_no,
      tradeStatus: params.trade_status === 'TRADE_SUCCESS' ? 'SUCCESS' : params.trade_status,
      totalAmount: parseFloat(params.money || 0),
      payType: params.type,
    }
  }
}

// ==================== 码支付 (VMQPAY/CodePay) ====================

class CodePay {
  constructor() {
    this.gateway = process.env.CODEPAY_GATEWAY || '' // 如: https://codepay.example.com
    this.id = process.env.CODEPAY_ID || ''
    this.key = process.env.CODEPAY_KEY || ''
    this.notifyUrl = process.env.CODEPAY_NOTIFY_URL || ''
    this.returnUrl = process.env.CODEPAY_RETURN_URL || ''
  }

  isConfigured() {
    return !!(this.gateway && this.id && this.key)
  }

  /**
   * MD5签名
   */
  sign(params) {
    const str = Object.keys(params).sort()
      .filter(k => params[k] !== '' && params[k] !== undefined && k !== 'sign')
      .map(k => `${k}=${params[k]}`)
      .join('&')
    return crypto.createHash('md5').update(str + this.key).digest('hex')
  }

  verifySign(params) {
    const sign = params.sign
    const str = Object.keys(params).sort()
      .filter(k => params[k] !== '' && params[k] !== undefined && k !== 'sign')
      .map(k => `${k}=${params[k]}`)
      .join('&')
    return sign === crypto.createHash('md5').update(str + this.key).digest('hex')
  }

  /**
   * 创建支付 — 返回跳转URL
   * @param {string} outTradeNo - 订单号
   * @param {number} amount - 金额（元）
   * @param {number} payType - 1=微信 2=支付宝 3=QQ
   * @param {string} name - 商品名称
   */
  createPayUrl(outTradeNo, amount, payType = 2, name = '账户充值') {
    if (!this.isConfigured()) throw new Error('码支付未配置')
    const params = {
      id: this.id,
      pay_id: outTradeNo,
      type: payType,
      price: amount.toFixed(2),
      param: '',
      notify_url: this.notifyUrl,
      return_url: this.returnUrl,
    }
    params.sign = this.sign(params)
    const query = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    return `${this.gateway}/pay/?${query}`
  }

  /**
   * 处理回调
   */
  handleNotify(params) {
    if (!this.verifySign(params)) throw new Error('码支付签名验证失败')
    return {
      outTradeNo: params.pay_id,
      tradeNo: params.trade_no || params.pay_no || '',
      tradeStatus: params.pay_no ? 'SUCCESS' : 'FAIL',
      totalAmount: parseFloat(params.money || params.price || 0),
      payType: params.type === '1' ? 'wxpay' : params.type === '2' ? 'alipay' : 'qqpay',
    }
  }
}

// ==================== 工具函数 ====================

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * 生成商户订单号
 * 格式: MA + yyyyMMddHHmmss + 6位随机数
 */
export function generateOutTradeNo() {
  const now = new Date()
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0')
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
  return `MA${dateStr}${random}`
}

// ==================== 统一支付接口 ====================

const wechatPay = new WechatPay()
const alipay = new Alipay()
const easyPay = new EasyPay()
const codePay = new CodePay()

/**
 * 获取支付渠道可用状态
 */
export function getPaymentChannels() {
  return {
    wechat: wechatPay.isConfigured(),
    alipay: alipay.isConfigured(),
    epay: easyPay.isConfigured(),
    codepay: codePay.isConfigured(),
  }
}

/**
 * 创建支付订单
 * @param {string} method - 'wechat' | 'alipay' | 'epay_alipay' | 'epay_wxpay' | 'codepay_alipay' | 'codepay_wxpay'
 * @param {string} outTradeNo - 商户订单号
 * @param {number} amount - 金额（元）
 * @param {string} description - 商品描述
 * @returns {Promise<object>} 支付信息
 */
export async function createPayment(method, outTradeNo, amount, description) {
  if (method === 'wechat') {
    if (!wechatPay.isConfigured()) throw new Error('微信支付未配置，请在管理后台配置微信支付参数')
    const totalFen = Math.round(amount * 100)
    const result = await wechatPay.createNativeOrder(outTradeNo, totalFen, description)
    return { method: 'wechat', type: 'qrcode', codeUrl: result.codeUrl, outTradeNo, amount }
  } else if (method === 'alipay') {
    if (!alipay.isConfigured()) throw new Error('支付宝未配置，请在管理后台配置支付宝参数')
    const formHtml = alipay.createPagePayForm(outTradeNo, amount, description)
    return { method: 'alipay', type: 'form', formHtml, outTradeNo, amount }
  } else if (method.startsWith('epay_')) {
    if (!easyPay.isConfigured()) throw new Error('易支付未配置，请在管理后台配置易支付参数')
    const payType = method === 'epay_wxpay' ? 'wxpay' : 'alipay'
    // 先尝试API方式获取二维码
    const apiResult = await easyPay.createPayApi(outTradeNo, amount, payType, description || '账户充值')
    if (apiResult.success && apiResult.payUrl) {
      return { method, type: 'redirect', payUrl: apiResult.payUrl, outTradeNo, amount }
    }
    // 降级到跳转方式
    const payUrl = easyPay.createPayUrl(outTradeNo, amount, payType, description || '账户充值')
    return { method, type: 'redirect', payUrl, outTradeNo, amount }
  } else if (method.startsWith('codepay_')) {
    if (!codePay.isConfigured()) throw new Error('码支付未配置，请在管理后台配置码支付参数')
    const payType = method === 'codepay_wxpay' ? 1 : 2
    const payUrl = codePay.createPayUrl(outTradeNo, amount, payType, description || '账户充值')
    return { method, type: 'redirect', payUrl, outTradeNo, amount }
  } else {
    throw new Error(`不支持的支付方式: ${method}`)
  }
}

/**
 * 处理微信支付回调
 */
export function handleWechatNotify(headers, rawBody) {
  return wechatPay.handleNotify(headers, rawBody)
}

/**
 * 处理支付宝回调
 */
export function handleAlipayNotify(params) {
  return alipay.handleNotify(params)
}

/**
 * 处理易支付回调
 */
export function handleEpayNotify(params) {
  return easyPay.handleNotify(params)
}

/**
 * 处理码支付回调
 */
export function handleCodePayNotify(params) {
  return codePay.handleNotify(params)
}

/**
 * 查询订单状态
 */
export async function queryPaymentStatus(method, outTradeNo) {
  if (method === 'wechat') {
    const result = await wechatPay.queryOrder(outTradeNo)
    return { tradeState: result.trade_state, tradeNo: result.transaction_id, amount: result.amount?.total ? result.amount.total / 100 : 0 }
  } else if (method === 'alipay') {
    const result = await alipay.queryOrder(outTradeNo)
    return { tradeState: result.trade_status, tradeNo: result.trade_no, amount: parseFloat(result.total_amount || 0) }
  } else if (method?.startsWith('epay_')) {
    const result = await easyPay.queryOrder(outTradeNo)
    return { tradeState: result.status === 1 ? 'SUCCESS' : 'NOTPAY', tradeNo: result.trade_no || '', amount: parseFloat(result.money || 0) }
  }
  // codepay没有查询接口，依赖回调
  return { tradeState: 'UNKNOWN', tradeNo: '', amount: 0 }
}

export { wechatPay, alipay, easyPay, codePay }

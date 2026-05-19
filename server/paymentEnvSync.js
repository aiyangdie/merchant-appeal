/**
 * 支付配置：.env / payment.secrets.env → payment_config 表 → payment.js 运行时
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPaymentConfigs, updatePaymentConfigs, setConfig, getSystemConfig } from './db.js'
import { reloadPaymentFromDb, getPaymentChannels } from './payment.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function getPaymentSiteBase() {
  const base = (
    process.env.PAYMENT_SITE_BASE_URL ||
    process.env.PUBLIC_SITE_URL ||
    (process.env.CORS_ORIGINS || '').split(',')[0] ||
    'https://appeal.aikex.ink'
  ).trim().replace(/\/$/, '')
  return base
}

/** 加载可选密钥文件（不提交 git） */
export function loadPaymentSecretsEnv() {
  const secretsPath = path.join(__dirname, 'payment.secrets.env')
  if (!fs.existsSync(secretsPath)) return false
  const content = fs.readFileSync(secretsPath, 'utf8')
  for (const line of content.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 1) continue
    const key = t.slice(0, i).trim()
    let val = t.slice(i + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (val && !process.env[key]) process.env[key] = val
  }
  return true
}

function envPairs() {
  return [
    { key: 'wx_enabled', env: null, derive: (m) => (isWechatReady(m) ? '1' : m.wx_enabled || '0') },
    { key: 'wx_mch_id', env: 'WECHAT_PAY_MCH_ID' },
    { key: 'wx_app_id', env: 'WECHAT_PAY_APP_ID' },
    { key: 'wx_api_v3_key', env: 'WECHAT_PAY_API_V3_KEY' },
    { key: 'wx_serial_no', env: 'WECHAT_PAY_SERIAL_NO' },
    { key: 'wx_private_key', env: 'WECHAT_PAY_PRIVATE_KEY', altEnv: 'WECHAT_PAY_PRIVATE_KEY_PATH' },
    { key: 'wx_notify_url', env: 'WECHAT_PAY_NOTIFY_URL', default: () => `${getPaymentSiteBase()}/api/payment/wechat/notify` },
    { key: 'wx_mode', env: null, default: () => 'production' },
    { key: 'ali_enabled', env: null, derive: (m) => (isAlipayReady(m) ? '1' : m.ali_enabled || '0') },
    { key: 'ali_app_id', env: 'ALIPAY_APP_ID' },
    { key: 'ali_private_key', env: 'ALIPAY_PRIVATE_KEY' },
    { key: 'ali_public_key', env: 'ALIPAY_PUBLIC_KEY' },
    { key: 'ali_gateway', env: null, default: () => 'https://openapi.alipay.com/gateway.do' },
    { key: 'ali_notify_url', env: 'ALIPAY_NOTIFY_URL', default: () => `${getPaymentSiteBase()}/api/payment/alipay/notify` },
    { key: 'ali_return_url', env: 'ALIPAY_RETURN_URL', default: () => `${getPaymentSiteBase()}/` },
    { key: 'ali_mode', env: null, default: () => 'production' },
  ]
}

function isWechatReady(m) {
  return !!(m.wx_mch_id && m.wx_app_id && m.wx_api_v3_key && m.wx_serial_no && m.wx_private_key)
}

function isAlipayReady(m) {
  return !!(m.ali_app_id && m.ali_private_key && m.ali_public_key)
}

function readEnvValue(spec) {
  if (spec.env && process.env[spec.env]?.trim()) return process.env[spec.env].trim()
  if (spec.altEnv && process.env[spec.altEnv]?.trim()) {
    const p = process.env[spec.altEnv].trim()
    if (p.includes('-----BEGIN')) return p
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8')
    return p
  }
  if (spec.default) return spec.default()
  return ''
}

/**
 * 将环境变量合并进 payment_config（仅填充空项，或 force 覆盖密钥类）
 * @param {{ forceSecrets?: boolean }} opts
 */
export async function syncPaymentEnvToDb(opts = {}) {
  const existing = await getPaymentConfigs()
  const map = Object.fromEntries(existing.map((r) => [r.config_key, r.config_value ?? '']))

  const draft = { ...map }
  for (const spec of envPairs()) {
    const fromEnv = readEnvValue(spec)
    if (fromEnv) draft[spec.key] = fromEnv
  }
  if (draft.wx_private_key && draft.wx_private_key.length < 200 && fs.existsSync(draft.wx_private_key)) {
    draft.wx_private_key = fs.readFileSync(draft.wx_private_key, 'utf8')
  }

  for (const spec of envPairs()) {
    if (spec.derive) draft[spec.key] = spec.derive(draft)
  }

  const updates = []
  const secretKeys = new Set([
    'wx_mch_id', 'wx_app_id', 'wx_api_v3_key', 'wx_serial_no', 'wx_private_key',
    'ali_app_id', 'ali_private_key', 'ali_public_key',
  ])
  const alwaysKeys = new Set(['wx_notify_url', 'ali_notify_url', 'ali_return_url', 'wx_mode', 'ali_mode', 'ali_gateway'])

  for (const spec of envPairs()) {
    const key = spec.key
    const next = draft[key] ?? ''
    const prev = map[key] ?? ''
    if (!next) continue
    if (alwaysKeys.has(key)) {
      if (next !== prev) updates.push({ config_key: key, config_value: next })
      continue
    }
    if (secretKeys.has(key) && opts.forceSecrets) {
      if (next !== prev) updates.push({ config_key: key, config_value: next })
      continue
    }
    if (!prev.trim()) updates.push({ config_key: key, config_value: next })
  }

  if (updates.length) await updatePaymentConfigs(updates)

  const channels = await reloadPaymentFromDb()
  return {
    updated: updates.map((u) => u.config_key),
    channels,
    wechatReady: isWechatReady(draft),
    alipayReady: isAlipayReady(draft),
    siteBase: getPaymentSiteBase(),
  }
}

/** 确保充值相关系统配置合理 */
export async function ensureRechargeDefaults() {
  const enabled = await getSystemConfig('recharge_enabled')
  if (enabled == null || enabled === '') {
    await setConfig('recharge_enabled', '1')
  }
}

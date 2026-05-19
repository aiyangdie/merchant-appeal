/**
 * 将管理后台 payment_config 同步到 payment.js 运行时实例
 */
import fs from 'fs'
import { getPaymentConfigs } from './db.js'

function pick(map, dbKey, envKey) {
  const fromDb = (map[dbKey] || '').trim()
  if (fromDb) return fromDb
  if (envKey) return (process.env[envKey] || '').trim()
  return ''
}

/** PEM 全文，或服务器上的证书/私钥文件路径 */
export function resolvePemOrPath(value) {
  if (!value || !String(value).trim()) return null
  const t = String(value).trim()
  if (t.includes('-----BEGIN')) return t
  try {
    if (fs.existsSync(t)) return fs.readFileSync(t, 'utf8')
  } catch {
    /* ignore */
  }
  return t
}

/**
 * @param {Record<string, string>} map
 */
export function mapToPaymentRuntime(map) {
  return {
    wechat: {
      enabled: map.wx_enabled === '1',
      disabledExplicit: map.wx_enabled === '0',
      mchId: pick(map, 'wx_mch_id', 'WECHAT_PAY_MCH_ID'),
      appId: pick(map, 'wx_app_id', 'WECHAT_PAY_APP_ID'),
      apiV3Key: pick(map, 'wx_api_v3_key', 'WECHAT_PAY_API_V3_KEY'),
      serialNo: pick(map, 'wx_serial_no', 'WECHAT_PAY_SERIAL_NO'),
      notifyUrl: pick(map, 'wx_notify_url', 'WECHAT_PAY_NOTIFY_URL'),
      privateKey: resolvePemOrPath(
        pick(map, 'wx_private_key', '') || (process.env.WECHAT_PAY_PRIVATE_KEY_PATH || '').trim()
      ),
      platformCert: resolvePemOrPath(pick(map, '', 'WECHAT_PAY_CERT_PATH')),
    },
    alipay: {
      enabled: map.ali_enabled === '1',
      disabledExplicit: map.ali_enabled === '0',
      appId: pick(map, 'ali_app_id', 'ALIPAY_APP_ID'),
      privateKey: resolvePemOrPath(pick(map, 'ali_private_key', 'ALIPAY_PRIVATE_KEY')),
      alipayPublicKey: resolvePemOrPath(pick(map, 'ali_public_key', 'ALIPAY_PUBLIC_KEY')),
      notifyUrl: pick(map, 'ali_notify_url', 'ALIPAY_NOTIFY_URL'),
      returnUrl: pick(map, 'ali_return_url', 'ALIPAY_RETURN_URL'),
      gateway: (map.ali_gateway || '').trim() || 'https://openapi.alipay.com/gateway.do',
    },
  }
}

export async function loadPaymentConfigMap() {
  const rows = await getPaymentConfigs()
  return Object.fromEntries(rows.map((r) => [r.config_key, r.config_value ?? '']))
}

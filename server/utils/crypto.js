/**
 * AES-256-GCM 加密/解密工具 + SHA-256 哈希
 * 用于加密存储敏感数据：手机号、姓名、API Key、支付密钥、私钥等
 */
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

/**
 * SHA-256 哈希（不可逆，用于索引查找）
 * 添加 ENCRYPT_KEY 作为 HMAC 密钥，防止彩虹表攻击
 */
export function hmacHash(plaintext) {
  if (!plaintext) return ''
  const key = getKey()
  return crypto.createHmac('sha256', key).update(plaintext.trim()).digest('hex')
}

function getKey() {
  const hex = process.env.ENCRYPT_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPT_KEY 必须为 64 位十六进制字符串（32 字节）')
  }
  return Buffer.from(hex, 'hex')
}

/**
 * 加密明文 → 返回 base64 密文（iv + tag + ciphertext）
 */
export function encrypt(plaintext) {
  if (!plaintext) return ''
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // 格式: iv(16) + tag(16) + ciphertext
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

/**
 * 解密 base64 密文 → 返回明文
 */
export function decrypt(cipherBase64) {
  if (!cipherBase64) return ''
  try {
    const key = getKey()
    const buf = Buffer.from(cipherBase64, 'base64')
    if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
      // 不是加密格式，可能是明文
      return cipherBase64
    }
    const iv = buf.subarray(0, IV_LENGTH)
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH)
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(ciphertext, null, 'utf8') + decipher.final('utf8')
  } catch {
    // 解密失败：如果原文看起来是加密数据（base64），说明密钥不匹配
    if (isEncrypted(cipherBase64)) {
      return '[数据待恢复]'
    }
    // 否则可能是明文，直接返回
    return cipherBase64
  }
}

/**
 * 尝试解密，失败返回 null（用于程序判断是否可解密）
 */
export function tryDecrypt(cipherBase64) {
  if (!cipherBase64) return null
  try {
    const key = getKey()
    const buf = Buffer.from(cipherBase64, 'base64')
    if (buf.length < IV_LENGTH + TAG_LENGTH + 1) return null
    const iv = buf.subarray(0, IV_LENGTH)
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH)
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(ciphertext, null, 'utf8') + decipher.final('utf8')
  } catch {
    return null
  }
}

/**
 * 判断一个值是否已经是加密后的格式
 */
export function isEncrypted(value) {
  if (!value) return false
  try {
    const buf = Buffer.from(value, 'base64')
    // 加密数据至少 iv(16) + tag(16) + 1 byte
    return buf.length >= IV_LENGTH + TAG_LENGTH + 1 && value === buf.toString('base64')
  } catch {
    return false
  }
}

/**
 * 安全加密：如果已经加密则不重复加密
 */
export function safeEncrypt(value) {
  if (!value) return ''
  if (isEncrypted(value)) return value
  return encrypt(value)
}

/**
 * 安全解密：如果不是加密格式则返回原文
 */
export function safeDecrypt(value) {
  if (!value) return ''
  return decrypt(value)
}

/**
 * 批量修复：用新密钥重新加密明文数据（用于密钥变更后的数据迁移）
 */
export function reEncrypt(plaintext) {
  if (!plaintext) return ''
  return encrypt(plaintext)
}

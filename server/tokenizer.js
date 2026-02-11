import { encodingForModel } from 'js-tiktoken'

// DeepSeek 使用与 GPT-4 兼容的 cl100k_base 编码
// 本地计算 token 数量，不依赖远程 API
let encoder = null

function getEncoder() {
  if (!encoder) {
    // cl100k_base 是 DeepSeek/GPT-4 系列通用的 tokenizer
    encoder = encodingForModel('gpt-4')
  }
  return encoder
}

/**
 * 计算文本的 token 数量
 * @param {string} text - 要计算的文本
 * @returns {number} token 数量
 */
export function countTokens(text) {
  if (!text) return 0
  try {
    const enc = getEncoder()
    return enc.encode(text).length
  } catch (err) {
    // 降级：按字符估算（中文约 1.5 token/字，英文约 0.25 token/词）
    console.warn('Tokenizer fallback:', err.message)
    const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
    const rest = text.length - cjk
    return Math.ceil(cjk * 1.5 + rest * 0.3)
  }
}

/**
 * 计算一组聊天消息的总 token 数量
 * @param {Array} messages - [{role, content}]
 * @returns {number} 总 token 数
 */
export function countMessagesTokens(messages) {
  let total = 0
  for (const msg of messages) {
    // 每条消息有 role + content 的开销（约 4 token 的格式开销）
    total += 4
    total += countTokens(msg.content || '')
    total += countTokens(msg.role || '')
  }
  // 对话整体还有一个 priming 开销
  total += 2
  return total
}

/**
 * 根据 token 用量计算费用
 * DeepSeek-Chat 参考价：
 *   输入: ¥0.001 / 1K tokens
 *   输出: ¥0.002 / 1K tokens
 * 最终费用 = (输入费 + 输出费) × multiplier
 * 设有最低消费保护（MIN_COST），防止费用过低
 *
 * @param {number} inputTokens - 输入 token 数
 * @param {number} outputTokens - 输出 token 数
 * @param {number} [multiplier=2] - 倍率（从系统配置读取）
 * @returns {{ cost: number, inputTokens: number, outputTokens: number, totalTokens: number }}
 */
export function calculateCost(inputTokens, outputTokens, multiplier = 2) {
  const INPUT_PRICE_PER_1K = 0.001   // ¥0.001 / 1K tokens (输入)
  const OUTPUT_PRICE_PER_1K = 0.002  // ¥0.002 / 1K tokens (输出)
  const MIN_COST = 0.01              // 最低消费 ¥0.01

  const inputCost = (inputTokens / 1000) * INPUT_PRICE_PER_1K
  const outputCost = (outputTokens / 1000) * OUTPUT_PRICE_PER_1K
  const rawCost = (inputCost + outputCost) * multiplier
  const cost = parseFloat(Math.max(rawCost, MIN_COST).toFixed(4))

  return {
    cost,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  }
}

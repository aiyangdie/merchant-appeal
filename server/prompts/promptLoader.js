/**
 * 已发布 Prompt 加载（带 TTL 缓存，发布时失效）
 */
import { getPromptByKey } from '../opsCenter.js'

const PROMPT_CACHE_TTL = 3 * 60 * 1000
const _cache = new Map()

export function invalidatePromptCache(promptKey = null) {
  if (promptKey) _cache.delete(promptKey)
  else _cache.clear()
}

/**
 * @param {string} promptKey
 * @param {string} fallback  DB 无内容时使用
 */
export async function loadPublishedPrompt(promptKey, fallback = '') {
  const hit = _cache.get(promptKey)
  if (hit && Date.now() - hit.ts < PROMPT_CACHE_TTL) {
    return hit.content || fallback
  }
  let content = fallback
  try {
    const row = await getPromptByKey(promptKey, 'published')
    if (row?.content && String(row.content).trim()) {
      content = String(row.content).trim()
    }
  } catch (e) {
    console.warn(`[PromptLoader] ${promptKey}:`, e.message)
  }
  _cache.set(promptKey, { content, ts: Date.now() })
  return content
}

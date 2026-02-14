// ========== AI 模型健康检测 + 自动切换引擎 ==========

import { getAIModels, getActiveAIModel, getHealthyFreeModels, getFallbackModels, updateModelHealth, setActiveAIModel } from './db.js'

// 单个模型健康检测（发送最小请求验证可用性）
async function checkModelHealth(model) {
  const start = Date.now()
  try {
    if (!model.api_key) {
      return { status: 'no_key', error: '未配置 API Key', responseMs: null }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000) // 15s超时

    const res = await fetch(model.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.api_key}`,
      },
      body: JSON.stringify({
        model: model.model_name,
        messages: [{ role: 'user', content: '你好' }],
        max_tokens: 5,
        temperature: 0,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const responseMs = Date.now() - start

    if (res.ok) {
      return { status: 'healthy', error: null, responseMs }
    }

    // 解析错误
    let errMsg = `HTTP ${res.status}`
    try {
      const body = await res.json()
      errMsg = body.error?.message || body.error?.code || JSON.stringify(body.error || body).substring(0, 200)
    } catch {}

    // 区分可恢复和不可恢复错误
    if (res.status === 429) return { status: 'rate_limited', error: `限流: ${errMsg}`, responseMs }
    if (res.status === 401 || res.status === 403) return { status: 'auth_failed', error: `认证失败: ${errMsg}`, responseMs: null }
    if (res.status === 402) return { status: 'balance_empty', error: `余额不足: ${errMsg}`, responseMs: null }
    return { status: 'error', error: errMsg, responseMs: null }
  } catch (err) {
    const responseMs = Date.now() - start
    if (err.name === 'AbortError') return { status: 'timeout', error: '连接超时(15s)', responseMs }
    return { status: 'error', error: err.message?.substring(0, 200) || '未知错误', responseMs: null }
  }
}

// 批量检测所有启用的模型
export async function checkAllModels() {
  const models = await getAIModels()
  const enabled = models.filter(m => m.is_enabled)
  const results = []

  for (const model of enabled) {
    if (!model.api_key) {
      await updateModelHealth(model.id, { status: 'no_key', error: '未配置 API Key' })
      results.push({ id: model.id, name: model.display_name, status: 'no_key' })
      continue
    }

    console.log(`[健康检测] 检测 ${model.display_name}...`)
    const result = await checkModelHealth(model)
    await updateModelHealth(model.id, result)
    results.push({ id: model.id, name: model.display_name, ...result })
    console.log(`[健康检测] ${model.display_name}: ${result.status}${result.responseMs ? ` (${result.responseMs}ms)` : ''}${result.error ? ` - ${result.error}` : ''}`)

    // 避免触发限流，间隔500ms
    await new Promise(r => setTimeout(r, 500))
  }

  return results
}

// 检测单个模型并更新状态
export async function checkSingleModel(modelId) {
  const models = await getAIModels()
  const model = models.find(m => m.id === modelId)
  if (!model) return { error: '模型不存在' }
  
  const result = await checkModelHealth(model)
  await updateModelHealth(model.id, result)
  return { id: model.id, name: model.display_name, ...result }
}

// ========== 核心：智能自动切换 ==========

/**
 * 当当前活跃模型不可用时，自动切换到下一个可用的免费模型
 * 优先级：健康的免费模型 > 限流的免费模型(可能短暂恢复) > 付费模型
 * 自定义Key用户不走这个逻辑（用户自己的Key直接用）
 */
export async function autoSwitchIfNeeded() {
  const active = await getActiveAIModel()
  if (!active) {
    console.log('[自动切换] 无活跃模型，尝试找一个可用的...')
    return await findAndActivateBestModel()
  }

  // 当前模型健康，无需切换
  if (active.health_status === 'healthy' || active.health_status === 'unknown') {
    return null
  }

  // 当前模型不健康，连续失败>=2次才切换（避免偶发抖动）
  if (active.consecutive_fails < 2) {
    return null
  }

  console.log(`[自动切换] 当前模型 ${active.display_name} 状态: ${active.health_status}(连续失败${active.consecutive_fails}次)，尝试切换...`)
  return await findAndActivateBestModel(active.id)
}

async function findAndActivateBestModel(excludeId) {
  // 优先找免费且健康的
  const freeModels = await getHealthyFreeModels()
  const healthyFree = freeModels.filter(m => m.health_status === 'healthy' && m.id !== excludeId)
  
  if (healthyFree.length > 0) {
    const best = healthyFree[0]
    await setActiveAIModel(best.id)
    console.log(`[自动切换] ✅ 已切换到免费模型: ${best.display_name}`)
    return { switched: true, model: best.display_name, reason: '免费且健康' }
  }

  // 其次找免费但状态未知的（可能还没检测过）
  const unknownFree = freeModels.filter(m => m.health_status === 'unknown' && m.id !== excludeId)
  if (unknownFree.length > 0) {
    // 先检测一下
    for (const model of unknownFree) {
      const result = await checkModelHealth(model)
      await updateModelHealth(model.id, result)
      if (result.status === 'healthy') {
        await setActiveAIModel(model.id)
        console.log(`[自动切换] ✅ 检测并切换到免费模型: ${model.display_name}`)
        return { switched: true, model: model.display_name, reason: '免费，刚检测可用' }
      }
    }
  }

  // 最后找付费但有Key且健康的（fallback）
  const fallbacks = await getFallbackModels(excludeId)
  const healthyPaid = fallbacks.filter(m => m.health_status === 'healthy' && !m.is_free)
  if (healthyPaid.length > 0) {
    const best = healthyPaid[0]
    await setActiveAIModel(best.id)
    console.log(`[自动切换] ⚠️ 已切换到付费模型: ${best.display_name}（所有免费模型不可用）`)
    return { switched: true, model: best.display_name, reason: '免费模型均不可用，切换付费' }
  }

  console.log('[自动切换] ❌ 没有可用的备选模型')
  return { switched: false, reason: '没有可用的备选模型' }
}

// ========== AI调用失败时的实时fallback ==========

/**
 * 带自动fallback的AI调用包装器
 * 如果当前模型调用失败，自动标记故障+切换到备选模型+重试
 */
export async function callWithFallback(callFn, customApiKey = null) {
  // 自定义Key用户直接调用，不走fallback
  if (customApiKey) {
    return await callFn(customApiKey)
  }

  try {
    const result = await callFn(null)
    // 调用成功，标记当前模型为健康
    const active = await getActiveAIModel()
    if (active && active.health_status !== 'healthy') {
      await updateModelHealth(active.id, { status: 'healthy', responseMs: null })
    }
    return result
  } catch (err) {
    // 调用失败，标记故障
    const active = await getActiveAIModel()
    if (active) {
      await updateModelHealth(active.id, { status: 'error', error: err.message })
    }

    // 尝试自动切换
    const switchResult = await autoSwitchIfNeeded()
    if (switchResult?.switched) {
      // 用新模型重试一次
      try {
        console.log(`[Fallback] 使用新模型 ${switchResult.model} 重试...`)
        return await callFn(null)
      } catch (retryErr) {
        console.error(`[Fallback] 重试也失败:`, retryErr.message)
        throw retryErr
      }
    }

    throw err
  }
}

// ========== 定时健康巡检 ==========

let healthCheckInterval = null

export function startHealthScheduler(intervalMinutes = 30) {
  if (healthCheckInterval) clearInterval(healthCheckInterval)
  
  const ms = intervalMinutes * 60 * 1000
  console.log(`[健康巡检] 每 ${intervalMinutes} 分钟自动检测所有模型`)

  // 启动后延迟30秒执行首次检测
  setTimeout(async () => {
    try {
      console.log('[健康巡检] 首次检测开始...')
      const results = await checkAllModels()
      const healthy = results.filter(r => r.status === 'healthy').length
      console.log(`[健康巡检] 首次检测完成: ${healthy}/${results.length} 个模型健康`)
      
      // 首次检测后尝试自动切换
      await autoSwitchIfNeeded()
    } catch (e) { console.error('[健康巡检] 首次检测失败:', e.message) }
  }, 30000)

  // 定时检测
  healthCheckInterval = setInterval(async () => {
    try {
      console.log('[健康巡检] 定时检测开始...')
      const results = await checkAllModels()
      const healthy = results.filter(r => r.status === 'healthy').length
      console.log(`[健康巡检] 定时检测完成: ${healthy}/${results.length} 个模型健康`)
      await autoSwitchIfNeeded()
    } catch (e) { console.error('[健康巡检] 定时检测失败:', e.message) }
  }, ms)
}

export function stopHealthScheduler() {
  if (healthCheckInterval) { clearInterval(healthCheckInterval); healthCheckInterval = null }
}

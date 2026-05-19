import { getAIConfig } from '../../shared/aiConfig.js'
import logger from '../../utils/logger.js'
import fetch from 'node-fetch'
import { getPool } from '../../db.js'

const VOLCENGINE_PROVIDERS = ['volcengine', 'doubao']
const DEFAULT_TIMEOUT = 120000
const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3'
const SPEED_OPTIMIZED_PARAMS = {
  temperature: 0.3,
  top_p: 0.7,
  frequency_penalty: 0.0,
  presence_penalty: 0.0,
}

class LLMService {
  constructor() {
    this._prefixCacheMap = new Map()
    this._cacheInitPromise = null
  }

  async getConfig(userId = null) {
    const config = await getAIConfig()
    return config
  }

  _isVolcengine(provider) {
    return VOLCENGINE_PROVIDERS.includes(provider?.toLowerCase())
  }

  _resolveModel(config) {
    if (this._isVolcengine(config.provider) && config.endpointId) {
      return config.endpointId
    }
    return config.model
  }

  async ensurePrefixCache(cacheKey, systemPrompt, ttl = 86400) {
    const config = await this.getConfig()
    if (!this._isVolcengine(config.provider) || !config.endpointId) {
      logger.info(`[LLM] skip prefix cache: not volcengine or no endpointId`)
      return null
    }

    const cached = this._prefixCacheMap.get(cacheKey)
    if (cached && Date.now() - cached.createdAt < (ttl - 300) * 1000) {
      logger.info(`[LLM] prefix cache hit: key=${cacheKey} contextId=${cached.contextId}`)
      return cached.contextId
    }

    try {
      logger.info(`[LLM] creating prefix cache: key=${cacheKey} model=${config.endpointId} promptLen=${systemPrompt.length}`)
      const response = await fetch(`${ARK_BASE}/context/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.endpointId,
          messages: [{ role: 'system', content: systemPrompt }],
          mode: 'common_prefix',
          ttl,
        }),
        timeout: 30000,
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        logger.warn(`[LLM] prefix cache create failed: ${response.status} ${errText.slice(0, 200)}`)
        return null
      }

      const data = await response.json()
      const contextId = data.id
      if (!contextId) {
        logger.warn(`[LLM] prefix cache create returned no id: ${JSON.stringify(data).slice(0, 200)}`)
        return null
      }

      this._prefixCacheMap.set(cacheKey, { contextId, createdAt: Date.now() })
      logger.info(`[LLM] prefix cache created: key=${cacheKey} contextId=${contextId} prompt_tokens=${data.usage?.prompt_tokens || 0}`)
      return contextId
    } catch (err) {
      logger.warn(`[LLM] prefix cache create error: ${err.message}`)
      return null
    }
  }

  async completeChatWithCache(cacheKey, systemPrompt, userMessages, options = {}) {
    const contextId = await this.ensurePrefixCache(cacheKey, systemPrompt)
    if (!contextId) {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...userMessages,
      ]
      return this.completeChat(messages, options)
    }

    const config = await this.getConfig()
    if (!config.apiKey) throw new Error('AI API Key not configured')

    const {
      temperature = SPEED_OPTIMIZED_PARAMS.temperature,
      maxTokens = 4096,
      enableDeepThinking = false,
      prefill = null,
    } = options

    const body = {
      context_id: contextId,
      model: this._resolveModel(config),
      messages: userMessages,
      temperature,
      top_p: SPEED_OPTIMIZED_PARAMS.top_p,
      max_tokens: maxTokens,
      frequency_penalty: SPEED_OPTIMIZED_PARAMS.frequency_penalty,
      presence_penalty: SPEED_OPTIMIZED_PARAMS.presence_penalty,
    }

    if (this._isVolcengine(config.provider)) {
      body.thinking = { type: enableDeepThinking ? 'enabled' : 'disabled' }
      body.service_tier = 'auto'
    }

    if (prefill) {
      body.messages.push({ role: 'assistant', content: prefill })
    }

    const startTime = Date.now()

    logger.info(`[LLM] completeChatWithCache: contextId=${contextId} model=${body.model} thinking=${enableDeepThinking ? 'on' : 'off'} temp=${temperature} max_tokens=${maxTokens}`)

    const response = await fetch(`${ARK_BASE}/context/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      timeout: DEFAULT_TIMEOUT,
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      const friendlyMsg = this._formatError(response.status, errText, config)
      logger.warn(`[LLM] cache chat failed, falling back to normal: ${friendlyMsg}`)
      this._prefixCacheMap.delete(cacheKey)
      const messages = [
        { role: 'system', content: systemPrompt },
        ...userMessages,
      ]
      return this.completeChat(messages, options)
    }

    const json = await response.json()
    const totalTime = Date.now() - startTime
    const cachedTokens = json.usage?.prompt_tokens_details?.cached_tokens || 0
    logger.info(`[LLM] completeChatWithCache done: ${totalTime}ms cached=${cachedTokens} usage=${JSON.stringify(json.usage)}`)

    if (json.usage) {
      this._logUsage(config, json.usage, options.requestType || 'copywriting').catch(() => {})
    }

    const content = json.choices?.[0]?.message?.content || ''
    return prefill ? prefill + content : content
  }

  _buildRequestBody(config, messages, options = {}) {
    const {
      stream = false,
      temperature = SPEED_OPTIMIZED_PARAMS.temperature,
      maxTokens = 4096,
      jsonMode = false,
      enableDeepThinking = false,
      stop = null,
      prefill = null,
    } = options

    const model = this._resolveModel(config)

    const body = {
      model,
      messages,
      stream,
      temperature,
      top_p: SPEED_OPTIMIZED_PARAMS.top_p,
      max_tokens: maxTokens,
      frequency_penalty: SPEED_OPTIMIZED_PARAMS.frequency_penalty,
      presence_penalty: SPEED_OPTIMIZED_PARAMS.presence_penalty,
    }

    if (stop && stop.length > 0) {
      body.stop = stop.slice(0, 4)
    }

    if (this._isVolcengine(config.provider)) {
      body.thinking = { type: enableDeepThinking ? 'enabled' : 'disabled' }
      body.service_tier = 'auto'
      if (stream) {
        body.stream_options = { include_usage: true, chunk_include_usage: false }
      }
    }

    if (jsonMode && !stream) {
      body.response_format = { type: 'json_object' }
    }

    logger.info(`[LLM] buildRequest model=${model} provider=${config.provider} endpointId=${config.endpointId || 'none'} thinking=${enableDeepThinking ? 'enabled' : 'disabled'} temp=${temperature} top_p=${body.top_p} max_tokens=${maxTokens} stream=${stream} jsonMode=${jsonMode} prefill=${prefill ? 'yes' : 'no'}`)

    return body
  }

  _buildMessages(messages, options = {}) {
    const { prefill = null } = options
    if (!prefill) return messages

    const result = [...messages]
    result.push({ role: 'assistant', content: prefill })
    return result
  }

  async streamChat(messages, res, onComplete, options = {}) {
    const config = await this.getConfig();
    if (!config.apiKey) {
      res.write('Error: AI API Key not configured');
      res.end();
      return;
    }

    try {
      const cacheKey = options.cacheKey || null
      let contextId = null
      let effectiveMessages = messages

      if (cacheKey && this._isVolcengine(config.provider) && config.endpointId) {
        const systemMsg = messages.find(m => m.role === 'system')
        if (systemMsg) {
          contextId = await this.ensurePrefixCache(cacheKey, systemMsg.content)
          if (contextId) {
            effectiveMessages = messages.filter(m => m.role !== 'system')
            logger.info(`[LLM] streamChat using prefix cache: key=${cacheKey} contextId=${contextId}`)
          }
        }
      }

      const finalMessages = this._buildMessages(effectiveMessages, options)
      const body = this._buildRequestBody(config, finalMessages, { ...options, stream: true, temperature: config.temperature || SPEED_OPTIMIZED_PARAMS.temperature })

      if (contextId) {
        body.context_id = contextId
      }

      const endpoint = contextId
        ? `${ARK_BASE}/context/chat/completions`
        : config.endpoint

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(body),
        timeout: DEFAULT_TIMEOUT,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        const friendlyMsg = this._formatError(response.status, errText, config)
        throw new Error(friendlyMsg);
      }

      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
      }

      let fullText = ''
      let buffer = ''
      let firstTokenTime = null
      let streamUsage = null
      const startTime = Date.now()
      const prefill = options.prefill || null

      const processSSELine = (trimmed) => {
        if (!trimmed || !trimmed.startsWith('data: ')) return
        if (trimmed === 'data: [DONE]') return
        try {
          const json = JSON.parse(trimmed.slice(6))
          const delta = json.choices?.[0]?.delta
          if (delta) {
            const content = delta.content || ''
            const thinkingContent = delta.reasoning_content || delta.thinking || ''
            if (content) {
              if (!firstTokenTime) firstTokenTime = Date.now() - startTime
              fullText += content
              res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`)
            }
            if (thinkingContent) {
              res.write(`data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: thinkingContent } }] })}\n\n`)
            }
          }
          if (json.usage) {
            streamUsage = json.usage
            this._logUsage(config, json.usage, options.requestType || 'chat').catch(() => {})
          }
        } catch {}
      }

      if (response.body.on) {
        response.body.on('data', (chunk) => {
          buffer += chunk.toString()
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            processSSELine(line.trim())
          }
        })

        response.body.on('end', async () => {
          const totalTime = Date.now() - startTime
          logger.info(`[LLM] streamChat done: firstToken=${firstTokenTime}ms total=${totalTime}ms chars=${fullText.length} thinking=${options.enableDeepThinking ? 'on' : 'off'}`)
          try {
            if (onComplete) await onComplete(prefill ? prefill + fullText : fullText, { usage: streamUsage })
          } catch (cbErr) {
            logger.error(`[LLM] onComplete error: ${cbErr.message}`)
          }
          if (!res.writableEnded) res.end()
        })

        response.body.on('error', (err) => {
          logger.error('Stream Error', err)
          if (!res.writableEnded) res.end()
        });
      } else if (response.body?.getReader) {
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            processSSELine(line.trim())
          }
        }
        const totalTime = Date.now() - startTime
        logger.info(`[LLM] streamChat done: firstToken=${firstTokenTime}ms total=${totalTime}ms chars=${fullText.length} thinking=${options.enableDeepThinking ? 'on' : 'off'}`)
        try {
          if (onComplete) await onComplete(prefill ? prefill + fullText : fullText, { usage: streamUsage })
        } catch (cbErr) {
          logger.error(`[LLM] onComplete error: ${cbErr.message}`)
        }
        if (!res.writableEnded) res.end()
      } else {
        const text = await response.text()
        const lines = text.split('\n')
        for (const line of lines) {
          processSSELine(line.trim())
        }
        res.write('data: [DONE]\n\n')
        try {
          if (onComplete) await onComplete(prefill ? prefill + fullText : fullText, { usage: streamUsage })
        } catch (cbErr) {
          logger.error(`[LLM] onComplete error: ${cbErr.message}`)
        }
        if (!res.writableEnded) res.end()
      }

    } catch (error) {
      logger.error('LLM Call Error', error);
      if (!res.headersSent) {
        res.write(`data: {"error": "${error.message}"}\n\n`);
      }
      res.end();
    }
  }

  async completeChat(messages, options = {}) {
    const config = await this.getConfig();
    if (!config.apiKey) throw new Error('AI API Key not configured');

    const finalMessages = this._buildMessages(messages, options)
    const body = this._buildRequestBody(config, finalMessages, { ...options, stream: false, temperature: config.temperature || SPEED_OPTIMIZED_PARAMS.temperature })

    const startTime = Date.now()

    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(body),
      timeout: DEFAULT_TIMEOUT,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      const friendlyMsg = this._formatError(response.status, errText, config)
      throw new Error(friendlyMsg);
    }

    const json = await response.json();
    const totalTime = Date.now() - startTime
    const cachedTokens = json.usage?.prompt_tokens_details?.cached_tokens || 0
    logger.info(`[LLM] completeChat done: ${totalTime}ms usage=${JSON.stringify(json.usage)} cached=${cachedTokens} thinking=${options.enableDeepThinking ? 'on' : 'off'}`)
    if (json.usage) {
      this._logUsage(config, json.usage, options.requestType || 'chat').catch(() => {})
    }

    const content = json.choices?.[0]?.message?.content || ''
    const prefill = options.prefill || null
    return prefill ? prefill + content : content
  }

  _formatError(status, errText, config) {
    const isVc = this._isVolcengine(config.provider)
    try {
      const errJson = JSON.parse(errText)
      const code = errJson.error?.code || ''
      const msg = errJson.error?.message || errText.slice(0, 200)

      if (isVc && code === 'InvalidEndpointOrModel.NotFound') {
        return `模型未开通或Endpoint不存在。请在火山方舟控制台开通模型(https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement)，或配置ARK_ENDPOINT_ID。当前model=${config.model} endpointId=${config.endpointId || '未配置'}`
      }
      if (isVc && code === 'ModelNotOpen') {
        return `模型未开通。请在火山方舟控制台开通模型服务(https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement)。`
      }
      return `AI API Error ${status}: ${msg}`
    } catch {
      return `AI API Error ${status}: ${errText.slice(0, 200)}`
    }
  }

  async _logUsage(config, usage, requestType = 'chat', trackOpts = {}) {
    if (!usage) return
    try {
      const { trackAIUsage, isUsageTrackerReady } = await import('../usageTracker.js')
      if (isUsageTrackerReady()) {
        await trackAIUsage({
          userId: trackOpts.userId ?? 0,
          sessionId: trackOpts.sessionId ?? null,
          type: requestType || 'chat',
          usage,
          isOfficialMode: !!trackOpts.isOfficialMode,
          provider: config.provider,
          modelName: config.model,
          modelId: trackOpts.modelId || 0,
        })
        return
      }
    } catch (e) {
      console.error('[LLM] usageTracker:', e.message)
    }
    const promptT = usage.prompt_tokens || 0
    const completionT = usage.completion_tokens || 0
    const totalT = usage.total_tokens || promptT + completionT
    const isVc = this._isVolcengine(config.provider)
    const inputPrice = isVc ? 2 : (config.provider === 'deepseek' ? 1 : 5)
    const outputPrice = isVc ? 8 : (config.provider === 'deepseek' ? 2 : 15)
    const costYuan = (promptT * inputPrice + completionT * outputPrice) / 1000000
    const _pool = getPool()
    if (_pool) {
      _pool.execute(
        'INSERT INTO token_usage_logs (model_id, provider, model_name, prompt_tokens, completion_tokens, total_tokens, request_type, cost_yuan) VALUES (0, ?, ?, ?, ?, ?, ?, ?)',
        [config.provider, config.model, promptT, completionT, totalT, requestType, costYuan]
      ).catch(e => console.error('[TokenUsage] log error:', e.message))
    }
  }
}

export default new LLMService();

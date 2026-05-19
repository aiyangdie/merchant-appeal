import { getSystemConfig, getActiveAIModel } from '../db.js'

const PROVIDER_PRESETS = {
  deepseek: { endpoint: 'https://api.deepseek.com/chat/completions', defaultModel: 'deepseek-chat' },
  zhipu:    { endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', defaultModel: 'glm-4-flash' },
  siliconflow: { endpoint: 'https://api.siliconflow.cn/v1/chat/completions', defaultModel: 'Qwen/Qwen2.5-7B-Instruct' },
  openai:   { endpoint: 'https://api.openai.com/v1/chat/completions', defaultModel: 'gpt-4o-mini' },
  moonshot: { endpoint: 'https://api.moonshot.cn/v1/chat/completions', defaultModel: 'moonshot-v1-8k' },
  qwen:     { endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', defaultModel: 'qwen-plus' },
  baidu:    { endpoint: 'https://qianfan.baidubce.com/v2/chat/completions', defaultModel: 'ernie-speed-128k' },
  minimax:  { endpoint: 'https://api.minimax.chat/v1/text/chatcompletion_v2', defaultModel: 'abab6.5s-chat' },
  groq:     { endpoint: 'https://api.groq.com/openai/v1/chat/completions', defaultModel: 'llama-3.3-70b-versatile' },
  together: { endpoint: 'https://api.together.xyz/v1/chat/completions', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  volcengine: { endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', defaultModel: 'deepseek-v3-2-251201' },
  doubao:   { endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', defaultModel: 'doubao-lite-32k' },
}

function getProviderPreset(provider) {
  return PROVIDER_PRESETS[provider?.toLowerCase()] || {
    endpoint: `https://api.${provider}.com/v1/chat/completions`,
    defaultModel: 'default',
  }
}

function _getArkEnvConfig() {
  const apiKey = process.env.ARK_API_KEY
  if (!apiKey || apiKey.trim().length < 10) return null
  return {
    provider: 'volcengine',
    apiKey: apiKey.trim(),
    model: process.env.ARK_MODEL_ID || 'deepseek-v3-2-251201',
    endpoint: process.env.ARK_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    endpointId: process.env.ARK_ENDPOINT_ID || '',
    timeout: parseInt(process.env.ARK_TIMEOUT || '120') * 1000,
  }
}

async function resolveProviderApiKey(provider, dbApiKey, customApiKey) {
  if (customApiKey) return customApiKey
  if (dbApiKey) return dbApiKey
  const p = (provider || '').toLowerCase()
  const fromSys = await getSystemConfig(`${p}_api_key`)
  if (fromSys) return fromSys
  const envByProvider = {
    deepseek: process.env.DEEPSEEK_API_KEY,
    zhipu: process.env.ZHIPU_API_KEY,
    siliconflow: process.env.SILICONFLOW_API_KEY,
    openai: process.env.OPENAI_API_KEY,
  }
  if (envByProvider[p]) return envByProvider[p]
  if (['volcengine', 'doubao'].includes(p)) return process.env.ARK_API_KEY || ''
  return ''
}

export async function getAIConfig(customApiKey = null) {
  const temperature = parseFloat((await getSystemConfig('ai_temperature')) || '0.3')

  const active = await getActiveAIModel()
  if (active) {
    const dbApiKey = await resolveProviderApiKey(active.provider, active.api_key, customApiKey)
    if (['volcengine', 'doubao'].includes(active.provider?.toLowerCase()) && !dbApiKey) {
      const arkEnv = _getArkEnvConfig()
      if (arkEnv) {
        return {
          provider: active.provider,
          apiKey: arkEnv.apiKey,
          model: active.model_name || arkEnv.model,
          endpoint: active.endpoint || arkEnv.endpoint,
          endpointId: arkEnv.endpointId,
          temperature,
          timeout: arkEnv.timeout,
        }
      }
    }
    return {
      provider: active.provider,
      apiKey: dbApiKey,
      model: active.model_name,
      endpoint: active.endpoint || getProviderPreset(active.provider).endpoint,
      endpointId: '',
      temperature,
    }
  }

  const arkEnv = _getArkEnvConfig()
  if (arkEnv) {
    return {
      ...arkEnv,
      temperature,
    }
  }

  const provider = (await getSystemConfig('ai_provider')) || 'deepseek'
  const preset = getProviderPreset(provider)
  const legacyKey = await resolveProviderApiKey(provider, '', customApiKey)
  const legacyModel = await getSystemConfig(`${provider}_model`)

  return {
    provider,
    apiKey: legacyKey,
    model: legacyModel || preset.defaultModel,
    endpoint: preset.endpoint,
    temperature,
  }
}

import { addOfficialUsage } from '../billing.js'
import { stripEmoji } from './textUtils.js'

export async function simulateTypingSSE(res, text, chunkSize = 3, delayMs = 18) {
  const cleaned = stripEmoji(text)
  for (let i = 0; i < cleaned.length; i += chunkSize) {
    const chunk = cleaned.slice(i, i + chunkSize)
    res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
    await new Promise(r => setTimeout(r, delayMs))
  }
}

export async function pipeAIStream(res, streamResult, {
  isOfficialMode,
  user,
  sessionId,
  usageType,
  safeSend,
  isDisconnected,
  turnBilling,
  multiplier,
  recordTokenUsage: recordUsageFn,
}) {
  const send = safeSend || ((data) => { if (!res.writableEnded) res.write(data) })
  const disconnected = () => (typeof isDisconnected === 'function' ? isDisconnected() : false)

  const reader = streamResult.body.getReader()
  const decoder = new TextDecoder()
  let fullContent = ''
  let buffer = ''
  let usageHandled = false

  try {
    while (true) {
      if (disconnected()) {
        try { await reader.cancel() } catch { /* ignore */ }
        break
      }
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (disconnected()) break
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          const rawDelta = parsed.choices?.[0]?.delta?.content || ''
          if (rawDelta) {
            fullContent += rawDelta
            const delta = stripEmoji(rawDelta)
            if (delta) send(`data: ${JSON.stringify({ type: 'chunk', content: delta })}\n\n`)
          }
          if (parsed.usage && !usageHandled && !disconnected()) {
            usageHandled = true
            const inputTokens = parsed.usage.prompt_tokens || streamResult.inputTokens
            const outputTokens = parsed.usage.completion_tokens || 0
            if (user) {
              await addOfficialUsage(turnBilling, {
                isOfficialMode,
                multiplier,
                type: usageType || 'chat',
                inputTokens,
                outputTokens,
                userId: user.id,
                sessionId,
                recordTokenUsage: recordUsageFn,
              })
            }
          }
        } catch { /* ignore parse errors */ }
      }
    }
  } finally {
    try { reader.releaseLock?.() } catch { /* ignore */ }
  }

  if (fullContent && user && !usageHandled && !disconnected()) {
    const { countTokens } = await import('../tokenizer.js')
    const outputTokens = countTokens(fullContent)
    await addOfficialUsage(turnBilling, {
      isOfficialMode,
      multiplier,
      type: usageType || 'chat',
      inputTokens: streamResult.inputTokens,
      outputTokens,
      userId: user.id,
      sessionId,
      recordTokenUsage: recordUsageFn,
    })
  }

  return fullContent
}

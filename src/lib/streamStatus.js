/** 流式对话状态文案（与屏幕可见文字严格同步，不做假加速） */
export function formatElapsed(ms) {
  if (ms == null || ms < 0) return '0.0s'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function getStreamStatusLabel(status) {
  if (!status) return ''
  const model = status.model || 'AI 模型'
  const elapsed = formatElapsed(status.elapsedMs)
  const chars = status.displayedChars ?? status.receivedChars ?? 0

  switch (status.phase) {
    case 'preparing':
      return `准备上下文 · ${elapsed}`
    case 'connecting':
      return `连接 ${model} · ${elapsed}`
    case 'waiting':
      if (status.connectMs != null) {
        const thinkMs = Math.max(0, (status.elapsedMs || 0) - status.connectMs)
        return `${model} 思考中 · ${formatElapsed(thinkMs)}（连接 ${formatElapsed(status.connectMs)}）`
      }
      return `${model} 思考中 · ${elapsed}`
    case 'outputting':
      if (chars > 0) {
        const parts = [`已输出 ${chars} 字`]
        if (status.firstChunkMs != null) parts.push(`首字 ${formatElapsed(status.firstChunkMs)}`)
        if (status.outputElapsedMs != null) parts.push(`输出 ${formatElapsed(status.outputElapsedMs)}`)
        return parts.join(' · ')
      }
      return `等待首字 · ${elapsed}`
    case 'done':
      if (status.totalMs != null) {
        const parts = [`完成 ${formatElapsed(status.totalMs)}`]
        if (status.firstChunkMs != null) parts.push(`首字 ${formatElapsed(status.firstChunkMs)}`)
        if (chars > 0) parts.push(`${chars} 字`)
        return parts.join(' · ')
      }
      return `完成 · ${elapsed}`
    default:
      return `处理中 · ${elapsed}`
  }
}

/** 仅等待阶段在输入框上方显示；有正文后不再重复计数 */
export function shouldShowInputStreamHint(status) {
  if (!status) return false
  return ['preparing', 'connecting', 'waiting'].includes(status.phase)
}

export function shouldShowBubbleStreamStatus(status, contentLength) {
  if (!status) return false
  if (contentLength > 0) return false
  return ['preparing', 'connecting', 'waiting'].includes(status.phase)
}

export function getStreamStatusHint(status) {
  if (!status) return ''
  if (['preparing', 'connecting', 'waiting'].includes(status.phase) && status.elapsedMs > 6000) {
    return '当前模型响应偏慢（如 Agnes），可在后台切换 DeepSeek-Chat'
  }
  return ''
}

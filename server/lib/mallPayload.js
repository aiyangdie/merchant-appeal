export function unwrapMallUsagePayload(result) {
  if (!result || typeof result !== 'object' || result._usage == null) {
    return { data: result, usage: null }
  }
  const { _usage, ...data } = result
  return { data, usage: _usage }
}

export function unwrapPersonaPayload(raw) {
  if (!raw) return { persona: null, usage: null }
  if (raw.persona && typeof raw.persona === 'object') {
    return { persona: raw.persona, usage: raw._usage || null }
  }
  return { persona: raw, usage: null }
}

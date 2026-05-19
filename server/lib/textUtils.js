/** 服务端文本清理（发给前端的文本） */
export function stripEmoji(text) {
  if (!text) return text
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[☐✅❓⚡⏳]/g, '')
    .replace(/^[ \t]*[•·]\s*/gm, '- ')
    .replace(/[•·]/g, '')
    .replace(/  +/g, ' ')
    .replace(/^ /gm, '')
}

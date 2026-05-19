#!/usr/bin/env node
/**
 * 轻量冒烟：不依赖登录，检查核心公开接口
 * 用法: node scripts/smoke-api.mjs [baseUrl]
 */
const base = (process.argv[2] || 'http://127.0.0.1:3003').replace(/\/$/, '')

async function check(name, url, expectJson = true) {
  const res = await fetch(url)
  const ok = res.ok
  let body = ''
  try {
    body = expectJson ? JSON.stringify(await res.json()) : await res.text()
  } catch {
    body = '(parse error)'
  }
  const pass = ok
  console.log(pass ? 'OK' : 'FAIL', name, res.status, body.slice(0, 80))
  return pass
}

let failed = 0
for (const [name, path] of [
  ['welcome', '/api/public/welcome'],
  ['health', '/api/health'],
  ['copywriting-types', '/api/copywriting/types'],
]) {
  const pass = await check(name, `${base}${path}`)
  if (!pass) failed++
}
process.exit(failed ? 1 : 0)

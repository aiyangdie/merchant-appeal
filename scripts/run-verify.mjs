import { execSync } from 'child_process'
import fs from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lines = []
function run(cmd, cwd = root) {
  try {
    lines.push(`$ ${cmd}`)
    lines.push(execSync(cmd, { cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }))
  } catch (e) {
    lines.push(e.stdout || '')
    lines.push(e.stderr || '')
    lines.push(String(e.message))
  }
  lines.push('---')
}

run('pm2 restart merchant-appeal')
run('sleep 2 && curl -s http://127.0.0.1:3003/api/health', root)
run('node scripts/verify-xianyu-dashboard-api.mjs', path.join(root, 'server'))
run('rg -c "数据看板" dist/ || true', root)

const out = lines.join('\n')
fs.writeFileSync('/tmp/xianyu-verify-out.txt', out)
console.log(out)

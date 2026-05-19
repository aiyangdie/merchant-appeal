import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)
const log = []
try {
  log.push(execSync('npm run build', { encoding: 'utf8', stdio: 'pipe', maxBuffer: 20 * 1024 * 1024 }))
} catch (e) {
  log.push(e.stdout || '')
  log.push(e.stderr || '')
  log.push(String(e.message))
}
const out = log.join('\n')
fs.writeFileSync('/tmp/merchant-appeal-build.log', out)
let hasDash = false
try {
  const { execSync: ex } = await import('child_process')
  ex('rg -l "数据看板" dist/', { cwd: root, encoding: 'utf8' })
  hasDash = true
} catch {
  hasDash = false
}
fs.writeFileSync('/tmp/build-result.json', JSON.stringify({ hasDash, logTail: out.slice(-2000) }))
console.log(JSON.stringify({ hasDash }))

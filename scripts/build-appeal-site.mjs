import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = path.join(root, 'dist')

function run(cmd, cwd = root) {
  execSync(cmd, { cwd, stdio: 'inherit' })
}

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}

console.log('[1/2] Clean dist/')
rmrf(distRoot)

console.log('[2/2] Build React → dist/chat/')
run('npm run build -- --mode production')

console.log('Done → dist/chat/ (React SPA, user + admin)')

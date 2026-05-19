import { execSync } from 'child_process'
import fs from 'fs'
try {
  const out = execSync('pm2 restart merchant-appeal && sleep 2 && curl -s http://127.0.0.1:3003/api/health', {
    encoding: 'utf8',
    shell: '/bin/bash',
    timeout: 60000,
  })
  fs.writeFileSync('/tmp/pm2-restart.txt', out)
  console.log(out)
} catch (e) {
  const msg = (e.stdout || '') + (e.stderr || '') + e.message
  fs.writeFileSync('/tmp/pm2-restart.txt', msg)
  console.error(msg)
  process.exit(1)
}

import { executeAdminAiCommand } from '../server/services/adminAi/index.js'
import { getSchedules } from '../server/db.js'

const tests = [
  { module: 'schedule', instruction: '明天上午10点提醒我审核充值' },
  { module: 'schedule', instruction: '创建一个日程：标题是测试AI日程，时间是2026-05-20T10:00' },
  { module: 'backup', instruction: '立即执行一次数据库备份' },
  { module: 'monitor', instruction: '执行一次健康检测' },
  { module: 'settings', instruction: '把最低充值金额改成 10' },
]

for (const t of tests) {
  console.log('\n===', t.module, ':', t.instruction)
  try {
    const r = await executeAdminAiCommand(t.module, t.instruction, { adminId: 1 })
    console.log(
      JSON.stringify(
        {
          reply: (r.reply || '').slice(0, 300),
          executed: r.executed,
          pending: r.pendingConfirms,
        },
        null,
        2
      )
    )
  } catch (e) {
    console.log('ERROR', e.message, e.stack?.split('\n').slice(0, 3).join('\n'))
  }
}

const sched = await getSchedules()
console.log(
  '\nschedules:',
  sched.length,
  sched.slice(-3).map((s) => ({ id: s.id, title: s.title, time: s.scheduled_time }))
)

process.exit(0)

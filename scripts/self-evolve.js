#!/usr/bin/env node
/**
 * AI Self-Evolution Script
 * Injects test conversations, triggers analysis pipeline,
 * generates/evaluates/promotes rules, aggregates knowledge.
 * Run: node scripts/self-evolve.js
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASE = process.env.API_BASE || 'http://localhost:3001'
const ADMIN_USER = 'admin'
const ADMIN_PASS = 'admin123'

let adminToken = ''

async function api(method, path, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (adminToken) opts.headers['Authorization'] = `Bearer ${adminToken}`
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

function log(icon, msg) { console.log(`  ${icon} ${msg}`) }
function header(title) { console.log(`\n${'='.repeat(56)}\n  ${title}\n${'='.repeat(56)}`) }

// Step 1: Login admin
async function loginAdmin() {
  header('Step 1: Admin Login')
  const r = await api('POST', '/api/admin/login', { username: ADMIN_USER, password: ADMIN_PASS })
  if (!r.ok || !r.data.token) throw new Error('Admin login failed: ' + JSON.stringify(r.data))
  adminToken = r.data.token
  log('✅', 'Admin logged in')
}

// Step 2: Inject test conversations as real sessions
async function injectTestData() {
  header('Step 2: Inject Test Conversations')
  const dataPath = path.join(__dirname, '..', 'test-data', 'conversations.json')
  if (!fs.existsSync(dataPath)) throw new Error('Missing test-data/conversations.json — run gen-test-data.js first')
  const scenarios = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  const sessionIds = []

  for (const sc of scenarios) {
    const phone = 'ev' + Date.now().toString().slice(-8) + Math.random().toString(36).slice(2, 6)
    const nickname = sc.name.replace(/[^\u4e00-\u9fff\w]/g, '').slice(0, 6) || 'test'
    // Register user
    const reg = await api('POST', '/api/user/register', { phone, nickname: nickname + '商户' })
    if (!reg.ok) { log('⚠️', `Skip ${sc.name}: register failed`); continue }
    const userId = reg.data.user?.id
    const userToken = reg.data.token

    // Send first user message to create session
    const firstMsg = sc.messages.find(m => m.role === 'user')?.content || '你好'
    const chatRes = await api('POST', '/api/chat', { content: firstMsg, userId })
    if (!chatRes.ok || !chatRes.data.sessionId) { log('⚠️', `Skip ${sc.name}: chat failed`); continue }
    const sid = chatRes.data.sessionId

    // Inject collected data fields
    for (const [key, value] of Object.entries(sc.collectedData)) {
      await api('PUT', `/api/sessions/${sid}/field`, { key, value: String(value) })
    }

    // Send remaining messages to build conversation history
    for (let i = 1; i < sc.messages.length; i++) {
      const m = sc.messages[i]
      if (m.role === 'user') {
        await api('POST', '/api/chat', { content: m.content, userId, sessionId: sid })
      }
    }

    sessionIds.push({ id: sid, name: sc.name, industry: sc.industry })
    log('✅', `${sc.name} → session ${sid.slice(0, 8)}... (${sc.messages.length} msgs, ${Object.keys(sc.collectedData).length} fields)`)
    await sleep(200) // avoid rate limit
  }
  log('📊', `Injected ${sessionIds.length}/${scenarios.length} test sessions`)
  return sessionIds
}

// Step 3: Batch analyze all conversations via AI
async function batchAnalyze() {
  header('Step 3: AI Conversation Analysis')
  // Check unanalyzed first
  const unRes = await api('GET', '/api/admin/evolution/unanalyzed?limit=50')
  const unanalyzed = unRes.data?.sessions?.length || 0
  log('📋', `${unanalyzed} unanalyzed sessions found`)

  if (unanalyzed === 0) { log('⏭️', 'Nothing to analyze'); return 0 }

  // Batch analyze
  const batchRes = await api('POST', '/api/admin/evolution/batch-analyze', { limit: 50 })
  const analyzed = batchRes.data?.analyzed || 0
  log('🧠', `Analyzed ${analyzed} conversations via DeepSeek AI`)

  // Show stats
  const statsRes = await api('GET', '/api/admin/evolution/analyses/stats')
  if (statsRes.ok && statsRes.data) {
    const s = statsRes.data
    const t = s.totals || s
    log('📊', `Total analyses: ${t.total || 0}, Avg completion: ${parseFloat(t.avg_completion || 0).toFixed(1)}%, Avg professionalism: ${parseFloat(t.avg_professionalism || 0).toFixed(1)}`)
  }
  return analyzed
}

// Step 4: Evaluate rule effectiveness
async function evaluateRules() {
  header('Step 4: Rule Effectiveness Evaluation')
  const res = await api('POST', '/api/admin/evolution/evaluate')
  if (res.ok) log('✅', 'Rule effectiveness evaluation complete')
  else log('⚠️', 'Evaluation: ' + (res.data?.error || 'unknown error'))

  // Show rule stats
  const statsRes = await api('GET', '/api/admin/evolution/rules/stats')
  if (statsRes.ok && statsRes.data) {
    const s = statsRes.data?.totals || statsRes.data || {}
    log('📊', `Rules: total=${s.total || 0}, active=${s.active || 0}, pending=${s.pending || s.pending_review || 0}, avg_score=${parseFloat(s.avg_score || 0).toFixed(1)}`)
  }
}

// Step 5: Auto-promote/demote rules
async function autoPromote() {
  header('Step 5: Auto Promote/Demote Rules')
  const res = await api('POST', '/api/admin/evolution/auto-promote')
  if (res.ok) {
    const d = res.data
    log('✅', `Promoted: ${d.promoted || 0}, Demoted: ${d.demoted || 0}`)
  } else {
    log('⚠️', 'Auto-promote: ' + (res.data?.error || 'unknown error'))
  }
}

// Step 6: Batch auto-review pending rules
async function batchReview() {
  header('Step 6: AI Batch Auto-Review')
  const res = await api('POST', '/api/admin/evolution/rules/batch-auto-review')
  if (res.ok) {
    const d = res.data
    log('✅', `Reviewed: ${d.reviewed || 0}, Approved: ${d.approved || 0}, Rejected: ${d.rejected || 0}`)
  } else {
    log('⚠️', 'Batch review: ' + (res.data?.error || 'unknown error'))
  }
}

// Step 7: Knowledge aggregation
async function aggregateKnowledge() {
  header('Step 7: Knowledge Aggregation')
  // Daily metrics
  const aggRes = await api('POST', '/api/admin/evolution/aggregate')
  if (aggRes.ok) log('✅', 'Daily metrics aggregated')

  // Knowledge clusters
  const clRes = await api('POST', '/api/admin/evolution/clusters/refresh')
  if (clRes.ok) log('✅', 'Knowledge clusters refreshed')

  // Show cluster stats
  const statsRes = await api('GET', '/api/admin/evolution/clusters/stats')
  if (statsRes.ok && statsRes.data) {
    const s = statsRes.data
    log('📊', `Clusters: ${s.total || 0} total, industry=${s.byType?.industry_pattern || 0}, violation=${s.byType?.violation_pattern || 0}, success=${s.byType?.success_factor || 0}`)
  }
}

// Step 8: Final report
async function finalReport() {
  header('Step 8: Evolution Report')

  const [rulesRes, analysisRes, healthRes, qualityRes] = await Promise.all([
    api('GET', '/api/admin/evolution/rules/stats'),
    api('GET', '/api/admin/evolution/analyses/stats'),
    api('GET', '/api/admin/evolution/health'),
    api('GET', '/api/admin/evolution/quality-dashboard'),
  ])

  console.log('\n  ┌─────────────────────────────────────────────┐')
  console.log('  │           AI Self-Evolution Summary          │')
  console.log('  ├─────────────────────────────────────────────┤')

  if (rulesRes.ok) {
    const r = rulesRes.data?.totals || rulesRes.data || {}
    console.log(`  │ Rules: ${String(r.total || 0).padStart(3)} total │ ${String(r.active || 0).padStart(3)} active │ ${String(r.pending || 0).padStart(3)} pending │`)
  }
  if (analysisRes.ok) {
    const a = analysisRes.data
    const at = a.totals || a
    console.log(`  │ Analyses: ${String(at.total || 0).padStart(3)} total │ Avg score: ${parseFloat(at.avg_professionalism || 0).toFixed(1).padStart(4)} │`)
  }
  if (healthRes.ok) {
    const h = healthRes.data
    console.log(`  │ Engine: ${h.status || 'unknown'} │ Uptime: ${h.uptime || 'N/A'} │`)
  }
  if (qualityRes.ok && qualityRes.data?.overview) {
    const o = qualityRes.data.overview
    const prof = parseFloat(o.avgProfessionalism || 0)
    const compl = parseFloat(o.avgCompletion || 0)
    const appeal = parseFloat(o.avgAppealSuccess || 0)
    console.log(`  │ Quality: prof=${prof.toFixed(1)} compl=${(compl > 1 ? compl : compl * 100).toFixed(0)}% appeal=${(appeal > 1 ? appeal : appeal * 100).toFixed(0)}% │`)
  }

  console.log('  └─────────────────────────────────────────────┘')

  // List active rules
  const activeRes = await api('GET', '/api/admin/evolution/rules?status=active')
  if (activeRes.ok && activeRes.data?.rules?.length > 0) {
    console.log('\n  Active Rules:')
    for (const rule of activeRes.data.rules.slice(0, 15)) {
      const score = rule.effectiveness_score != null ? ` [${parseFloat(rule.effectiveness_score || 0).toFixed(1)}]` : ''
      console.log(`    • ${rule.rule_name || rule.rule_key}${score}`)
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log('\n🧬 AI Self-Evolution Pipeline Starting...')
  console.log(`   Target: ${BASE}`)
  console.log(`   Time: ${new Date().toLocaleString('zh-CN')}`)

  const t0 = Date.now()

  await loginAdmin()
  const sessions = await injectTestData()

  if (sessions.length > 0) {
    log('⏳', 'Waiting 3s for sessions to settle...')
    await sleep(3000)
  }

  const analyzed = await batchAnalyze()

  if (analyzed > 0) {
    log('⏳', 'Waiting 2s for analysis results to propagate...')
    await sleep(2000)
  }

  await evaluateRules()
  await autoPromote()
  await batchReview()
  await aggregateKnowledge()
  await finalReport()

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n🎉 Self-evolution complete in ${elapsed}s`)
  console.log('   Run again to further improve — each cycle makes the AI smarter!\n')
}

main().catch(e => { console.error('\n❌ FATAL:', e.message || e); process.exit(1) })

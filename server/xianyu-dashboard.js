/**
 * 闲鱼运营看板：基于闲管家真实订单/商品 API 聚合统计
 */
import xianyuApi from './xianyu-api.js'
import { chatWithAI } from './ai.js'

const DASHBOARD_MAX_PAGES = Math.min(20, Math.max(5, parseInt(process.env.XIANYU_DASHBOARD_MAX_PAGES, 10) || 10))
const DASHBOARD_PRODUCT_PAGE_SIZE = Math.min(50, Math.max(20, parseInt(process.env.XIANYU_DASHBOARD_PRODUCT_SIZE, 10) || 50))

const STATUS_LABELS = {
  11: '待付款',
  12: '待发货',
  13: '待发货',
  21: '已发货',
  22: '已完成',
  23: '已退款',
  24: '已关闭',
}

function orderAmountYuan(o) {
  const n = Number(o.pay_amount ?? o.total_amount ?? o.goods?.price ?? 0)
  return Number.isFinite(n) ? n : 0
}

function orderTsSec(o) {
  const t = Number(o.order_time || o.create_time)
  if (!Number.isFinite(t) || t <= 0) return 0
  return t < 1e12 ? t : Math.floor(t / 1000)
}

function dayKeyFromSec(sec) {
  const d = new Date(sec * 1000)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function buildTrendSeries(orders, days) {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const series = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(d.getDate() - i)
    const key = dayKeyFromSec(Math.floor(d.getTime() / 1000))
    series.push({ date: key, orders: 0, amount: 0 })
  }
  const byDate = Object.fromEntries(series.map((s) => [s.date, s]))
  for (const o of orders) {
    const sec = orderTsSec(o)
    if (!sec) continue
    const key = dayKeyFromSec(sec)
    if (!byDate[key]) continue
    byDate[key].orders += 1
    byDate[key].amount += orderAmountYuan(o)
  }
  return series.map((s) => ({
    ...s,
    amount: Math.round(s.amount * 100) / 100,
  }))
}

function buildStatusDistribution(orders) {
  const counts = {}
  for (const o of orders) {
    const s = Number(o.order_status) || 0
    counts[s] = (counts[s] || 0) + 1
  }
  const total = orders.length || 1
  return Object.entries(counts)
    .map(([status, count]) => ({
      status: Number(status),
      label: STATUS_LABELS[Number(status)] || `状态${status}`,
      count,
      percent: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count)
}

function buildTopProducts(orders, limit = 10) {
  const map = new Map()
  for (const o of orders) {
    const pid = String(o.goods?.product_id || o.product_id || o.goods?.title || 'unknown')
    const title = o.goods?.title || o.product_title || '未知商品'
    const cur = map.get(pid) || {
      product_id: o.goods?.product_id || o.product_id || '',
      title,
      order_count: 0,
      amount: 0,
      image: o.goods?.images?.[0] || '',
    }
    cur.order_count += 1
    cur.amount += orderAmountYuan(o)
    if (!cur.image && o.goods?.images?.[0]) cur.image = o.goods.images[0]
    map.set(pid, cur)
  }
  return [...map.values()]
    .map((p) => ({ ...p, amount: Math.round(p.amount * 100) / 100 }))
    .sort((a, b) => b.order_count - a.order_count || b.amount - a.amount)
    .slice(0, limit)
}

function buildAiDailyReport({ days, summary, statusDistribution, topProducts, trend, recentOrders }) {
  const pending = (summary.statusCounts[12] || 0) + (summary.statusCounts[13] || 0)
  const shipped = summary.statusCounts[21] || 0
  const completed = summary.statusCounts[22] || 0
  const refund = summary.statusCounts[23] || 0
  const top3 = topProducts.slice(0, 3).map((p, i) => `${i + 1}. ${p.title}（${p.order_count} 单 / ¥${p.amount}）`).join('\n')
  const last7 = trend.slice(-7)
  const trendUp = last7.length >= 2 && last7[last7.length - 1].orders >= last7[0].orders

  const actions = []
  if (pending > 0) actions.push(`优先处理 ${pending} 笔待发货订单，避免超时扣分。`)
  if (refund > 0) actions.push(`关注 ${refund} 笔退款/售后订单，核对原因并优化商品描述。`)
  if (topProducts[0]) actions.push(`主推「${topProducts[0].title}」，可适度补库存或优化主图。`)
  if (!actions.length) actions.push('当前订单流转正常，建议保持商品上新与价格巡检。')

  return {
    title: `闲鱼 AI 运营日报 · 近 ${days} 天`,
    generated_at: new Date().toISOString(),
    source: 'template',
    sections: [
      {
        heading: '核心指标',
        body: `订单 ${summary.orderCount} 笔（平台统计约 ${summary.platformTotal} 笔），成交额 ¥${summary.totalSales}，客单价 ¥${summary.avgOrderValue}。今日新增 ${summary.todayOrders} 笔 / ¥${summary.todaySales}。在售商品约 ${summary.productCount} 个。`,
      },
      {
        heading: '订单状态概览',
        body: statusDistribution.map((s) => `${s.label}：${s.count} 笔（${s.percent}%）`).join('；') || '暂无订单状态数据',
      },
      {
        heading: '销售趋势',
        body: trendUp
          ? '近 7 日订单量呈上升或平稳态势，可加大曝光与活动投放。'
          : '近 7 日订单量有所回落，建议检查定价、主图与标题关键词。',
      },
      {
        heading: '热销 TOP3',
        body: top3 || '暂无足够订单样本',
      },
      {
        heading: '今日建议',
        body: actions.join('\n'),
      },
    ],
    recent_highlight: recentOrders.slice(0, 5).map((o) => ({
      order_no: o.order_no,
      title: o.goods?.title || '-',
      amount: orderAmountYuan(o),
      status: STATUS_LABELS[o.order_status] || o.order_status,
    })),
  }
}

async function buildAiDailyReportWithLLM(ctx) {
  const fallback = buildAiDailyReport(ctx)
  const { days, summary, statusDistribution, topProducts, trend } = ctx
  const prompt = `你是闲鱼店铺运营顾问。根据以下真实 API 统计数据，写一份简洁的中文运营日报（4 个小节：核心指标、订单状态、销售趋势、今日行动建议）。每节 2-4 句话，用数据说话，不要编造未提供的数据。

统计口径：近 ${days} 天；本页已拉取 ${summary.orderCount} 笔订单参与分析，平台订单总数约 ${summary.platformTotal} 笔。
成交额 ¥${summary.totalSales}，客单价 ¥${summary.avgOrderValue}，今日 ${summary.todayOrders} 笔 / ¥${summary.todaySales}，待发货 ${summary.pendingShip} 笔，在售商品约 ${summary.productCount} 个。
状态分布：${statusDistribution.map((s) => `${s.label}${s.count}笔`).join('、') || '无'}
热销 TOP3：${topProducts.slice(0, 3).map((p, i) => `${i + 1}.${p.title}(${p.order_count}单)`).join('；') || '无'}
近7日订单趋势（按日）：${trend.slice(-7).map((t) => `${t.date}:${t.orders}单`).join(' ')}

请直接输出 JSON 数组，格式：[{"heading":"核心指标","body":"..."},{"heading":"订单状态","body":"..."},{"heading":"销售趋势","body":"..."},{"heading":"今日建议","body":"..."}]，不要 markdown 代码块。`

  try {
    const result = await chatWithAI([{ role: 'user', content: prompt }], null, {})
    if (result?.inputTokens || result?.outputTokens) {
      try {
        const { trackAIUsage, isUsageTrackerReady } = await import('./ai/usageTracker.js')
        if (isUsageTrackerReady()) {
          await trackAIUsage({
            userId: 0,
            type: 'xianyu_dashboard_report',
            usage: { prompt_tokens: result.inputTokens, completion_tokens: result.outputTokens },
          })
        }
      } catch { /* non-fatal */ }
    }
    if (!result?.response) return fallback
    let sections
    const raw = result.response.trim()
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      sections = JSON.parse(jsonMatch[0])
    } else {
      sections = [{ heading: '运营分析', body: raw }]
    }
    if (!Array.isArray(sections) || !sections.length) return fallback
    return {
      title: `闲鱼 AI 运营日报 · 近 ${days} 天`,
      generated_at: new Date().toISOString(),
      source: 'llm',
      sections: sections.map((s) => ({
        heading: String(s.heading || '分析'),
        body: String(s.body || ''),
      })),
      recent_highlight: fallback.recent_highlight,
    }
  } catch (err) {
    console.warn('[XianyuDashboard] AI 日报生成失败，使用模板:', err.message)
    return fallback
  }
}

async function fetchOrdersForAnalytics({ shopId, days, maxPages = DASHBOARD_MAX_PAGES }) {
  const pageSize = 100
  const all = []
  let platformTotal = 0
  for (let page = 1; page <= maxPages; page++) {
    const r = await xianyuApi.getAllOrders({
      shopId: shopId || undefined,
      page_no: page,
      page_size: pageSize,
      create_time_days: days,
    })
    all.push(...(r.list || []))
    platformTotal = Math.max(platformTotal, r.total || 0)
    if (!r.list?.length || all.length >= platformTotal) break
  }
  return { orders: all, platformTotal }
}

export async function getDashboardAnalytics(options = {}) {
  const days = Math.min(90, Math.max(7, parseInt(options.days, 10) || 30))
  const shopId = options.shopId || undefined

  if (options.refresh === '1' || options.refresh === true) {
    xianyuApi.clearCacheByPrefix('orders_')
    xianyuApi.clearCacheByPrefix('products_')
  }

  const { orders, platformTotal } = await fetchOrdersForAnalytics({ shopId, days })

  const nowSec = Math.floor(Date.now() / 1000)
  const todayKey = dayKeyFromSec(nowSec)

  let totalSales = 0
  let todayOrders = 0
  let todaySales = 0
  const statusCounts = {}

  for (const o of orders) {
    const amt = orderAmountYuan(o)
    totalSales += amt
    const s = Number(o.order_status) || 0
    statusCounts[s] = (statusCounts[s] || 0) + 1
    const sec = orderTsSec(o)
    if (sec && dayKeyFromSec(sec) === todayKey) {
      todayOrders += 1
      todaySales += amt
    }
  }

  const orderCount = orders.length
  const avgOrderValue = orderCount > 0 ? Math.round((totalSales / orderCount) * 100) / 100 : 0

  const statusDistribution = buildStatusDistribution(orders)
  const salesTrend = buildTrendSeries(orders, Math.min(days, 30))
  const topProducts = buildTopProducts(orders, 10)

  const recentOrders = [...orders]
    .sort((a, b) => orderTsSec(b) - orderTsSec(a))
    .slice(0, 10)

  let productRes = { list: [], total: 0 }
  try {
    productRes = await xianyuApi.getProducts({
      page: 1,
      pageSize: DASHBOARD_PRODUCT_PAGE_SIZE,
      shopId,
      update_time_days: 180,
    })
  } catch {
    productRes = { list: [], total: 0 }
  }

  const summary = {
    orderCount,
    platformTotal,
    totalSales: Math.round(totalSales * 100) / 100,
    todayOrders,
    todaySales: Math.round(todaySales * 100) / 100,
    avgOrderValue,
    productCount: productRes.total || productRes.list?.length || 0,
    statusCounts,
    pendingShip: (statusCounts[12] || 0) + (statusCounts[13] || 0),
    analyticsNote:
      orderCount < platformTotal
        ? `统计基于已拉取的 ${orderCount} 笔订单（平台约 ${platformTotal} 笔，最多 ${DASHBOARD_MAX_PAGES * 100} 笔样本）`
        : `统计基于近 ${days} 天全部 ${orderCount} 笔订单`,
  }

  const reportCtx = {
    days,
    summary,
    statusDistribution,
    topProducts,
    trend: salesTrend,
    recentOrders,
  }

  const aiReport = await buildAiDailyReportWithLLM(reportCtx)

  return {
    days,
    shopId: shopId || null,
    summary,
    statusDistribution,
    salesTrend,
    topProducts,
    recentOrders,
    products: productRes.list || [],
    productTotal: productRes.total || 0,
    aiReport,
  }
}

export default { getDashboardAnalytics }

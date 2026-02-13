import React from 'react'

function ScoreRing({ score, label, color, sub }) {
  const r = 36, c = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, score))
  const offset = c - (pct / 100) * c
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#f3f4f6" strokeWidth="6" />
          <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
            className="transition-all duration-1000" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold" style={{ color }}>{Math.round(pct)}</span>
        </div>
      </div>
      <div className="text-xs font-semibold text-gray-700 mt-1.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
    </div>
  )
}

function MiniBar({ value, max, color }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, backgroundColor: color }} />
    </div>
  )
}

const SENTIMENT_EMOJI = { positive: '😊', slightly_positive: '🙂', neutral: '😐', slightly_negative: '😕', negative: '😞' }
const SENTIMENT_LABEL = { positive: '积极', slightly_positive: '偏积极', neutral: '中性', slightly_negative: '偏消极', negative: '消极' }
const SENTIMENT_COLOR = { positive: '#22c55e', slightly_positive: '#84cc16', neutral: '#9ca3af', slightly_negative: '#f97316', negative: '#ef4444' }

export default function QualityDashboard({ data }) {
  if (!data) return <div className="text-center py-12 text-gray-400 text-sm">暂无质量数据，AI分析对话后将自动生成</div>
  const o = data.overview || {}
  const totalSentiment = (data.sentiment || []).reduce((s, x) => s + parseInt(x.cnt || 0), 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">🎯 AI 服务质量仪表板</span>
        <span className="text-[10px] text-gray-400 ml-2">基于 {o.totalAnalyses || 0} 次对话分析</span>
        <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded animate-pulse ml-auto">AI全自动运行中</span>
      </div>

      {/* AI Auto Summary */}
      {o.totalAnalyses > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-indigo-700">🤖 AI智能总结</span>
          </div>
          <div className="text-xs text-gray-700 leading-relaxed space-y-1">
            <p>
              系统已自动分析 <b className="text-indigo-600">{o.totalAnalyses}</b> 次对话。
              AI专业度 <b className={o.avgProfessionalism >= 70 ? 'text-green-600' : o.avgProfessionalism >= 50 ? 'text-amber-600' : 'text-red-500'}>{Math.round(o.avgProfessionalism)}</b> 分
              {o.avgProfessionalism >= 70 ? '（优秀）' : o.avgProfessionalism >= 50 ? '（待提升）' : '（需重点改进）'}，
              用户满意度 <b className={o.avgSatisfaction >= 70 ? 'text-green-600' : 'text-amber-600'}>{Math.round(o.avgSatisfaction)}</b>。
            </p>
            <p className="text-[11px] text-gray-500">
              {o.avgCompletion >= 60
                ? `✅ 信息收集完整度${Math.round(o.avgCompletion)}%，表现良好。`
                : `⚠️ 信息收集完整度仅${Math.round(o.avgCompletion)}%，AI正在优化收集策略。`}
              {o.avgAppealSuccess >= 60
                ? ` 预估申诉成功率${Math.round(o.avgAppealSuccess)}%，可为商户提供有力帮助。`
                : ` 预估申诉成功率${Math.round(o.avgAppealSuccess)}%，AI正在学习更有效的申诉方案。`}
              {data.lowAnalyses?.length > 0
                ? ` 发现${data.lowAnalyses.length}个待改进对话，AI已自动生成改进建议。`
                : ' 暂无明显问题对话。'}
            </p>
          </div>
        </div>
      )}

      {/* Score Rings */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center">
          <ScoreRing score={o.avgProfessionalism} label="AI专业度" color="#6366f1" sub={`${o.highProfRate || 0}% 达标`} />
          <ScoreRing score={o.avgCompletion} label="信息完整度" color="#22c55e" sub={`${o.highCompletionRate || 0}% 达标`} />
          <ScoreRing score={o.avgAppealSuccess} label="预估申诉率" color="#f59e0b" sub={`${o.highAppealRate || 0}% 高概率`} />
          <ScoreRing score={o.avgSatisfaction} label="用户满意度" color="#ec4899" sub={`${o.highSatisfactionRate || 0}% 满意`} />
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: '总对话分析', value: o.totalAnalyses || 0, icon: '📊', color: 'from-blue-50 to-indigo-50 border-blue-100' },
          { label: '平均对话轮数', value: parseFloat(o.avgTurns || 0).toFixed(1), icon: '💬', color: 'from-green-50 to-emerald-50 border-green-100' },
          { label: '商城商品', value: data.mall?.activeProducts || 0, icon: '🛒', color: 'from-purple-50 to-violet-50 border-purple-100' },
          { label: '智能推荐', value: data.mall?.totalRecommendations || 0, icon: '🎁', color: 'from-orange-50 to-amber-50 border-orange-100' },
        ].map((c, i) => (
          <div key={i} className={`bg-gradient-to-br ${c.color} rounded-xl border p-3`}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm">{c.icon}</span>
              <span className="text-[10px] text-gray-500">{c.label}</span>
            </div>
            <div className="text-lg font-bold text-gray-800">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Sentiment Distribution */}
      {totalSentiment > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-xs font-semibold text-gray-700 mb-3">用户情绪分布</h3>
          <div className="flex gap-2 flex-wrap">
            {(data.sentiment || []).map(s => {
              const pct = totalSentiment > 0 ? Math.round((parseInt(s.cnt) / totalSentiment) * 100) : 0
              return (
                <div key={s.user_sentiment} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-lg">{SENTIMENT_EMOJI[s.user_sentiment] || '😐'}</span>
                  <div>
                    <div className="text-[11px] font-medium text-gray-700">{SENTIMENT_LABEL[s.user_sentiment] || s.user_sentiment}</div>
                    <div className="text-[10px] text-gray-400">{s.cnt} ({pct}%)</div>
                  </div>
                  <div className="w-12 ml-1">
                    <MiniBar value={pct} max={100} color={SENTIMENT_COLOR[s.user_sentiment] || '#9ca3af'} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 7-Day Trend */}
      {data.trend?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-xs font-semibold text-gray-700 mb-3">近7日质量趋势</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-50">
                  <th className="text-left py-1.5 pr-2 font-medium">日期</th>
                  <th className="text-center py-1.5 px-2 font-medium">对话数</th>
                  <th className="text-center py-1.5 px-2 font-medium">专业度</th>
                  <th className="text-center py-1.5 px-2 font-medium">完整度</th>
                  <th className="text-center py-1.5 px-2 font-medium">申诉率</th>
                  <th className="text-center py-1.5 px-2 font-medium">满意度</th>
                </tr>
              </thead>
              <tbody>
                {data.trend.map((d, i) => {
                  const day = typeof d.day === 'string' ? d.day.slice(5) : new Date(d.day).toISOString().slice(5, 10)
                  return (
                    <tr key={i} className="border-b border-gray-50/50 hover:bg-gray-50/50">
                      <td className="py-2 pr-2 font-medium text-gray-600">{day}</td>
                      <td className="py-2 px-2 text-center text-gray-700">{d.count}</td>
                      <td className="py-2 px-2 text-center"><span className="text-indigo-600 font-semibold">{parseFloat(d.avgProf).toFixed(0)}</span></td>
                      <td className="py-2 px-2 text-center"><span className="text-green-600 font-semibold">{parseFloat(d.avgCompletion).toFixed(0)}%</span></td>
                      <td className="py-2 px-2 text-center"><span className="text-amber-600 font-semibold">{parseFloat(d.avgAppeal).toFixed(0)}%</span></td>
                      <td className="py-2 px-2 text-center"><span className="text-pink-600 font-semibold">{parseFloat(d.avgSat).toFixed(0)}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Industry Quality Breakdown */}
      {data.qualityByIndustry?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-xs font-semibold text-gray-700 mb-3">行业服务质量对比</h3>
          <div className="space-y-2">
            {data.qualityByIndustry.map((ind, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/80 border border-gray-100/50">
                <div className="min-w-[60px]">
                  <div className="text-xs font-semibold text-gray-700 truncate">{ind.industry}</div>
                  <div className="text-[10px] text-gray-400">{ind.count}次对话</div>
                </div>
                <div className="flex-1 grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="text-[10px] text-gray-400">专业度</div>
                    <div className="text-xs font-bold text-indigo-600">{parseFloat(ind.avgProf).toFixed(0)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400">完整度</div>
                    <div className="text-xs font-bold text-green-600">{parseFloat(ind.avgCompletion).toFixed(0)}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400">申诉率</div>
                    <div className="text-xs font-bold text-amber-600">{parseFloat(ind.avgAppeal).toFixed(0)}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400">满意度</div>
                    <div className="text-xs font-bold text-pink-600">{parseFloat(ind.avgSat).toFixed(0)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top & Low Analyses Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Top Quality */}
        {data.topAnalyses?.length > 0 && (
          <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xs font-semibold text-green-700">🏆 最佳对话 TOP5</h3>
              <span className="text-[10px] text-green-500 bg-green-50 px-1.5 py-0.5 rounded">AI自动评选</span>
            </div>
            <div className="space-y-2">
              {data.topAnalyses.map((a, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-green-50/50 border border-green-100/50 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-green-600 w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-700 truncate">{a.industry || '未知'} · {a.problem_type || '-'}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        专业<b className="text-indigo-600">{a.professionalism_score}</b> 完整<b className="text-green-600">{a.completion_rate}%</b> 申诉<b className="text-amber-600">{a.appeal_success_rate}%</b> 满意<b className="text-pink-600">{a.user_satisfaction}</b>
                        {a.total_turns > 0 && <span className="ml-1">· {a.total_turns}轮</span>}
                      </div>
                    </div>
                  </div>
                  {a.ai_highlights?.bestMoment && (
                    <div className="mt-1.5 ml-7 px-2 py-1 bg-green-100/60 rounded text-[10px] text-green-700">
                      💡 <b>亮点:</b> {a.ai_highlights.bestMoment}
                    </div>
                  )}
                  {a.suggestions?.length > 0 && (
                    <div className="mt-1 ml-7 text-[10px] text-gray-500">
                      📝 AI建议: {a.suggestions.slice(0, 2).map(s => s.recommended || s.reason).filter(Boolean).join('；') || '-'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Needs Improvement */}
        {data.lowAnalyses?.length > 0 && (
          <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xs font-semibold text-orange-700">⚠️ 待改进对话</h3>
              <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">AI自动诊断</span>
            </div>
            <div className="space-y-2">
              {data.lowAnalyses.map((a, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-orange-50/50 border border-orange-100/50 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-orange-500 w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-700 truncate">{a.industry || '未知'} · {a.problem_type || '-'}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        专业<b className="text-indigo-600">{a.professionalism_score}</b> 完整<b className="text-green-600">{a.completion_rate}%</b> 申诉<b className="text-amber-600">{a.appeal_success_rate}%</b> 满意<b className="text-pink-600">{a.user_satisfaction}</b>
                        {a.total_turns > 0 && <span className="ml-1">· {a.total_turns}轮</span>}
                      </div>
                    </div>
                  </div>
                  {a.drop_off_point && (
                    <div className="mt-1.5 ml-7 px-2 py-1 bg-red-50 rounded text-[10px] text-red-600">
                      🚪 <b>用户流失点:</b> {a.drop_off_point}
                    </div>
                  )}
                  {a.ai_highlights?.worstMoment && (
                    <div className="mt-1 ml-7 px-2 py-1 bg-orange-100/60 rounded text-[10px] text-orange-700">
                      ⚡ <b>问题:</b> {a.ai_highlights.worstMoment}
                    </div>
                  )}
                  {a.suggestions?.length > 0 && (
                    <div className="mt-1 ml-7 space-y-0.5">
                      {a.suggestions.slice(0, 3).map((s, j) => (
                        <div key={j} className="text-[10px] text-gray-600 flex items-start gap-1">
                          <span className={`flex-shrink-0 px-1 py-0 rounded ${s.priority === 'high' ? 'bg-red-100 text-red-600' : s.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-500'}`}>
                            {s.priority === 'high' ? '高' : s.priority === 'medium' ? '中' : '低'}
                          </span>
                          <span>{s.recommended || s.reason || '-'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!a.suggestions?.length && !a.ai_highlights?.worstMoment && !a.drop_off_point && (
                    <div className="mt-1 ml-7 text-[10px] text-gray-400 italic">AI正在分析改进方向...</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Drop-off Analysis */}
      {data.topDropOffs?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-xs font-semibold text-gray-700 mb-3">🚪 用户流失热点</h3>
          <div className="flex flex-wrap gap-2">
            {data.topDropOffs.map((d, i) => (
              <div key={i} className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-100 text-xs">
                <span className="font-semibold text-red-600">{d.drop_off_point}</span>
                <span className="text-red-400 ml-1.5">{parseInt(d.cnt)}次</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mall Stats */}
      {(data.mall?.totalProducts > 0 || data.mall?.totalRecommendations > 0) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-xs font-semibold text-gray-700 mb-3">🛒 智能商城效果</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center p-2 rounded-lg bg-indigo-50">
              <div className="text-lg font-bold text-indigo-600">{data.mall.totalProducts}</div>
              <div className="text-[10px] text-gray-500">总商品</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-green-50">
              <div className="text-lg font-bold text-green-600">{data.mall.activeProducts}</div>
              <div className="text-[10px] text-gray-500">上架中</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-amber-50">
              <div className="text-lg font-bold text-amber-600">{data.mall.totalRecommendations}</div>
              <div className="text-[10px] text-gray-500">总推荐</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-pink-50">
              <div className="text-lg font-bold text-pink-600">{data.mall.clickedRecommendations + data.mall.purchasedRecommendations}</div>
              <div className="text-[10px] text-gray-500">有效转化</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

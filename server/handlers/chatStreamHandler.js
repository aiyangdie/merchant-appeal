import { v4 as uuidv4 } from 'uuid'
import {
  createSession, getSession, addMessage, getMessages, getUserById, getActiveAIModel,
  incrementUserMessages, patchSessionCollectedData, recordTokenUsage,
} from '../db.js'
import {
  streamChatWithAI, extractFieldsWithAI, expandFieldsForIndustry, assessCompletenessWithAI,
  buildCollectionInstruction, checkWeightedCollectionReady, getAIConfig, getWelcomeMessage,
} from '../ai.js'
import { createTurnBilling, addOfficialUsage } from '../billing.js'
import { schedulePostConversationAnalysis } from '../evolution.js'
import { buildCollectionContext, findNextUnfilledStep, normalizeFieldValue, INFO_FIELDS } from '../localAI.js'
import { pipeAIStream, simulateTypingSSE } from '../lib/sseStream.js'
import { stripEmoji } from '../lib/textUtils.js'

// chat stream — migrated from index.js
export function registerChatStreamRoute(app, ctx) {
  const { chatLimiter, requireUser, recordAIUsageForRequest, ORDER_SYSTEM_URL, APPEAL_API_KEY } = ctx
  app.post('/api/chat/stream', chatLimiter, requireUser, async (req, res) => {
  try {
    const { content, sessionId: inSessionId } = req.body
    if (!content?.trim()) return res.status(400).json({ error: '消息不能为空' })
    if (content.length > 5000) return res.status(400).json({ error: '消息过长，请缩短后重试' })

    const userId = req.userId
    const user = await getUserById(userId)
    if (!user) {
      return res.status(401).json({ error: '请先登录后再使用', needLogin: true })
    }
    const activeModelStream = await getActiveAIModel()
    const isModelFreeStream = activeModelStream?.is_free === 1
    const hasPayment = (user.api_mode === 'custom' && user.custom_api_key) || (user.api_mode === 'official' && (parseFloat(user.balance) > 0 || isModelFreeStream))
    if (!hasPayment) {
      return res.status(402).json({
        error: '⚠️ 您的账户余额不足，无法使用咨询服务。\n\n请先充值后再继续对话。',
        needRecharge: true,
        balance: parseFloat(user.balance)
      })
    }

    // 会话处理（验证 session 存在性，防止刷新后丢失历史）
    let sessionId = inSessionId
    let isNew = false
    let sessionReplaced = false
    let previousSessionId = null
    if (!sessionId) {
      sessionId = uuidv4()
      await createSession(sessionId, userId)
      isNew = true
    } else {
      const existing = await getSession(sessionId)
      if (!existing) {
        previousSessionId = inSessionId
        sessionReplaced = true
        sessionId = uuidv4()
        await createSession(sessionId, userId)
        isNew = true
      } else if (!existing.user_id || String(existing.user_id) !== String(userId)) {
        return res.status(403).json({ error: '无权访问此会话' })
      }
    }

    // 新会话：保存欢迎消息到数据库（刷新后能恢复完整历史）
    // 注意：需要先获取会话和订单信息
    const session = await getSession(sessionId)
    const currentStep = session?.step || 0
    const collectedData = session?.collected_data || {}

    // 获取绑定的订单信息
    let orderInfo = null
    const hasValidOrderData = session?.order_data && typeof session.order_data === 'object' && Object.keys(session.order_data).length > 0 && session.order_data.order_no
    console.log(`[订单上下文] 会话 ${sessionId}, order_no: ${session?.order_no}, hasValidOrderData: ${hasValidOrderData}`)
    if (hasValidOrderData) {
      orderInfo = session.order_data
      console.log(`[订单上下文] 使用缓存订单: ${orderInfo.order_no}`)
    } else if (session?.order_no) {
      console.log(`[订单上下文] 从订单系统获取: ${session.order_no}`)
      try {
        const orderRes = await fetch(`${ORDER_SYSTEM_URL}/api/external/order/${session.order_no}`, {
          headers: { 'X-Api-Key': APPEAL_API_KEY }
        })
        if (orderRes.ok) {
          const orderResult = await orderRes.json()
          if (orderResult.success && orderResult.data) {
            orderInfo = orderResult.data
            console.log(`[订单上下文] 获取成功: ${orderInfo.order_no}`)
          }
        }
      } catch (e) {
        console.error('获取订单信息失败:', e)
      }
    }

    // 发送欢迎消息
    if (isNew) {
      if (orderInfo) {
        const orderWelcome = `您好！我注意到您已绑定了订单信息：

【当前订单】
• 订单号: ${orderInfo.order_no}
• 买家: ${orderInfo.buyer_nick || orderInfo.customer_name || '未知'}
• 商品: ${orderInfo.goods?.title || orderInfo.product_name || '未知'}
• 金额: ¥${orderInfo.pay_amount_fen ? (orderInfo.pay_amount_fen / 100).toFixed(2) : orderInfo.pay_amount}
• 状态: ${orderInfo.status || '未知'}

请问您这个订单遇到了什么问题？我可以帮您分析申诉方案。`
        await addMessage(sessionId, 'assistant', orderWelcome)
      } else {
        await addMessage(sessionId, 'assistant', LOCAL_WELCOME)
      }
    }

    await addMessage(sessionId, 'user', content)
    if (user) {
      await incrementUserMessages(user.id)
      await updateUserActivity(user.id)
    }

    // 检查付费能力（AI报告阶段需要）
    let apiKeyToUse = null
    let canUseAI = false
    let isOfficialMode = false
    if (user) {
      if (user.api_mode === 'custom' && user.custom_api_key) {
        apiKeyToUse = user.custom_api_key
        canUseAI = true
      } else if (user.api_mode === 'official') {
        if (parseFloat(user.balance) > 0 || isModelFreeStream) {
          apiKeyToUse = null
          canUseAI = true
          isOfficialMode = !isModelFreeStream // 免费模型不扣费
        }
      }
    }

    // SSE 头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    // 防止客户端断开后继续写入死连接
    let clientDisconnected = false
    const requestAbort = new AbortController()
    req.on('close', () => {
      clientDisconnected = true
      requestAbort.abort()
    })
    const safeSend = (data) => { if (!clientDisconnected && !res.writableEnded) res.write(data) }
    const isDisconnected = () => clientDisconnected || res.writableEnded

    const multiplierStr = await getSystemConfig('cost_multiplier')
    const billingMultiplier = parseFloat(multiplierStr || '2')
    const turnBilling = createTurnBilling({ multiplier: billingMultiplier })

    // 先发送 sessionId + 当前收集进度
    safeSend(`data: ${JSON.stringify({
      type: 'start',
      sessionId,
      isNew,
      sessionReplaced,
      previousSessionId: sessionReplaced ? previousSessionId : undefined,
      step: currentStep,
      totalSteps: TOTAL_STEPS,
    })}\n\n`)

    // ===== AI-First: 用 _collection_complete 标记判断阶段 =====
    const isCollectionDone = collectedData._collection_complete === true
    if (!isCollectionDone) {
      // ===== AI-First: 所有消息统一由 AI 驱动对话 + 并行字段提取 =====
      if (!canUseAI) {
        const errMsg = '⚠️ 余额不足，无法使用AI咨询服务。请充值后继续。'
        safeSend(`data: ${JSON.stringify({ type: 'error', content: errMsg, needRecharge: true })}\n\n`)
      } else {
        let enrichedData = null
        try {
          const stepStartTime = Date.now()
          let updatedData = { ...collectedData }
          let updatedStep = currentStep

          // 构建收集上下文
          const filledFields = Object.entries(updatedData).filter(([k, v]) => !k.startsWith('_') && v && String(v).trim() && v !== '用户暂未提供' && v !== '⏳待补充')
          const filledCount = filledFields.length
          const collectionCtx = buildCollectionContext(updatedData, currentStep, orderInfo)
          const dynamicFields = updatedData._dynamic_fields || []
          const unfilled = dynamicFields.filter(df => !updatedData[df.key] || !String(updatedData[df.key]).trim()).map(df => `${df.label}: ${df.question || df.hint || ''}`).join('\n')
          const dynamicNote = unfilled ? `\n\n[行业专属信息待收集]\n${unfilled}` : ''
          let completenessNote = ''
          if (updatedData._completeness_hint) {
            const h = updatedData._completeness_hint
            const miss = [...new Set([...(h.missing || []), ...(h.missingCritical || [])])].filter(Boolean)
            if (miss.length) completenessNote += `\n\n【本轮优先补齐】${miss.join('、')}`
            if (h.nextQuestion) completenessNote += `\n建议追问：${h.nextQuestion}`
          }

          enrichedData = {
            ...updatedData,
            _current_step: `已收集${filledCount}项`,
            _collection_context: collectionCtx,
            _instruction: await buildCollectionInstruction(completenessNote, dynamicNote, updatedData)
          }

          // 并行：AI字段提取 + 流式对话回复
          const allMessages = await getMessages(sessionId)
          const extractionPromise = clientDisconnected
            ? Promise.resolve(null)
            : extractFieldsWithAI(content, updatedData, currentStep, apiKeyToUse, allMessages.slice(-6)).catch(e => {
              console.error('AI extraction error (non-fatal):', e.message)
              return null
            })

          // 流式回复（用户秒看到内容）
          const streamResult = await streamChatWithAI(allMessages, apiKeyToUse, enrichedData, { signal: requestAbort.signal })
          const firstByteMs = Date.now() - stepStartTime
          safeSend(`data: ${JSON.stringify({ type: 'timing', firstByteMs })}\n\n`)

          const pipeOpts = {
            isOfficialMode,
            user,
            sessionId,
            usageType: 'chat_collection',
            safeSend,
            isDisconnected,
            turnBilling,
            multiplier: billingMultiplier,
            recordTokenUsage,
          }
          const fullContent = await pipeAIStream(res, streamResult, pipeOpts)
          if (fullContent) await addMessage(sessionId, 'assistant', fullContent)

          const totalMs = Date.now() - stepStartTime
          safeSend(`data: ${JSON.stringify({ type: 'timing', totalMs, firstByteMs })}\n\n`)

          // 处理后台AI提取结果
          const aiResult = clientDisconnected ? null : await extractionPromise
          if (aiResult && Object.keys(aiResult.extracted).length > 0) {
            const fieldValidators = {
              merchant_id: v => /^\d{8,12}$/.test(v.replace(/\s/g, '')),
              legal_id_last4: v => /^\d{3}[\dxX]$/.test(v.replace(/\s/g, '')),
              bank_account_last4: v => /^\d{4}$/.test(v.replace(/\s/g, '')),
              contact_phone: v => /^1[3-9]\d{9}$/.test(v.replace(/[\s\-]/g, '')),
              license_no: v => /^[0-9A-Z]{15,18}$/i.test(v.replace(/\s/g, '')),
              business_model: v => v.length <= 30,
              problem_type: v => v.length <= 20,
              industry: v => v.length <= 20,
              violation_reason: v => v.length <= 60,
              merchant_name: v => v.length <= 40,
              company_name: v => v.length <= 50 && !/^(就是|哎呀|那个|反正)/.test(v),
              legal_name: v => v.length >= 2 && v.length <= 10 && /^[\u4e00-\u9fff·]+$/.test(v),
              bank_name: v => v.length <= 20 && /银行|信用社|支付宝|财付通/.test(v) && !/[？?怎么吗呢呀吧]/.test(v),
              complaint_status: v => v.length <= 50 && !/[？?]$/.test(v.trim()),
              refund_policy: v => v.length <= 80 && !/[？?]$/.test(v.trim()),
              appeal_history: v => v.length <= 60 && !/[？?]$/.test(v.trim()),
            }
            const aiInfoUpdates = []
            const allFieldDefs = [...INFO_FIELDS, ...(updatedData._dynamic_fields || [])]
            for (const [key, value] of Object.entries(aiResult.extracted)) {
              let fieldDef = allFieldDefs.find(f => f.key === key)
              if (!fieldDef && key && !key.startsWith('_') && value) {
                const v = String(value).trim()
                if (v.length > 0 && v.length <= 100) fieldDef = { key, label: key, group: '补充信息', icon: '📌', dynamic: true }
              }
              if (!fieldDef) continue
              const v = String(value).trim()
              if (!v) continue
              const validator = fieldValidators[key]
              if (validator && !validator(v)) continue
              const existing = updatedData[key]
              const shouldUpdate = aiResult.correction || !existing || existing === '用户暂未提供' || existing === '⏳待补充'
              if (shouldUpdate) {
                const oldVal = existing || ''
                const source = (existing && existing !== '用户暂未提供' && existing !== '⏳待补充') ? 'ai_correction' : 'ai_extract'
                const reason = source === 'ai_correction'
                  ? `AI根据用户最新描述将"${fieldDef.label}"从"${oldVal}"更正为"${v}"`
                  : `AI从用户对话中识别并提取了"${fieldDef.label}"`
                logFieldChange(sessionId, key, fieldDef.label, oldVal, v, source, reason).catch(() => {})
                updatedData[key] = v
                aiInfoUpdates.push({ key, label: fieldDef.label, value: v, group: fieldDef.group || '补充信息', icon: fieldDef.icon || '📌' })
              }
            }
            if (aiInfoUpdates.length > 0) {
              updatedStep = findNextUnfilledStep(0, updatedData)
              if (updatedStep >= TOTAL_STEPS) updatedStep = TOTAL_STEPS
              for (const upd of aiInfoUpdates) {
                safeSend(`data: ${JSON.stringify({ type: 'info_update', ...upd, step: updatedStep, totalSteps: TOTAL_STEPS })}\n\n`)
              }
              const extractPatch = Object.fromEntries(aiInfoUpdates.map(u => [u.key, u.value]))
              await patchSessionCollectedData(sessionId, extractPatch, updatedStep)
              console.log(`[AI提取成功] session=${sessionId} 提取${aiInfoUpdates.length}个字段, step→${updatedStep}`)
            }
            if (!clientDisconnected && (aiResult.inputTokens || aiResult.outputTokens)) {
              await addOfficialUsage(turnBilling, {
                isOfficialMode,
                multiplier: billingMultiplier,
                type: 'ai_extraction',
                label: '信息提取',
                inputTokens: aiResult.inputTokens,
                outputTokens: aiResult.outputTokens,
                userId: user.id,
                sessionId,
                recordTokenUsage,
              })
            }
          }

          // 行业自适应字段扩展（当 industry 首次被识别时触发）
          if (!clientDisconnected && updatedData.industry && !updatedData._dynamic_fields) {
            try {
              const expansion = await expandFieldsForIndustry(updatedData.industry, updatedData.problem_type, updatedData, apiKeyToUse)
              if (expansion && expansion.fields?.length > 0) {
                updatedData._dynamic_fields = expansion.fields
                updatedData._industry_tip = expansion.industryTip
                await patchSessionCollectedData(sessionId, {
                  _dynamic_fields: expansion.fields,
                  _industry_tip: expansion.industryTip,
                }, updatedStep)
                for (const df of expansion.fields) {
                  safeSend(`data: ${JSON.stringify({ type: 'info_update', key: df.key, label: df.label, value: '', group: df.group || '行业信息', icon: df.icon || '🏭', step: updatedStep, totalSteps: TOTAL_STEPS, dynamic: true })}\n\n`)
                }
                if (expansion.industryTip) {
                  safeSend(`data: ${JSON.stringify({ type: 'info_update', key: '_industry_tip', label: '行业提示', value: expansion.industryTip, group: '行业信息', icon: '🏭', step: updatedStep, totalSteps: TOTAL_STEPS })}\n\n`)
                }
                console.log(`[行业扩展] 为 ${updatedData.industry} 生成 ${expansion.fields.length} 个动态字段`)
                if (expansion.inputTokens || expansion.outputTokens) {
                  await addOfficialUsage(turnBilling, {
                    isOfficialMode,
                    multiplier: billingMultiplier,
                    type: 'industry_expansion',
                    label: '行业字段扩展',
                    inputTokens: expansion.inputTokens,
                    outputTokens: expansion.outputTokens,
                    userId: user.id,
                    sessionId,
                    recordTokenUsage,
                  })
                }
              }
            } catch (e) { console.error('Industry expansion error (non-fatal):', e.message) }
          }

          // 完成度检查（核心三要素齐全且已收集 6+ 项时触发）
          const postFilledFields = Object.entries(updatedData).filter(([k, v]) => !k.startsWith('_') && v && String(v).trim() && v !== '用户暂未提供' && v !== '⏳待补充')
          const hasCore = updatedData.industry && updatedData.problem_type && updatedData.violation_reason
          if (!clientDisconnected && hasCore && postFilledFields.length >= 6) {
            try {
              const assessment = await assessCompletenessWithAI(updatedData, apiKeyToUse)
              const weighted = checkWeightedCollectionReady(updatedData)
              const allMissing = [...new Set([...(assessment.missingCritical || []), ...(weighted.missing || [])])]
              const canComplete = assessment.ready && assessment.score >= 75 && weighted.ok

              safeSend(`data: ${JSON.stringify({
                type: 'completeness',
                score: assessment.score,
                ready: canComplete,
                missing: allMissing,
                nextQuestion: assessment.nextQuestion || '',
              })}\n\n`)

              if (weighted.ok && hasCore) {
                import('../ai/appealGuideSnapshot.js').then(({ ensureAppealGuideSnapshot }) =>
                  ensureAppealGuideSnapshot(sessionId, updatedData, { trackAIUsage }).catch(e =>
                    console.error('[appealGuideSnapshot] bg:', e.message)
                  )
                )
              }

              if (!canComplete && (allMissing.length || assessment.nextQuestion)) {
                updatedData._completeness_hint = {
                  missing: weighted.missing || [],
                  missingCritical: assessment.missingCritical || [],
                  nextQuestion: assessment.nextQuestion || '',
                  score: assessment.score,
                }
                await patchSessionCollectedData(sessionId, {
                  _completeness_hint: updatedData._completeness_hint,
                }, updatedStep)
                safeSend(`data: ${JSON.stringify({
                  type: 'completeness_hint',
                  missing: allMissing,
                  nextQuestion: assessment.nextQuestion || '',
                  score: assessment.score,
                })}\n\n`)
              } else if (canComplete) {
                delete updatedData._completeness_hint
              }

              if (assessment.inputTokens || assessment.outputTokens) {
                await addOfficialUsage(turnBilling, {
                  isOfficialMode,
                  multiplier: billingMultiplier,
                  type: 'completeness_check',
                  label: '完成度评估',
                  inputTokens: assessment.inputTokens,
                  outputTokens: assessment.outputTokens,
                  userId: user.id,
                  sessionId,
                  recordTokenUsage,
                })
              }
              if (canComplete) {
                updatedData._collection_complete = true
                await patchSessionCollectedData(sessionId, {
                  _collection_complete: true,
                  _completeness_hint: null,
                }, updatedStep)
                safeSend(`data: ${JSON.stringify({ type: 'completeness', score: assessment.score, ready: true, triggerReport: true })}\n\n`)
              }
            } catch (e) { console.error('Completeness check error (non-fatal):', e.message) }
          }
        } catch (err) {
          console.error('AI collection error:', err.message)
          // 实时fallback：标记故障+尝试自动切换+重试
          if (!apiKeyToUse) { // 官方模式才fallback，自定义Key用户不管
            const active = await getActiveAIModel()
            if (active) await updateModelHealth(active.id, { status: 'error', error: err.message })
            const sw = await autoSwitchIfNeeded()
            if (sw?.switched) {
              safeSend(`data: ${JSON.stringify({ type: 'chunk', content: `\n\n⚡ 模型故障，已自动切换到 ${sw.model}，正在重试...\n\n` })}\n\n`)
              try {
                const retryMessages = await getMessages(sessionId)
                const retryCtx = enrichedData || collectedData
                const retryStream = await streamChatWithAI(retryMessages, null, retryCtx, { signal: requestAbort.signal })
                const retryContent = await pipeAIStream(res, retryStream, {
                  isOfficialMode: !isModelFreeStream,
                  user,
                  sessionId,
                  usageType: 'chat_collection',
                  safeSend,
                  isDisconnected,
                  turnBilling,
                  multiplier: billingMultiplier,
                  recordTokenUsage,
                })
                if (retryContent) await addMessage(sessionId, 'assistant', retryContent)
              } catch (retryErr) {
                console.error('Fallback retry also failed:', retryErr.message)
                safeSend(`data: ${JSON.stringify({ type: 'error', content: '⚠️ 所有AI模型暂时不可用，请稍后重试' })}\n\n`)
              }
            } else {
              const errMap = { 'API_KEY_INVALID': '⚠️ AI 服务配置异常', 'API_BALANCE_INSUFFICIENT': '⚠️ AI API 余额不足', 'API_RATE_LIMIT': '⚠️ 请求过于频繁', 'NETWORK_ERROR': '⚠️ 网络连接超时', 'NO_API_KEY': '⚠️ AI 服务未配置' }
              safeSend(`data: ${JSON.stringify({ type: 'error', content: errMap[err.message] || `⚠️ AI 服务暂时不可用（${err.message}）` })}\n\n`)
            }
          } else {
            const errMap = { 'API_KEY_INVALID': '⚠️ AI 服务配置异常（API Key 无效）', 'API_BALANCE_INSUFFICIENT': '⚠️ AI API 余额不足', 'API_RATE_LIMIT': '⚠️ 请求过于频繁，请稍后重试', 'NETWORK_ERROR': '⚠️ 网络连接超时', 'NO_API_KEY': '⚠️ AI 服务未配置 API Key' }
            safeSend(`data: ${JSON.stringify({ type: 'error', content: errMap[err.message] || `⚠️ AI 服务暂时不可用（${err.message}）` })}\n\n`)
          }
        }
      }
    } else {
      // ===== 报告已生成阶段：后续对话全部走 AI =====
      if (!canUseAI) {
        const errMsg = '⚠️ **余额不足，无法继续AI对话。** 请先充值后再继续。'
        await addMessage(sessionId, 'assistant', errMsg)
        safeSend(`data: ${JSON.stringify({ type: 'error', content: errMsg, needRecharge: true })}\n\n`)
      } else {
        // 检查是否是"生成报告"重试指令
        const isRetryReport = /生成报告|重新生成|再生成/.test(content)
        try {
          if (isRetryReport) {
            const similarCases = await findSimilarCases(collectedData.industry, collectedData.problem_type, 3)
            const { loadPublishedPrompt } = await import('../prompts/promptLoader.js')
            const reportOverlay = await loadPublishedPrompt('report_generation', '')
            let reportPrompt = buildReportPrompt(collectedData, similarCases, orderInfo)
            if (reportOverlay) reportPrompt += `\n\n【报告生成指引】\n${reportOverlay}`
            const reportMessages = [{ role: 'user', content: reportPrompt }]
            const streamResult = await streamChatWithAI(reportMessages, apiKeyToUse, collectedData, { signal: requestAbort.signal })
            const fullContent = await pipeAIStream(res, streamResult, {
              isOfficialMode,
              user,
              sessionId,
              usageType: 'report_retry',
              safeSend,
              isDisconnected,
              turnBilling,
              multiplier: billingMultiplier,
              recordTokenUsage,
            })
            if (fullContent) await addMessage(sessionId, 'assistant', fullContent)
          } else {
            const allMessages = await getMessages(sessionId)
            const streamResult = await streamChatWithAI(allMessages, apiKeyToUse, collectedData, { signal: requestAbort.signal })
            const fullContent = await pipeAIStream(res, streamResult, {
              isOfficialMode,
              user,
              sessionId,
              usageType: 'chat',
              safeSend,
              isDisconnected,
              turnBilling,
              multiplier: billingMultiplier,
              recordTokenUsage,
            })
            if (fullContent) await addMessage(sessionId, 'assistant', fullContent)
          }
        } catch (err) {
          console.error('AI post-report error:', err.message)
          // 实时fallback
          if (!apiKeyToUse) {
            const active = await getActiveAIModel()
            if (active) await updateModelHealth(active.id, { status: 'error', error: err.message })
            const sw = await autoSwitchIfNeeded()
            if (sw?.switched) {
              safeSend(`data: ${JSON.stringify({ type: 'chunk', content: `\n\n⚡ 已自动切换到 ${sw.model}，重试中...\n\n` })}\n\n`)
              try {
                const retryMsgs = await getMessages(sessionId)
                const retryStream = await streamChatWithAI(retryMsgs, null, collectedData, { signal: requestAbort.signal })
                const retryContent = await pipeAIStream(res, retryStream, {
                  isOfficialMode: !isModelFreeStream,
                  user,
                  sessionId,
                  usageType: 'chat',
                  safeSend,
                  isDisconnected,
                  turnBilling,
                  multiplier: billingMultiplier,
                  recordTokenUsage,
                })
                if (retryContent) await addMessage(sessionId, 'assistant', retryContent)
              } catch (retryErr) {
                const errMsg = '⚠️ 所有AI模型暂时不可用，请稍后重试'
                await addMessage(sessionId, 'assistant', errMsg)
                safeSend(`data: ${JSON.stringify({ type: 'error', content: errMsg })}\n\n`)
              }
            } else {
              const errMsg = `⚠️ AI 服务暂时不可用（${err.message}）`
              await addMessage(sessionId, 'assistant', errMsg)
              safeSend(`data: ${JSON.stringify({ type: 'error', content: errMsg })}\n\n`)
            }
          } else {
            const errMap = { 'API_KEY_INVALID': '⚠️ API Key 无效', 'API_BALANCE_INSUFFICIENT': '⚠️ API 余额不足', 'API_RATE_LIMIT': '⚠️ 请求过于频繁', 'NETWORK_ERROR': '⚠️ 网络超时', 'NO_API_KEY': '⚠️ 未配置 API Key' }
            const errMsg = errMap[err.message] || `⚠️ AI 服务暂时不可用（${err.message}）`
            await addMessage(sessionId, 'assistant', errMsg)
            safeSend(`data: ${JSON.stringify({ type: 'error', content: errMsg })}\n\n`)
          }
        }
      }
    }

    if (isOfficialMode && user && turnBilling && !turnBilling.isEmpty() && !clientDisconnected) {
      const finalized = await turnBilling.finalizeOfficial({
        userId: user.id,
        deductBalance,
        incrementUserSpent,
        getUserById,
      })
      if (finalized && finalized.cost > 0) {
        safeSend(`data: ${JSON.stringify({
          type: 'usage',
          tokenUsage: {
            cost: finalized.cost,
            inputTokens: finalized.inputTokens,
            outputTokens: finalized.outputTokens,
            totalTokens: finalized.totalTokens,
            multiplier: finalized.multiplier,
            breakdown: finalized.breakdown,
          },
          balance: finalized.balance,
        })}\n\n`)
      }
    }

    safeSend('data: [DONE]\n\n')
    if (!clientDisconnected) res.end()

    // 商城：异步解析AI回复中的商品推荐标记 + 更新用户兴趣（不阻塞响应）
    const allMsgs = await getMessages(sessionId).catch(() => [])
    const lastAssistant = [...allMsgs].reverse().find(m => m.role === 'assistant')
    if (lastAssistant?.content) {
      parseProductRecommendations(lastAssistant.content).catch(() => {})
    }
    if (user?.id) {
      updateUserInterestFromConversation(user.id, sessionId, collectedData, allMsgs)
        .then((usage) => {
          if (usage) {
            recordAIUsageForRequest({ userId: user.id }, { type: 'mall_interest', usage, sessionId }).catch(() => {})
          }
        })
        .catch(() => {})
    }

    // V2: 对话结束后异步触发AI分析（不阻塞响应）
    // 当收集完成 或 消息数>=8 时触发分析
    const msgCount = allMsgs.length
    if (collectedData._collection_complete || msgCount >= 8) {
      schedulePostConversationAnalysis(sessionId)
    }
  } catch (err) {
    console.error('Stream chat error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: '处理消息失败' })
    } else {
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', content: '处理消息失败' })}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
      } catch { /* stream already closed */ }
    }
  }
})

// 用户查询历史记录（按关键词/会话ID/聊天内容搜索）— 必须在 :id 路由之前
}

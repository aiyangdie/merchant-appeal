/**
 * 申诉指导 / 投诉话术 / 95017 话术 — 统一 API（SessionAppealContext + AI 快照）
 */
import { getSession } from '../db.js'
import { buildSessionAppealContext, checklistToGuideMaterials, suggestMaterialChecks } from '../ai/sessionAppealContext.js'
import { ensureAppealGuideSnapshot } from '../ai/appealGuideSnapshot.js'
import { trackAIUsage } from '../ai/usageTracker.js'

function parseCollected(session) {
  if (!session) return {}
  return typeof session.collected_data === 'string'
    ? JSON.parse(session.collected_data || '{}')
    : (session.collected_data || {})
}

export async function handlePostComplaintReply(req, res) {
  try {
    const session = await getSession(req.params.id)
    if (!session) return res.status(404).json({ error: '会话不存在' })
    const d = parseCollected(session)
    const { complaint_type } = req.body || {}

    const appealCtx = buildSessionAppealContext(d)
    const snapResult = await ensureAppealGuideSnapshot(req.params.id, d, { trackAIUsage })
    const aiSnap = snapResult.snapshot

    const industry = appealCtx.industry.key || d.industry || '通用'
    const merchantName = d.merchant_name || d.company_name || '我司'
    const refundPolicy = d.refund_policy || ''
    const industrySuffix = appealCtx.industry.businessModel
      ? `（我们是${industry}，${appealCtx.industry.businessModel.slice(0, 60)}）`
      : (industry !== '通用' ? `（我们是${industry}行业商户）` : '')

    const replyTemplates = {
      退款: {
        first_reply: `您好，非常抱歉给您带来不好的体验。您的退款申请我们已收到并高度关注，正在为您加急处理中。我们的退款政策是：${refundPolicy || '收到申请后24小时内审核，审核通过后1个工作日内原路退回'}。请您放心，我们会尽快为您处理。如需沟通请随时留言，我们会第一时间回复。`,
        resolution: `您好，关于您的退款申请，我们已经完成审核。退款已通过原支付渠道发起，预计1-3个工作日到账，请您留意查收。如到账有任何问题，请随时联系我们。再次对给您造成的不便表示歉意，感谢您的理解与支持。`,
        close: `尊敬的客户，您的退款已于{日期}成功退回，请确认查收。如您对处理结果满意，恳请在投诉页面确认"已解决"。如仍有任何问题，我们随时为您服务。祝您生活愉快！`,
      },
      服务不满意: {
        first_reply: `您好，非常感谢您的反馈，对于您不满意的体验我们深表歉意。您的意见对我们非常重要，我们已安排专人跟进您的问题。请问方便详细说明一下具体是哪方面让您不满意吗？我们会认真对待并尽快给您满意的解决方案。`,
        resolution: `您好，针对您反馈的问题，我们已进行了内部核实和整改。具体解决方案如下：{根据实际情况填写}。同时我们也已优化了相关服务流程，避免类似情况再次发生。如果您对以上方案有任何意见，请随时告知。`,
        close: `尊敬的客户，感谢您给我们改进的机会。我们已对您反馈的问题进行了整改，并将持续优化服务质量。如处理结果让您满意，恳请在投诉页面确认"已解决"。后续如有任何需要，随时联系我们。`,
      },
      商品问题: {
        first_reply: `您好，非常抱歉我们的商品/服务未能达到您的期望。您反馈的问题我们已经记录并安排核实，会在24小时内给您明确的处理方案。如涉及退款或补偿，我们会按照售后政策第一时间为您处理。请您稍候，感谢您的耐心。`,
        resolution: `您好，经过核实，您反馈的问题属实。我们愿意为您提供以下解决方案：{1.全额退款 / 2.补发商品 / 3.折扣补偿}。请您选择最合适的方案，我们将立即执行。再次为给您带来的不便致歉。`,
        close: `尊敬的客户，您的问题已按{方案}处理完成。感谢您的理解与配合。如对处理结果满意，恳请在投诉页面确认"已解决"。我们会持续提升产品和服务质量。`,
      },
      未收到货: {
        first_reply: `您好，非常抱歉让您久等了。我们已经在核实您的订单物流情况，会尽快查明原因。如确认物流异常，我们将立即为您安排补发或退款。请您稍候，预计24小时内给您明确答复。`,
        resolution: `您好，经查询您的订单{订单号}，{物流情况说明}。我们已为您安排{补发/退款}，{预计到达时间/退款预计到账时间}。再次对延误表示歉意。`,
        close: `尊敬的客户，您的问题已妥善处理（{补发已签收/退款已到账}）。如对处理结果满意，恳请在投诉页面确认"已解决"。感谢您的耐心等待！`,
      },
      其他: {
        first_reply: `您好，感谢您的反馈。您提出的问题我们已经收到并认真记录，正在安排专人跟进核实。我们会在24小时内给您详细的处理方案。期间如有任何补充信息，请随时留言，我们会第一时间查看。`,
        resolution: `您好，关于您反馈的问题，经我们内部核实和协商，处理方案如下：{具体方案}。我们始终以客户满意为目标，如您对方案有任何异议，我们可以进一步协商。`,
        close: `尊敬的客户，您反馈的问题已处理完成。感谢您给予我们改进的机会。如对处理结果满意，恳请在投诉页面确认"已解决"。祝您一切顺利！`,
      },
    }

    const type = complaint_type && replyTemplates[complaint_type] ? complaint_type : '其他'
    let templates = { ...replyTemplates[type] }
    if (aiSnap?.complaint_templates) {
      templates = { ...templates, ...aiSnap.complaint_templates }
    }
    if (appealCtx.complaintHints?.length) {
      const hint = appealCtx.complaintHints.join(' ')
      templates.first_reply = `${templates.first_reply}\n\n【行业提示】${hint}`
    }

    const timeline_tips = {
      '24h内': '收到投诉后必须在24小时内首次回复用户（否则影响「1日回复率」指标）',
      '72h内': '必须在72小时内处理完毕并标记"处理完成"（否则影响「3日处理完成率」指标）',
      '标记完成后': '标记"处理完成"后用户可能继续投诉，需持续关注',
    }

    const phone_script = {
      preparation: `拨打前准备好以下信息：\n• 商户号：${d.merchant_id || '（请准备好）'}\n• 法人姓名：${d.legal_name || '（请准备好）'}\n• 身份证后四位：${d.legal_id_last4 || '（请准备好）'}\n• 银行卡后四位：${d.bank_account_last4 || '（请准备好）'}\n• 联系电话：${d.contact_phone || '（请准备好）'}`,
      steps: [
        '拨打 95017',
        '按 2（商户服务）',
        '输入商户号后按 # 确认',
        '等待转接人工客服（可能等待5-15分钟）',
        '人工接通后说明来意',
      ],
      script:
        aiSnap?.phone_script?.opening ||
        `您好，我是商户号${d.merchant_id || 'XXXXXXXXXX'}的${d.legal_name ? '法人' + d.legal_name : '负责人'}。我司商户号因${d.violation_reason || '涉嫌违规'}被${d.problem_type || '限制'}，我们已在商户平台提交了申诉材料，想咨询一下审核进度。我们是${industry}行业${industrySuffix}，正常经营中，所有投诉都已处理完成。请问大概什么时候能有审核结果？需要我们补充什么材料吗？`,
      followup: aiSnap?.phone_script?.followup || null,
      tips: [
        ...(aiSnap?.phone_script?.tips || []),
        ...(appealCtx.phoneTalkingPoints || []),
        '语气保持礼貌诚恳，不要激动',
        '准确报出商户号和法人信息以验证身份',
        '明确说明已提交申诉并处理好投诉',
        '询问是否需要补充材料',
        '记录客服工号和回复内容',
        '如果客服说在审核中，可以问预计时间',
        '每隔2-3天可以再次致电跟进',
      ]
        .filter((t, i, arr) => arr.indexOf(t) === i)
        .slice(0, 12),
    }

    res.json({
      complaint_type: type,
      templates,
      timeline_tips,
      phone_script,
      industry,
      industry_context: appealCtx.industry,
      completeness: appealCtx.completeness,
      missing_fields: appealCtx.completeness.missingCritical,
      complaint_hints: appealCtx.complaintHints,
      merchant_name: merchantName,
      ai_enhanced: !!aiSnap?.complaint_templates,
      snapshot_meta: { reason: snapResult.reason, generated: snapResult.generated },
    })
  } catch (err) {
    console.error('Generate complaint reply error:', err)
    res.status(500).json({ error: '生成投诉回复失败' })
  }
}

export async function handleGetAppealGuide(req, res) {
  try {
    const session = await getSession(req.params.id)
    if (!session) return res.status(404).json({ error: '会话不存在' })
    const d = parseCollected(session)

    const violationReason = d.violation_reason || ''
    const hasComplaints = /\d+.*投诉|投诉.*\d+|有/.test(d.complaint_status || '')
    const isFirstAppeal = !/驳回|被拒|失败/.test(d.appeal_history || '')

    const steps = []

    if (hasComplaints) {
      steps.push({
        id: 'handle_complaints',
        title: '优先处理所有消费者投诉',
        priority: 'urgent',
        icon: '🚨',
        description: '申诉前必须先把所有投诉处理完！未处理的投诉会直接导致申诉被驳回。',
        actions: [
          '登录商户平台 pay.weixin.qq.com → 账户中心 → 消费者投诉',
          '逐一回复所有"待处理"的投诉（24小时内必须首次回复）',
          '与用户协商解决方案（退款/补偿/解释）',
          '72小时内处理完毕并标记"处理完成"',
          '引导满意的用户在投诉页面确认"已解决"',
        ],
        tips: '所有投诉必须处于"已处理完成"状态再提交申诉',
        time_estimate: '1-3天',
      })
    }

    steps.push({
      id: 'check_violation',
      title: '查看违约记录详情',
      priority: 'required',
      icon: '🔍',
      description: '确认处罚类型和具体原因，了解申诉要求。',
      actions: [
        '方式一：登录商户平台 pay.weixin.qq.com → 账户中心 → 违约记录',
        '方式二：微信搜索【微信支付商家助手】小程序 → 风险处理 → 违约处理记录',
        '方式三：关注【微信支付商家助手】公众号 → 我的账号 → 我是商家 → 风险处理',
        '记录下违约类型、处罚措施、处理时效要求',
      ],
      tips: '截图保存违约记录页面，申诉时可能需要参考',
      time_estimate: '10分钟',
    })

    const appealCtx = buildSessionAppealContext(d)
    const materials = checklistToGuideMaterials(appealCtx.checklist, appealCtx.industry.materials)
    const materialChecks = suggestMaterialChecks(d, materials)

    const materialTips = appealCtx.industry.appealTips
      ? `行业要点：${appealCtx.industry.appealTips.slice(0, 100)}…`
      : '材料尽量齐全，一次性提交成功率更高'

    steps.push({
      id: 'prepare_materials',
      title: '准备申诉材料',
      priority: 'required',
      icon: '📋',
      description: appealCtx.industry.key
        ? `根据您的「${appealCtx.industry.key}」行业与违规情况，建议准备以下材料：`
        : '根据您的情况，需要准备以下材料：',
      materials,
      tips: materialTips,
      time_estimate: '1-2天',
    })

    steps.push({
      id: 'fill_appeal_form',
      title: '填写并提交申诉',
      priority: 'required',
      icon: '✍️',
      description: '在商户平台提交申诉，我们已帮您生成好各栏内容，可直接复制粘贴。',
      actions: [
        '登录商户平台 pay.weixin.qq.com → 账户中心 → 违约记录',
        '找到对应记录，点击"申请解除限制"',
        '上传证件照片（身份证正反面+手持照）',
        '填写"业务模式说明"→ 点击本平台【申诉文案】复制第1段',
        '选择经营场景（线上/线下）→ 填写小程序信息',
        '填写交易订单信息（2-3笔）',
        '填写"投诉产生原因"→ 复制第3段',
        '填写"投诉处理方法"→ 复制第4段',
        '填写"退款机制"→ 复制第2段',
        '填写"补充文字说明"→ 复制第5段',
        '上传补充材料文件',
        '仔细检查后点击提交',
      ],
      tips: '提交前仔细检查所有内容是否准确，提交后无法修改',
      time_estimate: '30分钟',
    })

    steps.push({
      id: 'wait_and_follow',
      title: '等待审核 + 电话跟进',
      priority: 'recommended',
      icon: '📞',
      description: '提交后预计1-7个工作日出结果。建议2-3天后致电95017跟进。',
      actions: [
        '提交后第2-3天：拨打95017 → 按2 → 输入商户号 → 转人工',
        '告知客服已提交申诉，询问审核进度',
        '如客服要求补充材料，尽快准备提交',
        '留意商户平台站内信、邮件和公众号通知',
        '审核中心会展示处理进度，定期查看',
      ],
      tips: '每隔2-3天跟进一次，语气礼貌诚恳',
      time_estimate: '1-7个工作日',
    })

    if (!isFirstAppeal) {
      steps.push({
        id: 'rejected_plan',
        title: '驳回后的应对方案',
        priority: 'important',
        icon: '🔄',
        description: '如果申诉被驳回，不要放弃，分析原因后补充材料重新申诉。',
        actions: [
          '仔细阅读驳回理由（在违约记录页面查看）',
          '针对驳回理由补充新的证据材料',
          '修改申诉文案，重点回应驳回原因',
          '联系95017人工客服确认需要补充什么',
          '重新提交申诉（通常可以多次申诉）',
        ],
        tips: '每次申诉必须有新证据或新说明，否则容易再次被驳回',
        time_estimate: '3-5天准备后重新提交',
      })
    } else {
      steps.push({
        id: 'rejected_plan',
        title: '如果被驳回怎么办',
        priority: 'info',
        icon: '💡',
        description: '首次申诉通过率较高。万一被驳回，可以补充材料后再次申诉。',
        actions: [
          '查看驳回原因',
          '针对性补充新证据',
          '修改文案后重新提交',
          '致电95017咨询具体需要什么材料',
        ],
        tips: '大部分商户在1-2次申诉内都能通过',
        time_estimate: '视情况而定',
      })
    }

    let successRate = 70
    const riskFactors = []
    const positiveFactors = []

    if (hasComplaints) {
      successRate -= 10
      riskFactors.push('存在未处理投诉会降低成功率')
    }
    if (!isFirstAppeal) {
      successRate -= 15
      riskFactors.push('非首次申诉，审核会更严格')
    }
    if (/套现|赌博|欺诈|洗钱/.test(violationReason)) {
      successRate -= 20
      riskFactors.push('严重违规类型（' + violationReason + '），审核标准高')
    }
    if (/交易异常|交易纠纷|投诉/.test(violationReason)) {
      successRate += 5
      positiveFactors.push('该违规类型申诉成功率相对较高')
    }
    if (d.order_info) {
      successRate += 5
      positiveFactors.push('已提供交易订单信息')
    }
    if (d.miniprogram_appid || d.miniprogram_name) {
      successRate += 3
      positiveFactors.push('已提供经营场景信息')
    }
    if (d.refund_policy) {
      successRate += 5
      positiveFactors.push('有完善的退款政策')
    }
    if (d.contact_phone) {
      successRate += 2
      positiveFactors.push('已提供联系电话')
    }
    if (/处理完|已解决|已退款/.test(d.complaint_status || '')) {
      successRate += 10
      positiveFactors.push('投诉已处理完毕')
    }
    if (appealCtx.risk?.factors?.length) {
      for (const f of appealCtx.risk.factors.slice(0, 2)) {
        if (!riskFactors.includes(f)) riskFactors.push(f)
      }
    }

    successRate = Math.max(10, Math.min(95, successRate))

    const forceGen = req.query.generate === '1' || req.query.regenerate === '1'
    const snapResult = await ensureAppealGuideSnapshot(req.params.id, d, {
      force: forceGen,
      trackAIUsage,
    })
    const aiSnapshot = snapResult.snapshot

    if (aiSnapshot?.industry_steps?.length) {
      for (const extra of aiSnapshot.industry_steps.slice(0, 4)) {
        steps.push({
          id: `industry_${(extra.title || 'extra').slice(0, 12)}`,
          title: extra.title || '行业专属建议',
          priority: extra.priority || 'recommended',
          icon: '🏭',
          description: extra.description || '',
          actions: [],
          tips: '由 AI 根据您的行业与违规原因生成',
          time_estimate: '视情况而定',
        })
      }
    }

    if (aiSnapshot?.material_notes?.length) {
      const matStep = steps.find(s => s.id === 'prepare_materials')
      if (matStep) matStep.ai_material_notes = aiSnapshot.material_notes
    }

    res.json({
      steps,
      success_estimate: {
        rate: successRate,
        level: successRate >= 75 ? 'high' : successRate >= 50 ? 'medium' : 'low',
        risk_factors: riskFactors,
        positive_factors: positiveFactors,
      },
      violation_info: {
        type: violationReason || '未知',
        problem: d.problem_type || '未知',
        industry: d.industry || '未知',
        industry_key: appealCtx.industry.key || null,
        has_complaints: hasComplaints,
        is_first_appeal: isFirstAppeal,
      },
      industry_context: appealCtx.industry,
      violation_context: appealCtx.violation,
      completeness: appealCtx.completeness,
      missing_fields: appealCtx.completeness.missingCritical,
      auto_checked_materials: appealCtx.autoCheckedMaterials || [],
      material_checks: materialChecks,
      suggested_material_checks: materialChecks,
      industry_tip: d._industry_tip || null,
      ai_snapshot: aiSnapshot,
      snapshot_meta: {
        generated: snapResult.generated,
        reason: snapResult.reason,
      },
    })
  } catch (err) {
    console.error('Appeal guide error:', err)
    res.status(500).json({ error: '生成申诉指导失败' })
  }
}

export async function handlePostAppealGuideGenerate(req, res) {
  try {
    const session = await getSession(req.params.id)
    if (!session) return res.status(404).json({ error: '会话不存在' })
    const d = parseCollected(session)
    const result = await ensureAppealGuideSnapshot(req.params.id, d, { force: true, trackAIUsage })
    res.json({
      success: !!result.snapshot,
      snapshot: result.snapshot,
      reason: result.reason,
      completeness: result.ctx?.completeness,
    })
  } catch (err) {
    console.error('Appeal guide generate error:', err)
    res.status(500).json({ error: err.message || '生成失败' })
  }
}

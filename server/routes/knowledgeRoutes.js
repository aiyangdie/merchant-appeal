import express from 'express';

const router = express.Router();

const MERCHANT_TYPE_KNOWLEDGE = {
  ordinary: {
    name: '普通商户',
    description: '商户自行申请入驻微信支付，无服务商协助，直接与微信支付对接。',
    features: ['可独立收款', '收款能力较强', '不可成为服务商的特约商户', '资金直接结算到商户账户'],
    advantages: [
      '直接对接微信支付，无中间商',
      '资金直接到账，无分账延迟',
      '支持所有支付场景',
      '支持企业付款到零钱'
    ],
    limitations: [
      '需要认证服务号（300元/年）',
      '需要技术对接能力',
      '需自行处理风控问题'
    ]
  },
  special: {
    name: '特约商户',
    description: '由普通服务商协助完成入驻的商户，是服务商的下级商户，又称子商户。',
    features: ['由服务商赋予商户号', '依赖服务商的支付服务系统', '可同时成为多个服务商的特约商户'],
    advantages: [
      '入驻便捷，无需认证服务号',
      '费率优惠（通常0.3%）',
      '服务商协助处理问题'
    ],
    limitations: [
      '无法使用App支付、网站支付',
      '数据流必须经过服务商',
      '收款能力相对较弱'
    ]
  },
  service: {
    name: '服务商',
    description: '为特约商户提供支付能力服务的商户，是微信支付生态的重要组成部分。',
    features: ['自身不能作为普通商户直接发起交易', '可发展特约商户成为下级', '可赚取分佣和手续费'],
    advantages: [
      '可拓展多个下级商户',
      '可获得分佣收入',
      '帮助商户对接微信支付'
    ],
    limitations: [
      '技术门槛较高',
      '需要提供客服支持',
      '需要协助商户处理问题'
    ]
  }
};

const RISK_TYPE_KNOWLEDGE = {
  TRANSACTION_ANOMALY: {
    type: 'TRANSACTION_ANOMALY',
    name: '涉嫌实时交易异常',
    description: '商户交易行为触发风控策略，可能由于交易量波动、刷单、高频退款等原因。',
    commonReasons: [
      '近期店铺内交易量存在较大波动',
      '店铺内可能存在刷单行为',
      '高频退款或投诉率激增',
      '资金快进快出'
    ],
    suggestedMaterials: [
      '营业执照',
      '法人身份证',
      '门头照片+内景照片',
      '近3个月交易小票',
      '异常原因说明',
      '整改措施说明'
    ],
    improvementSuggestions: [
      '保持交易量稳定增长',
      '避免集中大额交易',
      '建立完善的订单管理系统',
      '设置交易预警机制'
    ]
  },
  TRANSACTION_DISPUTE: {
    type: 'TRANSACTION_DISPUTE',
    name: '涉嫌交易纠纷',
    description: '商户未妥善处理客诉，导致被投诉。',
    commonReasons: [
      '虚假宣传，商品/服务与描述不符',
      '商品质量问题',
      '服务态度差、流程不规范',
      '售后不到位'
    ],
    suggestedMaterials: [
      '所有投诉订单的全额退款凭证',
      '与用户的完整沟通记录',
      '整改说明',
      '客服响应机制优化文件'
    ],
    improvementSuggestions: [
      '优化宣传内容，避免夸大宣传',
      '建立客服响应机制（24小时回复）',
      '完善售后政策（7天无理由退换）',
      '制定整改时间表'
    ]
  },
  GAMBLING: {
    type: 'GAMBLING',
    name: '涉嫌赌博',
    description: '为赌博平台提供支付服务或交易模式类似赌博。',
    commonReasons: [
      '为赌博平台提供支付服务',
      '交易模式类似赌博（下注、开奖）',
      '资金归集明显',
      '涉及虚拟商品交易'
    ],
    suggestedMaterials: [
      '营业执照',
      '完整交易流水（3个月）',
      '业务说明（详细描述主营业务）',
      '合规经营承诺书'
    ],
    improvementSuggestions: [
      '立即停止相关业务',
      '建立交易监控措施',
      '进行风险排查'
    ]
  },
  MERCHANT_FRAUD: {
    type: 'MERCHANT_FRAUD',
    name: '涉嫌商户欺诈',
    description: '商户收款后未提供服务或存在欺诈行为。',
    commonReasons: [
      '用户付款后未收到商品',
      '商户收款后失联',
      '虚假宣传骗取付款',
      '收款不发货'
    ],
    suggestedMaterials: [
      '完整发货记录（带物流单号）',
      '与买家的沟通记录',
      '物流跟踪截图',
      '所有涉及订单的退款凭证'
    ],
    improvementSuggestions: [
      '建立完善的订单管理系统',
      '确保发货时效',
      '建立客服响应机制',
      '优化售后流程'
    ]
  },
  CROSS_CATEGORY: {
    type: 'CROSS_CATEGORY',
    name: '涉嫌跨类目经营',
    description: '实际经营内容超出营业执照经营范围。',
    commonReasons: [
      '营业执照经营范围不包含实际业务',
      '实际经营内容超出范围',
      '涉及敏感商品/服务'
    ],
    suggestedMaterials: [
      '最新营业执照（经营范围需包含实际业务）',
      '行业许可证（如有）',
      '业务说明',
      '调整经营范围证明'
    ],
    improvementSuggestions: [
      '更新营业执照经营范围',
      '立即停止未开放业务',
      '申请新类目（如需）'
    ]
  },
  NO_QUALIFICATION: {
    type: 'NO_QUALIFICATION',
    name: '涉嫌无资质经营',
    description: '缺少相关经营资质或证照过期。',
    commonReasons: [
      '营业执照过期',
      '缺少行业许可证',
      '法人身份证过期',
      '证照信息与商户平台不一致'
    ],
    suggestedMaterials: [
      '最新营业执照',
      '法人身份证正反面',
      '行业许可证（如有）',
      '变更证明（如有信息变更）'
    ],
    improvementSuggestions: [
      '更新过期证照',
      '补齐缺失资质',
      '确保证照信息一致'
    ]
  },
  ADJUSTMENT_ORDER: {
    type: 'ADJUSTMENT_ORDER',
    name: '调单',
    description: '微信要求商户提供交易凭证核实。',
    commonReasons: [
      '持卡人否认交易',
      '怀疑虚假交易',
      '交易凭证丢失',
      '信用卡盗刷调查'
    ],
    suggestedMaterials: [
      '订单凭证（带订单号）',
      '交易小票（清晰可读）',
      '物流凭证（快递单、签收单）',
      '发票（如有）'
    ],
    improvementSuggestions: [
      '妥善保存所有交易凭证',
      '建立凭证存档系统',
      '确保交易小票清晰可读'
    ]
  },
  NO_TRANSACTION: {
    type: 'NO_TRANSACTION',
    name: '无交易风控',
    description: '商户长时间未产生交易。',
    commonReasons: [
      '商户长时间（通常3个月以上）未产生交易',
      '入驻完成后未进行任何交易',
      '账户长期不使用'
    ],
    suggestedMaterials: [
      '营业执照',
      '法人身份证',
      '经营场所照片',
      '业务模式说明'
    ],
    improvementSuggestions: [
      '尽快产生真实交易',
      '说明长期无交易的原因',
      '提供经营计划证明'
    ]
  }
};

const FAQ_KNOWLEDGE = [
  {
    id: 1,
    question: '商户号申诉需要多长时间？',
    answer: '普通申诉一般1-7个工作日完成审核，复杂申诉可能需要15天以上。如需加急，可拨打95017转3（商户专线）催办。'
  },
  {
    id: 2,
    question: '申诉材料必须使用原件吗？',
    answer: '是的，所有材料必须使用真实原件。复印件除非加盖公章，否则不被接受。照片需清晰可读，不能使用美颜相机拍摄导致信息不清晰。'
  },
  {
    id: 3,
    question: '申诉被驳回后还能重新申诉吗？',
    answer: '可以。被驳回后，需要先查看驳回原因，按原因补充材料或进行整改，然后再重新提交申诉。建议在重新申诉前先咨询客服。'
  },
  {
    id: 4,
    question: '一个商户号可以同时有多个申诉吗？',
    answer: '不可以。一个商户号同时只能有一个进行中的申诉。如果需要提交新申诉，需要先取消或完成当前的申诉。'
  },
  {
    id: 5,
    question: '申诉提交后可以撤回吗？',
    answer: '在审核过程中无法撤回。如果确实需要取消，可以联系客服说明原因请求协助。'
  }
];

router.get('/merchant-types', (req, res) => {
  res.json({
    success: true,
    data: MERCHANT_TYPE_KNOWLEDGE
  });
});

router.get('/merchant-types/:type', (req, res) => {
  const { type } = req.params;
  const knowledge = MERCHANT_TYPE_KNOWLEDGE[type];

  if (!knowledge) {
    return res.status(404).json({
      success: false,
      error: { code: 'E404', message: '商户类型不存在' }
    });
  }

  res.json({
    success: true,
    data: knowledge
  });
});

router.get('/risk-types', (req, res) => {
  const riskTypes = Object.values(RISK_TYPE_KNOWLEDGE).map(risk => ({
    type: risk.type,
    name: risk.name,
    description: risk.description
  }));

  res.json({
    success: true,
    data: riskTypes
  });
});

router.get('/risk-types/:riskType', (req, res) => {
  const { riskType } = req.params;
  const knowledge = RISK_TYPE_KNOWLEDGE[riskType];

  if (!knowledge) {
    const matchedKey = Object.keys(RISK_TYPE_KNOWLEDGE).find(
      key => key.toLowerCase() === riskType.toLowerCase() ||
             RISK_TYPE_KNOWLEDGE[key].name.includes(riskType)
    );

    if (matchedKey) {
      return res.json({
        success: true,
        data: RISK_TYPE_KNOWLEDGE[matchedKey]
      });
    }

    return res.status(404).json({
      success: false,
      error: { code: 'E404', message: '风控类型不存在' }
    });
  }

  res.json({
    success: true,
    data: knowledge
  });
});

router.get('/faqs', (req, res) => {
  res.json({
    success: true,
    data: FAQ_KNOWLEDGE
  });
});

router.get('/faqs/:id', (req, res) => {
  const { id } = req.params;
  const faq = FAQ_KNOWLEDGE.find(f => f.id === parseInt(id));

  if (!faq) {
    return res.status(404).json({
      success: false,
      error: { code: 'E404', message: 'FAQ不存在' }
    });
  }

  res.json({
    success: true,
    data: faq
  });
});

export default router;

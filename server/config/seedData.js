// ========== 内置知识库：成功案例 + 违规原因专业知识 ==========

// 内置成功案例（覆盖常见处罚类型和行业）
export const BUILT_IN_CASES = [
  {
    id: 'builtin_1',
    title: '餐饮行业交易拦截申诉成功',
    industry: '餐饮',
    problem_type: '交易拦截',
    violation_reason: '涉嫌交易异常',
    difficulty: 1,
    success_summary: '提供门店实景照片+3笔真实外卖订单凭证+美团店铺截图，一次申诉通过',
    key_strategy: '重点证明交易真实性，提供外卖平台店铺链接和近期真实订单的完整交易链路',
    appeal_points: [
      '提供门头照+内景照+厨房照共6张',
      '提供3笔微信支付订单号对应的美团/饿了么订单截图',
      '附上食品经营许可证和卫生许可证',
      '说明近期交易量增长是因为新店开业促销活动'
    ],
    timeline: '提交后3个工作日通过'
  },
  {
    id: 'builtin_2',
    title: '电商零售交易限额申诉成功',
    industry: '电商',
    problem_type: '收款限额',
    violation_reason: '涉嫌交易异常',
    difficulty: 2,
    success_summary: '说明双十一大促导致交易波动，提供店铺后台数据和物流发货记录',
    key_strategy: '用数据说话，提供历史交易趋势对比图，证明交易量增长有合理商业原因',
    appeal_points: [
      '提供小程序商城后台30天交易数据截图',
      '附上5笔订单的完整链路：下单-发货-物流-签收',
      '提供进货合同和供应商发票',
      '说明交易量激增原因是参加了平台促销活动'
    ],
    timeline: '提交后5个工作日通过'
  },
  {
    id: 'builtin_3',
    title: '教育培训关闭支付权限(交易纠纷)申诉成功',
    industry: '教育',
    problem_type: '支付权限关闭',
    violation_reason: '涉嫌交易纠纷',
    difficulty: 3,
    success_summary: '全部投诉原路退款+消费者撤诉+完善退费政策，二次申诉通过',
    key_strategy: '先处理所有投诉（原路全额退款），让消费者在微信投诉界面留言撤诉，再提交申诉',
    appeal_points: [
      '逐一联系所有投诉用户，协商退款并取得谅解',
      '提供每笔投诉的退款凭证截图',
      '引导消费者在微信投诉页面留言"已解决，撤销投诉"',
      '提交完善的退费政策文件：7天无理由退费、课程不满意随时退',
      '附上办学许可证和师资证明'
    ],
    timeline: '首次驳回，补充退款凭证后二次申诉5个工作日通过'
  },
  {
    id: 'builtin_4',
    title: '生活服务关闭支付权限(跨类目经营)申诉成功',
    industry: '生活服务',
    problem_type: '支付权限关闭',
    violation_reason: '涉嫌跨类目经营',
    difficulty: 3,
    success_summary: '补充营业执照经营范围证明+下架不符商品+变更经营类目',
    key_strategy: '承认问题并积极整改，下架超出类目的商品/服务，申请变更为正确类目',
    appeal_points: [
      '提供最新营业执照，标注经营范围中包含实际经营的业务',
      '截图证明已下架所有不符合注册类目的商品/服务',
      '如经营范围确实不包含，先去工商变更经营范围再申诉',
      '提交整改报告，说明已梳理全部商品确保与类目一致',
      '附上门店实景照片证明实际经营场景'
    ],
    timeline: '提交后7个工作日通过'
  },
  {
    id: 'builtin_5',
    title: '美妆零售关闭支付权限(交易异常)申诉成功',
    industry: '零售',
    problem_type: '支付权限关闭',
    violation_reason: '涉嫌交易异常',
    difficulty: 3,
    success_summary: '解释新店开业交易激增原因+提供品牌授权+进货凭证',
    key_strategy: '用完整的供应链证据证明商品来源正规，用营销活动解释交易量波动',
    appeal_points: [
      '提供品牌授权书或正规渠道进货合同',
      '附上近期5笔订单的发货单+物流单+签收截图',
      '提供产品质检报告',
      '说明新店开业期间做了朋友圈推广和优惠活动导致订单激增',
      '提供门店实景照片和商品陈列照片'
    ],
    timeline: '提交后5个工作日通过'
  },
  {
    id: 'builtin_6',
    title: '数码产品资金冻结申诉成功',
    industry: '零售',
    problem_type: '资金冻结',
    violation_reason: '涉嫌交易异常',
    difficulty: 4,
    success_summary: '提供结算账户信息+全部交易流水+进货发票，资金180天后全额解冻',
    key_strategy: '资金冻结案件重点是证明资金来源合法，提供结算账户开户信息配合验证',
    appeal_points: [
      '提供结算账户开户银行+账户后四位配合身份验证',
      '导出全部交易流水并标注每笔订单对应的商品',
      '提供进货发票和供应商合同证明货源正规',
      '拨打95017转3提供商户号+结算账户后四位催促审核',
      '提交法人手持身份证+营业执照照片'
    ],
    timeline: '申诉通过后资金分批解冻，共耗时约15个工作日'
  },
  {
    id: 'builtin_7',
    title: '食品行业关闭支付权限(被驳回后二次申诉)成功',
    industry: '餐饮',
    problem_type: '支付权限关闭',
    violation_reason: '涉嫌交易纠纷',
    difficulty: 4,
    success_summary: '首次驳回原因是"投诉未妥善处理"，补充退款凭证和撤诉截图后通过',
    key_strategy: '被驳回后先打95017转3询问具体驳回原因，针对性补充材料，切勿盲目重复提交',
    appeal_points: [
      '拨打95017转3，提供商户号查询具体驳回原因',
      '针对"投诉未妥善处理"：逐一联系投诉用户办理退款',
      '收集每笔退款的微信转账截图作为凭证',
      '引导用户在投诉页面确认"已解决"',
      '重新提交时在整改说明中详细列出每笔投诉的处理结果',
      '两次申诉间隔了5天，避免频繁提交'
    ],
    timeline: '首次申诉被驳回，间隔5天二次申诉后4个工作日通过'
  },
  {
    id: 'builtin_8',
    title: '保健品行业关闭支付权限(多级分销)申诉成功',
    industry: '健康',
    problem_type: '支付权限关闭',
    violation_reason: '涉嫌多级分销返利',
    difficulty: 4,
    success_summary: '证明分销模式为一级分佣非多级，提供分销规则截图和佣金结构说明',
    key_strategy: '重点证明不是多级分销：只有一级推荐奖励，无门槛费，非传销模式',
    appeal_points: [
      '提供分销系统后台截图，证明只有一级分佣',
      '提交分销规则文档：无入门费、无囤货要求、可随时退出',
      '提供佣金结构说明：仅推荐人获得一次性佣金，无多层级',
      '附上产品质检报告和经营资质',
      '整改说明：已调整分销规则，确保符合微信规范'
    ],
    timeline: '提交后7个工作日通过'
  },
  {
    id: 'builtin_9',
    title: '服装零售信用卡套现嫌疑申诉成功',
    industry: '零售',
    problem_type: '收款限额',
    violation_reason: '涉嫌信用卡套现',
    difficulty: 3,
    success_summary: '提供真实交易凭证证明非套现，附上发货物流记录',
    key_strategy: '用真实的商品交易链路证明每笔大额交易都有对应的真实商品和物流',
    appeal_points: [
      '提供5笔大额订单的完整交易链路：订单详情-商品照片-发货单-物流单号-签收记录',
      '附上进货合同和供应商发票',
      '说明大额交易原因（如批发客户、企业团购等）',
      '提供客户沟通记录截图证明交易真实性',
      '提交门店实景照和商品库存照片'
    ],
    timeline: '提交后5个工作日限额恢复正常'
  },
  {
    id: 'builtin_10',
    title: '科技公司延迟结算申诉成功',
    industry: '科技',
    problem_type: '资金冻结',
    violation_reason: '涉嫌交易异常',
    difficulty: 3,
    success_summary: '提供软件著作权+服务合同+客户验收报告，证明SaaS订阅收入合法',
    key_strategy: 'SaaS/技术服务类需要用合同和交付证明来解释订阅制收费模式的合理性',
    appeal_points: [
      '提供软件著作权证书',
      '附上3-5份客户服务合同（脱敏处理）',
      '提供客户验收报告或使用反馈',
      '说明SaaS订阅制收费模式：按月/年收费，非一次性大额交易',
      '提供结算账户信息配合资金验证'
    ],
    timeline: '提交后5个工作日结算恢复正常'
  },
  {
    id: 'builtin_11',
    title: '微商/社交电商交易拦截申诉成功',
    industry: '微商',
    problem_type: '交易拦截',
    violation_reason: '涉嫌交易异常',
    difficulty: 2,
    success_summary: '提供朋友圈经营记录+客户聊天截图+发货物流凭证，证明社交电商模式真实',
    key_strategy: '微商模式的关键是证明交易真实性：每笔交易都有真实的客户沟通、下单、发货记录',
    appeal_points: [
      '提供朋友圈/社群经营的截图记录（近1个月）',
      '提供3-5笔订单的完整链路：客户微信聊天→转账/付款→发货单→物流单号→签收',
      '提供进货渠道证明（供应商聊天记录、进货单、转账记录）',
      '说明交易量增长原因（如参加团购活动、节日促销等）',
      '如有实体仓库，提供仓库库存照片'
    ],
    timeline: '提交后3-5个工作日通过'
  },
  {
    id: 'builtin_12',
    title: '游戏陪玩/代练交易限额申诉成功',
    industry: '游戏',
    problem_type: '收款限额',
    violation_reason: '涉嫌交易异常',
    difficulty: 2,
    success_summary: '提供陪玩平台入驻证明+接单记录+客户评价，证明服务真实',
    key_strategy: '游戏服务类需重点证明有真实的服务交付，每笔收款都对应真实的陪玩/代练服务',
    appeal_points: [
      '提供陪玩平台（比心、捞月狗等）的入驻截图和接单记录',
      '提供5笔订单对应的服务记录：接单截图+游戏对局截图+客户评价',
      '说明收费标准和服务模式',
      '如果是独立接单，提供客户沟通记录和转账对应的服务内容'
    ],
    timeline: '提交后3个工作日限额恢复'
  },
  {
    id: 'builtin_13',
    title: '直播带货支付权限关闭申诉成功',
    industry: '直播',
    problem_type: '支付权限关闭',
    violation_reason: '涉嫌交易异常',
    difficulty: 3,
    success_summary: '提供直播回放+下单截图+发货记录，证明直播带货交易真实',
    key_strategy: '直播电商的核心证据是直播回放录屏+实时下单记录+发货物流，形成完整证据链',
    appeal_points: [
      '提供近期3场直播回放截图或录屏片段',
      '提供直播间商品列表和价格截图',
      '提供5笔订单的完整链路：直播间下单→订单详情→发货→物流→签收',
      '提供供应商合作合同或进货凭证',
      '说明直播频次、场均观众、场均GMV等经营数据'
    ],
    timeline: '提交后5-7个工作日通过'
  },
  {
    id: 'builtin_14',
    title: '知识付费/在线教育交易纠纷申诉成功',
    industry: '教育',
    problem_type: '交易拦截',
    violation_reason: '涉嫌交易纠纷',
    difficulty: 3,
    success_summary: '处理全部退款+完善售后政策+提供课程交付证明，二次申诉通过',
    key_strategy: '知识付费要证明课程真实交付、已处理所有投诉退款、有完善的退费机制',
    appeal_points: [
      '逐一处理所有退款申请，提供退款凭证',
      '提供课程内容截图/录屏证明课程真实存在且有价值',
      '提供学员评价和学习记录截图',
      '制定完善的退费政策：7天无理由退费、课程不满意全额退款',
      '附上教师资质证明（如有）'
    ],
    timeline: '处理退款后二次申诉5个工作日通过'
  },
  {
    id: 'builtin_15',
    title: '跨境代购商户号封禁申诉成功',
    industry: '代购',
    problem_type: '商户号封禁',
    violation_reason: '涉嫌欺诈',
    difficulty: 5,
    success_summary: '提供海关清关单+正品购买凭证+品牌授权，经法人视频认证后解封',
    key_strategy: '代购/跨境类封禁最难，需要海关凭证+正品证明+法人亲自认证的全套材料',
    appeal_points: [
      '提供海关进口报关单/清关单',
      '提供海外购买凭证（商场小票、电商订单截图）',
      '提供品牌授权书或代理协议（如有）',
      '提供商品防伪验证截图',
      '准备法人视频认证：法人本人+身份证+营业执照出镜',
      '间隔7天以上再提交二次申诉'
    ],
    timeline: '首次驳回，间隔7天后提交完善材料+法人视频认证后10个工作日通过'
  },
  {
    id: 'builtin_16',
    title: '盲盒/潮玩收款限额申诉成功',
    industry: '盲盒',
    problem_type: '收款限额',
    violation_reason: '涉嫌交易异常',
    difficulty: 2,
    success_summary: '提供商品实拍+发货记录+经营资质，证明盲盒销售业务真实合规',
    key_strategy: '盲盒类重点证明商品真实存在、价值合理、非赌博性质',
    appeal_points: [
      '提供盲盒商品实拍照片（含包装和内容物）',
      '提供采购合同和进货发票',
      '说明盲盒定价机制和商品价值范围，证明非赌博性质',
      '提供5笔订单的发货物流截图',
      '附上营业执照（经营范围含玩具/礼品销售）'
    ],
    timeline: '提交后3个工作日限额恢复'
  }
]

// 违规原因专业知识库（按违规原因分类）
export const VIOLATION_KNOWLEDGE = {
  '交易异常': {
    aliases: ['交易异常', '异常交易', '交易波动', '交易量异常'],
    severity: 3,
    description: '微信风控系统检测到交易模式异常，如短时间内交易量激增、交易金额异常、交易时间异常等',
    appeal_key_points: [
      '用数据解释交易量变化的合理原因（促销、季节性、新店开业等）',
      '提供3-5笔真实订单的完整交易链路证据',
      '提供门店/仓库实景照片证明有真实经营场景',
      '如有进货合同/发票，务必提供'
    ],
    required_materials: ['营业执照', '法人身份证', '门店照片', '交易凭证(3-5笔)', '业务模式说明'],
    common_rejection_reasons: ['交易凭证不足', '无法证明交易真实性', '业务模式说明不清晰'],
    success_key: '关键是让审核人员相信每笔交易都有真实的商品/服务交付',
    estimated_success_rate: '首次申诉70-85%'
  },
  '交易纠纷': {
    aliases: ['交易纠纷', '消费者投诉', '投诉率', '纠纷', '用户投诉'],
    severity: 3,
    description: '消费者投诉率超标或存在大量未处理的交易纠纷',
    appeal_key_points: [
      '先处理所有未解决的投诉（原路全额退款是最有效的方式）',
      '引导消费者在微信投诉页面留言"已解决，撤销投诉"',
      '提交完善的退款/售后政策文件',
      '在整改说明中逐条列出每笔投诉的处理结果'
    ],
    required_materials: ['退款凭证', '消费者撤诉截图', '完善的退款政策', '投诉处理记录表', '整改措施说明'],
    common_rejection_reasons: ['仍有未处理投诉', '退款凭证不完整', '消费者未确认撤诉'],
    success_key: '必须100%处理完所有投诉，最好让消费者在投诉页面确认"已解决"',
    estimated_success_rate: '投诉全部处理后80-90%'
  },
  '跨类目经营': {
    aliases: ['跨类目', '类目不符', '经营范围不符', '超范围经营', '未开放类目', '无资质经营'],
    severity: 3,
    description: '实际经营内容与注册的商户类目不一致，或经营了微信未开放的类目',
    appeal_key_points: [
      '如果营业执照经营范围包含实际业务：提供执照证明',
      '如果不包含：先去工商变更经营范围，再申诉',
      '下架所有不符合注册类目的商品/服务',
      '申请变更商户类目为实际经营类目'
    ],
    required_materials: ['最新营业执照', '已下架截图', '类目变更申请', '整改报告', '门店实景照片'],
    common_rejection_reasons: ['仍有超出类目的商品在售', '营业执照经营范围不含', '未提供整改证据'],
    success_key: '先整改再申诉，确保所有在售商品/服务都在注册类目范围内',
    estimated_success_rate: '整改到位后75-85%'
  },
  '信用卡套现': {
    aliases: ['套现', '信用卡套现', '信用卡', '大额交易'],
    severity: 4,
    description: '交易模式疑似信用卡套现：大额交易无对应商品、交易双方关联、交易后快速退款等',
    appeal_key_points: [
      '提供每笔大额交易对应的真实商品/服务交付证据',
      '提供发货单、物流单号、签收记录的完整链路',
      '解释大额交易的合理商业原因（批发、团购等）',
      '提供进货合同和供应商发票证明货源真实'
    ],
    required_materials: ['完整交易链路(5笔以上)', '进货合同/发票', '物流发货记录', '客户沟通记录', '门店/仓库照片'],
    common_rejection_reasons: ['交易链路不完整', '无法证明商品真实交付', '交易对手关联性存疑'],
    success_key: '每笔被质疑的交易都需要有从下单到签收的完整证据链',
    estimated_success_rate: '证据充分时60-75%'
  },
  '商户欺诈': {
    aliases: ['欺诈', '诈骗', '虚假宣传', '假货', '售假'],
    severity: 5,
    description: '被判定为欺诈行为，如销售假冒伪劣商品、虚假宣传、收款不发货等',
    appeal_key_points: [
      '提供商品正品证明（品牌授权书、进货发票、质检报告）',
      '提供真实发货记录和物流信息',
      '如有虚假宣传嫌疑，提供已修改的宣传材料截图',
      '处理所有消费者投诉并提供退款凭证'
    ],
    required_materials: ['品牌授权/进货证明', '质检报告', '发货物流记录', '退款处理凭证', '整改后宣传截图'],
    common_rejection_reasons: ['无法提供正品证明', '仍有未处理投诉', '宣传内容仍有违规'],
    success_key: '欺诈类最难申诉，必须有铁证证明商品为正品且已完全整改',
    estimated_success_rate: '40-60%（难度最高）'
  },
  '赌博风险': {
    aliases: ['赌博', '博彩', '棋牌', '彩票'],
    severity: 5,
    description: '交易模式疑似赌博或博彩类业务',
    appeal_key_points: [
      '如果确实不涉及赌博，提供完整的业务模式说明',
      '提供产品/服务截图证明经营内容合法',
      '如果是棋牌/游戏类，证明无真实货币兑换功能',
      '提供软件著作权或游戏版号'
    ],
    required_materials: ['业务模式详细说明', '产品截图/演示', '软件著作权/版号', '营业执照', '法人声明书'],
    common_rejection_reasons: ['业务模式说明不够详细', '产品功能疑似涉赌', '无法提供资质证明'],
    success_key: '赌博类极难申诉，如确实不涉赌需要非常详细的业务证明',
    estimated_success_rate: '30-50%（极难）'
  },
  '多级分销': {
    aliases: ['分销', '多级分销', '传销', '返利', '拉人头'],
    severity: 4,
    description: '分销模式被判定为多级分销或类传销模式',
    appeal_key_points: [
      '证明分销模式为一级分佣，非多级（只有直接推荐人获得佣金）',
      '证明无入门费、无囤货要求、可随时退出',
      '提供分销系统后台截图和佣金结构说明',
      '整改分销规则确保符合微信规范'
    ],
    required_materials: ['分销规则文档', '分销后台截图', '佣金结构说明', '整改报告', '营业执照'],
    common_rejection_reasons: ['分销层级超过一级', '存在入门费机制', '佣金结构不透明'],
    success_key: '微信只允许一级分销，必须证明分销层级不超过一层',
    estimated_success_rate: '整改后65-80%'
  },
  '色情风险': {
    aliases: ['色情', '涉黄', '低俗', '不雅'],
    severity: 5,
    description: '内容或交易涉嫌色情、低俗',
    appeal_key_points: [
      '如果是误判，提供产品/服务的完整展示截图',
      '清理所有可能被误判的内容',
      '提供业务模式说明证明经营内容合法',
      '提交整改报告'
    ],
    required_materials: ['产品/内容截图', '已整改证据', '业务模式说明', '营业执照', '整改承诺书'],
    common_rejection_reasons: ['仍有疑似违规内容', '整改不彻底', '业务模式说明不清'],
    success_key: '必须彻底清理所有可能被误判的内容，提供清理前后对比截图',
    estimated_success_rate: '30-50%（极难）'
  },
  '洗钱风险': {
    aliases: ['洗钱', '反洗钱', '资金来源', '可疑交易', '大额可疑'],
    severity: 5,
    description: '交易模式被反洗钱系统标记，涉嫌利用商户号进行资金清洗',
    appeal_key_points: [
      '提供所有大额交易对应的真实合同和发票',
      '证明资金流向清晰可追溯，每笔进出都有商业背景',
      '提供公司银行流水与微信交易的对账报告',
      '如涉及跨境业务，提供外汇许可和海关报关单',
      '提供公司反洗钱内控制度文件'
    ],
    required_materials: ['商业合同', '银行流水对账', '发票/收据', '反洗钱内控制度', '法人声明书', '外汇许可（跨境）'],
    common_rejection_reasons: ['资金流向不清晰', '交易缺乏商业背景', '无法提供合同/发票支撑'],
    success_key: '每笔被标记交易都需要有合同+发票+物流/服务交付证明的三方印证',
    estimated_success_rate: '35-55%（极难，需法律专业支持）'
  },
  '内容违规': {
    aliases: ['内容违规', '违反法律法规', '违法内容', '敏感内容', '政治敏感', '侵权内容'],
    severity: 4,
    description: '发布的商品描述、宣传文案或页面内容违反相关法规或平台规则',
    appeal_key_points: [
      '立即下架/修改所有被标记的违规内容',
      '提供修改前后的对比截图，证明已彻底整改',
      '如是误判（如合规医疗器械被判为违禁品），提供相关资质证明',
      '建立内容审核机制，提交内容管理制度文件',
      '承诺后续所有上架内容经过合规审核'
    ],
    required_materials: ['违规内容整改截图', '整改报告', '内容审核制度', '相关资质证明（如有）', '法人承诺书'],
    common_rejection_reasons: ['仍有违规内容未清理', '整改不彻底', '缺少相关经营资质'],
    success_key: '先彻底整改再申诉，提供清理前后对比截图和内容管理制度',
    estimated_success_rate: '55-75%（整改到位后较乐观）'
  },
  '虚假交易': {
    aliases: ['虚假交易', '刷单', '虚假订单', '自买自卖', '虚构交易'],
    severity: 4,
    description: '交易被判定为虚假，如自买自卖、刷单刷量、无真实商品交付的空壳交易',
    appeal_key_points: [
      '提供被质疑交易的完整证据链：下单→付款→发货→物流→签收',
      '证明买卖双方无关联关系（非同一人/同一公司/亲属）',
      '提供物流实际配送记录和签收照片',
      '如确实有刷单行为，承认并说明已停止、已处罚涉事人员',
      '提供真实客户的评价和复购记录'
    ],
    required_materials: ['完整交易链路(5笔以上)', '物流签收记录', '客户沟通记录', '进货凭证', '商品实拍照', '整改报告'],
    common_rejection_reasons: ['交易链路不完整', '买卖双方存在关联', '物流信息异常'],
    success_key: '用无可辩驳的物流和签收证据证明交易真实存在',
    estimated_success_rate: '50-70%（取决于证据完整度）'
  },
  '异地收款': {
    aliases: ['异地收款', '异地交易', '收款地点异常', '地理位置异常'],
    severity: 2,
    description: '商户注册地与实际收款地不一致，触发地理位置风控',
    appeal_key_points: [
      '说明异地收款的合理原因（分支机构、外出展销、出差等）',
      '提供异地经营的证明材料（分店执照、展会邀请函等）',
      '如有多地经营，提供各地门店照片和员工证明',
      '说明业务模式本身就需要多地收款（如物流、上门服务等）'
    ],
    required_materials: ['异地经营证明', '分店/分支机构证明', '业务模式说明', '门店照片（各地）'],
    common_rejection_reasons: ['无法解释异地收款原因', '缺少异地经营证明'],
    success_key: '合理解释异地收款的商业原因，提供辅助证明',
    estimated_success_rate: '80-90%（通常容易解决）'
  }
}

// 根据违规原因匹配知识
export function matchViolation(text) {
  if (!text) return null
  const t = text.toLowerCase()
  for (const [key, info] of Object.entries(VIOLATION_KNOWLEDGE)) {
    if (info.aliases.some(a => t.includes(a))) return { key, ...info }
  }
  return null
}

// 根据处罚类型和行业匹配最相关的内置案例
export function matchBuiltInCases(problemType, industry, violationReason) {
  const pt = (problemType || '').toLowerCase()
  const ind = (industry || '').toLowerCase()
  const vr = (violationReason || '').toLowerCase()

  return BUILT_IN_CASES
    .map(c => {
      let score = 0
      const cpt = (c.problem_type || '').toLowerCase()
      const cind = (c.industry || '').toLowerCase()
      const cvr = (c.violation_reason || '').toLowerCase()
      // 处罚类型匹配权重最高
      if (pt && cpt.includes(pt)) score += 5
      if (pt && pt.includes(cpt)) score += 3
      // 违规原因匹配
      if (vr && cvr.includes(vr)) score += 4
      if (vr && vr.includes(cvr)) score += 2
      // 行业匹配
      if (ind && cind.includes(ind)) score += 2
      if (ind && ind.includes(cind)) score += 1
      return { ...c, _score: score }
    })
    .filter(c => c._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 3)
}

// 风险评分引擎：根据收集的数据评估申诉难度和成功率
export function assessRisk(collectedData) {
  const d = collectedData
  let riskScore = 50 // 基准分50，越高越难
  let factors = []
  let tips = []

  // 1. 处罚类型评估
  const pt = (d.problem_type || '').toLowerCase()
  if (pt.includes('封禁')) { riskScore += 30; factors.push('商户号封禁是最严重的处罚') }
  else if (pt.includes('冻结')) { riskScore += 20; factors.push('资金冻结案件难度较高') }
  else if (pt.includes('关闭')) { riskScore += 15; factors.push('支付权限关闭需要充分的申诉材料') }
  else if (pt.includes('限额')) { riskScore += 5; factors.push('交易限额相对较容易申诉') }
  else if (pt.includes('拦截')) { riskScore -= 5; factors.push('交易拦截通常较容易解决') }

  // 2. 违规原因评估
  const vr = (d.violation_reason || '').toLowerCase()
  if (vr.includes('赌博') || vr.includes('色情')) { riskScore += 25; factors.push('涉赌/涉黄类违规申诉极难') }
  else if (vr.includes('洗钱') || vr.includes('反洗钱')) { riskScore += 25; factors.push('涉嫌洗钱极难申诉，建议寻求法律支持') }
  else if (vr.includes('欺诈') || vr.includes('诈骗') || vr.includes('售假')) { riskScore += 20; factors.push('欺诈类违规需要大量正品证明') }
  else if (vr.includes('虚假交易') || vr.includes('刷单')) { riskScore += 18; factors.push('虚假交易需提供完整物流签收证据') }
  else if (vr.includes('套现')) { riskScore += 15; factors.push('套现嫌疑需要完整交易链路证明') }
  else if (vr.includes('分销') || vr.includes('传销')) { riskScore += 10; factors.push('分销模式需证明仅一级分佣') }
  else if (vr.includes('内容违规') || vr.includes('违反法律')) { riskScore += 10; factors.push('内容违规需彻底整改后申诉') }
  else if (vr.includes('跨类目') || vr.includes('类目')) { riskScore += 5; factors.push('跨类目经营需整改后申诉') }
  else if (vr.includes('纠纷') || vr.includes('投诉')) { riskScore += 5; factors.push('交易纠纷需先处理所有投诉') }
  else if (vr.includes('异地') || vr.includes('地点异常')) { riskScore -= 5; factors.push('异地收款通常较容易解释') }
  else if (vr.includes('异常')) { riskScore += 0; factors.push('交易异常是最常见的处罚原因') }

  // 2.5 敏感行业评估（来自行业智能检测）
  if (d._sensitive_industry) {
    const sr = d._sensitive_risk || ''
    if (sr === '极高') { riskScore += 25; factors.push(`行业属于「${d._sensitive_industry}」，风险极高`) }
    else if (sr === '高') { riskScore += 15; factors.push(`行业属于「${d._sensitive_industry}」，风险较高`) }
    else if (sr === '中高') { riskScore += 10; factors.push(`行业属于「${d._sensitive_industry}」，需注意合规`) }
    else if (sr === '中') { riskScore += 5; factors.push(`行业属于「${d._sensitive_industry}」，建议准备资质证明`) }
    tips.push('敏感行业申诉需要更充分的合规证明和业务真实性证据')
  }

  // 3. 投诉情况评估
  const cs = (d.complaint_status || '').toLowerCase()
  if (cs.includes('很多') || cs.includes('大量') || cs.includes('多')) { riskScore += 10; factors.push('投诉较多会增加申诉难度'); tips.push('建议先处理完所有投诉再申诉') }
  else if (cs.includes('没有') || cs.includes('无') || cs.includes('已处理')) { riskScore -= 5; factors.push('无投诉或已处理是好信号') }

  // 4. 申诉历史评估
  const ah = (d.appeal_history || '').toLowerCase()
  if (ah.includes('驳回') || ah.includes('失败') || ah.includes('拒绝')) {
    riskScore += 15; factors.push('有被驳回历史，需针对性改进')
    tips.push('建议先打95017转3查询具体驳回原因')
    tips.push('切勿盲目重复提交相同材料')
  } else if (ah.includes('没有') || ah.includes('无') || ah.includes('第一次')) {
    riskScore -= 5; factors.push('首次申诉，成功率相对较高')
  }

  // 5. 资金冻结特殊评估
  if (pt.includes('冻结') || pt.includes('延迟结算')) {
    if (d.bank_name && d.bank_account_last4) {
      riskScore -= 5; tips.push('已提供结算账户信息，有助于资金验证和催审')
    } else {
      tips.push('资金冻结案件建议提供结算账户信息，方便拨打95017催审')
    }
  }

  // 计算等级和成功率
  riskScore = Math.max(10, Math.min(95, riskScore))
  let level, successRate
  if (riskScore <= 30) { level = '低'; successRate = '80-95%' }
  else if (riskScore <= 50) { level = '中'; successRate = '65-80%' }
  else if (riskScore <= 70) { level = '较高'; successRate = '45-65%' }
  else { level = '高'; successRate = '30-50%' }

  return { riskScore, level, successRate, factors, tips }
}

// 生成个性化材料清单
export function generateMaterialChecklist(collectedData) {
  const d = collectedData
  const pt = (d.problem_type || '').toLowerCase()
  const vr = (d.violation_reason || '').toLowerCase()

  let checklist = [
    { item: '营业执照照片（清晰完整）', required: true, category: '证件信息' },
    { item: '法人身份证正反面照片', required: true, category: '证件信息' },
    { item: '法人手持身份证照片', required: true, category: '证件信息' },
  ]

  // 经营场景照片
  const bm = (d.business_model || '').toLowerCase()
  if (bm.includes('线下') || bm.includes('门店') || bm.includes('实体')) {
    checklist.push({ item: '门店门头照片', required: true, category: '经营信息' })
    checklist.push({ item: '门店内景照片（体现经营范围）', required: true, category: '经营信息' })
    checklist.push({ item: '营业场景地点定位截图', required: false, category: '经营信息' })
  }
  if (bm.includes('线上') || bm.includes('小程序') || bm.includes('电商') || bm.includes('网')) {
    checklist.push({ item: '小程序/商城后台截图', required: true, category: '经营信息' })
    checklist.push({ item: '商品列表页面截图', required: true, category: '经营信息' })
  }

  // 交易凭证
  checklist.push({ item: '3-5笔微信支付订单号（4开头28位）', required: true, category: '交易凭证' })
  checklist.push({ item: '订单对应的商品/服务凭证', required: true, category: '交易凭证' })

  // 根据违规原因添加特殊材料
  if (vr.includes('纠纷') || vr.includes('投诉')) {
    checklist.push({ item: '所有投诉的退款凭证截图', required: true, category: '投诉处理' })
    checklist.push({ item: '消费者撤诉/确认已解决的截图', required: true, category: '投诉处理' })
    checklist.push({ item: '完善的退款售后政策文件', required: true, category: '投诉处理' })
  }
  if (vr.includes('跨类目') || vr.includes('类目')) {
    checklist.push({ item: '已下架不符商品/服务的截图', required: true, category: '整改证据' })
    checklist.push({ item: '类目变更申请截图', required: false, category: '整改证据' })
  }
  if (vr.includes('套现') || vr.includes('异常')) {
    checklist.push({ item: '进货合同/供应商发票', required: true, category: '交易凭证' })
    checklist.push({ item: '发货单+物流单号+签收记录', required: true, category: '交易凭证' })
  }
  if (vr.includes('欺诈') || vr.includes('售假')) {
    checklist.push({ item: '品牌授权书', required: true, category: '正品证明' })
    checklist.push({ item: '产品质检报告', required: true, category: '正品证明' })
  }
  if (vr.includes('分销')) {
    checklist.push({ item: '分销规则文档', required: true, category: '业务证明' })
    checklist.push({ item: '分销后台截图（显示仅一级）', required: true, category: '业务证明' })
    checklist.push({ item: '佣金结构说明', required: true, category: '业务证明' })
  }
  if (vr.includes('洗钱') || vr.includes('反洗钱') || vr.includes('可疑交易')) {
    checklist.push({ item: '商业合同（与交易对应）', required: true, category: '资金证明' })
    checklist.push({ item: '银行流水与微信交易对账报告', required: true, category: '资金证明' })
    checklist.push({ item: '增值税发票/收据', required: true, category: '资金证明' })
    checklist.push({ item: '反洗钱内控制度文件', required: false, category: '合规文件' })
    checklist.push({ item: '法人声明书（声明资金合法）', required: true, category: '合规文件' })
  }
  if (vr.includes('内容违规') || vr.includes('违反法律') || vr.includes('敏感内容')) {
    checklist.push({ item: '违规内容整改前后对比截图', required: true, category: '整改证据' })
    checklist.push({ item: '内容审核管理制度文件', required: true, category: '整改证据' })
    checklist.push({ item: '相关经营资质证明（如有）', required: false, category: '资质证明' })
  }
  if (vr.includes('虚假交易') || vr.includes('刷单') || vr.includes('自买自卖')) {
    checklist.push({ item: '物流实际签收记录（含签收照片）', required: true, category: '交易凭证' })
    checklist.push({ item: '客户真实沟通记录截图', required: true, category: '交易凭证' })
    checklist.push({ item: '商品实拍照片（含包装和标签）', required: true, category: '交易凭证' })
    checklist.push({ item: '客户评价/复购记录截图', required: false, category: '交易凭证' })
  }
  if (vr.includes('赌博') || vr.includes('棋牌')) {
    checklist.push({ item: '软件著作权登记证书', required: true, category: '资质证明' })
    checklist.push({ item: '游戏用户协议（含禁止变现条款）', required: true, category: '业务证明' })
    checklist.push({ item: '游戏内商城/交易系统截图（证明无变现功能）', required: true, category: '业务证明' })
  }

  // 资金冻结特殊材料
  if (pt.includes('冻结') || pt.includes('延迟结算')) {
    checklist.push({ item: '结算账户开户信息', required: true, category: '账户信息' })
    checklist.push({ item: '交易流水明细导出', required: true, category: '交易凭证' })
  }

  // 商户号封禁特殊材料
  if (pt.includes('封禁')) {
    checklist.push({ item: '法人手持身份证+营业执照合影（视频认证用）', required: true, category: '证件信息' })
    checklist.push({ item: '近6个月银行流水', required: false, category: '交易凭证' })
  }

  // 通用整改材料
  checklist.push({ item: '整改措施说明书', required: true, category: '整改文件' })
  checklist.push({ item: '业务模式说明', required: true, category: '整改文件' })

  return checklist
}

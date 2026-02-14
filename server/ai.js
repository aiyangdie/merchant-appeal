import { getSystemConfig, getActiveAIModel } from './db.js'
import { countTokens, countMessagesTokens } from './tokenizer.js'
import { loadActiveRulesForPrompt } from './evolution.js'
import { loadProductCatalogForPrompt } from './mall.js'

// ========== 多模型 AI Provider 抽象层 ==========

/**
 * 读取当前激活的 AI 模型配置（从 ai_models 表）
 * 支持传入 customApiKey 覆盖系统配置
 */
async function getAIConfig(customApiKey = null) {
  const active = await getActiveAIModel()
  const temperature = parseFloat((await getSystemConfig('ai_temperature')) || '0.7')

  if (active) {
    return {
      provider: active.provider,
      apiKey: customApiKey || active.api_key,
      model: active.model_name,
      endpoint: active.endpoint,
      temperature,
    }
  }

  // 回退：从旧 system_config 读取（兼容）
  const provider = (await getSystemConfig('ai_provider')) || 'deepseek'
  const FALLBACK = {
    deepseek: { key: 'deepseek_api_key', model: 'deepseek_model', defaultModel: 'deepseek-chat', endpoint: 'https://api.deepseek.com/chat/completions' },
    zhipu:    { key: 'zhipu_api_key',    model: 'zhipu_model',    defaultModel: 'glm-4.7-flash', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions' },
  }
  const fb = FALLBACK[provider] || FALLBACK.deepseek
  return {
    provider,
    apiKey: customApiKey || await getSystemConfig(fb.key),
    model: (await getSystemConfig(fb.model)) || fb.defaultModel,
    endpoint: fb.endpoint,
    temperature,
  }
}

// ========== AI Chat 集成（多模型支持） ==========

const BASE_SYSTEM_PROMPT = `你是"全平台商户号申诉战略顾问"，拥有8年微信支付/支付宝/抖音/快手/美团等全平台风控申诉实战经验，累计处理1800+商户申诉案件，整体成功率82%，二次申诉成功率71%。你的核心价值是帮商家用最少的时间和成本解决商户号问题。

## 用户水平自动识别（极其重要）
你必须在前2轮对话中判断用户的经验水平，并自动调整沟通方式：

### 小白用户特征（占80%）
- 说话口语化："商户号被封了咋办""微信不让收钱了"
- 不知道专业术语：不知道什么是"风控""申诉""商户号"在哪看
- 对流程完全陌生："我该怎么办""第一次遇到"
- 焦虑、着急

**应对方式**：
- 用最简单的大白话，避免专业术语
- 每步都给具体操作指引："打开微信→搜索'商家助手'→点进去→看到..."
- 多用鼓励语气："别担心，这种情况我见多了，能搞定的~"
- 主动告诉用户去哪找信息："不知道商户号的话，打开'微信支付商家助手'小程序首页就能看到"
- 问题更简单直白

### 老手用户特征（占20%）
- 会用专业术语："涉嫌交易异常""风控触发""二次申诉"
- 了解申诉流程：知道95017、知道商户平台在哪
- 可能申诉过：提到被驳回、补充材料
- 目标明确，希望高效

**应对方式**：
- 直接用专业语言沟通
- 跳过基础解释，专注策略分析
- 提供更深层的风控逆向分析
- 给出进阶技巧和案例对比

## 核心规则
1. **每次只问一个问题**，等客户回答后再问下一个。
2. **你是对话的主导者**——根据用户回答自主决定下一步收集什么信息，不依赖固定顺序。
3. 收集完所有关键信息后，系统会自动触发报告生成。
4. 生成的材料必须**语言正式、措辞合理、可直接复制提交**，每部分控制在300字以内。
5. **回答问题时，必须结合用户的具体数据给出针对性回答**，禁止泛泛的通用回答。
6. 你要主动思考和推理——分析用户的行业特点、违规可能原因、最优申诉策略，而不是被动收集信息。
7. 用户一条消息中可能包含多个字段的信息（如行业+处罚类型），全部接收并确认，不要只关注一个。
8. **用户说"不懂""帮我看看""不知道怎么办"时**，不要问他不懂什么，而是主动引导："没关系，我来问您几个简单问题就能帮您分析了~先说说您是做什么生意的？"

## 三层深度推理框架（你的核心竞争力）

### 第一层：风控触发推演（拿到信息后5秒内完成）
收到行业+违规原因后，立即在脑中推演完整因果链：
- 这个行业的典型交易模式是什么？（频率、金额、时间分布、对手方特征）
- 微信风控的哪一层（规则引擎/模型层/人工审核）最可能触发？
- 具体触发点是什么？（如：客单价突然变高→套现模型触发；退款率>5%→纠纷规则触发）
- 是误判还是确实存在风险？如果是误判，误判的原因是什么？

### 第二层：证据链逆向设计（基于触发点反推）
根据推演出的触发点，反向设计证据体系：
- 需要什么类型的证据来反驳风控判定？
- 证据之间如何形成完整链条？（下单→付款→发货→物流→签收→评价 = 完整交易闭环）
- 哪些证据是审核人员最看重的？（行业不同，重点不同）
- 如果用户缺少某些证据，有什么替代方案？

### 第三层：战略决策（综合判断最优路径）
- 先申诉还是先处理投诉？先整改还是先提交？
- 需不需要先打95017摸底？
- 是否建议用户同时准备Plan B（如新主体申请）？
- 时间窗口：补充资料通道24小时限制、二次申诉间隔3-5天、连续5次失败风险

## 全平台风控知识体系

### 微信支付风控体系（最核心）
风控分为三层：
1. **规则引擎层**：基于交易金额、频率、时间等硬性规则触发
   - 单日交易量突增300%以上 → 交易异常
   - 退款率>5% → 交易纠纷预警
   - 单笔>5000元且无历史大额交易 → 套现模型触发
   - 同一IP/设备多商户收款 → 关联风控
   - 凌晨1-6点密集交易 → 异常时段预警
2. **模型层**：机器学习分析交易模式
   - 交易对手集中度（>50%来自同一人→疑似自买自卖）
   - 退款闭环检测（收款后快速原路退回→疑似套现）
   - 行业偏离检测（注册餐饮但交易模式像电商→跨类目）
   - 地理位置异常（注册北京但收款全在广州→异地风控）
3. **人工审核层**：模型标记后由人工复核
   - 审核人员关注：材料真实性、证据完整度、整改诚意
   - 审核人员可以看到商户的真实交易数据
   - 一个审核员平均每天处理50-80个案件，材料要让他一眼看到重点

申诉的本质是：用充分的证据说服人工审核人员，让他相信你的交易是真实合规的。审核员能看到你的底层数据，所以任何编造的数字都会被识破。

### 支付宝/蚂蚁商户风控体系
- 处罚类型：花呗/信用卡收款关闭、资金冻结、账户限制、商户号注销
- 申诉渠道：支付宝商家服务→账户管理→申诉入口 / b.alipay.com 商户后台
- 特点：对投诉率容忍度比微信更低（>0.5%即触发）；更注重芝麻信用和经营时长
- 电话：95188转商户服务
- 核心区别：支付宝更重视「持续经营稳定性」，申诉材料需强调经营时长和稳定交易

### 抖音/抖店风控体系
- 处罚类型：店铺扣分、保证金扣除、限制提现、封店
- 申诉渠道：抖店后台→违规管理→申诉 / 飞鸽客服
- 特点：抖音侧重商品质量和发货时效；直播带货的坑位费纠纷是高频问题
- 核心区别：需要提供商品质检报告、发货物流截图；直播录屏是强力证据

### 快手/快手小店风控
- 处罚类型：限流、扣保证金、关店、封号
- 申诉渠道：快手商家后台→违规申诉
- 特点：对内容违规（虚假宣传）查得特别严
- 核心区别：需配合平台运营规则，内容合规是前提

### 美团商户风控
- 处罚类型：下架门店、限制接单、扣款、解约
- 申诉渠道：美团商家后台→店铺管理→申诉
- 特点：关注差评率、退款率、食品安全合规
- 核心区别：门店实拍+食品资质+好评截图是核心证据

### 微信风控处罚类型（按严重度排序）
- **交易拦截**（难度⭐）：用户付款时被拦截，通常是阶段性风控，申诉相对容易。首次成功率85-95%
- **收款限额**（难度⭐⭐）：日收款额度被下调，常见于交易波动触发风控。成功率80-92%
- **支付权限关闭**（难度⭐⭐⭐）：无法使用微信支付收款，需提交完整申诉材料。成功率65-80%
- **资金冻结/延迟结算**（难度⭐⭐⭐⭐）：已收资金被冻结，需提供结算账户信息配合验证。成功率55-70%
- **商户号封禁**（难度⭐⭐⭐⭐⭐）：最严重，需全套材料+可能法人视频认证。成功率40-60%

## 各行业深度申诉策略

### 微商/社交电商
- 风控触发点：交易对手高度集中、无物流信息、朋友圈经营无平台背书
- 核心证据：朋友圈经营记录+客户聊天截图+发货物流凭证+收发货地址不同
- 实战案例："之前有个做朋友圈卖护肤品的客户，被判交易异常，我们帮她整理了30条朋友圈发布记录+10个客户的微信聊天下单截图+对应快递单号，3个工作日就通过了"
- 避坑：如果是一件代发，需要额外提供供应商合作协议

### 游戏/陪玩/代练
- 风控触发点：虚拟服务无实物交付、高频小额交易、用户群体年轻化（未成年风险）
- 核心证据：平台入驻证明+接单记录+游戏对局截图+客户评价
- 实战案例："一个比心陪玩的客户收款限额，我们提供了比心平台入驻截图+20条接单记录+客户5星好评截图，5天恢复正常"
- 避坑：如果涉及游戏充值代充，需要证明货源合法

### 直播带货
- 风控触发点：短时间大量交易、退货率高、商品质量投诉
- 核心证据：直播回放录屏+实时下单记录+发货物流+进货凭证
- 实战案例："一个抖音带货的客户微信商户号被关，我们用3场直播录屏+对应下单截图+发货单+物流签收记录打了个翻身仗，7个工作日恢复"

### 知识付费/教育培训
- 风控触发点：预付费+退费纠纷、效果争议、虚假师资宣传
- 核心证据：课程交付证明+学员评价+完善退费机制+师资证明
- 实战案例："在线课程平台退款投诉率过高，先帮客户处理了全部12笔退款，让5个客户在投诉页面确认撤诉，再提交申诉，二次申诉5天通过"

### 跨境代购
- 风控触发点：大额交易+跨境收付+品牌侵权嫌疑
- 核心证据：海关清关单+正品购买凭证+品牌授权+法人视频认证
- 实战案例："代购奢侈品商户号被封，最难的案例。用海关进口报关单+专柜购买小票+品牌代理协议+法人亲自录视频认证，前后花了20天才解封"

### 盲盒/潮玩
- 风控触发点：概率消费≈赌博嫌疑、定价不透明、用户投诉
- 核心证据：商品实拍+定价机制说明+概率公示截图+证明非赌博性质
- 实战案例："盲盒商户收款限额，关键是证明：每个盲盒都有实物、价值≥售价、概率公开透明、有保底机制。3天解决"

### 餐饮外卖
- 风控触发点：突然交易量激增（新店开业）、食品安全投诉
- 核心证据：门店实景6张以上+外卖平台店铺截图+食品安全资质+真实订单
- 实战案例："新开的奶茶店做活动交易量翻了5倍被风控，提供门店照片+美团店铺截图+食品经营许可证+活动海报，3天解封"

### SaaS/技术服务
- 风控触发点：订阅制大额入账、B2B交易缺少C端特征
- 核心证据：软件著作权+服务合同+客户验收报告+演示截图
- 实战案例："SaaS公司延迟结算，提供了软著证书+5份客户合同（脱敏）+系统后台截图+客户使用反馈，5天解决"

### 财税/企业服务
- 风控触发点：代理记账属于B2B，交易模式不像C端消费
- 核心证据：代理记账许可证+服务合同+客户签章确认书
- 实战案例："企业年报服务小程序被限额，提供了代账许可证+10份服务合同+客户好评截图，一周恢复"

### 美容/医美
- 风控触发点：预付费+高客单价+效果争议投诉
- 核心证据：卫生许可证+从业人员资质+门店实景+服务价目表公示
- 避坑：任何功效类宣传用语都可能触发广告法合规检查

### 珠宝/奢侈品
- 风控触发点：高单价+售假投诉+品牌侵权嫌疑
- 核心证据：品牌授权书+GIA/国检鉴定证书+进货发票+门店实景
- 避坑：每件商品都要有可追溯的鉴定证书

## 违规原因深度分析与申诉关键

### 涉嫌交易异常（最常见，成功率最高）
- 风控模型关注：交易量突变比、平均客单价偏离、交易时段分布、交易对手分散度
- 申诉关键：用数据解释交易波动的具体原因（促销活动、季节性旺季、新店开业、媒体曝光引流）
- 必须提供：3-5笔真实订单的完整链路（下单→付款→发货→物流→签收）
- 加分项：历史交易趋势对比图、活动策划方案截图、推广投放记录

### 涉嫌交易纠纷（处理投诉是前提）
- 风控规则：投诉率>万分之25触发预警，>万分之50触发处罚
- 申诉前必须做：100%处理所有投诉（原路全额退款），引导消费者在微信投诉页面确认"已解决"
- 文案策略：承认投诉存在→分析原因→展示已处理结果→说明改进措施
- 绝对禁忌：投诉没处理完就申诉，100%被驳回

### 涉嫌信用卡套现
- 风控模型关注：大额交易无对应商品、收款后快速退款、交易双方关联（同IP/设备/地理位置）
- 申诉关键：每笔被质疑交易都需要从下单到签收的完整证据链
- 必须提供：5笔以上完整交易链路+进货合同+供应商发票+物流签收
- 加分项：客户沟通记录、不同收货地址证明买家非同一人

### 涉嫌跨类目经营
- 风控检测：实际交易商品与注册类目不符
- 先整改再申诉：下架不符商品→变更工商经营范围→申请变更商户类目→提交申诉
- 必须提供：最新营业执照+已下架截图+整改报告
- 时间策略：如需变更工商范围，预留5-10个工作日

### 涉嫌多级分销
- 风控检测：佣金结构超过一层、存在入门费、有囤货机制
- 申诉关键：证明仅一级分佣、无入门费、无囤货要求、分销员可随时退出
- 必须提供：分销后台截图+佣金结构文档+分销规则说明

### 涉嫌欺诈/售假
- 风控检测：品牌侵权投诉、商品质量投诉、收款不发货
- 申诉关键：正品证明是核心——品牌授权书+进货发票+质检报告
- 必须提供：品牌授权链条（从品牌方到经销商到你的完整链路）
- 极难案例：如果确实有虚假宣传，先承认并修改所有材料，用诚意打动审核

### 涉嫌赌博/色情
- 申诉难度极高（成功率<50%），需非常详细的业务证明
- 棋牌类：必须有游戏版号/软著+防沉迷系统+实名认证+无现金兑换证明
- 社交类：内容审核机制说明+违规内容整改截图+7×24审核团队证明
- 建议：如果业务确实有擦边内容，先彻底整改，再考虑申诉

### 涉嫌洗钱/资金异常
- 申诉难度极高，建议寻求法律专业支持
- 每笔被标记交易需要：合同+发票+物流/服务交付证明三方印证
- 如涉及跨境：外汇许可+海关报关单+反洗钱内控制度

## 申诉材料四大模块
1. **证件信息**：法人身份证正反面、手持身份证照、营业执照
2. **经营信息**：业务模式说明（必须详细）+ 经营场景照片（线下门店6张以上，线上商城3-5张截图）
3. **交易凭证**：3-5笔微信支付订单号（4开头28位）+ 对应商品凭证（形成闭环证据链）
4. **补充材料**：投诉处理凭证、整改文件、结算账户信息（资金冻结案件）、行业资质证明

## 实战技巧大全

### 关键申诉技巧
- 订单号必须是4开头28位的微信支付订单号，不是商户系统订单号
- 投诉处理只认：原路全额退款或消费者在微信投诉界面留言撤诉
- 补充资料通道一般只开放24小时，超时直接维持原判
- 被驳回后打95017转3问具体原因，别盲目重新提交
- 连续申诉5次不通过可能变更为"不支持申诉"
- 材料按"交易单号+处理凭证+整改说明"用表格整理
- 二次申诉必须有增量证据，不能只是重复提交
- 申诉文案要站在审核人员角度写，让他一眼看到关键信息
- 最佳提交时间：工作日上午9-11点，避开周末和节假日
- 申诉材料PDF/Word格式比纯图片更专业，审核人员更容易阅读
- 每张图片标注序号和说明（如"图1：营业执照"），方便审核对照
- 不要堆砌重复材料，审核员时间有限，材料要精炼有力

### 95017电话策略（实战经验）
- 转3是商户专线，转1是个人用户线（别转错）
- 身份验证需要：商户号+结算账户后四位+法人姓名
- 首次打电话是摸底：问清楚具体违规详情和需要什么材料
- 提交后第3个工作日打催审电话最合适（太早没用，太晚错过窗口期）
- 态度要诚恳但不卑微，表达"我们已经整改，材料已准备齐全"
- 如果客服说"等通知"，追问"大概需要多少个工作日？"锁定时间
- 记录每次通话的客服工号和回复内容，后续跟进有据可查
- 黄金时段：工作日上午10-11点接通率最高，下午4-5点人少好沟通

### 申诉提交渠道（按优先级）
1. 微信支付商户平台 pay.weixin.qq.com → 账户中心 → 风险信息 → 申诉（最正式）
2. 微信支付商家助手小程序 → 风险处理 → 申诉（移动端方便）
3. 拨打95017转3人工提交（适合复杂案件或被系统拒绝的情况）

### 二次申诉黄金法则
- 间隔时间：至少3-5个工作日，不要连续提交（会被标记为恶意申诉）
- 必须有增量证据：新的订单凭证、新的整改措施、客户撤诉截图等
- 针对驳回原因逐条回应：审核人员说"证据不足"就补证据，说"投诉未处理"就处理投诉
- 二次申诉文案开头要写"针对X月X日驳回意见，我们已做如下补充"
- 三次被驳回后建议咨询专业律师或找有经验的申诉代理
- 第二次申诉的材料量应该是第一次的1.5-2倍

### 常见新手错误（帮用户避坑）
- ❌ 用商户系统订单号代替微信支付订单号（4开头28位）
- ❌ 只提交营业执照不提交交易凭证
- ❌ 投诉没处理完就申诉（100%被驳回）
- ❌ 申诉文案全是情绪化表达，没有事实和证据
- ❌ 材料拍照模糊、截图不完整
- ❌ 周末/节假日提交（无人审核）
- ❌ 被驳回后立刻重新提交相同材料
- ❌ 编造不存在的数据（审核员能看到真实交易数据）
- ❌ 一次性提交过多材料导致审核员找不到重点

### 结算账户相关
- 资金冻结案件必须提供结算账户开户银行和账户后四位
- 拨打95017转3催审时需要提供商户号+结算账户后四位验证身份
- 申诉成功后资金3-5个工作日自动解冻到结算账户
- 未申诉的冻结期一般为180天
- 冻结期间可以正常提交申诉，不需要等180天期满

## 阶段性诊断行为规范

### 收到行业信息时
立刻给出行业洞察："您做XX行业的，这个行业最常见的风控问题是XX，申诉重点是XX。我之前处理过很多类似案件..."

### 收到处罚类型时
立刻给出难度评估："XX处罚属于X难度，首次申诉成功率大概在XX%左右。关键是要准备好XX材料..."

### 收到违规原因时（最关键的信息）
立刻执行三层推理，给出完整诊断：
① 风控触发分析："根据我的经验，这个违规原因通常是因为XX触发了风控系统..."
② 证据链规划："要反驳这个判定，我们需要准备XX、XX、XX这几类核心证据..."
③ 案例引用："之前有个做XX的客户也是这个情况，用了XX方法，X天就通过了"
④ 风险预警（如有）："不过需要注意，如果您有XX情况，需要先处理好再申诉"

### 收到投诉信息时
如果有未处理投诉，立刻预警："⚠️ 投诉未处理是申诉被驳回的第一大原因！建议您先100%处理完投诉再提交申诉。处理方式是..."

### 收到申诉历史时
如果有被驳回经历，立刻调整策略："被驳回过的案件需要换个打法。建议先打95017转3查一下具体驳回原因，这样我可以针对性地帮您优化材料"

## 信息收集流程（AI-First：你全权驱动）
你负责通过自然对话收集以下关键信息，顺序由你根据对话上下文灵活决定：
- 核心三要素（必须优先）：行业类型、处罚类型、违规原因
- 商户基本信息：商户号、商户名称、公司全称、统一社会信用代码
- 法人信息：法人姓名、身份证后四位
- 业务信息：经营模式、投诉情况、退款政策
- 账户信息：开户银行、结算账户后四位、联系电话
- 申诉历史：是否申诉过、结果如何

收集策略：
- 先问核心三要素，拿到后立刻给出专业诊断，让用户感受到价值
- 用户主动提供的额外信息要全部接收，不要忽略
- 用户说"不知道"或"忘了"的非必填字段可跳过，不要反复追问
- 收到关键信息后自然过渡到下一个问题，不要机械地逐项询问

## 生成报告格式
当收到buildReportPrompt的指令时，输出完整报告，每部分≤300字，语言正式严谨，可直接复制用于微信申诉提交。报告包含：案情评估、投诉处理方法、退款规则、投诉原因详情、业务模式、整改说明，以及详细的申诉提交指南。

## 报价参考（在案情评估中自然提及）
| 案件类型 | 难度 | 参考价格 |
|---------|------|--------|
| 交易拦截（首次） | 低 | 500-800元 |
| 交易限额（有投诉） | 中低 | 800-1500元 |
| 关闭支付权限 | 中 | 1500-2500元 |
| 关闭支付+被驳回过 | 高 | 2500-4000元 |
| 资金冻结/复杂案件 | 极高 | 4000-6000元 |

## 对话风格
- 简洁专业，像真人顾问聊天，不像机器人填表
- 每次回复控制在3-5句话，不要长篇大论
- 每次只问一个问题
- 收到关键信息立刻给诊断，不要等收集完再分析
- 用户焦虑时先共情再给方案
- 给具体可执行的下一步，不给模糊建议
- 引用用户已提供的数据，体现个性化
- 少用emoji，最多1-2个，不要堆砌
- 句尾适当用~让语气亲和

## 工具引导
在关键节点简短提醒用户使用平台工具：
- 诊断完成→提醒顶部"申诉指导"
- 提到投诉→提醒"申诉指导→投诉话术"
- 提到95017→提醒"申诉指导→95017话术"
- 信息收集完→提醒"申诉文案"和"投诉材料"按钮
不要每次都提醒，用户知道了就不用重复。

## 商品推荐
案件复杂/用户说不会操作时，简短提一句"也有专业团队可以协助"，不要长篇推销。`

/**
 * 构建包含用户已收集数据的完整 system prompt
 * 让 AI 在回答问题时能参考用户数据，给出个性化回答
 * 同时注入 AI 自学习规则库中的活跃规则
 */
async function buildSystemPrompt(collectedData = {}) {
  // 加载 AI 自学习规则（从数据库）
  let dynamicRules = ''
  try { dynamicRules = await loadActiveRulesForPrompt() } catch { /* 规则加载失败不影响主流程 */ }

  // 加载商品目录（智能商城）
  let productCatalog = ''
  try { productCatalog = await loadProductCatalogForPrompt() } catch { /* 商品加载失败不影响主流程 */ }

  const keys = Object.keys(collectedData)
  if (keys.length === 0) return BASE_SYSTEM_PROMPT + dynamicRules + productCatalog

  const fieldLabels = {
    problem_type: '处罚类型', violation_reason: '违规原因',
    merchant_id: '商户号', merchant_name: '商户名称',
    company_name: '公司全称', license_no: '统一社会信用代码',
    legal_name: '法人姓名', legal_id_last4: '身份证后四位',
    industry: '所属行业', business_model: '经营模式',
    business_scenario: '经营场景', miniprogram_name: '小程序/公众号名称',
    miniprogram_appid: '小程序AppID', order_info: '交易订单信息',
    complaint_status: '投诉情况', refund_policy: '退款政策',
    bank_name: '开户银行', bank_account_last4: '结算账户后四位',
    contact_phone: '联系电话', appeal_history: '申诉历史',
  }

  let dataSection = '\n\n## 当前用户已提供的数据（回答问题时必须参考以下信息）\n\n'
  dataSection += '\n> 以下是用户已经提供的信息，回答任何问题时请结合这些具体数据给出针对性建议。不要忽略用户数据给出泛泛的通用回答。\n\n'
  for (const [key, value] of Object.entries(collectedData)) {
    if (key.startsWith('_')) continue
    if (value != null && String(value).trim()) {
      const label = fieldLabels[key] || key
      dataSection += `- **${label}**：${value}\n`
    }
  }

  // ===== 动态注入：违规原因专项诊断策略 =====
  const vr = (collectedData.violation_reason || '').toLowerCase()
  if (vr) {
    const violationDiag = []
    if (vr.includes('交易异常') || vr.includes('异常交易')) {
      violationDiag.push(`\n## 本案诊断：交易异常\n- 触发层：规则引擎（交易量突变>300%）或模型层（模式偏离）\n- 反驳：用合理商业原因解释波动（促销/旺季/新品/引流）\n- 证据链：3-5笔订单完整闭环（下单→付款→发货→物流→签收）\n- 加分：交易趋势对比图、活动方案截图、推广记录\n- 成功率：首次70-85%，材料充分可达90%`)
    }
    if (vr.includes('纠纷') || vr.includes('投诉')) {
      violationDiag.push(`\n## 本案诊断：交易纠纷\n关键前提：必须先处理完所有投诉再申诉，投诉未清零=100%被驳回\n- 风控规则：投诉率>万分之25预警，>万分之50处罚\n- 处理步骤：①联系投诉用户→②原路全额退款→③引导在投诉页面留言"已解决"→④等状态更新→⑤再提交申诉\n- 文案策略：承认投诉→分析原因→展示处理结果→说明改进措施\n- 有未处理投诉时，立即给出处理方案，不要继续收集其他信息`)
    }
    if (vr.includes('套现') || vr.includes('信用卡')) {
      violationDiag.push(`\n## 本案诊断：信用卡套现嫌疑\n- 风控关注：大额无商品、收款后快速退款、交易双方同IP/设备/地理位置\n- 反驳核心：每笔大额交易都要有完整商品交付证据链\n- 必须准备：5笔以上完整链路+进货合同+供应商发票+物流签收+不同收货地址\n- 审核员能看到交易数据，编造信息会被识破\n- 成功率：证据充分60-75%，不充分<40%`)
    }
    if (vr.includes('跨类目') || vr.includes('类目')) {
      violationDiag.push(`\n## 本案诊断：跨类目经营\n- 整改优先：下架不符商品→变更工商范围→申请变更类目→再申诉\n- 关键：营业执照经营范围是否包含实际业务？不包含需先工商变更（5-10工作日）\n- 成功率：整改到位后75-85%`)
    }
    if (vr.includes('分销') || vr.includes('传销')) {
      violationDiag.push(`\n## 本案诊断：多级分销\n- 微信铁律：只允许一级分销，超过一层=违规\n- 证明：仅直推佣金、无入门费、无囤货、可随时退出\n- 必须提供：分销后台截图+佣金结构文档+分销规则说明\n- 确实多级：先关闭多级功能、修改规则后再申诉`)
    }
    if (vr.includes('欺诈') || vr.includes('售假') || vr.includes('虚假')) {
      violationDiag.push(`\n## 本案诊断：欺诈/售假\n- 核心：必须用铁证证明正品\n- 证据链：品牌授权→经销商协议→进货发票→质检报告→物流签收\n- 有虚假宣传：承认+已修改+用诚意打动审核\n- 成功率：40-60%`)
    }
    if (vr.includes('赌博') || vr.includes('色情') || vr.includes('涉黄')) {
      violationDiag.push(`\n## 本案诊断：赌博/色情（极难，成功率<50%）\n- 棋牌类：版号/软著+防沉迷+实名认证+无现金兑换证明\n- 社交类：内容审核机制+违规整改截图+7×24审核团队证明\n- 有擦边内容先彻底整改再考虑申诉\n- Plan B：注销后换新主体+合规业务模式`)
    }
    if (vr.includes('洗钱') || vr.includes('资金异常')) {
      violationDiag.push(`\n## 本案诊断：洗钱/资金异常（极难，建议法律支持）\n- 每笔被标记交易：合同+发票+物流/服务交付证明三方印证\n- 跨境还需：外汇许可+海关报关单+反洗钱内控制度\n- 成功率：35-55%`)
    }
    if (violationDiag.length > 0) dataSection += violationDiag.join('\n')
  }

  // ===== 动态注入：行业专属策略 =====
  const industry = (collectedData.industry || '').toLowerCase()
  if (industry) {
    const industryStrategies = {
      '餐饮': '门店实景6张+食品经营许可证+美团/饿了么店铺截图+真实订单凭证。交易激增可用"新店开业/促销活动"解释',
      '零售': '进货凭证+品牌授权+产品质检+仓库实拍+物流合同。重点证明货源正规',
      '教育': '办学许可/备案+课程大纲+师资证明+学员评价+退费政策。预付费类先处理退款',
      '电商': '店铺后台数据+物流发货记录+好评截图+进货合同。直播带货需提供直播录屏',
      '游戏': '版号/软著+防沉迷系统+实名认证。涉及充值代充需证明货源合法',
      '陪玩社交': 'ICP备案+内容审核机制+实名认证记录+投诉处理记录。强调合规运营',
      '科技': '软件著作权+服务合同+客户验收报告。解释订阅制收费模式的合理性',
      '财税服务': '代理记账许可证+服务合同+客户确认书。解释B2B交易模式',
      '美容': '卫生许可证+从业资质+门店实景+价目表。注意广告法合规',
      '珠宝饰品': '品牌授权+鉴定证书+进货发票。每件商品都要可追溯',
      '盲盒潮玩': '商品实拍+概率公示+保底机制+非赌博性质证明',
      '健康': '医疗执业许可/药品经营许可+从业资质+产品检测报告。规范宣传用语',
      '知识付费': '内容团队介绍+课程大纲+试看机制+退款通道',
      '物流': '运输资质+车辆信息+保险凭证。完善货物追踪和理赔机制',
      '农业': '食品经营许可+产品检测+产地证明+冷链物流合同',
    }
    for (const [key, strategy] of Object.entries(industryStrategies)) {
      if (industry.includes(key)) {
        dataSection += `\n\n## ${key}行业申诉策略\n${strategy}\n`
        break
      }
    }
  }

  // ===== 动态注入：处罚类型专项应对 =====
  const pt = (collectedData.problem_type || '').toLowerCase()
  if (pt) {
    if (pt.includes('冻结') || pt.includes('延迟')) {
      dataSection += `\n\n## 资金冻结案件指引\n- 提醒用户提供结算账户信息（开户银行+后四位）\n- 95017转3用"商户号+结算账户后四位"验证催审\n- 成功后3-5工作日自动解冻；未申诉冻结期180天\n- 冻结期间可正常申诉\n`
    }
    if (pt.includes('封禁')) {
      dataSection += `\n\n## 商户号封禁案件指引\n- 难度最高，成功率40-60%，可能需法人视频认证\n- Plan B：注销条件（无违规+无余额+无投诉+30天无交易）→新主体申请\n- 材料要求极高：全套证件+详细业务说明+充分整改证据\n`
    }
  }

  // ===== 动态注入：申诉历史策略调整 =====
  const ah = (collectedData.appeal_history || '').toLowerCase()
  if (ah && (ah.includes('驳回') || ah.includes('失败') || ah.includes('不通过') || ah.includes('被拒'))) {
    dataSection += `\n\n## 二次申诉策略（有驳回历史）\n- 建议先打95017转3查具体驳回原因\n- 间隔至少3-5工作日再提交\n- 二次材料量应是首次的1.5-2倍\n- 文案开头写"针对X月X日驳回意见，已做如下补充"\n- 连续5次不通过可能被标记为"不支持申诉"\n`
  }

  // AI-First: 收集进度上下文（不再依赖 _current_step 门控）
  if (collectedData._current_step) {
    dataSection += `\n\n## 当前收集进度\n`
    dataSection += `进度：${collectedData._current_step}\n`
  }
  if (collectedData._collection_context) dataSection += collectedData._collection_context
  if (collectedData._instruction) dataSection += `\n${collectedData._instruction}\n`

  // 敏感行业特别提示
  if (collectedData._sensitive_industry) {
    dataSection += `\n**敏感行业：${collectedData._sensitive_industry}，风险：${collectedData._sensitive_risk || '未知'}。** 如实评估难度，强调合规资质，违规建议先整改。\n`
  }

  if (collectedData._industry_tip) {
    dataSection += `\n行业提示：${collectedData._industry_tip}\n`
  }

  return BASE_SYSTEM_PROMPT + dataSection + dynamicRules + productCatalog
}

const WELCOME_MESSAGE = `您好！我是全平台商户号申诉专家，8年实战经验，处理过1800+案件~

不管是交易拦截、收款限额、支付权限关闭、资金冻结还是商户号封禁，我都能帮您分析情况、制定方案、生成可直接提交的申诉材料。

💼 先简单说说您的情况吧——您是做什么业务的？遇到了什么问题？

随便说就行，比如"我做餐饮的，商户号被冻结了"，我就能开始帮您分析了~

💡 右侧面板会实时显示已收集的信息，方便您随时查看。
🔒 所有数据仅用于本次咨询。`

export function getWelcomeMessage() {
  return WELCOME_MESSAGE
}

// AI API 调用（统一多模型 — 支持所有 OpenAI 兼容接口）
async function callAIChat(chatHistory, customApiKey, collectedData = {}) {
  const cfg = await getAIConfig(customApiKey)
  if (!cfg.apiKey) return null

  const systemPrompt = await buildSystemPrompt(collectedData)
  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.map(m => ({
      role: m.role === 'admin' ? 'assistant' : (m.role === 'user' ? 'user' : 'assistant'),
      content: m.content,
    })),
  ]

  // 构建请求体（所有 OpenAI 兼容接口通用参数）
  const reqBody = { model: cfg.model, messages, temperature: cfg.temperature, max_tokens: 4096, top_p: 0.9, frequency_penalty: 0.3, presence_penalty: 0.2 }

  // 带超时和重试的请求
  const MAX_RETRIES = 2
  let res = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)
      res = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify(reqBody),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      break
    } catch (err) {
      console.error(`[${cfg.provider}] fetch attempt ${attempt + 1} failed:`, err.message)
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      }
    }
  }

  if (!res) {
    console.error(`[${cfg.provider}] all retries failed`)
    throw new Error('NETWORK_ERROR')
  }

  if (!res.ok) {
    const errText = await res.text()
    console.error(`[${cfg.provider}] API error:`, res.status, errText)
    const errCode = res.status
    if (errCode === 401) throw new Error('API_KEY_INVALID')
    if (errCode === 402) throw new Error('API_BALANCE_INSUFFICIENT')
    if (errCode === 429) throw new Error('API_RATE_LIMIT')
    throw new Error(`API_ERROR_${errCode}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || null
  if (!content) return null

  let inputTokens, outputTokens
  if (data.usage) {
    inputTokens = data.usage.prompt_tokens || 0
    outputTokens = data.usage.completion_tokens || 0
  } else {
    inputTokens = countMessagesTokens(messages)
    outputTokens = countTokens(content)
  }

  return { content, inputTokens, outputTokens }
}

// ========== 规则引擎（AI 不可用时的后备方案） ==========

const STEPS = {
  WELCOME: 0,
  ASK_PROBLEM: 1,       // 第1步：问处罚类型
  ASK_BUSINESS: 2,      // 第2步：问行业和经营模式
  ASK_VIOLATION: 3,     // 第3步：问违规原因
  ASK_COMPLAINT: 4,     // 第4步：问投诉情况
  ASK_REFUND: 5,        // 第5步：问退款售后流程
  ASK_APPEAL: 6,        // 第6步：问申诉历史
  GENERATE: 7,          // 生成评估报告 + 申诉材料
  DONE: 8,
}

// 根据情况评估难度和报价
function assessCase(d) {
  const problem = (d.problem || '').toLowerCase()
  const violation = (d.violation || '').toLowerCase()
  const appealHist = (d.appealHistory || '').toLowerCase()
  const hasAppealed = appealHist.includes('申诉过') || appealHist.includes('驳回') || appealHist.includes('维持') || (appealHist.length > 2 && !appealHist.includes('没') && !appealHist.includes('无') && !appealHist.includes('第一次') && !appealHist.includes('没有'))

  let difficulty, level, price, successRate

  if (problem.includes('冻结') || problem.includes('封禁')) {
    difficulty = '⭐⭐⭐⭐⭐ 非常困难'
    level = hasAppealed ? '极难' : '困难'
    price = hasAppealed ? '¥4500-6000' : '¥3500-5000'
    successRate = hasAppealed ? '50-65%' : '65-80%'
  } else if (problem.includes('关闭') || problem.includes('限制收款') || problem.includes('无法收款')) {
    difficulty = hasAppealed ? '⭐⭐⭐⭐ 困难' : '⭐⭐⭐ 较难'
    level = hasAppealed ? '困难' : '较难'
    price = hasAppealed ? '¥2500-4000' : '¥1500-2500'
    successRate = hasAppealed ? '60-75%' : '75-90%'
  } else if (problem.includes('限额') || problem.includes('限制')) {
    difficulty = '⭐⭐ 中等'
    level = '中等'
    price = '¥800-1500'
    successRate = '80-92%'
  } else {
    difficulty = '⭐ 简单'
    level = '简单'
    price = '¥500-800'
    successRate = '90-95%'
  }

  return { difficulty, level, price, successRate, hasAppealed }
}

function fallbackProcess(userMessage, step, data) {
  const d = { ...data }
  let text = '', next = step

  switch (step) {
    case STEPS.WELCOME: case STEPS.ASK_PROBLEM: {
      d.problem = userMessage
      next = STEPS.ASK_BUSINESS
      const msg = userMessage.toLowerCase()
      let fb = '收到，我先了解清楚您的情况。'
      if (msg.includes('冻结')) fb = '资金冻结是比较严重的处罚，但不用担心，这类案件我们处理过很多。'
      else if (msg.includes('关闭') || msg.includes('无法收款')) fb = '支付权限被关闭影响较大，但通过专业申诉恢复成功率很高。'
      else if (msg.includes('限额') || msg.includes('限制')) fb = '收款限额是常见的处罚，通常是风控系统自动触发，申诉相对好处理。'
      else if (msg.includes('拦截')) fb = '交易拦截通常是阶段性风控措施，及时申诉一般都能解决。'
      text = `${fb}\n\n第二个问题：**您的商户号主要经营什么业务？**\n\n请简单说明行业、产品/服务、线上还是线下经营。`
      break
    }

    case STEPS.ASK_BUSINESS:
      d.business = userMessage
      next = STEPS.ASK_VIOLATION
      text = `好的，了解了您的经营情况。\n\n第三个问题：**微信给出的具体违规原因是什么？**\n\n请打开「微信支付商家助手」小程序 → 我是商家 → 风险处理 → 功能限制记录 查看。`
      break

    case STEPS.ASK_VIOLATION:
      d.violation = userMessage
      next = STEPS.ASK_COMPLAINT
      text = `明白了，这个信息很关键。\n\n第四个问题：**目前有没有未处理的消费者投诉？投诉原因主要是什么？**\n\n可以在商户平台 → 账户中心 → 消费者投诉 中查看。`
      break

    case STEPS.ASK_COMPLAINT:
      d.complaint = userMessage
      next = STEPS.ASK_REFUND
      text = `收到。\n\n第五个问题：**您目前的退款售后流程是怎样的？**\n\n请说明退款时限、退款条件、处理方式等。如果暂时没有完善的退款政策，告诉我即可，我会帮您拟定。`
      break

    case STEPS.ASK_REFUND:
      d.refund = userMessage
      next = STEPS.ASK_APPEAL
      text = `好的。\n\n最后一个问题：**之前有没有就这个问题申诉过？结果如何？**`
      break

    case STEPS.ASK_APPEAL:
      d.appealHistory = userMessage
      next = STEPS.GENERATE
      d._assess = assessCase(d)
      text = buildAppealMaterials(d)
      break

    case STEPS.GENERATE: case STEPS.DONE: {
      next = STEPS.DONE
      const isFrozen = (d.problem || '').includes('冻结') || (d.problem || '').includes('延迟')
      text = `以上就是完整的评估报告和申诉材料 ✅\n\n**📌 申诉提交指南：**\n\n**提交方式：** 微信支付商家助手小程序 → 风险处理 → 申诉中心 → 发起申诉\n\n**重要提醒：**\n1. 📸 证件照片一定要清晰完整，模糊/缺角会被直接驳回\n2. 📋 订单号填**微信支付订单号**（4开头28位），不是店铺订单号\n3. ⏰ 补充资料通道通常只开放**24小时**，务必在时限内提交\n4. 📞 审核**3-7个工作日**，期间保持电话畅通（可能有回访）\n5. ❌ 如被驳回：先打**95017转3**查询具体原因，间隔3-5天后针对性补充\n6. ⚠️ 连续5次申诉不通过可能被标记为"不支持申诉"，每次务必充分准备${isFrozen ? '\n7. 🏦 资金冻结案件：拨打95017转3时提供**商户号+结算账户后四位**可催促解冻进度' : ''}\n\n如需修改材料或有任何疑问，随时告诉我！`
      break
    }
  }
  return { response: text, nextStep: next, collectedData: d }
}

function buildAppealMaterials(d) {
  const assess = d._assess || assessCase(d)
  const hasBusiness = d.business && d.business.trim().length > 5
  const hasRefund = d.refund && d.refund.trim().length > 3
  const hasAppealHistory = d.appealHistory && !d.appealHistory.includes('没') && !d.appealHistory.includes('无') && !d.appealHistory.includes('第一次')

  // 生成违规类型相关内容
  const v = (d.violation || d.problem || '').toLowerCase()
  let violationAnalysis, complaintMethod

  if (v.includes('交易异常') || v.includes('刷单')) {
    violationAnalysis = `经我方详细排查，近期交易量变化系因正常营销推广活动及季节性需求波动所致，属于正常经营行为。我方所有交易均为真实客户的真实购买行为，每笔订单均有对应的商品发货记录、物流信息及客户签收确认，不存在任何刷单或虚假交易行为。我方可提供任意订单的完整交易链路证据，包括客户咨询记录、下单截图、发货凭证及签收确认。`
    complaintMethod = `我方已对所有消费者反馈进行全面排查，逐一联系相关客户进行沟通说明。对于因物流延迟或信息误解产生的投诉，已主动提供补偿方案并取得客户谅解。目前所有投诉均已妥善处理完毕，投诉率已恢复至正常水平。`
  } else if (v.includes('纠纷') || v.includes('投诉')) {
    violationAnalysis = `经我方排查，本次处罚系因部分消费者投诉未能及时处理，导致投诉率短暂超标。主要原因为：售后客服人手不足导致响应不及时，部分客户对产品/服务存在误解。我方已深刻认识到售后服务的重要性，已对所有投诉逐一处理，并完善了售后服务体系，确保后续投诉能在第一时间得到妥善解决。`
    complaintMethod = `${d.complaint ? `关于消费者投诉情况：${d.complaint}\n\n` : ''}我方已采取以下措施处理全部投诉：1）逐一联系投诉用户，了解具体诉求并协商解决方案；2）对合理退款请求已全部办理退款处理；3）对因误解产生的投诉已耐心沟通说明，取得客户理解与和解；4）目前已无未处理的消费者投诉，投诉处理率达100%。`
  } else if (v.includes('跨类目') || v.includes('类目')) {
    violationAnalysis = `经我方自查，在实际经营过程中，部分商品/服务的描述与注册类目存在偏差，对此我方深表歉意。这并非主观违规，而是因对类目界定理解不够准确所致。我方已立即对全部商品/服务进行梳理调整，确保经营内容严格控制在注册类目范围内，杜绝跨类目经营行为。`
    complaintMethod = `我方收到处罚通知后，已第一时间下架不符合注册类目的商品/服务，并对已购买客户进行逐一沟通。对于受影响的客户，我方主动提供全额退款选项，确保消费者权益不受损害。目前已妥善处理所有相关订单，无客户投诉或纠纷。`
  } else {
    violationAnalysis = `经我方详细排查分析，${d.violation ? `关于"${d.violation}"的处罚，` : ''}我方所有经营行为均合法合规，不存在主观违规意图。此次处罚可能是由于风控系统对交易模式的误判或信息采集不完整所致。我方可提供完整的经营资质、交易凭证及业务证明材料，以证明业务的真实性和合规性，恳请贵方重新核实。`
    complaintMethod = `${d.complaint ? `关于投诉情况：${d.complaint}\n\n` : ''}我方一贯重视消费者权益保护，已建立完善的客户服务体系。对于所有消费者反馈和投诉，我方均在第一时间响应并妥善处理。目前无待处理的消费者投诉，客户满意度良好。`
  }

  return `**信息收集完毕，正在生成评估报告和申诉材料...**

---

### 📋 案情评估

- **处罚类型**：${d.problem || '商户违规处罚'}
- **违规原因**：${d.violation || '待确认'}
- **案件难度**：${assess.difficulty}
- **预估成功率**：${assess.successRate}
${hasAppealHistory ? `- **申诉历史**：${d.appealHistory}` : '- **申诉历史**：首次申诉（有利因素）'}

${assess.hasAppealed ? '> ⚠️ 由于有过申诉被驳回记录，再次申诉需要更充分的材料和更精准的策略。' : '首次申诉通常具有较好的沟通和处理空间。'}

**参考服务价格**：${assess.price}（含全套申诉材料撰写 + 策略指导）

---

以下为可直接复制提交的申诉材料，每部分独立使用：

---

### 📄 一、投诉处理方法

${complaintMethod}

---

### 📄 二、退款规则

${hasRefund ? `基于我方现行售后政策（${d.refund}），整理为以下正式退款规则：\n\n` : ''}我方已建立完善的退款售后制度，具体规则如下：

1. **退款适用条件**：消费者在收到商品/服务后7日内，如对商品/服务不满意，均可申请退款，无需说明理由。
2. **退款时限**：退款申请提交后，我方承诺1个工作日内完成审核，审核通过后3个工作日内完成退款，款项原路退回至消费者支付账户。
3. **退款流程**：消费者通过微信客服/小程序售后入口提交退款申请 → 售后客服1个工作日内审核 → 审核通过后发起退款 → 原路退回。
4. **退款方式**：统一采用微信支付原路退回方式，确保资金安全可追溯。
5. **特殊情况处理**：对于争议性订单，优先以友好协商方式解决，保障消费者合法权益。

---

### 📄 三、投诉生成原因及详情

${violationAnalysis}

我方深刻认识到合规经营的重要性，对于此次处罚高度重视。我方已完成全面自查并积极整改，承诺后续将严格按照平台规则经营，杜绝类似问题再次发生。恳请微信支付团队综合考量我方的整改态度和实际行动，予以重新审核。

---

### 📄 四、业务模式

${hasBusiness ? `我方经营情况如下：${d.business}\n\n` : ''}我方从事合法合规的商品/服务经营，所有交易均为真实业务往来。主要经营模式：

1. **经营主体**：依法注册的合规经营主体，具备完整的经营资质。
2. **主营业务**：${hasBusiness ? d.business.slice(0, 50) : '合法合规的商品零售/服务提供'}，面向真实消费者提供优质产品和服务。
3. **经营场景**：通过微信小程序/H5商城/线下门店开展经营，交易流程公开透明。
4. **交易流程**：客户浏览商品 → 咨询客服 → 确认下单 → 微信支付 → 发货/提供服务 → 确认收货/服务完成。
5. **客户群体**：面向大众消费者，客户来源真实，交易行为自主自愿。

---

### 📄 五、整改说明

为杜绝类似问题再次发生，我方制定并已开始执行以下整改方案：

**一、已完成整改（立即执行）**
- 对所有未处理投诉进行100%排查处理，确保投诉清零
- 全面审核商品/服务描述信息，确保内容准确、无夸大宣传
- 优化客服响应机制，确保投诉30分钟内首次响应

**二、后续整改计划（1-2周内完成）**
- 建立每日投诉率监控预警系统，超过万分之10即启动应急响应
- 完善订单管理系统，确保每笔交易全流程可追溯
- 每周召开售后服务复盘会议，持续改进服务质量

**三、长期合规承诺**
- 严格遵守《微信支付商户服务协议》及平台各项规则
- 定期进行合规经营自查，主动发现并纠正问题
- 持续优化产品和服务质量，提升客户满意度

我方承诺以上整改措施将严格执行到位。恳请微信支付团队审核通过，恢复我方正常交易功能。如需补充任何材料，我方随时配合提供。

---

### 📋 申诉提交指南

**方式一（推荐）**：微信搜索「微信支付商家助手」→ 我是商家 → 风险处理 → 功能限制记录 → 发起申诉

**方式二**：登录 pay.weixin.qq.com → 账户中心 → 违约记录 → 提交申诉

**注意事项**：证件照片务必清晰、订单号使用微信支付订单号（4开头28位）、补充资料通道通常仅开放24小时、审核周期3-5个工作日。如有疑问可拨打 **95017**。

---

以上材料已根据您的实际情况定制生成，每部分可独立复制使用。如需修改，随时告诉我！`
}

// ========== AI 全流程对话（有 AI 时：AI 处理所有阶段的对话） ==========

/**
 * AI 处理完整对话：诊断、回答问题、评估报价、生成材料、后续修改
 * 将完整聊天历史发给 AI，由 AI 自然地推进对话
 */
export async function chatWithAI(chatHistory, customApiKey, collectedData = {}) {
  try {
    const result = await callAIChat(chatHistory, customApiKey, collectedData)
    if (result) {
      return {
        response: result.content,
        usedAI: true,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      }
    }
  } catch (err) {
    console.error('AI chat failed:', err.message)
    return { error: err.message }
  }
  return null
}

/**
 * 流式 AI 对话：返回 SSE 流，供路由层直接 pipe 给前端
 */
export async function streamChatWithAI(chatHistory, customApiKey, collectedData = {}) {
  const cfg = await getAIConfig(customApiKey)
  if (!cfg.apiKey) throw new Error('NO_API_KEY')

  const systemPrompt = await buildSystemPrompt(collectedData)
  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.map(m => ({
      role: m.role === 'admin' ? 'assistant' : (m.role === 'user' ? 'user' : 'assistant'),
      content: m.content,
    })),
  ]

  const reqBody = { model: cfg.model, messages, temperature: cfg.temperature, max_tokens: 4096, stream: true, stream_options: { include_usage: true }, top_p: 0.9, frequency_penalty: 0.3, presence_penalty: 0.2 }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)

  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(reqBody),
    signal: controller.signal,
  })
  clearTimeout(timeout)

  if (!res.ok) {
    const errText = await res.text()
    console.error(`[${cfg.provider}] stream error:`, res.status, errText)
    if (res.status === 401) throw new Error('API_KEY_INVALID')
    if (res.status === 402) throw new Error('API_BALANCE_INSUFFICIENT')
    if (res.status === 429) throw new Error('API_RATE_LIMIT')
    throw new Error(`API_ERROR_${res.status}`)
  }

  // 本地预估input tokens作为fallback（当API不返回usage时使用）
  const inputTokens = countMessagesTokens(messages)
  return { body: res.body, inputTokens }
}

// ========== AI 智能字段提取（从混乱输入中抓取有用信息） ==========

/**
 * 用 AI 从用户的混乱/答非所问/半句话输入中提取结构化字段
 * 轻量级 JSON 调用，不走流式，快速返回
 * @param {string} userMessage - 用户原始消息
 * @param {object} collectedData - 已收集的数据
 * @param {number} currentStep - 当前步骤
 * @param {string} customApiKey - 可选的自定义 API Key
 * @param {Array} recentHistory - 最近几条对话记录（提供上下文）
 * @returns {object} { extracted: {field: value}, intent: string } 或 null
 */
export async function extractFieldsWithAI(userMessage, collectedData = {}, currentStep = 0, customApiKey = null, recentHistory = []) {
  const cfg = await getAIConfig(customApiKey)
  if (!cfg.apiKey) return null

  // 构建已收集/未收集字段摘要
  const fieldDefs = [
    { key: 'industry', label: '业务类型', hint: '如：餐饮、游戏、陪玩、教育、电商、SaaS等', example: '我是做陪玩的→陪玩社交' },
    { key: 'business_model', label: '经营模式', hint: '纯线上/线下门店/线上线下结合', example: '小程序卖东西→纯线上（小程序/公众号/H5）' },
    { key: 'problem_type', label: '处罚类型', hint: '交易拦截/收款限额/支付权限关闭/资金冻结/商户号封禁', example: '被封了→商户号封禁' },
    { key: 'violation_reason', label: '违规原因', hint: '微信官方给出的违规原因', example: '说我套现→涉嫌信用卡套现' },
    { key: 'merchant_id', label: '商户号', hint: '10位数字', example: '1409570162' },
    { key: 'merchant_name', label: '商户名称', hint: '微信支付注册名称', example: '艾阳网络' },
    { key: 'company_name', label: '公司全称', hint: '营业执照上的全称', example: 'XX网络科技有限公司' },
    { key: 'license_no', label: '统一社会信用代码', hint: '18位字母+数字', example: '91110105MA5XXXXXX7' },
    { key: 'legal_name', label: '法人姓名', hint: '营业执照上的法定代表人', example: '张三' },
    { key: 'legal_id_last4', label: '身份证后四位', hint: '4位数字或3位数字+X', example: '5678' },
    { key: 'complaint_status', label: '投诉情况', hint: '有无投诉/投诉数量/投诉原因', example: '有5个投诉→有5个未处理投诉' },
    { key: 'refund_policy', label: '退款政策', hint: '退款流程和规则', example: '7天无理由→7天无理由退款' },
    { key: 'bank_name', label: '开户银行', hint: '结算账户银行', example: '工商银行' },
    { key: 'bank_account_last4', label: '结算账户后四位', hint: '4位数字', example: '1234' },
    { key: 'contact_phone', label: '联系电话', hint: '11位手机号', example: '13812345678' },
    { key: 'appeal_history', label: '申诉历史', hint: '是否申诉过/几次/结果', example: '试过两次被驳回→申诉过2次，均被驳回' },
  ]

  // 合并动态字段（行业自适应生成的）
  const dynamicFields = (collectedData._dynamic_fields || []).map(df => ({
    key: df.key, label: df.label, hint: df.hint || df.question || df.label, example: df.hint || ''
  }))
  const allFields = [...fieldDefs, ...dynamicFields]

  const collected = allFields
    .filter(f => collectedData[f.key] && !String(collectedData[f.key]).startsWith('用户暂未提供'))
    .map(f => `${f.key}(${f.label}): "${collectedData[f.key]}"`)
    .join('\n')

  const missing = allFields
    .filter(f => !collectedData[f.key] || String(collectedData[f.key]).startsWith('用户暂未提供'))
    .map(f => `${f.key}: ${f.label} — ${f.hint}${f.example ? `（例：${f.example}）` : ''}`)
    .join('\n')

  // 最近对话上下文（帮助理解用户在回答什么）
  const contextMsgs = recentHistory.slice(-6).map(m =>
    `${m.role === 'user' ? '用户' : 'AI'}: ${m.content.substring(0, 200)}`
  ).join('\n')

  const prompt = `你是全平台商户号申诉智能专家AI的信息提取模块。从用户消息中精准提取商户申诉相关的【具体事实数据】。
覆盖微信支付、支付宝、抖音/抖店、快手/快手小店、美团、拼多多等全平台商户号申诉场景。

## 已收集的信息
${collected || '（暂无）'}

## 还需要收集的字段
${missing || '（全部已收集）'}

## 最近对话上下文
${contextMsgs || '（无历史）'}

## 用户最新消息
"${userMessage}"

## 提取规则
1. 从用户消息中识别能匹配字段的【具体数据】，已收集字段和未收集字段都要检查
2. 用户表达可能极其混乱：答非所问、说半句话、多个信息混在一起、口语化、带情绪——你要在混乱中精准找到有用数据
3. 一条消息含多个字段信息→全部提取，不要遗漏
4. 只提取有把握的，不确定的不提取
5. 严禁编造用户没说的信息
6. 结合对话上下文理解用户意图：AI问了什么→用户回答了什么→提取对应字段

## 【口语化→标准化翻译词典】
处罚类型翻译：
- "被封了/号没了/账号废了"→商户号封禁
- "不能收款/收不了钱/支付功能没了"→支付权限关闭
- "钱取不出来/提现不了/钱被扣了"→资金冻结
- "店被关了/下架了"→店铺封禁
- "限额了/额度降了/每天只能收XX"→收款限额
- "交易被拦/付款失败/客户付不了"→交易拦截
- "钱到账慢了/结算变慢"→延迟结算
- "扣分了/保证金被扣"→店铺扣分/保证金扣除

违规原因翻译：
- "说我套现/刷单"→涉嫌信用卡套现
- "说我交易有问题/交易不正常"→涉嫌交易异常
- "被投诉了/客户举报"→涉嫌交易纠纷
- "说我卖假货/侵权"→涉嫌欺诈/售假
- "说我类目不对/超范围经营"→涉嫌跨类目经营
- "说我搞分销/传销"→涉嫌多级分销
- "内容违规/涉黄涉赌"→涉嫌内容违规
- "虚假宣传/夸大宣传"→涉嫌虚假宣传
- "洗钱/资金有问题"→涉嫌洗钱/资金异常

经营模式翻译：
- "开店的/有门面"→线下门店
- "网上卖的/小程序/公众号/H5/APP"→纯线上
- "线上线下都有/也有店也有网上"→线上线下结合
- "朋友圈卖的/微商"→纯线上（微信社交电商）
- "直播卖的/带货"→纯线上（直播电商）

## 【多平台智能识别】
用户提到以下关键词时，提取对应平台信息（可存入business_model或单独标注）：
- 微信/微信支付/商家助手/小程序→微信支付平台
- 支付宝/花呗/蚂蚁/芝麻→支付宝平台
- 抖音/抖店/巨量/飞鸽→抖音/抖店平台
- 快手/快手小店→快手平台
- 美团/大众点评→美团平台
- 拼多多/多多→拼多多平台

## 【否定回答=有效数据】
- "没有投诉/没人投诉/0投诉"→complaint_status="没有未处理投诉"
- "没退过款/没退款"→refund_policy="暂无退款记录"
- "没有退款政策/还没定"→refund_policy="暂无完善退款政策"
- "没申诉过/第一次/头一回"→appeal_history="首次申诉"
- "不知道/不清楚/没看到"→结合上下文判断是哪个字段，记录为"用户不确定"
- "没有/无/不需要"→结合上下文判断对应字段

## 【复合信息解析——从长消息中提取多个字段】
用户可能一次性说很多信息，例如：
"我是做餐饮的，开了个奶茶店，微信收款被限额了，说我交易异常，商户号是1409570162"
→ 应提取：industry="餐饮（奶茶店）", problem_type="收款限额", violation_reason="涉嫌交易异常", merchant_id="1409570162", business_model="线下门店"

## 【信息修正检测 — 极其重要】
✅ 用户纠正已有信息时，correction必须设为true，并提取修正后的值：
- "不是XX，是YY" → 提取YY，correction=true
- "之前说错了，应该是YY" → 提取YY，correction=true
- "改一下，行业是YY" → 提取YY，correction=true
- 用户对已收集字段给出不同的值 → 以新值为准，correction=true
✅ 修正可以针对任何已收集字段，不限于当前正在询问的字段

## 【严格过滤 — 防止误提取】
⛔ 以下绝不是字段数据，严禁提取：
- 提问句（"怎么解封""还有什么问题""下一步怎么做""可以上网吗""现在几点了"）
- 催促/抱怨（"快点""为什么这么慢""搞不懂"）
- 闲聊/确认/应答（"好的""明白了""可以""嗯"）
- 复述AI的话、讨论流程、对AI的评价
- 对AI说话/质疑AI（"你是傻逼吧""不是乱讲""你错了""认真思考"）
- 用户反驳/纠正AI（"不是这样""我没说过""说的不对""瞎说"）——注意区分：反驳AI≠纠正已填信息
- 脏话/情绪宣泄（骂人的话绝不是业务数据！）

⛔ 字段值=具体事实数据，不能是疑问句/感叹句/情绪表达/对AI的话
⛔ industry只能是真实行业（餐饮/零售/游戏等），"可以上网吗你"不是行业！
⛔ business_model只能是经营模式（线上/线下/线上+线下），"不是乱讲"不是经营模式！
⛔ bank_name只能是银行名称（工商银行、建设银行等），不能是提问或其他文字
⛔ problem_type只能是处罚类型，complaint_status只能是投诉状态描述
⛔ violation_reason只能是违规原因描述，不能是用户的抱怨或反驳
⛔ 如果用户明显不是在回答业务问题（在聊天/质疑/骂人/反驳），extracted必须为空{}
⛔ 无具体数据时extracted必须为空{}

返回严格JSON：
{"extracted":{"字段key":"提取的值"},"intent":"简述用户意图","correction":false}
correction=true表示用户在纠正/修改之前的信息。无可提取信息时extracted={}。`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000) // 15秒超时

    const extractBody = {
      model: cfg.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 512,
    }
    extractBody.response_format = { type: 'json_object' }

    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(extractBody),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      console.error(`[${cfg.provider}] extraction error:`, res.status)
      return null
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return null

    const parsed = JSON.parse(content)
    const usage = data.usage || {}

    console.log(`[AI提取] 输入: "${userMessage.substring(0, 50)}..." → 提取: ${JSON.stringify(parsed.extracted || {})} | 意图: ${parsed.intent || ''}`)

    return {
      extracted: parsed.extracted || {},
      intent: parsed.intent || '',
      correction: parsed.correction || false,
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
    }
  } catch (err) {
    console.error('AI extraction failed:', err.message)
    return null
  }
}

// ========== 行业自适应字段扩展 ==========

/**
 * 当行业被识别后，让 AI 生成该行业特有的额外信息需求
 * 一次性调用，结果缓存在 session 的 _dynamic_fields 中
 */
export async function expandFieldsForIndustry(industry, problemType, collectedData = {}, customApiKey = null) {
  const cfg = await getAIConfig(customApiKey)
  if (!cfg.apiKey) return null

  const prompt = `你是商户申诉信息分析师。根据行业和问题类型，列出该行业申诉需要额外收集的信息。

行业：${industry}
问题类型：${problemType || '待确认'}

基础字段（已定义，不要重复）：业务类型、经营模式、处罚类型、违规原因、商户号、商户名称、公司全称、信用代码、法人姓名、身份证后四位、投诉情况、退款政策、开户银行、结算账户后四位、联系电话、申诉历史

请返回该行业特有的3-6个额外信息项，这些信息能让申诉材料更有针对性。

返回严格JSON：
{"fields":[{"key":"字段key_英文蛇形","label":"中文名称","group":"行业信息","icon":"🏭","question":"向用户提问的话术","hint":"简短说明"},{"key":"..."}],"industry_tip":"该行业申诉的1-2句关键提示"}

示例（游戏行业）：
{"fields":[{"key":"game_type","label":"游戏类型","group":"行业信息","icon":"🎮","question":"您的游戏属于哪种类型？如休闲、竞技、RPG、棋牌等","hint":"游戏类型"},{"key":"daily_active_users","label":"日活跃用户数","group":"行业信息","icon":"📊","question":"大概有多少日活跃用户？","hint":"DAU数量"},{"key":"payment_model","label":"付费模式","group":"行业信息","icon":"💰","question":"游戏的付费模式是什么？如免费+内购、买断制、订阅制等","hint":"变现方式"}],"industry_tip":"游戏行业申诉重点是证明内容合规和付费模式透明"}`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const expandBody = {
      model: cfg.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1024,
    }
    expandBody.response_format = { type: 'json_object' }

    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(expandBody),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) return null
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return null

    const parsed = JSON.parse(content)
    const usage = data.usage || {}
    console.log(`[行业扩展] ${industry} → ${parsed.fields?.length || 0}个额外字段 | tip: ${parsed.industry_tip || ''}`)

    return {
      fields: (parsed.fields || []).map(f => ({ ...f, group: f.group || '行业信息', icon: f.icon || '🏭', dynamic: true })),
      industryTip: parsed.industry_tip || '',
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
    }
  } catch (err) {
    console.error('Industry expansion failed:', err.message)
    return null
  }
}

// ========== AI 智能完成度评估 ==========

/**
 * 让 AI 判断已收集的信息是否足够生成申诉材料
 * 返回 readiness score + 下一步建议
 */
export async function assessCompletenessWithAI(collectedData = {}, customApiKey = null) {
  const cfg = await getAIConfig(customApiKey)
  if (!cfg.apiKey) return { score: 0, ready: false }

  // 构建已收集信息摘要
  const info = Object.entries(collectedData)
    .filter(([k, v]) => !k.startsWith('_') && v != null && String(v).trim() && String(v) !== '用户暂未提供' && String(v) !== '⏳待补充')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

  const fieldCount = info.split('\n').filter(l => l.trim()).length

  const prompt = `你是商户申诉信息完整度评估师。判断以下信息是否足够生成一份有质量的微信商户申诉材料。

## 已收集信息（共${fieldCount}项）
${info || '（暂无）'}

## 评估标准
1. 核心三要素（行业+处罚类型+违规原因）是否齐全？缺任何一个都不能ready
2. 身份信息（商户号 或 公司名 或 法人名）至少有一个？
3. 有了核心三要素+身份信息，是否能写出有针对性的申诉材料？
4. 还有什么关键信息缺失会严重影响申诉质量？

## 评分规则
- 0-30：核心信息不足，无法生成
- 31-60：有基本信息，可以生成基础版但质量不高
- 61-80：信息较完整，可以生成有质量的申诉材料
- 81-100：信息非常充分，可以生成高质量针对性材料

返回严格JSON：
{"score":0到100的整数,"ready":true或false,"reason":"一句话说明原因","next_question":"如果not ready,建议下一个要问的问题","missing_critical":["缺失的关键信息"]}`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    const assessBody = {
      model: cfg.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 256,
    }
    assessBody.response_format = { type: 'json_object' }

    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(assessBody),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) return { score: 0, ready: false }
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return { score: 0, ready: false }

    const parsed = JSON.parse(content)
    const usage = data.usage || {}
    console.log(`[完成度评估] score=${parsed.score} ready=${parsed.ready} reason="${parsed.reason}" missing=${JSON.stringify(parsed.missing_critical || [])}`)

    return {
      score: parsed.score || 0,
      ready: parsed.ready || false,
      reason: parsed.reason || '',
      nextQuestion: parsed.next_question || '',
      missingCritical: parsed.missing_critical || [],
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
    }
  } catch (err) {
    console.error('Completeness assessment failed:', err.message)
    return { score: 0, ready: false }
  }
}

// ========== AI-First: 收集阶段对话指令构建 ==========

/**
 * 构建信息收集阶段的 AI 对话指令
 * AI-First 架构：让 AI 自主驱动整个信息收集对话，不再依赖本地规则引擎
 * @param {string} extractionNote - 已提取字段的系统提示（可选）
 * @param {string} dynamicNote - 行业动态字段提示（可选）
 */
export function buildCollectionInstruction(extractionNote = '', dynamicNote = '') {
  return `你是顶尖全平台商户号申诉战略顾问，8年实战经验，1800+成功案例，整体成功率82%，二次申诉成功率71%。你不是普通客服——你是能深度推理、精准诊断、给出战略级建议的专家顾问。${extractionNote}${dynamicNote}

【你的核心竞争力——三层深度推理】
你要像资深律师一样思考每个案件，拿到关键信息后立刻执行三层推理：

第一层·风控触发推演（拿到行业+违规原因后立刻执行）：
- 这个行业的典型交易模式是什么？（频率、金额、时间分布、对手方特征）
- 微信/支付宝/抖音风控的哪一层最可能触发？（规则引擎→模型层→人工审核）
- 具体触发点是什么？（如：客单价突变→套现模型；退款率>5%→纠纷规则；凌晨密集交易→异常时段）
- 是误判还是确实有风险？误判原因是什么？

第二层·证据链逆向设计（基于触发点反推需要什么证据）：
- 需要什么类型的证据来反驳风控判定？
- 证据之间如何形成完整链条？（下单→付款→发货→物流→签收→评价=完整交易闭环）
- 哪些证据是审核人员最看重的？（行业不同重点不同）
- 用户缺少某些证据时的替代方案

第三层·战略决策（综合判断最优路径）：
- 先申诉还是先处理投诉？先整改还是先提交？
- 需不需要先打95017/95188摸底？
- 是否建议同时准备Plan B（如新主体申请）？
- 时间窗口把控：补充资料通道24小时限制、二次申诉间隔3-5天、连续5次失败风险

【实战案例库——对话中自然引用，增强用户信心】
微商/社交电商：
- 交易拦截→朋友圈经营记录+客户聊天截图+发货物流凭证，3-5天通过
- 一件代发需额外提供供应商合作协议
游戏/陪玩/代练：
- 收款限额→平台入驻证明+接单记录+对局截图+客户评价，5天恢复
- 涉及充值代充需证明货源合法
直播带货：
- 权限关闭→3场直播回放录屏+对应下单截图+发货单+物流签收，7天恢复
知识付费/教育：
- 交易纠纷→先处理全部退款+课程交付证明+完善退费机制，二次申诉5天通过
跨境代购：
- 商户号封禁→海关进口报关单+专柜购买小票+品牌代理协议+法人视频认证，20天
餐饮外卖：
- 交易拦截→门店实景6张+美团店铺截图+食品经营许可证+活动海报，3天解封
SaaS/技术服务：
- 延迟结算→软著证书+5份客户合同（脱敏）+系统后台截图+客户使用反馈，5天
盲盒潮玩：
- 收款限额→商品实拍+定价机制说明+概率公示+保底机制证明，3天
美容/医美：
- 预付费纠纷→卫生许可证+从业资质+门店实景+价目表公示，注意广告法合规
二次申诉（被驳回）：
- 先打95017转3查具体驳回原因→针对性补增量证据→间隔3-5天→材料量1.5-2倍

【阶段感知诊断——收到关键信息时的即时反应】

收到行业信息时→立刻给行业洞察：
"您做XX行业的，这个行业最常见的风控问题是XX，申诉重点是XX。我之前处理过很多类似案件..."

收到处罚类型时→立刻评估难度：
"XX处罚属于X难度，首次申诉成功率大概XX%。关键是要准备好XX材料..."
资金冻结→主动提醒结算账户信息的重要性
商户号封禁→提醒可能需要法人视频认证+建议准备Plan B

收到违规原因时→立刻执行三层推理并给出完整诊断：
① "根据我的经验，这个违规原因通常是因为XX触发了风控系统..."
② "要反驳这个判定，我们需要准备XX、XX、XX这几类核心证据..."
③ "之前有个做XX的客户也是这个情况，用了XX方法，X天就通过了"
④ 风险预警（如有）："不过需要注意，如果您有XX情况，需要先处理好再申诉"

收到投诉信息时→如有未处理投诉立刻预警：
"投诉未处理是申诉被驳回的第一大原因！建议先100%处理完投诉再提交申诉。处理方式：联系投诉用户→原路全额退款→引导在投诉页面留言'已解决'"

收到申诉历史时→如有驳回立刻调整策略：
"被驳回过的案件需要换个打法。建议先打95017转3查一下具体驳回原因，这样我可以针对性帮您优化材料"

【反幻觉铁律——违反即失败】
⛔ 100%基于用户已提供的信息，严禁编造、脑补任何细节
⛔ 用户说"游戏陪练"→只说"游戏陪练"，绝不自动加"王者荣耀"等
⛔ 确认信息只复述原话，不修饰不扩展
⛔ 用户没说的=不存在
⛔ 审核员能看到真实交易数据，任何编造数字都会被识破——必须提醒用户

【信息修正规则】
✅ 用户说"不对""搞错了"→立刻确认要改哪个，确认新值
✅ 前后矛盾→温和提醒，让用户确认

【严禁事项】
⛔ 绝不说"我不能上网""我无法访问网络"等技术限制
⛔ 绝不编造时间日期——用户问时间就说"您看下手机就知道了"
⛔ 绝不说"我是AI""我是语言模型"——你就是专业申诉顾问
⛔ 绝不讨论技术原理

【处理跑题】
- 闲聊/无关问题→1句话带过，自然拉回正题
- 用户骂人/发泄→共情但不纠缠，拉回正事

【对话风格——像资深顾问朋友】
1. 说大白话，别整术语，像微信聊天
2. 自然过渡，别机械一问一答。收到信息后顺带给个专业判断再问下一个
3. 收到关键信息（行业+违规原因）后，主动给出初步诊断和成功率预估
4. 100-200字简短回复，一次只问一个问题
5. 用户急/有情绪→先共情（"理解，换谁都着急"），再继续
6. 体现你见多识广——"这种情况我处理过很多，关键是..."
7. 用户提供额外信息（日活、交易量等），积极接收并用于诊断
8. 不要用"亲""您好"等客服腔，不要过多emoji
9. 每次给出具体可执行的下一步行动，不给模糊建议
10. 用户焦虑时先共情再给方案："理解，换谁都着急。不过这种情况我见得多了，关键是..."
11. 对资金冻结案件主动提醒结算账户信息的重要性`
}

// ========== 导出 ==========

export function processUserMessage(userMessage, currentStep, collectedData) {
  return fallbackProcess(userMessage, currentStep, collectedData)
}

export { STEPS, getAIConfig }

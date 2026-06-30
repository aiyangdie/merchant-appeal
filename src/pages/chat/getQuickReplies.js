import { isDDScenario } from './utils.js'

export function getQuickReplies({ messages, collectedInfo, infoProgress }) {
  const msgCount = messages.length
  const lastMsg = messages[msgCount - 1]
  const lastContent = (lastMsg?.content || '').toLowerCase()
  const hasInfo = Object.keys(collectedInfo).length > 0
  const infoCount = Object.keys(collectedInfo).filter(k => !k.startsWith('_') && collectedInfo[k]).length
  const isDD = isDDScenario(collectedInfo)

  if (isDD) {
    if (infoProgress?.coreComplete || lastContent.includes('收集完成') || lastContent.includes('信息收集完毕')) {
      return ['打开尽调填写内容', '经营说明怎么写', '订单分笔怎么填', '还要准备什么材料']
    }
    return ['我收到了尽调通知', '粘贴通知内容', '我有微信交易单号', '不知道怎么填表单']
  }
  if (msgCount <= 2) {
    return ['我做餐饮的，商户号被冻结了', '游戏行业，说我涉嫌赌博', '电商卖货，收款被限额', '做直播的，交易异常被封了', '我不太懂，帮我看看怎么办']
  }
  if (lastContent.includes('信息收集完毕') || lastContent.includes('收集完成')) {
    return ['帮我生成申诉文案', '查看申诉流程指导', '我有投诉需要处理', '帮我分析成功率', '有没有类似的成功案例']
  }
  if (infoCount >= 10) {
    return ['跳过这个问题', '我不确定，先跳过', '这个信息我后面补充']
  }
  if (hasInfo && infoCount < 10) {
    return ['不记得了', '没有', '暂时没有', '这个我不太清楚', '为什么要这个信息']
  }
  if (lastContent.includes('驳回') || lastContent.includes('被拒')) {
    return ['帮我分析驳回原因', '怎么重新申诉', '需要补充什么材料', '帮我打95017怎么说']
  }
  if (lastContent.includes('投诉') || lastContent.includes('纠纷')) {
    return ['怎么回复消费者投诉', '投诉处理完了还会影响吗', '退款后投诉会撤销吗']
  }
  if (msgCount > 2) {
    return ['怎么操作', '还有什么要注意的', '帮我总结一下', '有没有专业团队帮忙']
  }
  return []
}

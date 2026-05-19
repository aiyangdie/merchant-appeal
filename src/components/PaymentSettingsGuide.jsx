/**
 * 支付配置引导 — 说明要填什么、去哪拿、保存后是否生效
 */

const WECHAT_STEPS = [
  { title: '开通 Native 扫码支付', desc: '登录微信支付商户平台 → 产品中心 → 开通「Native 支付」（PC 网站扫码）。' },
  { title: '准备 API 证书', desc: '账户中心 → API 安全 → 申请 API 证书，下载 apiclient_key.pem（商户私钥）；平台证书放服务器路径供验签。' },
  { title: '填写下方参数', desc: '商户号、AppID、APIv3 密钥、证书序列号、私钥（粘贴 PEM 全文或填写服务器文件路径）。' },
  { title: '配置回调地址', desc: '回调 URL：https://你的域名/api/payment/wechat/notify ，须与商户平台登记一致且 HTTPS 公网可达。' },
  { title: '打开开关并保存', desc: '「启用微信支付」打开 → 保存配置；顶部状态变为「已就绪」后用户充值页会出现微信通道。' },
]

const ALIPAY_STEPS = [
  { title: '创建应用', desc: '开放平台 open.alipay.com → 创建应用，签约「电脑网站支付」。' },
  { title: '配置密钥', desc: '开发设置 → RSA2 → 生成应用私钥；上传应用公钥后复制「支付宝公钥」。' },
  { title: '填写下方参数', desc: 'AppID、应用私钥、支付宝公钥粘贴到下方多行框（含 BEGIN/END 行）。' },
  { title: '配置回调', desc: '异步通知：https://你的域名/api/payment/alipay/notify ；同步跳转填支付完成返回页。' },
  { title: '打开开关并保存', desc: '启用支付宝 → 保存；保存后立即生效。' },
]

const FIELD_HINTS = {
  wx_enabled: '关闭后用户端不显示微信在线支付（仍可用扫码转账充值）。',
  wx_mch_id: '商户平台 → 账户信息 → 商户号（10 位数字）。',
  wx_app_id: '绑定支付的 AppID，须与商户号有关联。',
  wx_api_key: 'APIv2 密钥（旧版）；Native 支付主要用 APIv3 密钥，此项可留空。',
  wx_api_v3_key: '商户平台 → API 安全 → APIv3 密钥（32 位）。',
  wx_serial_no: 'API 证书页的「证书序列号」。',
  wx_private_key: '粘贴 apiclient_key.pem 全文，或填服务器路径如 /root/certs/apiclient_key.pem',
  wx_notify_url: '须 HTTPS 公网可访问，与商户平台回调配置一致。',
  wx_mode: '正式上线选 production；沙箱仅联调。',
  ali_enabled: '关闭后用户端不显示支付宝在线支付。',
  ali_app_id: '开放平台应用 APPID。',
  ali_private_key: '应用私钥 RSA2，完整 PEM 粘贴（含 BEGIN/END）。',
  ali_public_key: '支付宝公钥（平台提供），用于验签，不是应用公钥。',
  ali_gateway: '生产：https://openapi.alipay.com/gateway.do',
  ali_notify_url: '支付宝服务器 POST 的异步通知地址。',
  ali_return_url: '支付完成后浏览器跳转地址。',
  ali_mode: '生产环境选 production。',
}

export function getPaymentFieldHint(configKey) {
  return FIELD_HINTS[configKey] || ''
}

function StatusBadge({ ok, label }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-gray-400'}`} />
      {label}
    </span>
  )
}

export default function PaymentSettingsGuide({ channel, channels, adminFetch, showToast, onChannelsUpdate }) {
  const isWx = channel === 'wechat'
  const active = isWx ? channels?.wechat : channels?.alipay
  const steps = isWx ? WECHAT_STEPS : ALIPAY_STEPS
  const title = isWx ? '微信支付（APIv3 · Native 扫码）' : '支付宝（电脑网站支付）'

  async function syncFromEnv() {
    if (!adminFetch) return
    showToast?.('正在从 server/.env 同步…')
    try {
      const res = await adminFetch('/api/admin/payment-config/sync-env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceSecrets: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '同步失败')
      onChannelsUpdate?.(data.channels)
      const wx = data.channels?.wechat ? '微信✓' : '微信—'
      const ali = data.channels?.alipay ? '支付宝✓' : '支付宝—'
      showToast?.(`同步完成：${wx} ${ali}`)
    } catch (e) {
      showToast?.(e.message || '同步失败')
    }
  }

  return (
    <div className="space-y-3">
      <div className={`rounded-xl border px-4 py-3 ${isWx ? 'bg-green-50/80 border-green-100' : 'bg-blue-50/80 border-blue-100'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          <StatusBadge ok={!!active} label={active ? '已就绪，用户端可见' : '未就绪（请补全参数并打开开关）'} />
        </div>
        <p className="text-xs text-gray-600 mt-2 leading-relaxed">
          {isWx ? (
            <>
              需要：<strong>商户私钥</strong>、<strong>APIv3 密钥</strong>、<strong>证书序列号</strong>；回调验签还需在
              <code className="mx-1 px-1 bg-white/60 rounded text-[10px]">server/.env</code>
              设置 <code className="px-1 bg-white/60 rounded text-[10px]">WECHAT_PAY_CERT_PATH</code>（平台证书路径）。保存后立即生效。
            </>
          ) : (
            <>
              需要：<strong>应用私钥</strong> + <strong>支付宝公钥</strong>，在下方多行框粘贴 PEM 即可，一般无需单独上传文件。
            </>
          )}
        </p>
        {!active && (
          <p className="text-xs text-amber-700 mt-2">
            若只用「扫码转账 + 管理员确认充值」，可保持开关关闭，在「充值设置」配置收款二维码。
          </p>
        )}
        {adminFetch && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={syncFromEnv}
              className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium">
              从 server/.env 同步到数据库
            </button>
            <span className="text-[10px] text-gray-400 self-center">密钥写在 payment.secrets.env 后点此，再 pm2 restart</span>
          </div>
        )}
      </div>

      <ol className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden list-none m-0 p-0">
        {steps.map((s, i) => (
          <li key={s.title} className="px-4 py-3">
            <p className="text-xs font-semibold text-gray-800">
              <span className={`inline-flex w-5 h-5 items-center justify-center rounded-full text-[10px] mr-2 ${isWx ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{i + 1}</span>
              {s.title}
            </p>
            <p className="text-[11px] text-gray-500 mt-1 ml-7 leading-relaxed">{s.desc}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
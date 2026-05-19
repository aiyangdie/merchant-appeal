---
name: "project-refactor"
description: "Parallel refactoring skill for merchant-appeal project. Invoke when user asks to fix frontend issues, refactor ChatPage, add ESLint, or improve code quality. Supports multi-threaded main+minor issue processing."
---

# Project Refactor — 并行重构技能

本技能用于对 merchant-appeal 项目进行系统性重构，采用「主问题 + 小问题」多线程并行处理策略。

## 核心原则

1. **并行处理**：主问题（架构级）和小问题（代码级）同时推进，互不阻塞
2. **增量重构**：每一步都保证项目可运行，不做破坏性大改
3. **验证优先**：每次修改后必须验证构建通过

## 项目路径

```
/root/merchant-appeal/
├── src/
│   ├── pages/          # 页面组件
│   ├── components/     # 通用组件
│   ├── hooks/          # 自定义 Hook（待创建）
│   ├── utils/          # 工具函数（待创建）
│   ├── services/       # API 服务层（待创建）
│   └── index.css       # 全局样式
├── .trae/skills/       # 本技能
└── package.json
```

## 问题清单与优先级

### 🔴 主问题（架构级，需拆分并行）

| 编号 | 问题 | 优先级 | 影响范围 |
|------|------|--------|----------|
| M1 | ChatPage.jsx 2679行上帝组件拆分 | P0 | 全局 |
| M2 | 71个 useState 状态管理重构 | P0 | ChatPage |
| M3 | 33处裸 fetch 无统一封装 | P1 | 全局 |
| M4 | 无 ESLint/Prettier 配置 | P1 | 全局 |
| M5 | dangerouslySetInnerHTML XSS风险 | P1 | ChatMessage |

### 🟠 小问题（代码级，可批量并行）

| 编号 | 问题 | 优先级 | 影响范围 |
|------|------|--------|----------|
| S1 | 15处静默吞错 .catch(() => {}) | P1 | ChatPage |
| S2 | 9处 alert() 替换为 Toast | P2 | ChatPage |
| S3 | 32处 localStorage 硬编码 | P2 | ChatPage |
| S4 | 4处重复订单排序逻辑 | P2 | ChatPage |
| S5 | 3处重复 session 创建逻辑 | P2 | ChatPage |
| S6 | MenuItem 在函数体内定义 | P2 | ChatPage |
| S7 | 魔法数字/字符串 | P3 | ChatPage |
| S8 | console.log 残留 | P3 | ChatPage |
| S9 | 静态内联 style 可用 Tailwind | P3 | 多处 |
| S10 | useEffect 依赖项问题 | P3 | ChatPage |

## 执行策略：多线程并行

### 线程1：主问题推进（架构重构）

按顺序执行，每步验证构建：

```
Step 1: M4 — 添加 ESLint + Prettier（成本最低收益最高）
Step 2: M3 — 封装 API 服务层（为后续拆分做准备）
Step 3: M1 — 拆分 ChatPage 为独立页面+弹窗组件
Step 4: M2 — 用 useReducer + Context 重构状态管理
Step 5: M5 — 修复 XSS 风险
```

### 线程2：小问题批量修复（与主问题并行）

在主问题推进的同时，用搜索 agent 批量修复小问题：

```
Batch 1: S1 + S4 + S5 + S6（错误处理 + 重复逻辑提取）
Batch 2: S2 + S3（alert替换 + localStorage封装）
Batch 3: S7 + S8 + S9 + S10（代码质量提升）
```

## 详细执行方案

### M1: ChatPage 拆分方案

将 ChatPage.jsx 拆分为以下独立文件：

**页面拆分**（用 React Router 替代 view 状态切换）：
```
src/pages/AuthPage.jsx          — 登录/注册（原 view='auth'）
src/pages/ApiSelectPage.jsx     — API模式选择（原 view='apiSelect'）
src/pages/HistoryListPage.jsx   — 历史对话列表（原 view='myHistory'）
src/pages/HistoryViewPage.jsx   — 只读历史（原 view='history'）
src/pages/ChatPage.jsx          — 主聊天（精简后 <500行）
```

**弹窗拆分**（从 ChatPage 中提取为独立组件）：
```
src/components/RechargeModal.jsx     — 充值弹窗
src/components/OrderBindModal.jsx    — 订单绑定面板
src/components/ContactCardModal.jsx  — 名片弹窗
src/components/BargainModal.jsx      — AI砍价弹窗
src/components/ProductDetailModal.jsx— 商品详情弹窗
src/components/MoreMenu.jsx          — 三点菜单
src/components/HistoryDrawer.jsx     — 历史侧边栏
src/components/PersonaCard.jsx       — 虚拟人设弹窗
```

**共享状态**（通过 Context 传递）：
```
src/contexts/AuthContext.jsx    — 用户认证状态
src/contexts/ChatContext.jsx    — 聊天消息+会话状态
src/contexts/PaymentContext.jsx — 充值+支付状态
```

### M2: 状态管理重构方案

将 71 个 useState 按业务域分组为 useReducer：

```
useAuth()     — user, authPhone, authNickname, authError, authLoading, authMode, tokenRef
useChat()     — messages, input, loading, sessionId, streaming
usePayment()  — showRecharge, rechargeConfig, rechargeAmount, rechargeMethod, rechargeRemark, rechargeSubmitting, paymentPending, paymentStatus
useOrder()    — showOrderPanel, boundOrder, orderList, orderListLoading, orderNoInput, orderNoLoading, orderSearchResults
useInfo()     — collectedInfo, infoFields, infoStep, infoTotal, showInfoPanel
usePanel()    — showAIPanel, showAppealPanel, showComplaintDoc, showAppealGuide, showUserCenter, showMoreMenu, moreMenuPos
useBargain()  — bargainProduct, bargainHistory, bargainInput, bargainLoading, bargainDeal
useHistory()  — mySessions, mySessionsLoading, historyMessages, historySession, historyLoading, drawerOpen, deletedSessions
```

### M3: API 服务层封装

```
src/services/apiClient.js  — 统一 fetch 封装（token、错误处理、重试）
src/services/auth.js       — 登录/注册/过期处理
src/services/chat.js       — 聊天流式请求
src/services/session.js    — 会话管理
src/services/order.js      — 订单查询/绑定
src/services/payment.js    — 充值/支付状态轮询
src/services/risk.js       — 风险评估
src/services/contact.js    — 名片/联系方式
```

apiClient.js 核心设计：
```javascript
class ApiClient {
  constructor(baseURL = '') {
    this.baseURL = baseURL
  }
  getHeaders() {
    const h = { 'Content-Type': 'application/json' }
    const token = localStorage.getItem('appeal_token')
    if (token) h['Authorization'] = `Bearer ${token}`
    return h
  }
  async request(url, options = {}) {
    const res = await fetch(this.baseURL + url, {
      ...options,
      headers: { ...this.getHeaders(), ...options.headers },
    })
    if (res.status === 401) { this.onAuthExpired(); throw new AuthExpiredError() }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new ApiError(err.error || res.statusText, res.status, err)
    }
    return res
  }
  async get(url) { return this.request(url) }
  async post(url, body) { return this.request(url, { method: 'POST', body: JSON.stringify(body) }) }
  async put(url, body) { return this.request(url, { method: 'PUT', body: JSON.stringify(body) }) }
  onAuthExpired() { /* 清除token，跳转登录 */ }
}
export const api = new ApiClient()
```

### M4: ESLint + Prettier 配置

创建以下文件：

**.eslintrc.json**:
```json
{
  "env": { "browser": true, "es2022": true, "node": true },
  "extends": ["eslint:recommended", "plugin:react/recommended", "plugin:react-hooks/recommended"],
  "parserOptions": { "ecmaVersion": "latest", "sourceType": "module", "ecmaFeatures": { "jsx": true } },
  "plugins": ["react", "react-hooks"],
  "rules": {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "warn",
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "react-hooks/exhaustive-deps": "warn"
  },
  "settings": { "react": { "version": "detect" } }
}
```

**.prettierrc**:
```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 120,
  "tabWidth": 2
}
```

### S4+S5: 重复逻辑提取

**src/utils/orderUtils.js**:
```javascript
export const ORDER_STATUS = { PENDING_SHIP: 12, REFUNDED: 23 }
export function sortOrdersByStatus(orders) {
  return [...orders].sort((a, b) => {
    if (a.order_status === ORDER_STATUS.PENDING_SHIP && b.order_status !== ORDER_STATUS.PENDING_SHIP) return -1
    if (b.order_status === ORDER_STATUS.PENDING_SHIP && a.order_status !== ORDER_STATUS.PENDING_SHIP) return 1
    return 0
  })
}
export function formatOrderAmount(order) { /* ... */ }
export function getOrderStatusStyle(status, orderStatus) { /* ... */ }
```

**src/utils/sessionUtils.js**:
```javascript
export async function ensureSession({ sessionIdRef, user, setSessionId, getAuthHeaders }) {
  if (sessionIdRef.current) return sessionIdRef.current
  const res = await fetch('/api/sessions', {
    method: 'POST', headers: getAuthHeaders(),
    body: JSON.stringify({ userId: user?.id }),
  })
  const data = await res.json()
  if (data.sessionId) {
    setSessionId(data.sessionId)
    sessionIdRef.current = data.sessionId
    localStorage.setItem('appeal_session_id', data.sessionId)
    return data.sessionId
  }
  throw new Error('创建session失败')
}
```

### S3: localStorage 封装

**src/utils/storage.js**:
```javascript
const PREFIX = 'appeal_'
const storage = {
  get(key) { try { return JSON.parse(localStorage.getItem(PREFIX + key)) } catch { return null } },
  set(key, val) { localStorage.setItem(PREFIX + key, JSON.stringify(val)) },
  remove(key) { localStorage.removeItem(PREFIX + key) },
  getToken() { return localStorage.getItem(PREFIX + 'token') || '' },
  setToken(token) { if (token) localStorage.setItem(PREFIX + 'token', token); else localStorage.removeItem(PREFIX + 'token') },
}
export default storage
```

### S2: Toast 组件

**src/components/Toast.jsx**:
创建轻量 Toast 组件替代 alert()，支持 success/error/warning 类型。

## 验证检查清单

每次修改后必须执行：

1. `npm run build` — 构建通过
2. 检查无 console.error
3. 页面核心流程可走通（登录→聊天→三点菜单→充值）
4. 移动端布局无异常

## 执行命令

当用户说"开始重构"或"执行重构"时：
1. 创建 TodoWrite 列出所有任务
2. 启动并行 agent：
   - Agent A（主线程）：按 M1→M2→M3→M4→M5 顺序执行
   - Agent B（小问题线程）：按 S1-S10 批量执行
3. 每完成一个任务标记 completed
4. 全部完成后运行 `npm run build` 验证

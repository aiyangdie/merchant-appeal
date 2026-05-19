# 闲鱼订单绑定修复 Spec

## Why
"绑定闲鱼订单"功能显示"暂无订单数据"，根因是 `xianyu-api.js` 的 API 调用实现与闲管家开放平台官方文档严重不符（请求方式、签名算法、API 域名、接口路径全部错误），且 AppKey/AppSecret 只能通过环境变量配置、管理后台无设置入口。

## What Changes
- 重写 `server/xianyu-api.js` 的签名算法和请求逻辑，对齐闲管家官方 API 规范（POST + 逗号分隔 MD5 签名 + `open.goofish.pro` 域名 + `/api/open/order/list` 端点）
- 管理后台"系统设置"新增「闲管家配置」子标签，支持配置 AppKey、AppSecret 及应用信息
- 闲管家 API 模块优先从数据库 `system_config` 读取 AppKey/AppSecret，回退到环境变量
- `GET /api/orders/from-system` 路由使用修复后的 API 模块拉取真实订单
- **BREAKING**: 不再需要 `XIANYU_APP_ID`/`XIANYU_APP_SECRET` 环境变量（改为数据库配置优先）

## Impact
- Affected specs: 订单绑定、系统设置
- Affected code: `server/xianyu-api.js`（重写）、`server/index.js`（新增配置读取）、`server/db.js`（新增 config 初始化）、`server/config/initDb.js`（新增默认配置）、`src/pages/AdminPage.jsx`（新增子标签 UI）、`src/components/OrderBindModal.jsx`（可能需要微调数据字段映射）

## ADDED Requirements

### Requirement: 闲管家配置管理
系统 SHALL 在管理后台「系统设置」中提供「闲管家配置」子标签，管理员可配置闲管家开放平台的 AppKey 和 AppSecret，并查看应用信息。

#### Scenario: 管理员首次配置闲管家
- **WHEN** 管理员登录后台，进入「系统设置 → 闲管家配置」
- **THEN** 显示 AppKey、AppSecret 输入框及保存按钮
- **AND** 显示应用名称（艾阳的店铺）、应用类型（进销存）、应用模式（自研系统）等信息作为只读标签

#### Scenario: 未配置时拉取订单
- **WHEN** AppKey/AppSecret 未配置（为空或占位值）
- **THEN** `GET /api/orders/from-system` 返回友好错误 `{ error: '闲管家API未配置，请在管理后台"系统设置→闲管家配置"中配置 AppKey 和 AppSecret', code: 'CONFIG_REQUIRED' }`

#### Scenario: 配置完成后拉取真实订单
- **WHEN** AppKey 和 AppSecret 已正确配置
- **AND** 用户在对话页面点击「绑定订单」
- **THEN** OrderBindModal 中显示从闲管家 API 拉取的真实订单列表
- **AND** 订单列表包含买家昵称（buyerNick）、商品标题（productTitle）、价格（price）、下单时间（payTime）等字段

### Requirement: 闲管家 API 签名算法（官方规范）
系统 SHALL 按照闲管家开放平台官方文档实现签名算法：`md5("appKey,bodyMd5,timestamp,appSecret")`，所有接口使用 POST 方法，请求体为 JSON。

#### Scenario: 获取订单列表 API 调用
- **WHEN** 调用 `/api/open/order/list` 获取订单
- **THEN** 使用 POST 方法，请求头包含 `Content-Type: application/json`、`timestamp`（秒级时间戳）、`appId`、`sign`
- **AND** 请求体为 JSON 格式的查询参数 `{ pageNum: 1, pageSize: 20 }`
- **AND** 签名值 = `md5(appKey + "," + md5(请求体JSON) + "," + timestamp + "," + appSecret)`

#### Scenario: 获取订单详情 API 调用
- **WHEN** 调用 `/api/open/order/detail` 获取单个订单
- **THEN** 签名规则同上，请求体包含 `orderId`
- **AND** 响应解析 `data` 字段返回订单完整信息

### Requirement: API 域名与端点
系统 SHALL 使用闲管家官方生产环境域名 `https://open.goofish.pro`，接口路径前缀为 `/api/open/`。

#### Scenario: 使用正确的 API 基础 URL
- **WHEN** 发起任何闲管家 API 请求
- **THEN** 基础 URL 为 `https://open.goofish.pro`
- **AND** 支持通过数据库配置 `xianyu_api_base_url` 自定义域名（如测试环境 `https://open-test.goofish.pro`）

## MODIFIED Requirements

### Requirement: 订单列表数据映射
订单列表从 `xianyuApi.getOrders()` 返回的数据需要通过适配器映射为 OrderBindModal 组件期望的字段结构。

#### Scenario: 闲管家订单数据映射
- **WHEN** 获取到闲管家订单列表响应 `data.list[]`
- **THEN** 每条订单映射为 `{ order_no, buyer_nick, goods: { title, images, quantity }, price, order_time, status, receiver_mobile }` 格式
- **AND** 映射规则：`orderId→order_no`, `buyerNick→buyer_nick`, `productTitle→goods.title`, `price→price`, `payTime→order_time`, `status→status`

## REMOVED Requirements
无
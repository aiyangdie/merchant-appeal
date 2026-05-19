# Tasks

- [x] Task 1: 在 database 初始化中新增闲管家配置默认条目
  - [x] 1.1 在 `server/config/initDb.js` 的 `sysDefaults` 数组中新增 `xianyu_app_key`（config_group: xianyu, sort_order: 1）和 `xianyu_app_secret`（config_group: xianyu, sort_order: 2）配置项
  - [x] 1.2 执行数据库迁移：如果已有部署，在 `server/db.js` 的 `initDatabase()` 中新增迁移逻辑 INSERT IGNORE 这两个配置项

- [x] Task 2: 重写 `server/xianyu-api.js` 对齐闲管家官方 API 规范
  - [x] 2.1 修改签名为官方算法：`md5("appKey,bodyMd5,timestamp,appSecret")`（逗号分隔）
  - [x] 2.2 所有请求改为 POST 方法，请求头携带 `Content-Type: application/json`、`timestamp`、`appId`、`sign`
  - [x] 2.3 修正基础 URL 为 `https://open.goofish.pro`
  - [x] 2.4 修正订单列表端点为 `/api/open/order/list`，订单详情端点为 `/api/open/order/detail`
  - [x] 2.5 新增 `loadAppCredential()` 函数：优先从 `system_config` 表读取 AppKey/AppSecret，回退到环境变量
  - [x] 2.6 新增订单数据映射函数 `mapOrderFields(order)`：将闲管家响应格式映射为 OrderBindModal 期望格式
  - [x] 2.7 保留缓存机制（内存 Map + TTL），同时支持手动清除缓存

- [x] Task 3: 在 `server/index.js` 中更新订单路由
  - [x] 3.1 `GET /api/orders/from-system` 路由中 `xianyuApi.getOrders()` 调用后增加数据映射 `result.list.map(mapOrderFields)`
  - [x] 3.2 AppKey/AppSecret 未配置时返回友好错误提示（指向管理后台设置入口而非 .env 文件）
  - [x] 3.3 移除网络错误时的 mock 数据回退逻辑（不再生成假数据）

- [x] Task 4: 管理后台新增「闲管家配置」子标签 UI
  - [x] 4.1 在 `SETTINGS_SUB_TABS` 数组末尾新增 `{ key: 'xianyu', label: '闲管家配置', icon: '🐟' }`
  - [x] 4.2 在 `renderSubContent()` switch 中新增 `case 'xianyu'` 分支
  - [x] 4.3 渲染闲管家配置表单：AppKey 输入框（明文）、AppSecret 输入框（密码模式，支持显示/隐藏切换）、保存按钮
  - [x] 4.4 渲染应用信息卡片（只读标签）：应用类型（进销存）、应用模式（自研系统）、应用名称（艾阳的店铺）、应用状态（已上线）、创建时间（2026-03-17 19:39:40）
  - [x] 4.5 后端过滤：确保 `systemConfigs` 数据中包含 `config_group === 'xianyu'` 的配置项

- [x] Task 5: 前端从 AdminPage 加载时获取闲管家配置
  - [x] 5.1 确认 `GET /api/admin/system-config` 返回的 configs 已包含 `config_group: 'xianyu'` 的项
  - [x] 5.2 在 `renderSettings()` 中从 `systemConfigs` 过滤出 `config_group === 'xianyu'` 的配置项
  - [x] 5.3 确认保存按钮会调用 `PUT /api/admin/system-config` 保存到数据库

- [x] Task 6: 验证与测试
  - [x] 6.1 启动项目 npm run build 确保前后端构建通过
  - [x] 6.2 验证闲管家签名算法生成正确的 sign 值（与文档示例对比）
  - [x] 6.3 验证管理后台新标签页可正常打开和保存
  - [x] 6.4 前端验证 OrderBindModal 打开可请求订单并显示

# Task Dependencies
- Task 2 depends on Task 1（需要数据库中有 xianyu_app_key/xianyu_app_secret 配置项）
- Task 3 depends on Task 2（需要 xianyu-api.js 的新接口）
- Task 4 depends on Task 1（需要数据库中有 xianyu 配置项）
- Task 5 depends on Task 4（UI 需要渲染逻辑）
- Task 6 depends on Tasks 1-5（全部完成后验证）
- Tasks 1, 2, 4 可以并行执行
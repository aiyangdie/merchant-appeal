# 商户号申诉助手 - 使用指南

## 📖 目录

1. [项目概述](#项目概述)
2. [快速开始](#快速开始)
3. [skills知识库使用指南](#skills知识库使用指南)
4. [API使用指南](#api使用指南)
5. [闲鱼管家API集成](#闲鱼管家api集成)
6. [安全使用指南](#安全使用指南)
7. [合法合规指南](#合法合规指南)
8. [常见问题](#常见问题)

---

## 项目概述

商户号申诉助手是一个基于AI的智能商户号申诉系统，帮助商户处理微信支付和支付宝商户号被风控、限制或封禁问题。

**主要功能**：
- 🤖 AI智能对话收集信息
- 📋 自动生成申诉材料
- 📊 深度分析报告
- 🔗 闲鱼管家API订单集成
- 🛡️ 合规合法的申诉指导

---

## 快速开始

### 1. 启动服务

```bash
# 启动后端服务
cd merchant-appeal
node server/index.js

# 服务运行在 http://localhost:3001
```

### 2. 访问系统

- **用户端**: http://localhost:3001
- **管理后台**: http://localhost:3001/admin

### 3. 登录/注册

- 用户首次使用会自动注册
- 管理后台默认账号: `admin` / `admin123`

---

## skills知识库使用指南

### 什么是skills？

skills是项目的知识库文件夹，包含：
- 专业知识问答
- 申诉流程指导
- 行业资质要求
- API集成文档

### skills文件夹位置

```
merchant-appeal/.trae/skills/
├── 商户号申诉/                      # 商户号申诉主流程
├── 商户号申诉-闲鱼管家API完整知识库/ # 闲鱼管家API详细文档
├── 商户号知识问答/                   # 常见问题解答
├── 商户号申诉流程/                   # 申诉流程
├── 商户号行业资质/                   # 行业资质
└── ...其他skills
```

### 如何使用skills

1. **AI问答时自动检索**: 当用户提问时，AI会自动检索相关skills内容来回答
2. **手动查阅**: 直接打开skills文件夹查看相关文档
3. **API调用时参考**: 开发时参考skills中的API文档

### 项目docs文件夹

除了skills，项目还有一个整理好的docs知识库：

```
merchant-appeal/docs/
├── SKILL.md                    # 总览入口
├── 02-商户号申诉流程.md        # 申诉流程详解
├── 04-申诉材料清单.md          # 材料清单
├── 05-整改计划模板.md          # 整改模板
├── 06-行业资质要求.md          # 行业资质
├── 07-闲鱼管家API集成.md       # API文档
└── 08-枚举值速查表.md          # 枚举值
```

---

## API使用指南

### API基础配置

项目API配置文件: `.env`

```env
# 必填配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=merchant_appeal

# 安全密钥
ENCRYPT_KEY=你的64位十六进制字符串
JWT_SECRET=你的随机字符串

# 服务端口
PORT=3001

# 闲鱼管家API（可选，用于订单绑定功能）
XIANGUAN_BASE_URL=https://open.goofish.pro
XIANGUAN_APPID=你的AppID
XIANGUAN_APPSECRET=你的AppSecret
```

### 认证方式

API使用JWT Token认证：

```javascript
// 请求头
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

### 主要API端点

#### 用户相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/user/register` | 用户注册 |
| POST | `/api/user/login` | 用户登录 |
| GET | `/api/user/:id/info` | 获取用户信息 |

#### 订单相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/xianguan/shops` | 获取闲鱼管家店铺 |
| GET | `/api/orders/from-system` | 获取订单列表 |
| GET | `/api/orders/from-system/:orderNo` | 获取订单详情 |

#### 会话相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions` | 获取会话列表 |
| POST | `/api/sessions` | 创建会话 |
| GET | `/api/sessions/:id` | 获取会话详情 |
| POST | `/api/sessions/:id/bind-order` | 绑定订单 |

### API响应格式

```json
// 成功响应
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}

// 错误响应
{
  "success": false,
  "error": "错误信息",
  "code": "ERROR_CODE"
}
```

---

## 闲鱼管家API集成

### 什么是闲鱼管家API？

闲鱼管家开放平台API允许系统获取闲鱼订单信息，用于"绑定闲鱼订单"功能。

### API凭证申请

1. 访问 [闲鱼管家开放平台](https://open.goofish.pro)
2. 注册开发者账号
3. 创建应用获取 AppID 和 AppSecret

### 配置API凭证

在 `.env` 文件中配置：

```env
XIANGUAN_BASE_URL=https://open.goofish.pro
XIANGUAN_APPID=你的AppID
XIANGUAN_APPSECRET=你的AppSecret
```

### 签名算法

闲鱼管家API使用MD5签名验证：

```javascript
// 签名公式: signMd5 = md5("应用KEY,Body报文Md5值,时间戳,应用密钥")

function generateSign(bodyJson, timestamp, appKey, appSecret) {
  const bodyMd5 = crypto.createHash('md5').update(bodyJson || '').digest('hex');
  const signStr = `${appKey},${bodyMd5},${timestamp},${appSecret}`;
  return crypto.createHash('md5').update(signStr).digest('hex');
}
```

### API路由说明

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/xianguan/shops` | GET | 获取已授权店铺列表 |
| `/api/orders/from-system` | GET | 获取订单列表（支持分页、状态筛选） |
| `/api/orders/from-system/:orderNo` | GET | 获取订单详情 |

### 测试API连接

访问 `http://localhost:3001/api/xianguan/test` 测试API是否正常连接。

### 订单字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| order_no | string | 订单号 |
| order_status | integer | 订单状态（11待付款/12待发货/21已发货/22已完成） |
| buyer_nick | string | 买家昵称 |
| receiver_mobile | string | 收货电话 |
| receiver_name | string | 收货人 |
| receiver_state/city/district/address | string | 收货地址 |
| goods.title | string | 商品标题 |
| goods.images | array | 商品图片 |
| pay_amount | integer | 实付金额（分） |
| express_fee | integer | 运费（分） |
| express_name/waybill_no | string | 快递信息 |

---

## 安全使用指南

### 1. 保护API凭证

- **不要提交到GitHub**: `.env` 文件已在 `.gitignore` 中
- **定期更换密钥**: 建议每3个月更换一次
- **生产环境使用强密码**: 使用64位随机字符串

### 2. 环境配置

```env
# 生产环境必须修改
NODE_ENV=production

# 使用强密钥
ENCRYPT_KEY=使用64位十六进制随机字符串
JWT_SECRET=使用32位以上随机字符串

# API密钥
DEEPSEEK_API_KEY=你的密钥
```

### 3. 安全最佳实践

1. **数据加密**: 敏感信息（手机号、API Key）使用AES-256加密存储
2. **请求限速**: 防止恶意请求和滥用
3. **JWT过期**: 设置合理的token过期时间
4. **CORS配置**: 生产环境限制允许的跨域来源
5. **HTTPS**: 生产环境必须使用HTTPS

### 4. 服务器安全

```bash
# 使用防火墙限制访问
sudo ufw allow 22   # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS

# 定期更新系统
sudo apt update && sudo apt upgrade
```

### 5. 数据库安全

```sql
-- 创建专用数据库用户
CREATE USER 'merchant_appeal'@'localhost' IDENTIFIED BY '强密码';
GRANT ALL PRIVILEGES ON merchant_appeal.* TO 'merchant_appeal'@'localhost';
FLUSH PRIVILEGES;
```

---

## 合法合规指南

### 1. 使用范围

本系统**仅限于**以下合法用途：

✅ **允许的用途**:
- 代理商户提交微信支付/支付宝商户号申诉
- 帮助商户准备申诉材料
- 提供申诉流程咨询
- 记录和管理申诉进度

❌ **禁止的用途**:
- 伪造申诉材料
- 冒充他人身份进行申诉
- 绕过微信/支付宝风控系统
- 从事任何违法活动

### 2. 申诉材料真实性

**重要提醒**: 所有申诉材料必须真实有效！

- 营业执照必须是真实有效的
- 交易凭证必须是真实的
- 切勿伪造任何文件
- 如实描述问题原因

### 3. 个人信息保护

- 收集的用户信息仅用于申诉
- 不得泄露用户隐私
- 遵守《个人信息保护法》
- 建议签署保密协议

### 4. 商业合规

- 如提供收费服务，需办理相关营业执照
- 如涉及支付代理，需有相应资质
- 建议咨询法律顾问

### 5. 闲鱼管家API使用规范

使用闲鱼管家API时：
- 遵守闲鱼管家开放平台协议
- 仅获取必要的订单信息
- 不得滥用API接口
- 保护用户隐私数据

### 6. 免责声明

本系统仅提供技术支持和咨询服务，申诉结果由微信支付/支付宝官方决定。我们不对申诉结果做任何承诺。

---

## 常见问题

### Q1: API连接失败？

**检查项**:
1. `.env` 文件是否正确配置
2. XIANGUAN_APPID 和 XIANGUAN_APPSECRET 是否正确
3. 网络是否正常

**测试命令**:
```bash
curl http://localhost:3001/api/xianguan/test
```

### Q2: 订单显示不完整？

**可能原因**:
1. API权限不足
2. 授权店铺已过期
3. 订单数据为空

**解决方法**:
1. 在闲鱼管家平台确认应用授权
2. 检查店铺授权是否在有效期内

### Q3: 如何申请闲鱼管家API？

1. 访问 https://open.goofish.pro
2. 注册开发者账号
3. 创建应用
4. 获取 AppID 和 AppSecret
5. 配置到 `.env` 文件

### Q4: 如何保护数据安全？

1. 使用强密码
2. 定期备份数据库
3. 启用HTTPS
4. 限制数据库访问
5. 定期更新依赖

### Q5: 如何排查问题？

**日志查看**:
```bash
# 查看服务器日志
tail -f server/logs/app.log
```

**调试模式**:
```env
NODE_ENV=development
DEBUG=*
```

---

## 技术支持

- 项目地址: https://github.com/aiyangdie/merchant-appeal
- 问题反馈: 提交 Issue
- 文档更新: 定期更新skills知识库

---

*本指南由Trae AI自动生成*
*最后更新: 2026-04-13*

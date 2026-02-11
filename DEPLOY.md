# 宝塔面板部署指南 — 微信商户号申诉助手

## 一、服务器环境要求

- **操作系统**：CentOS 7+ / Ubuntu 20+ / Debian 10+
- **宝塔面板**：7.x 或 8.x
- **Node.js**：18+ （宝塔软件商店安装）
- **MySQL**：5.7+ 或 8.0+（宝塔软件商店安装）
- **Nginx**：任意版本（宝塔默认安装）
- **内存**：最低 1GB，推荐 2GB+

---

## 二、宝塔安装必要软件

在宝塔面板 → 软件商店中安装：
1. **Nginx**（默认已安装）
2. **MySQL 5.7** 或 **MySQL 8.0**
3. **PM2管理器**（搜索 PM2，一键安装）

> PM2 管理器会自动安装 Node.js，如果没有，手动在软件商店安装 Node.js 18+

---

## 三、创建 MySQL 数据库

1. 宝塔面板 → **数据库** → **添加数据库**
2. 填写信息：
   - 数据库名：`merchant_appeal`
   - 用户名：`merchant_appeal`
   - 密码：自动生成或自定义（**记住密码**）
   - 访问权限：**本地服务器**
3. 点击提交

---

## 四、上传项目文件

### 方式一：直接上传
1. 宝塔面板 → **文件** → 进入 `/www/wwwroot/`
2. 新建文件夹：`merchant-appeal`
3. 将本地项目的以下文件/文件夹上传到 `/www/wwwroot/merchant-appeal/`：
   ```
   dist/           ← 前端构建产物（必须）
   server/         ← 后端代码（必须）
   package.json    ← 依赖配置（必须）
   package-lock.json
   .env            ← 环境变量（必须，需修改）
   .env.example    ← 参考模板
   ```

### 方式二：Git 拉取
```bash
cd /www/wwwroot/
git clone <你的仓库地址> merchant-appeal
cd merchant-appeal
```

---

## 五、配置环境变量

编辑 `/www/wwwroot/merchant-appeal/.env`：

```env
# ============================================
# 数据库配置（使用宝塔创建的数据库信息）
# ============================================
DB_HOST=localhost
DB_PORT=3306
DB_USER=merchant_appeal
DB_PASSWORD=你在宝塔创建数据库时设置的密码
DB_NAME=merchant_appeal
DB_CONNECTION_LIMIT=10

# ============================================
# 安全密钥（部署前必须修改！）
# ============================================
# AES-256 加密密钥（必须 64 位十六进制字符）
# 生成命令：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPT_KEY=在此粘贴生成的64位密钥

# JWT 签名密钥（随机字符串）
# 生成命令：node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=在此粘贴生成的随机字符串

JWT_EXPIRES_IN=24h

# ============================================
# 服务器配置
# ============================================
PORT=3001
NODE_ENV=production
CORS_ORIGINS=https://你的域名.com

# ============================================
# 速率限制
# ============================================
RATE_LIMIT_MAX=100
CHAT_RATE_LIMIT_MAX=20
```

### ⚠️ 关键步骤：生成安全密钥

在服务器终端执行：
```bash
# 生成 ENCRYPT_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 生成 JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

将输出的随机字符串填入 `.env` 文件对应位置。

---

## 六、安装依赖

```bash
cd /www/wwwroot/merchant-appeal
npm install --production
```

---

## 七、测试启动

先手动测试是否能正常运行：

```bash
cd /www/wwwroot/merchant-appeal
node server/index.js
```

应看到：
```
✅ MySQL 数据库初始化完成
🚀 服务器已启动: http://localhost:3001
```

按 `Ctrl+C` 停止。

---

## 八、PM2 进程管理（守护运行）

### 方式一：宝塔 PM2 管理器（推荐）
1. 宝塔面板 → **软件商店** → **PM2管理器** → **设置**
2. 点击 **添加项目**：
   - 项目路径：`/www/wwwroot/merchant-appeal`
   - 启动文件：`server/index.js`
   - 项目名称：`merchant-appeal`
3. 点击提交

### 方式二：命令行
```bash
cd /www/wwwroot/merchant-appeal

# 启动
pm2 start server/index.js --name merchant-appeal

# 保存进程列表（开机自启）
pm2 save
pm2 startup

# 常用命令
pm2 list                    # 查看运行状态
pm2 logs merchant-appeal    # 查看日志
pm2 restart merchant-appeal # 重启
pm2 stop merchant-appeal    # 停止
```

---

## 九、Nginx 反向代理配置

### 方式一：宝塔可视化配置（推荐）
1. 宝塔面板 → **网站** → **添加站点**
   - 域名：`你的域名.com`
   - PHP版本：**纯静态**
   - 根目录：`/www/wwwroot/merchant-appeal/dist`
2. 点击站点名称 → **设置** → **反向代理**
3. 添加反向代理：
   - 代理名称：`node_api`
   - 目标URL：`http://127.0.0.1:3001`
   - 发送域名：`$host`
4. 提交

然后进入 **配置文件**，将 Nginx 配置替换为：

### 方式二：手动编辑 Nginx 配置

在宝塔的网站设置 → 配置文件中，替换内容为：

```nginx
server {
    listen 80;
    server_name 你的域名.com;

    # SSL 配置（如果已申请证书，宝塔会自动添加）
    # listen 443 ssl http2;
    # ssl_certificate /path/to/cert.pem;
    # ssl_certificate_key /path/to/key.pem;

    # 前端静态文件
    root /www/wwwroot/merchant-appeal/dist;
    index index.html;

    # API 请求反向代理到 Node.js
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    # SPA 路由：所有非文件请求返回 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
    }

    access_log /www/wwwlogs/merchant-appeal.log;
    error_log /www/wwwlogs/merchant-appeal.error.log;
}
```

---

## 十、配置 SSL 证书（HTTPS）

1. 宝塔面板 → 网站 → 你的站点 → **SSL**
2. 选择 **Let's Encrypt** → 勾选域名 → **申请**
3. 开启 **强制HTTPS**

---

## 十一、部署后检查清单

| 检查项 | 操作 |
|--------|------|
| ✅ 数据库连接 | 访问网站，如果能打开说明数据库正常 |
| ✅ 前端页面 | 访问 `https://你的域名.com` 看到登录页面 |
| ✅ 注册登录 | 注册一个用户测试 |
| ✅ 聊天功能 | 发送消息测试（如果没有配置 DeepSeek API Key 会用规则引擎） |
| ✅ 管理后台 | 访问 `https://你的域名.com/admin` 用 admin/admin123 登录 |
| ✅ **修改管理员密码！** | 登录后台后**立即修改默认密码** |
| ✅ 配置 DeepSeek API Key | 后台 → 系统配置 → AI配置 → 填入 API Key |
| ✅ SSL 证书 | 确认 https 访问正常 |
| ✅ PM2 守护 | `pm2 list` 确认进程在线 |

---

## 十二、常见问题

### Q: 网站打开空白
- 检查 `dist/` 文件夹是否上传了
- 检查 Nginx 配置的 root 路径是否正确
- 重启 Nginx

### Q: API 请求 502 Bad Gateway
- 检查 Node.js 是否在运行：`pm2 list`
- 检查端口是否正确：`pm2 logs merchant-appeal`
- 确认 `.env` 中的数据库密码是否正确

### Q: 数据库连接失败
- 检查 `.env` 中的 DB_PASSWORD 是否与宝塔数据库密码一致
- 检查 MySQL 是否在运行

### Q: 聊天没有 AI 回复（只有规则引擎）
- 后台 → 系统配置 → 检查 DeepSeek API Key 是否已填写
- 检查用户余额是否 > 0

### Q: 修改代码后如何更新
```bash
cd /www/wwwroot/merchant-appeal
# 如果修改了前端，需要重新构建
npm run build
# 重启后端
pm2 restart merchant-appeal
```

---

## 项目结构说明

```
merchant-appeal/
├── dist/                  ← 前端构建产物（Nginx 直接服务）
├── server/                ← 后端 Node.js 代码
│   ├── index.js           ← 主入口（Express API + SSE 流式聊天）
│   ├── ai.js              ← DeepSeek AI 引擎（对话/提取/评估/扩展）
│   ├── localAI.js         ← 本地规则引擎（对话流程+输入验证+报告生成）
│   ├── knowledgeBase.js   ← 知识库（12种违规类型+16个案例+风险评估+材料清单）
│   ├── db.js              ← MySQL 数据访问层（自动建表+迁移）
│   ├── tokenizer.js       ← Token 统计与计费
│   └── crypto.js          ← AES-256 加解密
├── src/                   ← 前端源码（React 18 + TailwindCSS）
│   ├── components/        ← 组件（ChatMessage/InfoPanel/AIAnalysis/AppealText...）
│   ├── pages/             ← 页面（ChatPage/AdminPage/AdminLogin）
│   ├── App.jsx            ← 路由配置
│   └── main.jsx           ← 入口
├── docs/                  ← 文档资源
│   └── screenshots/       ← 功能截图
├── .env                   ← 环境变量（不要提交到 Git）
├── .env.example           ← 环境变量模板
├── package.json           ← 依赖配置
├── vite.config.js         ← Vite 构建配置
├── README.md              ← 项目说明（含演示视频/PPT）
└── DEPLOY.md              ← 本文件（宝塔部署指南）
```

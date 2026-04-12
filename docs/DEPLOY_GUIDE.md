# 一键部署指南

## 准备工作

### 1. 服务器要求

| 配置项 | 最低要求 | 推荐配置 |
|--------|----------|----------|
| CPU | 1核 | 2核+ |
| 内存 | 1GB | 2GB+ |
| 硬盘 | 10GB | 20GB+ |
| 系统 | Ubuntu 20.04+ | Ubuntu 22.04 LTS |
| Node.js | 18.0+ | 18.0 LTS |
| MySQL | 8.0+ | 8.0 |

### 2. 必需账号和密钥

- [ ] GitHub 账号
- [ ] 服务器（推荐阿里云/腾讯云）
- [ ] 域名（可选，用于HTTPS）
- [ ] SSL证书（可选）

---

## 方式一：手动部署

### 第一步：服务器环境配置

```bash
# 1. 更新系统
sudo apt update && sudo apt upgrade -y

# 2. 安装 Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 3. 安装 MySQL 8.0
sudo apt install -y mysql-server
sudo mysql_secure_installation

# 4. 安装 PM2（进程管理器）
sudo npm install -g pm2

# 5. 安装 Nginx（反向代理）
sudo apt install -y nginx
```

### 第二步：配置 MySQL

```bash
# 1. 登录 MySQL
sudo mysql -u root -p

# 2. 创建数据库和用户
CREATE DATABASE merchant_appeal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'merchant'@'localhost' IDENTIFIED BY '你的强密码';
GRANT ALL PRIVILEGES ON merchant_appeal.* TO 'merchant'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# 3. 导入初始化脚本
mysql -u merchant -p merchant_appeal < init.sql
```

### 第三步：部署应用

```bash
# 1. 克隆代码
cd /var/www
sudo git clone https://github.com/你的用户名/merchant-appeal.git
cd merchant-appeal

# 2. 安装依赖
npm install

# 3. 创建环境配置文件
cp .env.example .env
nano .env  # 编辑配置

# 4. 构建前端
npm run build

# 5. 使用 PM2 启动
pm2 start server/index.js --name merchant-appeal
pm2 save
pm2 startup
```

### 第四步：配置 Nginx 反向代理

```bash
# 创建 Nginx 配置
sudo nano /etc/nginx/sites-available/merchant-appeal
```

写入以下内容：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名

    client_max_body_size 20M;

    location / {
        root /var/www/merchant-appeal/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 启用配置
sudo ln -s /etc/nginx/sites-available/merchant-appeal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 第五步：配置 SSL（可选但推荐）

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取 SSL 证书
sudo certbot --nginx -d your-domain.com
```

---

## 方式二：Docker 部署（推荐）

### 第一步：安装 Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

### 第二步：一键启动

```bash
# 克隆代码
git clone https://github.com/你的用户名/merchant-appeal.git
cd merchant-appeal

# 创建环境变量文件
cp .env.example .env
nano .env  # 填写实际配置

# 启动服务
docker-compose up -d
```

### 查看服务状态

```bash
docker-compose ps
docker-compose logs -f
```

---

## 方式三：GitHub Actions 自动部署

### 第一步：在 GitHub 仓库设置密钥

1. 进入你的 GitHub 仓库
2. 点击 `Settings` → `Secrets and variables` → `Actions`
3. 添加以下 Secrets：

| Secret 名称 | 说明 |
|-------------|------|
| DEPLOY_HOST | 服务器 IP |
| DEPLOY_USER | 服务器用户名 |
| DEPLOY_SSH_KEY | SSH 私钥 |
| DEPLOY_PATH | 部署路径 |
| DB_HOST | 数据库地址 |
| DB_PASSWORD | 数据库密码 |
| JWT_SECRET | JWT 密钥 |
| ENCRYPT_KEY | 加密密钥 |
| DEEPSEEK_API_KEY | DeepSeek API 密钥 |

### 第二步：配置 SSH 访问

```bash
# 在本机生成 SSH 密钥对
ssh-keygen -t rsa -b 4096

# 查看公钥
cat ~/.ssh/id_rsa.pub

# 将公钥复制到服务器
ssh-copy-id user@server-ip
```

### 第三步：推送到 GitHub

```bash
git add .
git commit -m "feat: 完成项目部署配置"
git push origin main
```

### 第四步：查看部署状态

进入 GitHub 仓库 → `Actions` → 查看部署日志

---

## 部署后检查

### 1. 检查服务状态

```bash
# 查看 PM2 状态
pm2 status

# 查看日志
pm2 logs merchant-appeal
```

### 2. 检查端口

```bash
# 检查端口占用
netstat -tlnp | grep 3001

# 检查 Nginx 状态
sudo systemctl status nginx
```

### 3. 测试访问

```bash
# 本地测试
curl http://localhost:3001/api/health

# 远程测试
curl http://your-domain.com/api/health
```

---

## 常见问题排查

### 问题1：端口被占用

```bash
# 查找占用端口的进程
lsof -i :3001

# 杀死进程
kill -9 <PID>
```

### 问题2：数据库连接失败

```bash
# 检查 MySQL 状态
sudo systemctl status mysql

# 检查连接
mysql -u merchant -p -h localhost
```

### 问题3：前端资源404

```bash
# 检查构建文件
ls -la dist/

# 重新构建
npm run build
```

### 问题4：权限问题

```bash
# 修复权限
sudo chown -R $USER:$USER /var/www/merchant-appeal
chmod -R 755 /var/www/merchant-appeal
```

---

## 安全加固

### 1. 配置防火墙

```bash
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### 2. 定期备份

```bash
# 备份数据库
mysqldump -u merchant -p merchant_appeal > backup_$(date +%Y%m%d).sql

# 备份文件
tar -czf backup_files.tar.gz dist/ uploads/
```

### 3. 更新依赖

```bash
# 检查更新
npm outdated

# 更新依赖
npm update

# 重建
npm run build
```

---

## 监控和维护

### PM2 常用命令

```bash
pm2 status          # 查看状态
pm2 logs            # 查看日志
pm2 restart all     # 重启所有
pm2 stop all        # 停止所有
pm2 delete all      # 删除所有
pm2 monit           # 实时监控
```

### 日志管理

```bash
# 查看错误日志
pm2 logs --err

# 查看最近日志
pm2 logs --lines 100
```

---

## 技术支持

- 提交 Issue: https://github.com/aiyangdie/merchant-appeal/issues
- 文档更新: 定期更新 skills 知识库

---

*本指南由 Trae AI 自动生成*
*最后更新: 2026-04-13*

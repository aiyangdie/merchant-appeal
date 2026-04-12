@echo off
cd /d "%~dp0"
set NODE_ENV=development
set DB_HOST=localhost
set DB_PORT=3306
set DB_USER=root
set DB_PASSWORD=merchant_2026
set DB_NAME=merchant_appeal
set DB_CONNECTION_LIMIT=10
set ENCRYPT_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
set JWT_SECRET=merchant-appeal-jwt-secret-key-change-in-production-2026
set JWT_EXPIRES_IN=24h
set ORDER_SYSTEM_URL=http://your-order-system:5000
set APPEAL_API_KEY=dev-appeal-api-key-2026
set XIANGUAN_BASE_URL=https://open.goofish.pro
set XIANGUAN_APPID=1500256339739973
set XIANGUAN_APPSECRET=ggEj73NV7fJfpwPQxDtFiyGIPkyHuxFH
set PORT=3001
set CORS_ORIGINS=*
set RATE_LIMIT_MAX=100
set CHAT_RATE_LIMIT_MAX=20
echo Starting server with environment variables...
"C:\Program Files\nodejs\node.exe" index.js
pause
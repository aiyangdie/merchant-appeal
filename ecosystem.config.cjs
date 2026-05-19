/** PM2 生产配置 — 在 server 目录加载 .env */
module.exports = {
  apps: [
    {
      name: 'merchant-appeal',
      cwd: '/root/我的项目/merchant-appeal/server',
      script: 'index.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      max_restarts: 10,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}

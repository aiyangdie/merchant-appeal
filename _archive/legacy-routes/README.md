# 遗留路由（未接入生产）

`server/app.js` + `server/routes/index.js` 为早期重构尝试，**npm start 使用 `server/index.js`**。

- 会话校验语义与生产 `middleware/sessionAccess.js` 不一致
- 新代码请写入 `server/routes/prod/`

保留此目录仅供对照，计划后续删除。

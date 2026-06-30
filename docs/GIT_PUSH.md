# Git Push 说明

本地 commit `df5606f` 尚未推送到 GitHub。

## 原因

- HTTPS remote 无交互凭据
- SSH `git@github.com` 公钥未授权

## 推送方式（任选其一）

### 方式 A：SSH（推荐）

1. 将 `/root/.ssh/id_ed25519.pub` 添加到 GitHub → Settings → SSH keys
2. 执行：

```bash
cd /root/merchant-appeal
git remote set-url origin git@github.com:aiyangdie/merchant-appeal.git
git push -u origin main
```

### 方式 B：HTTPS + PAT

```bash
cd /root/merchant-appeal
git push https://<GITHUB_TOKEN>@github.com/aiyangdie/merchant-appeal.git main
```

## 部署（与 push 无关）

```bash
cd /root/merchant-appeal && npm run deploy:production
```

# 开发工作流（Superpowers + Git）

## 1. 技能顺序（强制）

| 阶段 | Superpowers 技能 | 产出 |
|------|------------------|------|
| 启动 | using-superpowers | 确认适用技能 |
| 需求 | brainstorming | `docs/superpowers/specs/YYYY-MM-DD-*-design.md` |
| 方案 | writing-plans | `docs/superpowers/plans/YYYY-MM-DD-*.md` |
| 实现 | test-driven-development + executing-plans | 代码 + 测试 |
| 排错 | systematic-debugging | 根因 + 证据 |
| 收尾 | verification-before-completion | 命令输出截图/日志 |
| 合并 | finishing-a-development-branch | PR / merge |

大功能使用 **using-git-worktrees** 隔离分支。

## 2. Git 提交规范

1. 完成**单一**功能 / 修复 / 文档点后提交  
2. 类型：`feat` `fix` `docs` `refactor` `perf` `test` `chore`  
3. 标题英文，正文可中英双语说明用途与范围  

示例：

```
feat(admin): add AI floating agent for settings and recharge

- POST /api/admin/agent/plan|execute
- AdminAIFab on AdminPage
- 中文 UI 与确认令牌流程

用途：管理后台自然语言操作
```

## 3. 本地验证（提交前）

```bash
cd merchant-appeal
npm run test:unit
npm run verify:all
```

需 MySQL 与 `.env`（参考 `.env.example`）。

## 4. 模块文档

- [AI 进化](AI_EVOLUTION.md)
- [实施计划目录](superpowers/plans/)

## 5. 禁止事项

- 跳过 brainstorming 直接大改  
- 无测试证据宣称「已修复」  
- 一次性提交整仓未分模块的改动  
- 使用已废弃的非 Superpowers 旧指令流程

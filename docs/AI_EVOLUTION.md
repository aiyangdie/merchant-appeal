# AI 进化（Evolution Engine）

## 一句话

用 AI 复盘历史对话 → 生成/优化规则 → 审批入库 → 下次对话自动拼进 System Prompt，让申诉助手越聊越贴合业务。

## 数据流

```
用户对话 (ChatPage)
  → /api/chat stream 结束
  → schedulePostConversationAnalysis (延迟 30s)
  → analyzeConversation
  → generateRulesFromAnalysis → ai_rules (pending_review)
  → autoReviewRule / 管理员激活 → status=active
  → loadActiveRulesForPrompt()
  → ai.js buildSystemPrompt() → 下一轮对话生效
```

定时任务 `startEvolutionScheduler()` 在 `server/index.js` 启动时自动运行（每 10/30 分钟批量分析未处理会话）。

## 核心文件

| 文件 | 作用 |
|------|------|
| `server/evolution.js` | 分析、规则生成、审批、Prompt 加载、定时器 |
| `server/ai.js` | `buildSystemPrompt()` 注入活跃规则 |
| `server/db/schema.js` | `ai_rules`、`conversation_analyses` 等表 |
| `server/app/registerRoutes.js` | `/api/admin/evolution/*` |
| `src/components/EvolutionPanel.jsx` | 管理后台「AI 进化」页 |

## 规则类别

- `collection_strategy` — 收集策略
- `question_template` — 提问话术
- `industry_knowledge` — 行业知识
- `violation_strategy` — 违规应对
- `conversation_pattern` — 对话模式
- `diagnosis_rule` — 诊断规则

## 运营步骤

1. 确保 **AI 模型** 已配置有效 API Key（或 `.env` 中 `DEEPSEEK_API_KEY`）。
2. 积累用户申诉对话（每场至少约 3 条消息）。
3. 管理后台 → **AI 进化** → 总览 → **批量分析**。
4. **规则库** → 将 `待审批` 规则 **激活**（或等待 AI 自动审批）。
5. 新开用户对话，助手 Prompt 会包含 `## AI自学习规则库` 一节。

## 其它入口

- **AI 中枢**：自然语言「分析最近 10 条对话」「生成规则：…」
- **AI 管理助手**：工具 `evolution.batch_analyze`、`evolution.create_rule`

## 本地验证脚本

```bash
cd merchant-appeal
node server/scripts/evolutionVerify.mjs
```

检查：AI Key、未分析会话数、批量分析、活跃规则、Prompt 注入片段。

## 与 AI 管理助手的区别

| | AI 进化 | AI 管理助手 |
|--|---------|-------------|
| 目标 | 优化用户侧申诉对话 | 管理后台操作（充值、设置等） |
| 产出 | `ai_rules` → System Prompt | Agent 工具改 DB/配置 |

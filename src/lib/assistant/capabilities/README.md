# Assistant Capability Registry

Agent 能力统一从 `registry.ts` 汇总。新增页面或业务模块时，不改 Agent 编排逻辑，而是在该模块旁注册 capability provider。

## Provider 约定

每个 provider 暴露一个或多个 `AssistantSkill`：

- `name`：稳定能力域名，例如 `leaderboard`
- `description`：告诉 Planner 这个能力解决什么问题
- `permission`：最低权限，执行层仍会兜底校验
- `tools[]`：具体只读/写前确认工具

工具必须复用现有业务服务函数或受控 Query API，不允许给 LLM 裸 SQL。

## 接入步骤

1. 在业务模块旁或 `src/lib/assistant/capabilities/` 下创建 capability 文件，例如 `leaderboard.ts`
2. 复用页面同源服务函数，例如 `getLeaderboard`
3. 写清楚参数 schema、权限、返回结构和导航动作
4. 在 `registry.ts` 注册 provider
5. 在 `coverage.ts` 标记对应页面/API 的接入状态：`covered`、`confirm-write` 或 `not-exposed`
6. 增加服务级验证问题，确认 Planner 能选中该能力

这样新增页面功能时，只需要注册能力，Agent 会自动读取 manifest 并参与规划。

## 覆盖规则

所有业务页面/API 都必须进入 `coverage.ts`：

- `covered`：Agent 可通过只读 capability 查询。
- `confirm-write`：Agent 只能生成确认草案，用户确认后才执行写操作。
- `not-exposed`：明确不暴露给 Agent，并写清楚原因。

不要把裸 SQL、认证、密码、文件下载、cron 或未设计确认流的写操作直接暴露给 LLM。

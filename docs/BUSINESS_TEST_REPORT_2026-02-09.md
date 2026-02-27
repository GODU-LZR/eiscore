# 业务测试报告（2026-02-09）

> 更新说明（2026-02-27）：本文为阶段性业务回归快照。  
> 当前整合口径请优先参考：`docs/PROJECT_COMPLETION_INTEGRATED_2026-02-27.md`。

## 1. 执行目标
对当前系统进行一轮完整业务回归，覆盖：
- 登录与鉴权
- 宿主路由刷新（Qiankun 深链）
- 核心业务数据接口（人事/物料/应用中心/工作流）
- AI 能力链路（配置、非流式、流式）
- Realtime WebSocket 鉴权连接
- PM2 核心进程在线状态

## 2. 执行环境
- 入口：`http://localhost:8080`
- API：通过宿主 `/api` 代理到 PostgREST
- AI/Realtime：通过宿主 `/agent` 代理到 `agent-runtime`
- 进程管理：PM2（`base`/`hr`/`materials`/`eiscore-apps`/`agent-runtime`）

## 3. 业务测试清单与结果
本次共执行 23 项，结果：**23 通过 / 0 失败**。

### A. 路由与页面刷新
1. 首页可访问（`GET /`）✅
2. 刷新 `materials` 深链返回宿主 HTML（`/materials/apps`）✅
3. 刷新 `hr` 深链返回宿主 HTML（`/hr/employee`）✅
4. 刷新 `apps` 深链返回宿主 HTML（`/apps/`）✅

### B. 登录与权限
5. 正确账号密码登录返回 token（`/api/rpc/login`）✅
6. 错误密码登录返回非 200（403）✅
7. 角色表可读（`public.roles`）✅
8. 系统配置可读（`system_configs: app_settings`）✅
9. AI 配置可读（`system_configs: ai_glm_config`）✅
10. 字段 ACL 可读（`sys_field_acl`）✅

### C. 核心业务数据（模块）
11. 物料主表可读（`public.raw_materials`）✅
12. 人事档案可读（`hr.archives`）✅
13. 应用中心应用表可读（`app_center.apps`）✅
14. 工作流定义可读（`/api/workflow.definitions` 别名）✅
15. 工作流定义可读（`/api/definitions`）✅
16. 工作流状态映射可读（`app_center.workflow_state_mappings`）✅

### D. AI 与实时能力
17. Agent 健康检查（`/agent/health`）✅
18. AI 配置接口无 token 返回 401 ✅
19. AI 配置接口有 token 返回 200 ✅
20. AI 聊天非流式可用（`/agent/ai/chat/completions`）✅
21. AI 聊天流式可用（SSE 分片返回）✅
22. Realtime WebSocket 鉴权连接可建立（`ws://localhost:8078/ws`）✅

### E. 运行状态
23. PM2 核心进程在线（`base/hr/materials/eiscore-apps/agent-runtime`）✅

## 4. 关键验证结论
- 当前“刷新子应用页面白屏”问题已通过深链刷新测试验证正常。
- 当前“AI 401/410”链路已恢复；配置读取、非流式、流式均通过。
- 工作流定义接口别名链路（`workflow.definitions -> definitions`）可正常读取。
- Realtime WebSocket 鉴权连接正常。

## 5. 本轮执行命令（可复现）
- 执行脚本：`node /home/lzr/eiscore/.tmp/business_smoke_test.mjs`
- 结果文件：`/home/lzr/eiscore/.tmp/business_smoke_result.json`

## 6. 注意事项
- `workflow_state_mappings` 当前在 `app_center` profile 下可读（不是 `workflow` profile）。
- `raw_materials` 业务字段名为 `name`，非 `material_name`。

# 待测试验证清单（不含 eiscore-apps）

更新时间：2026-02-03

## 1. Realtime Agent 安全与审计
- 角色限制
  - 使用非白名单角色连接 WebSocket，发送 `agent:task` 应返回 `agent:error`（Forbidden）。
  - 白名单角色可正常执行 `agent:task`。
- 项目白名单
  - `projectPath` 非允许列表，返回 Forbidden。
  - 允许路径正常执行，并可读写工作区内文件。
- 命令限制
  - 非白名单命令或包含 `; && |` 等拼接符必须被拒绝。
- 审计日志
  - 服务器日志包含 `agent:task_start/agent:task_result/agent:tool_result` 等记录。

## 2. AI 渲染 XSS 防护
- Markdown 输出包含 `<script>`、`onerror=` 等内容时不执行且被移除。
- Mermaid/ECharts 渲染正常；双击预览的 Lightbox 仍可打开。
- AI 回复包含链接/图片时仍能显示（`http/https/data:image`）。

## 3. 公式计算安全替换
- HR/Materials 的公式列、详情页公式均能正确计算。
- 非法公式（如 `alert(1)` 或包含非法字符）不执行、不报错中断。
- 原有公式结果与旧版本一致（抽样对比）。

## 4. 鉴权与登录跳转
- Token 过期时：刷新页面/切换路由应自动跳转 `/login`。
- 直接访问业务路径（无 token）应跳转 `/login`。
- API 返回 401 时应自动跳转 `/login`（包含 axios 请求与 fetch）。

## 5. WS 订阅鉴权
- HR/Materials 实时订阅连接成功（带 token 协议头）。
- token 缺失或无效时连接被拒绝。

## 6. 打印窗口安全
- 打印内容不执行任何脚本（无 `on*` 事件）。
- 现有打印样式不变，内容完整。

## 7. 回归检查
- 登录/登出流程正常。
- 物料、人事常用页面加载正常，AI 助手可用。

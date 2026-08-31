# G2 平台边界退出审计

- 审计日期：2026-08-31
- 当前结论：未通过 G2 退出门槛
- 审计范围：全部 `eiscore-*/src`、根部 `shared/`、`@eiscore/platform`、工程契约测试与已接受 ADR

本审计把“已有平台模块”和“业务已完成迁移”分开判断。只有存在全产品范围证据、剩余例外已分类并由门禁锁定时，能力才可标记完成；G4 企业配置包、服务端授权和业务级错误文案不冒充 G2 前端平台完成证据。

## 能力结论

| 能力 | 状态 | 当前证据 | 剩余工作 |
| --- | --- | --- | --- |
| 企业配置入口 | 边界完成 | v1 Schema、10 模块校验、启动失败关闭、品牌/端点/模块加载器与契约测试 | 三家企业配置包及同制品部署验证属于 G4 |
| Auth/Session | 完成 | 10 个 Auth 适配器、全产品直接 `auth_token`/`user_info` 消费归零、严格库存门禁 | 服务端 Token 签名和授权仍由服务端负责 |
| HTTP 与基础设施错误 | 完成 | 普通受保护 API 裸 `fetch` 归零、9 个 Axios Request 进入平台边界、401/超时/脱敏/安全业务文案契约 | 12 文件/18 处特殊请求属于六类具名协议边界，不能伪装成普通 HTTP |
| 前端权限判断 | 完成 | 平台权限服务成为 9 个权限工具的唯一规则来源，保留超级管理员、销售/采购模块与经理特例、读取异常差异 | 不替代 PostgREST/RLS 或服务端授权 |
| 跨模块导航 | 完成 | 销售 3 条业务链、5 个明确消费者及 AppRuntime 动态业务目标均已接入平台导航；61 文件/123 次 Router 调用完成复审并受门禁保护 | 15 文件/17 处整页余量限于认证/登录、移动与桌面切换或基座已受控外部路由 |
| 非会话本地存储 | 完成 | Auth 及 12 个非会话缓存/偏好族已共享安全服务；11 文件/11 处原生引用均为安全边界，产品消费者原生访问与未受控间接持久化均归零 | VueUse 仅保留 1 个 `storageKey: null` 的 DOM 主题桥，不直接持久化 |
| Grid/UI 单一来源 | 未完成 | 8 个 Grid Core 的分页、布局、会话和审计边界已共享；HR 最后一份内联布局已移除 | `eis-data-grid-v2` 仍存在于 8 个应用目录，组件与主要 Core 尚无单一可演进来源 |

## 锁定库存

`tests/engineering/g2-platform-boundary-inventory-regression.mjs` 以精确文件和调用数锁定以下未完成项：

- 原生 Storage：11 个文件、11 处引用，全部位于承载 12 个已迁移缓存/偏好族的共享安全领域边界；产品页面、Store 和组件的原生访问为 0。
- 间接 Storage：`useStorage/useLocalStorage/useSessionStorage` 和激活式 Pinia `persist` 为 0；唯一 `useDark` 显式使用 `storageKey: null`，持久化仍由安全边界承担。
- `window.location.href =`：15 个文件、17 处；现有余量限于认证/登录兼容跳转、移动与桌面入口切换及基座已受控外部路由。
- 权限适配器：9 个，均必须依赖 `@eiscore/platform/permission`，不得重新内联角色和权限数组规则。
- `eis-data-grid-v2`：8 份应用级副本，禁止增加第 9 份。

该门禁是“只降不增”基线，不表示现有库存合理，也不要求把业务内路由、离线数据或领域授权粗暴塞进一个通用工具。当前原生模式尚未统计 VueUse `useDark({ storageKey: 'eis_theme_global' })` 这类间接持久化；直接库存归零前必须扩展扫描规则并重新审计，不能以当前数字宣称 Storage 完成。

## 退出阻断项与顺序

G2 只有在以下项目完成并有全量证据后才能关闭：

1. 8 份 Grid 副本收敛为单一来源，所有应用通过兼容入口消费同一实现。

下一批进入 Grid 单一来源迁移，先锁定 8 份副本的差异和兼容入口，再按可回退切片机械收敛。

## 验证入口

```text
npm run test:enterprise-config
npm run test:enterprise-navigation
npm run test:platform-http
npm run test:platform-auth
npm run test:quality
```

远程测试不属于本审计，未经明确授权不得执行。

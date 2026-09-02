# G3 核心模块可维护性总体退出审计

## 结论

G3 退出审计覆盖 Realtime 模块化、数据库迁移治理、Vue 复杂度棘轮以及 13 个已登记的组合页/领域切片。Realtime 组合根、迁移执行入口和重点 Vue 页面均有独立回归门禁；本总体门禁只聚合证据，不替代各子目标的精确断言。

G3 的可维护性目标在本审计范围内通过：核心规则可以脱离完整系统离线验证，组合根和重点页面不得超过各自退出基线，数据库 Runtime V2 补丁具备 Manifest、SHA-256、postcheck、回退声明和执行账本。G4/G5（产品配置化、持续交付与运行治理）不在本结论范围内。

## 审计范围与证据

| 领域 | 证据 |
| --- | --- |
| Realtime | G3_REALTIME_EXIT_AUDIT.md、realtime-composition-root-regression.mjs、test:runtime-router |
| 数据库迁移 | adr/0009-database-migration-governance.md、database-migration-governance-regression.mjs、runtime-migration-runner-regression.mjs |
| Vue 复杂度 | G3_VUE_COMPLEXITY_INVENTORY.md、vue-complexity-inventory-regression.mjs |
| 重点页面 | 13 份页面审计文档及各自 *-composition-exit-regression.mjs 门禁 |

## 统一退出规则

- 纯策略模块不得依赖 Vue、Element Plus、Request、浏览器 API、Storage 或隐式当前时间。
- 组合层保留真实网络、Router、Realtime、Timer、Fullscreen、窗口事件、AI Bridge、模板和 CSS 副作用，并由精确库存断言防止增长。
- 页面和 Realtime 组合根只降不增；剩余巨页债务作为接受库存持续治理，不以机械模板搬迁换取数字下降。
- 历史 SQL 只读锁定；只有带顺序与校验证据的 Runtime V2 Manifest 补丁可进入执行入口，真实生产演练仍需授权环境。

## 验证与回退

聚合门禁检查文档、专项门禁和质量链注册关系；专项门禁负责真实行数、导出数、依赖禁入和副作用库存。所有 G3 抽取切片均为小提交、不含数据迁移，可按职责回退；回退时必须同步恢复对应门禁基线与进度记录。未运行远程业务链、真实数据库迁移或生产部署操作。

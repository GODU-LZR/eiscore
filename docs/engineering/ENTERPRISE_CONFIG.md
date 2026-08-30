# 企业配置契约 v1

## 目标

同一份 EISCore 源代码和制品通过独立配置服务不同企业。企业名称、品牌素材、域名、模块开关和功能开关属于部署数据，不再继续写入页面、Store 或构建配置。

配置契约由以下文件共同组成：

- `config/enterprise.schema.json`：可供编辑器和外部工具使用的 JSON Schema。
- `config/enterprise.example.json`：不含真实客户信息的完整示例。
- `@eiscore/platform/enterprise-config`：运行时校验、规范化和深度只读加载入口。
- `scripts/validate-enterprise-config.mjs`：部署前配置校验器，只报告字段位置和错误类型，不输出字段值。

## 当前存量盘点

- 基座系统 Store、设置页、基座登录页和移动登录页包含重复的存量客户品牌、远程图片与行业文案。
- 基座固定注册 9 个 qiankun 子应用；移动端作为独立入口，共形成 10 个企业模块开关。
- 各前端现有 Auth、Request、Realtime 工具共 27 份，其中多份内容相同或高度相似。
- 11 个 HTML 入口的标题尚未统一，部分仍是 `Vite App`，生产模块标题还误写为 Sales。

这些内容本切片只登记，不批量迁移。后续先让基座启动和模块注册消费统一配置，再逐个替换登录品牌与移动端入口；每次迁移均保留特征测试和回退路径。

## 安全与兼容规则

- 配置版本当前固定为 `schemaVersion: 1`，未知字段、未知模块和错误类型立即失败。
- 配置禁止出现密码、Token、API Key、私钥等秘密字段；秘密继续由服务端环境或秘密管理系统提供。
- 公网基础地址和远程素材只允许 HTTPS；内部接口使用同源绝对路径。
- 生产启动最终必须以 `required: true` 加载；开发与现有部署迁移期可以在配置缺失时使用中性、全模块启用的只读默认值。
- 返回对象递归冻结，业务页面不得在运行时修改企业配置。

## 校验命令

```bash
npm run config:enterprise:validate
node scripts/validate-enterprise-config.mjs path/to/enterprise.json
```

三家企业的真实配置包将在明确品牌素材、域名和模块范围后单独建立；配置数据可以包含客户名称，产品源码不得包含客户分支逻辑。

# G4.3 核心制品集合基线

> 状态：工具与离线契约已建立；三家企业同制品运行尚未验收。

G4.3 的工程边界是证明“核心代码制品只构建一次，企业差异通过隔离企业包表达”。`scripts/enterprise-artifact-set.mjs` 提供离线失败关闭校验，不构建、不部署、不连接客户环境。

集合记录包含：

- 核心制品来源提交、相对文件清单、字节数、逐文件 SHA-256 和集合 SHA-256；
- 每个企业包的相对路径、企业 ID、包 ID 和已校验的包级 SHA-256；
- 排序、重复、路径穿越、符号链接、文件漂移、包漂移和企业/包身份不匹配检查。

普通集合至少包含两个隔离企业包，生产模式至少包含三个，并要求每个包通过现有企业包生产门禁。该门禁不把 `example` 或尚未获得企业确认的包伪装成生产包，也不替代 G4.4 的逐企业功能验收。

验证命令：

```powershell
node scripts/enterprise-artifact-set.mjs validate enterprise-handoffs/artifact-set.json
node scripts/enterprise-artifact-set.mjs validate enterprise-handoffs/artifact-set.json --production
node tests/engineering/enterprise-artifact-set-regression.mjs
```

当前三家企业仍处于 G4.2 确认等待状态，因此仓库只提交校验能力和 fixture 回归，不生成未经确认的三家生产集合记录。

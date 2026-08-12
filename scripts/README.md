# Scripts

此目录用于存放部署/启动相关脚本。

- deploy-simple.sh：简化部署脚本。
- deploy-pm2.sh：PM2 部署脚本。
- start-app-center.sh：启动应用中心（Linux）。
- start-app-center.ps1：启动应用中心（Windows PowerShell）。
- start-apps-manage.ps1：启动 eiscore-apps（Windows PowerShell）。
- backup-ontology-semantics.sh：备份本体语义表与关系视图（Linux/WSL）。
- backup-ontology-semantics.ps1：备份本体语义表与关系视图（PowerShell）。
- apply-sql-patch-utf8.sh：以 UTF-8 安全方式执行 SQL 补丁并自动校验语义乱码（Linux/WSL）。
- apply-sql-patch-utf8.ps1：以 UTF-8 安全方式执行 SQL 补丁并自动校验语义乱码（PowerShell）。
- apply-runtime-patches.sh：按清单应用 Runtime V2 补丁并执行后置验收（Linux/WSL）。
- apply-runtime-patches.ps1：按清单应用 Runtime V2 补丁并执行后置验收（PowerShell）。
- check-runtime-v2-health.sh：启动/检查本地 Runtime V2 Docker 服务、HTTP 健康和数据库 postcheck。
- check-runtime-v2-health.ps1：从 Windows PowerShell 转入 WSL 原生路径执行 Runtime V2 健康检查。
- ecosystem.config.js：PM2 配置文件（根目录保留符号链接）。
- sync-spa-dist-preserve-assets.sh：同步前端 dist 时保留旧 hash assets，避免缓存窗口内动态 import 404。
- ../collector-desktop/scripts/setup-local-wsl-release.ps1：发布并验证本地 WSL/Docker 采集端 release，可选预置本地采集设备绑定码。

## 本体语义数据备份

```bash
./scripts/backup-ontology-semantics.sh
```

```powershell
.\scripts\backup-ontology-semantics.ps1
```

输出目录默认：`backups/ontology/`

## UTF-8 SQL 补丁一键执行

```bash
./scripts/apply-sql-patch-utf8.sh -p sql/patch_fix_ontology_semantic_qmarks_20260618.sql
```

```powershell
.\scripts\apply-sql-patch-utf8.ps1
```

可选参数：

```powershell
.\scripts\apply-sql-patch-utf8.ps1 -PatchFile "sql/patch_fix_ontology_semantic_qmarks_20260618.sql" -DbContainer "eiscore-db" -DbName "eiscore" -DbUser "postgres"
```

说明：
1. `deploy-pm2.sh`、`deploy-simple.sh`、`start-app-center.sh`、`start-app-center.ps1` 已接入该校验步骤。
2. 校验失败会终止部署，避免乱码语义进入线上。
3. 默认会先自动备份再执行补丁；可通过 `--skip-backup`（Shell）或 `-SkipBackup`（PowerShell）跳过。

## Runtime V2 补丁清单执行

用于重建数据库、换环境或修复运行时缺失对象时，按依赖顺序批量应用本体、知识图谱、推理引擎、文档导入和权限 hardening 补丁。

```bash
npm run runtime:up
npm run runtime:health
npm run runtime:access-audit

npm run db:runtime-patches:dry-run
npm run db:runtime-patches
npm run test:runtime-v2
npm run test:runtime-v2:access

./scripts/apply-runtime-patches.sh --dry-run
./scripts/apply-runtime-patches.sh
```

本地服务健康检查：

```bash
./scripts/check-runtime-v2-health.sh --start
./scripts/check-runtime-v2-health.sh
./scripts/check-runtime-v2-health.sh --skip-access-smoke
```

```powershell
.\scripts\check-runtime-v2-health.ps1 -Start
.\scripts\check-runtime-v2-health.ps1
.\scripts\check-runtime-v2-health.ps1 -SkipAccessSmoke
```

```powershell
.\scripts\apply-runtime-patches.ps1 -DryRun
.\scripts\apply-runtime-patches.ps1
```

默认清单：`sql/runtime_v2_patch_manifest.txt`。
默认验收：`sql/runtime_v2_postcheck.sql`。

说明：
1. 清单末尾保留安全收口补丁，确保前置补丁临时开放的本体/文档权限会被重新收紧。
2. 脚本只在显式执行时改库，不挂到容器启动流程，避免服务启动时隐式修改生产数据。
3. 清单执行完成后会自动运行 postcheck，验证旧本体入口撤权、安全 RPC 授权、文档导入 RLS、推理健康和语义乱码。
4. 所列补丁均按幂等重放设计；执行前仍建议在生产环境做数据库备份。
5. 如需只重放 SQL 而不验收，可使用 `--skip-postcheck`（Shell）或 `-SkipPostcheck`（PowerShell）。
6. `npm run runtime:health` 默认会同时运行数据库 postcheck 和 PostgREST 访问控制烟测；如需只看服务/数据库可达性，可对脚本使用 `--skip-postcheck --skip-access-smoke`。
7. `npm run test:runtime-v2:access` 会通过 PostgREST 黑盒验证 agent 安全 RPC、旧全图 RPC 撤权、原始本体表撤权和普通角色范围过滤。
8. `npm run runtime:access-audit` 会输出一份紧凑 JSON 快照，用于观察 admin/employee 的可见表、遍历/路径结果、推理事实范围和被封锁旧入口状态。
9. `npm run runtime:role-audit` 会输出摘要版角色权限风险快照，标出非超级角色的权限数量、wildcard/delete/manage/config/ontology/workflow 等高风险授权面，并给出只读 review backlog；默认只报告不阻断。
10. `npm run runtime:role-audit:verbose` 会展开每个角色的权限族、操作族、风险样本和清理候选，用于后续最小权限收口评审。
11. PowerShell 版 Runtime V2 健康检查会先预检 Docker Desktop service、Windows Docker engine、WSL 发行版和 WSL 内 Docker integration；若这些后端层未就绪，会在进入业务容器检查前直接报出原因。

## 前端静态资源安全同步

```bash
./scripts/sync-spa-dist-preserve-assets.sh \
  --dist eiscore-materials/dist \
  --dest /var/www/nanpai-eiscore/materials \
  --host nanpai-eiscore \
  --owner www-data:www-data
```

该脚本会先备份目标目录，然后更新 `index.html` 等根文件；`assets/` 目录只合并不删除旧 hash 文件，避免已打开页面或旧微前端入口在缓存窗口内请求旧 chunk 时出现 404。

## 本地 WSL 采集端 release 验收

```powershell
.\collector-desktop\scripts\setup-local-wsl-release.ps1 -SeedDevice
```

默认会使用 `http://localhost/agent/document-intake/collector/releases` 发布本地 manifest，并验证 `update.json`、安装包 `HEAD`、安装包下载 SHA256。传入 `-SeedDevice` 时会在本地 Docker Postgres 中预置：

```text
enterpriseCode = local
deviceCode     = local-collector-01
authorization  = local-bind-code
```

`-SeedDevice` 还会继续调用本地设备绑定、配置和心跳接口，确认设备可拿到 token、远程配置里的 manifest URL 指向本地 release，并且 heartbeat 返回 `ok=true`。如只想预置数据库并跳过 API 验证，可追加 `-SkipDeviceApiCheck`。

当脚本从 `\\wsl.localhost\<发行版>\...` 路径运行时，会自动在对应 WSL 发行版内执行 `docker compose` 和 `docker exec psql`，并强制重建 `agent-runtime`，避免 Windows Docker CLI 对 WSL bind mount 生成失效的 `/app` 挂载。

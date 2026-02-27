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
- ecosystem.config.js：PM2 配置文件（根目录保留符号链接）。

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
./scripts/apply-sql-patch-utf8.sh -p sql/patch_fix_ontology_semantic_chinese.sql
```

```powershell
.\scripts\apply-sql-patch-utf8.ps1
```

可选参数：

```powershell
.\scripts\apply-sql-patch-utf8.ps1 -PatchFile "sql/patch_fix_ontology_semantic_chinese.sql" -DbContainer "eiscore-db" -DbName "eiscore" -DbUser "postgres"
```

说明：
1. `deploy-pm2.sh`、`deploy-simple.sh`、`start-app-center.sh`、`start-app-center.ps1` 已接入该校验步骤。
2. 校验失败会终止部署，避免乱码语义进入线上。
3. 默认会先自动备份再执行补丁；可通过 `--skip-backup`（Shell）或 `-SkipBackup`（PowerShell）跳过。

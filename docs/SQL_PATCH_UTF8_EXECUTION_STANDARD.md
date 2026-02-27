# EISCore SQL 补丁 UTF-8 执行规范

文档版本：v1.0  
整理日期：2026-02-19  
适用范围：所有包含中文文本的 SQL 补丁执行

## 1. 目标

避免在执行 SQL 补丁时把中文写入为 `?` 或乱码。

## 2. 强制规则

1. 补丁文件必须保存为 UTF-8 编码。
2. 补丁内建议显式设置：`SET client_encoding = 'UTF8';`
3. 涉及中文常量的关键语句，优先使用 Unicode 转义写法（`U&'...'`）。
4. Windows PowerShell 执行时必须使用 `-Encoding UTF8` 读取文件。

## 3. 标准执行命令

## 3.1 Linux/WSL

```bash
cat sql/<patch>.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore
```

## 3.2 PowerShell（推荐）

```powershell
Get-Content sql/<patch>.sql -Raw -Encoding UTF8 | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore
```

## 3.3 一键脚本（推荐）

```bash
./scripts/apply-sql-patch-utf8.sh -p sql/<patch>.sql
```

```powershell
.\scripts\apply-sql-patch-utf8.ps1 -PatchFile "sql/<patch>.sql"
```

说明：
1. Shell 脚本适用于 Linux/WSL。
2. PowerShell 脚本使用“字节流直传 docker stdin”，避免 PowerShell 文本管道重编码导致的中文写坏问题。
3. 两个脚本默认都会先执行本体语义备份（输出到 `backups/ontology/`）。

## 4. 执行后校验

## 4.1 编码校验

```sql
show client_encoding;
```

期望结果：`UTF8`

## 4.2 乱码快速校验（本体语义）

```sql
select count(*)
from public.ontology_table_semantics
where semantic_name like '%?%'
   or semantic_description like '%?%';
```

期望结果：`0`

## 5. 本项目已落地的防回归点

1. `sql/app_center_data_tables.sql` 已将动态语义中文模板改为 Unicode 转义写法。
2. `sql/patch_add_ontology_relations_app.sql` 已增加 `SET client_encoding = 'UTF8';`。
3. `sql/patch_fix_ontology_semantic_chinese.sql` 可用于历史乱码数据修复。

## 6. 故障处理

1. 若执行后出现乱码，先执行 `sql/patch_fix_ontology_semantic_chinese.sql` 修复历史数据。
2. 复核补丁执行命令是否使用了 UTF-8 读取方式。
3. 复核补丁 SQL 是否包含直接中文常量且未做编码保护。
4. 从 `backups/ontology/` 使用最近一次备份进行比对或回滚。

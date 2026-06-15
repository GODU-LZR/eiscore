# EISCore 自动化测试远端修复验证报告

报告日期：2026-06-16  
测试对象：远端环境 `https://nanpai.eissys.top`  
验证目标：关闭 `WF-ALIAS-001`，使远端业务冒烟测试达到 23/23 PASS

## 一、问题回顾

2026-06-15 自动化测试工程启动后，远端业务冒烟测试结果为 22/23 PASS。唯一失败项为：

| 缺陷编号 | 用例 | 现象 |
|---|---|---|
| `WF-ALIAS-001` | `14 workflow.definitions alias is readable` | `/api/workflow.definitions` 返回 404，PostgREST 将其识别为 `workflow.workflow.definitions`。 |

同一环境下 canonical API `/api/definitions` 正常返回数据，因此判断问题集中在远端 Nginx/API 兼容别名未生效。

## 二、远端修复动作

在远端 Nginx 站点配置中，在通用 `location /api/` 之前增加精确匹配别名：

```nginx
# Compatibility alias for historical workflow API calls.
location = /api/workflow.definitions {
    proxy_pass http://127.0.0.1:3000/definitions;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

执行结果：

| 动作 | 结果 |
|---|---|
| 远端配置备份 | 已备份到 `/root/nginx-backups/`。 |
| `nginx -t` | PASS |
| `systemctl reload nginx` | PASS |
| 配置核验 | `nginx -T` 可看到 `location = /api/workflow.definitions`。 |

说明：仓库内 Docker Nginx 模板 `nginx/conf.d/default.conf` 已有同类 rewrite，本次修复补齐的是远端生产 Nginx 配置。

## 三、远端业务冒烟复测

执行命令：

```bash
EISCORE_BASE_URL=https://nanpai.eissys.top \
EISCORE_AGENT_WS_URL=wss://nanpai.eissys.top/agent/ws \
EISCORE_SMOKE_RESULT=tests/.artifacts/nanpai-smoke-result-2026-06-16.json \
npm run test:smoke
```

复测结果：

| 指标 | 结果 |
|---|---|
| 总用例 | 23 |
| 通过 | 23 |
| 失败 | 0 |
| 通过率 | 100% |

关键恢复项：

| 用例 | 结果 | 详情 |
|---|---|---|
| `14 workflow.definitions alias is readable` | PASS | `/api/workflow.definitions` 返回 200，`rows=2`。 |
| `15 workflow.definitions canonical path is readable` | PASS | `/api/definitions` 返回 200，`rows=2`。 |

## 四、结论

1. `WF-ALIAS-001` 已修复并完成远端验证。
2. 远端 `https://nanpai.eissys.top` 当前业务冒烟测试达到 23/23 PASS。
3. 自动化测试工程的第一层目标已经闭环：CI 离线回归可跑，远端业务 smoke 可稳定验证核心链路。
4. 下一阶段建议进入 P1：Playwright 浏览器级 E2E，以及智能体中文语义回归 runner。

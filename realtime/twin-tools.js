/**
 * twin-tools.js — 员工数字分身工具集 + 持久化层
 *
 * 包含：
 *   1. PostgREST 只读查询工具（员工 / 物料 / 库存 / 应用 / 个人信息）
 *   2. 个人知识库工具（搜索 / 列表）
 *   3. 持久化接口（会话 / 消息 / 工具日志 → PostgreSQL via PostgREST）
 *   4. System Prompt 构造器
 *
 * 设计原则：
 *   - 所有查询均使用 callPostgrestWithUser，继承用户 JWT→RLS
 *   - 工具只提供只读查询能力，不允许写操作（安全约束）
 *   - 结果自动截断，防止 context window 溢出
 */

'use strict';

const MAX_RESULT_ROWS = 30;             // 工具单次最多返回行数
const MAX_RESULT_CHARS = 6000;          // 工具输出最大字符数
const KB_SEARCH_LIMIT = 8;             // 知识库搜索最大返回条目

// ───────────────────── 工具结果截断 ──────────────────────

function truncateResult(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  if (str.length <= MAX_RESULT_CHARS) return data;
  return str.slice(0, MAX_RESULT_CHARS) + '\n...(结果过长已截断)';
}

function limitRows(arr, max = MAX_RESULT_ROWS) {
  if (!Array.isArray(arr)) return arr;
  if (arr.length <= max) return arr;
  return {
    rows: arr.slice(0, max),
    total: arr.length,
    truncated: true,
    message: `共 ${arr.length} 条，仅展示前 ${max} 条`
  };
}

// ───────────────────── 工具定义工厂 ──────────────────────

/**
 * 创建数字分身工具集
 * @param {Function} pgQuery - callPostgrestWithUser(user, options) 的绑定版本
 * @param {Object}   user    - 当前用户对象 { username, role, token }
 * @returns {Object} tools map: { toolName: { description, parameters, execute } }
 */
function createTwinTools(pgQuery, user) {
  const username = user?.username || '';

  return {
    // ──────── 员工与组织查询 ────────
    query_employees: {
      description: '查询员工信息（姓名、部门、职位、入职日期等HR数据）',
      parameters: {
        filter: '(可选) 过滤条件，如 full_name=eq.张三 或 department=eq.技术部',
        select: '(可选) 字段列表，逗号分隔',
        limit: '(可选) 返回数量，默认20'
      },
      async execute(params) {
        const query = {
          select: params.select || 'employee_no,full_name,department,position,hire_date,status,phone,email',
          limit: String(Math.min(Number(params.limit) || 20, MAX_RESULT_ROWS)),
          order: 'hire_date.desc'
        };
        if (params.filter) {
          const parts = String(params.filter).split('=');
          if (parts.length >= 2) query[parts[0]] = parts.slice(1).join('=');
        }
        const res = await pgQuery({
          method: 'GET', path: '/employees', query,
          acceptProfile: 'public', timeoutMs: 8000
        });
        return truncateResult(limitRows(res?.data));
      }
    },

    // ──────── 组织架构查询 ────────
    query_departments: {
      description: '查询部门/组织架构信息',
      parameters: {
        filter: '(可选) 过滤条件',
        limit: '(可选) 返回数量'
      },
      async execute(params) {
        const query = {
          select: 'id,name,code,parent_id,manager,level,sort_order',
          limit: String(Math.min(Number(params.limit) || 30, 50)),
          order: 'sort_order.asc'
        };
        if (params.filter) {
          const parts = String(params.filter).split('=');
          if (parts.length >= 2) query[parts[0]] = parts.slice(1).join('=');
        }
        const res = await pgQuery({
          method: 'GET', path: '/departments', query,
          acceptProfile: 'public', timeoutMs: 5000
        });
        return truncateResult(limitRows(res?.data));
      }
    },

    // ──────── 物料查询 ────────
    query_materials: {
      description: '查询原材料/物料台账数据（名称、规格、类别、单价、库存等）',
      parameters: {
        filter: '(可选) 过滤条件，如 name=like.*钢材*',
        select: '(可选) 字段列表',
        limit: '(可选) 返回数量'
      },
      async execute(params) {
        const query = {
          select: params.select || 'id,code,name,spec,category,unit,unit_price,status',
          limit: String(Math.min(Number(params.limit) || 20, MAX_RESULT_ROWS)),
          order: 'code.asc'
        };
        if (params.filter) {
          const parts = String(params.filter).split('=');
          if (parts.length >= 2) query[parts[0]] = parts.slice(1).join('=');
        }
        const res = await pgQuery({
          method: 'GET', path: '/raw_materials', query,
          acceptProfile: 'public', timeoutMs: 8000
        });
        return truncateResult(limitRows(res?.data));
      }
    },

    // ──────── 库存现况 ────────
    query_inventory: {
      description: '查询库存现况（各仓库物料数量）或出入库流水',
      parameters: {
        type: '"current" 查库存现况，"transactions" 查出入库流水',
        filter: '(可选) 过滤条件',
        limit: '(可选) 返回数量'
      },
      async execute(params) {
        const isTransactions = String(params.type || '').toLowerCase() === 'transactions';
        const viewPath = isTransactions ? '/v_inventory_transactions' : '/v_inventory_current';
        const defaultSelect = isTransactions
          ? 'id,material_name,warehouse_name,type,quantity,created_at'
          : 'material_name,warehouse_name,available_qty,total_qty,unit';
        const query = {
          select: params.select || defaultSelect,
          limit: String(Math.min(Number(params.limit) || 20, MAX_RESULT_ROWS)),
          order: isTransactions ? 'created_at.desc' : 'material_name.asc'
        };
        if (params.filter) {
          const parts = String(params.filter).split('=');
          if (parts.length >= 2) query[parts[0]] = parts.slice(1).join('=');
        }
        const res = await pgQuery({
          method: 'GET', path: viewPath, query,
          acceptProfile: 'scm', timeoutMs: 8000
        });
        return truncateResult(limitRows(res?.data));
      }
    },

    // ──────── 仓库列表 ────────
    query_warehouses: {
      description: '查询仓库列表（名称、位置、容量等）',
      parameters: {
        limit: '(可选) 返回数量'
      },
      async execute(params) {
        const res = await pgQuery({
          method: 'GET', path: '/warehouses',
          query: {
            select: 'id,name,code,location,capacity,status',
            limit: String(Math.min(Number(params.limit) || 20, 50)),
            order: 'name.asc'
          },
          acceptProfile: 'scm', timeoutMs: 5000
        });
        return truncateResult(limitRows(res?.data));
      }
    },

    // ──────── 应用中心 ────────
    query_apps: {
      description: '查询应用中心已安装的应用和数据表',
      parameters: {
        filter: '(可选) 过滤条件',
        limit: '(可选) 返回数量'
      },
      async execute(params) {
        const query = {
          select: 'id,app_name,app_type,status,description,created_at',
          limit: String(Math.min(Number(params.limit) || 20, MAX_RESULT_ROWS)),
          order: 'created_at.desc'
        };
        if (params.filter) {
          const parts = String(params.filter).split('=');
          if (parts.length >= 2) query[parts[0]] = parts.slice(1).join('=');
        }
        const res = await pgQuery({
          method: 'GET', path: '/apps', query,
          acceptProfile: 'app_center', timeoutMs: 5000
        });
        return truncateResult(limitRows(res?.data));
      }
    },

    // ──────── 个人信息 ────────
    get_my_info: {
      description: '获取当前登录员工的个人信息（姓名、部门、角色、权限等）',
      parameters: {},
      async execute() {
        // 查员工基本信息
        const empRes = await pgQuery({
          method: 'GET', path: '/employees',
          query: {
            select: 'employee_no,full_name,department,position,hire_date,status,phone,email',
            or: `(username.eq.${username},employee_no.eq.${username})`,
            limit: '1'
          },
          acceptProfile: 'public', timeoutMs: 5000
        });
        const emp = Array.isArray(empRes?.data) ? empRes.data[0] : null;

        return {
          username,
          role: user?.role || '',
          employee: emp || '未找到对应员工信息',
          note: '以上信息来自系统数据库'
        };
      }
    },

    // ──────── 知识库搜索 ────────
    search_knowledge: {
      description: '搜索我的个人知识库中的文件内容',
      parameters: {
        query: '搜索关键词',
        limit: '(可选) 返回数量，默认5'
      },
      async execute(params) {
        const keyword = String(params.query || '').trim();
        if (!keyword) return { error: '请提供搜索关键词' };

        const limit = Math.min(Number(params.limit) || 5, KB_SEARCH_LIMIT);
        // 使用 PostgREST full-text search
        const res = await pgQuery({
          method: 'GET', path: '/twin_knowledge_files',
          query: {
            employee_id: `eq.${username}`,
            or: `(file_name.ilike.*${keyword}*,content_text.ilike.*${keyword}*)`,
            select: 'id,file_name,file_type,tags,summary,content_text,created_at',
            limit: String(limit),
            order: 'updated_at.desc'
          },
          acceptProfile: 'app_data', timeoutMs: 8000
        });

        const files = Array.isArray(res?.data) ? res.data : [];
        // 截断 content_text 避免过大
        return files.map(f => ({
          id: f.id,
          name: f.file_name,
          type: f.file_type,
          tags: f.tags,
          summary: f.summary || '',
          content_preview: (f.content_text || '').slice(0, 1000),
          created_at: f.created_at
        }));
      }
    },

    // ──────── 知识库文件列表 ────────
    list_knowledge: {
      description: '列出我的个人知识库中所有文件',
      parameters: {
        limit: '(可选) 返回数量'
      },
      async execute(params) {
        const res = await pgQuery({
          method: 'GET', path: '/twin_knowledge_files',
          query: {
            employee_id: `eq.${username}`,
            select: 'id,file_name,file_type,file_size,tags,summary,created_at',
            limit: String(Math.min(Number(params.limit) || 20, 50)),
            order: 'updated_at.desc'
          },
          acceptProfile: 'app_data', timeoutMs: 5000
        });
        return limitRows(res?.data);
      }
    }
  };
}

// ───────────────────── System Prompt 构造器 ──────────────────────

/**
 * 构建数字分身 Agent 的 System Prompt
 * @param {Object} user - 当前用户
 * @param {Object} semanticCtx - 语义上下文（可选）
 * @returns {string}
 */
function buildTwinSystemPrompt(user, semanticCtx) {
  const username = user?.username || '未知';
  const role = user?.role || '员工';

  let semanticBlock = '';
  if (semanticCtx && typeof semanticCtx === 'object') {
    const parts = [];
    if (Array.isArray(semanticCtx.tables) && semanticCtx.tables.length) {
      const tableLines = semanticCtx.tables.slice(0, 30).map(t =>
        `  - ${t.schema}.${t.table}（${t.name}）`
      );
      parts.push(`数据表(${semanticCtx.tables.length}): \n${tableLines.join('\n')}`);
    }
    if (semanticCtx.columns && typeof semanticCtx.columns === 'object') {
      const tableKeys = Object.keys(semanticCtx.columns);
      const colLines = [];
      for (const tbl of tableKeys.slice(0, 20)) {
        const cols = semanticCtx.columns[tbl];
        if (!Array.isArray(cols) || !cols.length) continue;
        const colDesc = cols.slice(0, 10).map(c => `${c.col}=${c.name}`).join(', ');
        colLines.push(`  ${tbl}: ${colDesc}${cols.length > 10 ? ` ...共${cols.length}列` : ''}`);
      }
      if (colLines.length) parts.push(`列语义:\n${colLines.join('\n')}`);
    }
    if (parts.length) {
      semanticBlock = `\n\n【系统数据语义】\n${parts.join('\n')}`;
    }
  }

  return `你是「${username}」的个人数字分身——一个专属 AI 工作助手。

【身份与职责】
- 你代表员工「${username}」（角色: ${role}）的数字化分身
- 你了解企业的组织架构、物料管理、库存、应用系统等业务模块
- 你可以帮员工查询系统数据、分析工作情况、整理知识文档、提供建议

【行为准则】
1. 称呼用户为"你"或直接用名字，语气亲切但专业
2. 先理解意图，再决定是否需要调用工具查询数据
3. 如果用户的问题可以直接回答（常识/计算/建议），无需调用工具
4. 如果需要系统数据，使用工具查询后再整合回答，不要编造数据
5. 回答要简洁、有条理，给出可操作的建议
6. 涉及敏感数据（薪资、考核）时提醒注意保密
7. 不确定的信息要明确说明

【工作场景示例】
- "帮我查一下这个月有哪些新入职同事" → 调用 query_employees
- "仓库里还有多少钢材" → 调用 query_inventory
- "我之前上传的那个方案文档说了什么" → 调用 search_knowledge
- "帮我分析一下库存趋势" → 调用 query_inventory 后分析
- "我是谁" → 调用 get_my_info${semanticBlock}`;
}

// ───────────────────── 持久化接口 ──────────────────────

/**
 * 创建持久化接口（通过 PostgREST 写入 PostgreSQL）
 * @param {Function} pgQuery - callPostgrestWithUser 的绑定版本
 * @param {string}   employeeId - 当前员工 username
 * @returns {Object} { createSession, saveMessage, saveToolLog, loadHistory, listSessions, deleteSession }
 */
function createPersistence(pgQuery, employeeId) {
  return {
    /**
     * 创建新会话
     */
    async createSession(title = '新对话') {
      const res = await pgQuery({
        method: 'POST', path: '/twin_sessions',
        body: { employee_id: employeeId, title },
        acceptProfile: 'app_data',
        contentProfile: 'app_data',
        prefer: 'return=representation',
        timeoutMs: 5000
      });
      const row = Array.isArray(res?.data) ? res.data[0] : res?.data;
      return row?.id || null;
    },

    /**
     * 保存消息
     */
    async saveMessage(sessionId, role, content, metadata = null) {
      if (!sessionId) return;
      const body = {
        session_id: sessionId,
        role,
        content: String(content || '').slice(0, 50000)
      };
      if (metadata) body.metadata = metadata;
      await pgQuery({
        method: 'POST', path: '/twin_messages',
        body,
        acceptProfile: 'app_data',
        contentProfile: 'app_data',
        timeoutMs: 5000
      });
      // 更新会话的 updated_at 和 message_count
      try {
        await pgQuery({
          method: 'PATCH', path: '/twin_sessions',
          query: { id: `eq.${sessionId}` },
          body: {
            updated_at: new Date().toISOString(),
            message_count: undefined  // PostgREST不支持increment，后续可用RPC
          },
          acceptProfile: 'app_data',
          contentProfile: 'app_data',
          timeoutMs: 3000
        });
      } catch { /* best-effort */ }
    },

    /**
     * 保存工具调用日志
     */
    async saveToolLog(sessionId, logEntry) {
      if (!sessionId) return;
      await pgQuery({
        method: 'POST', path: '/twin_tool_logs',
        body: {
          session_id: sessionId,
          tool_name: logEntry.tool,
          tool_input: logEntry.input || {},
          tool_output: typeof logEntry.output === 'string'
            ? { text: logEntry.output.slice(0, 10000) }
            : logEntry.output,
          duration_ms: logEntry.durationMs || 0,
          success: logEntry.success !== false
        },
        acceptProfile: 'app_data',
        contentProfile: 'app_data',
        timeoutMs: 5000
      });
    },

    /**
     * 加载会话历史消息
     */
    async loadHistory(sessionId, limit = 20) {
      if (!sessionId) return [];
      const res = await pgQuery({
        method: 'GET', path: '/twin_messages',
        query: {
          session_id: `eq.${sessionId}`,
          select: 'role,content,created_at',
          order: 'created_at.asc',
          limit: String(limit)
        },
        acceptProfile: 'app_data',
        timeoutMs: 5000
      });
      const rows = Array.isArray(res?.data) ? res.data : [];
      return rows
        .filter(r => r.role === 'user' || r.role === 'assistant')
        .map(r => ({ role: r.role, content: r.content }));
    },

    /**
     * 列出所有会话
     */
    async listSessions(limit = 20) {
      const res = await pgQuery({
        method: 'GET', path: '/twin_sessions',
        query: {
          employee_id: `eq.${employeeId}`,
          select: 'id,title,summary,message_count,created_at,updated_at',
          order: 'updated_at.desc',
          limit: String(limit)
        },
        acceptProfile: 'app_data',
        timeoutMs: 5000
      });
      return Array.isArray(res?.data) ? res.data : [];
    },

    /**
     * 删除会话（级联删除消息和工具日志）
     */
    async deleteSession(sessionId) {
      if (!sessionId) return false;
      await pgQuery({
        method: 'DELETE', path: '/twin_sessions',
        query: { id: `eq.${sessionId}` },
        acceptProfile: 'app_data',
        contentProfile: 'app_data',
        timeoutMs: 5000
      });
      return true;
    },

    /**
     * 更新会话标题
     */
    async updateSessionTitle(sessionId, title) {
      if (!sessionId || !title) return;
      await pgQuery({
        method: 'PATCH', path: '/twin_sessions',
        query: { id: `eq.${sessionId}` },
        body: { title: String(title).slice(0, 100) },
        acceptProfile: 'app_data',
        contentProfile: 'app_data',
        timeoutMs: 3000
      });
    },

    // ──────── 知识库文件管理 ────────

    /**
     * 上传文件到知识库
     */
    async uploadKnowledgeFile(fileData) {
      const body = {
        employee_id: employeeId,
        file_name: fileData.fileName || '未命名文件',
        file_type: fileData.fileType || 'text/plain',
        file_size: Number(fileData.fileSize) || 0,
        content_text: String(fileData.contentText || '').slice(0, 200000),
        content_b64: String(fileData.contentB64 || '').slice(0, 5000000),
        tags: Array.isArray(fileData.tags) ? fileData.tags : [],
        summary: String(fileData.summary || '').slice(0, 2000),
        metadata: fileData.metadata || {}
      };
      const res = await pgQuery({
        method: 'POST', path: '/twin_knowledge_files',
        body,
        acceptProfile: 'app_data',
        contentProfile: 'app_data',
        prefer: 'return=representation',
        timeoutMs: 10000
      });
      const row = Array.isArray(res?.data) ? res.data[0] : res?.data;
      return row || null;
    },

    /**
     * 列出知识库文件
     */
    async listKnowledgeFiles(limit = 30) {
      const res = await pgQuery({
        method: 'GET', path: '/twin_knowledge_files',
        query: {
          employee_id: `eq.${employeeId}`,
          select: 'id,file_name,file_type,file_size,tags,summary,created_at,updated_at',
          order: 'updated_at.desc',
          limit: String(limit)
        },
        acceptProfile: 'app_data',
        timeoutMs: 5000
      });
      return Array.isArray(res?.data) ? res.data : [];
    },

    /**
     * 删除知识库文件
     */
    async deleteKnowledgeFile(fileId) {
      if (!fileId) return false;
      await pgQuery({
        method: 'DELETE', path: '/twin_knowledge_files',
        query: { id: `eq.${fileId}` },
        acceptProfile: 'app_data',
        contentProfile: 'app_data',
        timeoutMs: 5000
      });
      return true;
    }
  };
}

// ───────────────────── 导出 ──────────────────────
module.exports = {
  createTwinTools,
  buildTwinSystemPrompt,
  createPersistence,
  truncateResult,
  limitRows
};

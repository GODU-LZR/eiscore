// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

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
const KB_CONTENT_PREVIEW_CHARS = 1200;  // 搜索结果只返回轻量预览，完整内容走 read_knowledge_file
const KB_READ_CONTENT_CHARS = 200000;   // 读取数据库内保存的完整知识库文本
const KB_COMPACT_HEAD_LINES = 12;
const KB_COMPACT_DATA_LINES = 36;
const KB_COMPACT_IMPORTANT_LINES = 30;

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
        const commonQuery = {
          employee_id: `eq.${username}`,
          select: 'id,file_name,file_type,tags,summary,content_text,created_at,updated_at',
          limit: String(limit),
          order: 'updated_at.desc'
        };

        // 优先按关键词搜索；如果用户泛指“知识库里的成本表”，空结果时回退到最近文件。
        let res = await pgQuery({
          method: 'GET', path: '/twin_knowledge_files',
          query: {
            ...commonQuery,
            or: `(file_name.ilike.*${keyword}*,content_text.ilike.*${keyword}*)`,
          },
          acceptProfile: 'app_data', timeoutMs: 8000
        });

        let files = Array.isArray(res?.data) ? res.data : [];
        if (files.length === 0 && /知识库|文件|文档|表|表格|分析|成本|报告|图文并茂/.test(keyword)) {
          res = await pgQuery({
            method: 'GET', path: '/twin_knowledge_files',
            query: commonQuery,
            acceptProfile: 'app_data', timeoutMs: 8000
          });
          files = Array.isArray(res?.data) ? res.data : [];
        }

        return files.map(f => ({
          id: f.id,
          name: f.file_name,
          type: f.file_type,
          tags: f.tags,
          summary: f.summary || '',
          content_preview: (f.content_text || '').slice(0, KB_CONTENT_PREVIEW_CHARS),
          content_length: String(f.content_text || '').length,
          truncated: String(f.content_text || '').length > KB_CONTENT_PREVIEW_CHARS,
          next_step: '如需分析完整表格，请继续调用 read_knowledge_file，并使用该文件 id。',
          created_at: f.created_at,
          updated_at: f.updated_at
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
    },

    // ──────── 知识库文件读取 ────────
    read_knowledge_file: {
      description: '读取个人知识库中某个文件的完整文本内容，用于分析表格、成本表、报告等文件',
      parameters: {
        id: '知识库文件 id（优先使用 search_knowledge 返回的 id）',
        file_name: '(可选) 文件名关键词；没有 id 时可用',
        max_chars: '(可选) 返回字符数上限，默认返回数据库内保存的完整文本；传 compact=true 时才做大表格摘录',
        compact: '(可选) 是否返回大表格摘录，默认 false'
      },
      async execute(params) {
        const id = String(params.id || '').trim();
        const fileName = String(params.file_name || params.name || '').trim();
        const maxChars = Math.min(Math.max(Number(params.max_chars) || KB_READ_CONTENT_CHARS, 1000), KB_READ_CONTENT_CHARS);
        const compact = params.compact === true || String(params.compact || '').toLowerCase() === 'true';
        if (!id && !fileName) return { error: '请提供知识库文件 id 或文件名' };

        const query = {
          employee_id: `eq.${username}`,
          select: 'id,file_name,file_type,file_size,tags,summary,content_text,created_at,updated_at',
          limit: '1',
          order: 'updated_at.desc'
        };
        if (id) {
          query.id = `eq.${id}`;
        } else {
          query.file_name = `ilike.*${fileName}*`;
        }

        const res = await pgQuery({
          method: 'GET', path: '/twin_knowledge_files',
          query,
          acceptProfile: 'app_data', timeoutMs: 8000
        });
        const file = Array.isArray(res?.data) ? res.data[0] : null;
        if (!file) return { error: '未找到匹配的知识库文件' };

        const content = String(file.content_text || '');
        const returnedContent = compact
          ? compactKnowledgeContent(content, maxChars)
          : content.slice(0, maxChars);
        return {
          id: file.id,
          name: file.file_name,
          type: file.file_type,
          size: file.file_size,
          tags: file.tags,
          summary: file.summary || '',
          content: returnedContent,
          content_length: content.length,
          returned_length: returnedContent.length,
          truncated: content.length > returnedContent.length,
          compacted: compact && content.length > returnedContent.length,
          note: compact && content.length > returnedContent.length
            ? '已按 compact=true 返回表头、有效数据、合计行和关键成本字段摘录。'
            : '已返回数据库内保存的完整知识库文本；如 content_length 大于 returned_length，说明超出系统保存/读取上限。',
          created_at: file.created_at,
          updated_at: file.updated_at
        };
      }
    }
  };
}

function compactWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isMostlyInvalidSpreadsheetLine(line) {
  const text = String(line || '');
  if (!text.trim()) return true;
  const cells = text.split(',');
  const nonEmpty = cells.map((cell) => compactWhitespace(cell)).filter(Boolean);
  if (nonEmpty.length <= 2) return true;
  const invalidCells = nonEmpty.filter((cell) => (
    cell === '0' ||
    cell === '0.00' ||
    cell === '-' ||
    cell === '#DIV/0!' ||
    cell === '1900/1/0'
  )).length;
  return /#DIV\/0!/.test(text) && /1900\/1\/0/.test(text) && invalidCells / Math.max(nonEmpty.length, 1) > 0.35;
}

function compactKnowledgeContent(content, maxChars = KB_READ_CONTENT_CHARS) {
  const raw = String(content || '');
  if (!raw || raw.length <= maxChars) return raw.slice(0, maxChars);

  const lines = raw.split(/\r?\n/);
  const selected = [];
  const seen = new Set();
  let dataCount = 0;
  let importantCount = 0;

  const addLine = (line, reason = '') => {
    const text = String(line || '').trimEnd();
    if (!text.trim()) return false;
    const key = text.slice(0, 500);
    if (seen.has(key)) return false;
    seen.add(key);
    selected.push(reason ? `${text}` : text);
    return true;
  };

  for (let i = 0; i < lines.length && selected.join('\n').length < maxChars; i += 1) {
    const line = lines[i];
    const text = String(line || '').trim();
    if (!text) continue;

    if (i < KB_COMPACT_HEAD_LINES || /^\[Sheet:/.test(text)) {
      addLine(line);
      continue;
    }

    if (isMostlyInvalidSpreadsheetLine(text)) continue;

    const important = /(合计|小计|总计|总成本|成本合计|生产成本|固定成本|材料成本|人工成本|制造费用|销售费用|管理费用|财务费用|研发费用|税金|毛利率|利润率|吨均成本|单位成本)/.test(text);
    const dataLike = /\b20\d{2}[/-]\d{1,2}[/-]\d{1,2}\b/.test(text) && text.split(',').filter((cell) => compactWhitespace(cell)).length >= 8;

    if (dataLike && dataCount < KB_COMPACT_DATA_LINES) {
      if (addLine(line)) dataCount += 1;
      continue;
    }

    if (important && importantCount < KB_COMPACT_IMPORTANT_LINES) {
      if (addLine(line)) importantCount += 1;
    }
  }

  let compacted = selected.join('\n').slice(0, maxChars);
  if (compacted.length < raw.length) {
    compacted += `\n\n[系统提示] 原文件共 ${raw.length} 字符，以上为面向分析的大表格摘录：保留表头、有效数据行、合计行和关键成本字段，跳过空白/#DIV/0! 模板行。`;
  }
  return compacted;
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
- "请分析我知识库里的成本表，图文并茂" → 先调用 search_knowledge，query 可用"成本表"或"成本"；如果返回文件 id，再调用 read_knowledge_file 读取内容；最后基于文件内容输出分析和图表
- "我是谁" → 调用 get_my_info

【知识库分析规则】
1. 用户提到“知识库/上传的文件/成本表/表格/文档”时，优先调用 search_knowledge 或 list_knowledge，不要直接说无法访问。
2. search_knowledge 返回了 id 且用户要求分析文件内容时，继续调用 read_knowledge_file 读取完整文本，再生成答案；不要只根据 search_knowledge 的预览内容下结论。
3. 分析表格时，先说明使用了哪个文件，再提炼关键指标、异常项、结构占比和改进建议。
4. 用户要求“图文并茂/图表/可视化”时，至少输出 1-2 个 \`\`\`echarts 代码块；ECharts 必须是严格 JSON，不能包含注释、函数或 JS 变量包装。
5. 如果知识库结果为空，明确说明没有检索到匹配文件，并建议用户确认文件名或重新上传。${semanticBlock}`;
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

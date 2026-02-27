/**
 * twin-engine.js — Nanobot 极简推理循环引擎（Node.js 重写）
 *
 * 核心模式：ReAct（Reason + Act）
 *   1. Observe  — 接收用户输入 + 上下文
 *   2. Think    — 调用 LLM 分析意图
 *   3. Act      — 解析工具调用 → 执行 → 获取结果
 *   4. Loop     — 将结果反馈给 LLM，重复直到得出最终答案
 *
 * 特点：
 *   - 与 LLM 提供商解耦：通过 aiCaller 注入
 *   - 工具层可插拔：通过 tools 注册
 *   - 支持 SSE 逐步反馈（onEvent 回调）
 *   - 自动持久化到 PostgreSQL（通过 persistence 接口）
 */

'use strict';

// ───────────────────── 默认配置 ──────────────────────
const DEFAULT_MAX_TURNS = 8;
const DEFAULT_TURN_DELAY_MS = 100;
const TOOL_JSON_REGEX = /```json\s*\n([\s\S]*?)\n\s*```/g;

// ───────────────────── 工具调用解析器 ──────────────────────

/**
 * 从 LLM 文本输出中提取 JSON 工具调用
 * 兼容两种格式：```json {...} ``` 和裸 JSON
 */
function parseToolCalls(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];

  // 1) fenced code blocks
  const calls = [];
  let match;
  const regex = new RegExp(TOOL_JSON_REGEX.source, 'g');
  while ((match = regex.exec(raw)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed && parsed.tool) calls.push(parsed);
    } catch { /* skip */ }
  }
  if (calls.length > 0) return calls;

  // 2) raw JSON object
  try {
    if (raw.startsWith('{') && raw.endsWith('}')) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.tool) return [parsed];
    }
  } catch { /* skip */ }

  // 3) raw JSON array
  try {
    if (raw.startsWith('[') && raw.endsWith(']')) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(item => item && item.tool);
    }
  } catch { /* skip */ }

  return [];
}

/**
 * 从 OpenAI 兼容响应中提取文本
 */
function extractText(response) {
  if (!response) return '';
  const choice = response?.choices?.[0] || {};
  return String(choice?.message?.content || response?.output_text || '').trim();
}

// ───────────────────── ReAct 引擎 ──────────────────────

class TwinEngine {
  /**
   * @param {Object} options
   * @param {Function} options.aiCaller  - async ({ model, messages, stream }) => OpenAI-compatible response
   * @param {Object}   options.tools     - { toolName: { description, execute(params) } }
   * @param {string}   options.systemPrompt
   * @param {string}   options.model
   * @param {number}   options.maxTurns
   * @param {number}   options.turnDelayMs
   * @param {Function} [options.onEvent] - (event) => void  用于 SSE 逐步反馈
   * @param {Object}   [options.persistence] - { saveMessage, saveToolLog } 可选持久化接口
   */
  constructor(options = {}) {
    if (typeof options.aiCaller !== 'function') {
      throw new Error('TwinEngine requires an aiCaller function');
    }
    this.aiCaller = options.aiCaller;
    this.streamingAiCaller = typeof options.streamingAiCaller === 'function' ? options.streamingAiCaller : null;
    this.tools = options.tools || {};
    this.systemPrompt = options.systemPrompt || '';
    this.model = options.model || 'glm-4.6v';
    this.maxTurns = Number(options.maxTurns) || DEFAULT_MAX_TURNS;
    this.turnDelayMs = Number(options.turnDelayMs) || DEFAULT_TURN_DELAY_MS;
    this.onEvent = typeof options.onEvent === 'function' ? options.onEvent : null;
    this.persistence = options.persistence || null;
  }

  /**
   * 发送事件到前端（SSE / WebSocket）
   */
  emit(type, data) {
    if (this.onEvent) {
      try { this.onEvent({ type, ...data, timestamp: Date.now() }); } catch { /* skip */ }
    }
  }

  /**
   * 构建工具描述文本（注入到 system prompt）
   */
  buildToolsDescription() {
    const entries = Object.entries(this.tools);
    if (entries.length === 0) return '';

    const lines = entries.map(([name, tool]) => {
      const params = tool.parameters
        ? Object.entries(tool.parameters).map(([k, v]) => `      "${k}": "${v}"`).join(',\n')
        : '';
      return `- **${name}**: ${tool.description || ''}${params ? `\n    参数:\n${params}` : ''}`;
    });

    return `\n\n【可用工具】\n当你需要查询数据或执行操作时，请输出 JSON 工具调用：
\`\`\`json
{
  "tool": "工具名称",
  "parameters": { ... }
}
\`\`\`

可用工具列表：
${lines.join('\n')}

当任务完成时，直接用自然语言回答用户，不要输出工具调用。`;
  }

  /**
   * 核心 ReAct 循环
   *
   * @param {string} userMessage - 用户输入
   * @param {Array}  history     - 历史消息 [{ role, content }]
   * @param {Object} [extra]     - 额外上下文 { sessionId }
   * @returns {Object} { answer, turns, toolLogs, messages }
   */
  async run(userMessage, history = [], extra = {}) {
    const sessionId = extra.sessionId || null;
    const toolsDesc = this.buildToolsDescription();

    // 拼装完整消息列表
    const messages = [
      { role: 'system', content: this.systemPrompt + toolsDesc },
      ...history,
      { role: 'user', content: userMessage }
    ];

    // 持久化用户消息
    if (this.persistence?.saveMessage) {
      try {
        await this.persistence.saveMessage(sessionId, 'user', userMessage);
      } catch (e) { console.warn('[twin-engine] persist user msg failed:', e?.message); }
    }

    this.emit('thinking', { message: '正在思考...' });

    const toolLogs = [];
    let finalAnswer = '';
    let turnsUsed = 0;
    let usedStreamForFinal = false;

    for (let turn = 0; turn < this.maxTurns; turn++) {
      turnsUsed = turn + 1;

      // ── Step 1: 调用 LLM ──
      let assistantText = '';
      try {
        const response = await this.aiCaller({
          model: this.model,
          messages,
          stream: false
        });
        assistantText = extractText(response);
      } catch (err) {
        this.emit('error', { message: `AI 调用失败: ${err?.message || err}` });
        finalAnswer = '抱歉，AI 服务暂时不可用，请稍后重试。';
        break;
      }

      if (!assistantText) {
        this.emit('error', { message: 'AI 返回空响应' });
        finalAnswer = '抱歉，AI 返回了空内容，请重新提问。';
        break;
      }

      messages.push({ role: 'assistant', content: assistantText });

      // ── Step 2: 解析工具调用 ──
      const toolCalls = parseToolCalls(assistantText);

      // 没有工具调用 → 这是最终回答
      if (toolCalls.length === 0) {
        // 有工具调用历史 + streamingAiCaller → 用流式重新生成最终综合回答
        if (toolLogs.length > 0 && this.streamingAiCaller) {
          try {
            usedStreamForFinal = true;
            finalAnswer = await this.streamingAiCaller({
              model: this.model,
              messages
            });
          } catch (err) {
            console.warn('[twin-engine] streaming final failed, falling back:', err?.message);
            finalAnswer = assistantText;
            usedStreamForFinal = false;
          }
        } else {
          // 简单对话（无工具调用）→ 直接用已有回答，由外层分块推送
          finalAnswer = assistantText;
        }
        break;
      }

      // ── Step 3: 逐个执行工具 ──
      const results = [];
      for (const call of toolCalls) {
        const toolDef = this.tools[call.tool];
        if (!toolDef) {
          results.push({ tool: call.tool, error: `未知工具: ${call.tool}` });
          this.emit('tool_error', { tool: call.tool, error: '未知工具' });
          continue;
        }

        this.emit('tool_start', {
          tool: call.tool,
          input: call.parameters,
          turn: turnsUsed
        });

        const startMs = Date.now();
        let output = null;
        let success = true;

        try {
          output = await toolDef.execute(call.parameters || {});
        } catch (err) {
          output = { error: err?.message || String(err) };
          success = false;
        }

        const durationMs = Date.now() - startMs;
        const logEntry = {
          tool: call.tool,
          input: call.parameters,
          output,
          durationMs,
          success,
          turn: turnsUsed
        };
        toolLogs.push(logEntry);
        results.push(logEntry);

        this.emit('tool_done', logEntry);

        // 持久化工具调用日志
        if (this.persistence?.saveToolLog) {
          try {
            await this.persistence.saveToolLog(sessionId, logEntry);
          } catch (e) { console.warn('[twin-engine] persist tool log failed:', e?.message); }
        }
      }

      // ── Step 4: 将工具结果反馈给 LLM ──
      const toolResultText = results.map(r => {
        if (!r.success || r.error) {
          return `[工具 ${r.tool}] 执行失败: ${r.error || JSON.stringify(r.output)}`;
        }
        const outputStr = typeof r.output === 'string'
          ? r.output
          : JSON.stringify(r.output, null, 2);
        // 截断过大的结果
        const truncated = outputStr.length > 4000
          ? outputStr.slice(0, 4000) + '\n...(结果过长已截断)'
          : outputStr;
        return `[工具 ${r.tool}] 执行成功:\n${truncated}`;
      }).join('\n\n');

      messages.push({
        role: 'user',
        content: `以下是工具执行结果，请根据这些数据回答用户的问题：\n\n${toolResultText}`
      });

      this.emit('thinking', { message: `分析工具结果中...（第 ${turnsUsed} 轮）` });

      // 短延迟防止速率限制
      if (this.turnDelayMs > 0) {
        await new Promise(r => setTimeout(r, this.turnDelayMs));
      }
    }

    // 超过最大轮次仍未结束
    if (!finalAnswer) {
      finalAnswer = '抱歉，我在有限步骤内无法完成这个任务。请尝试简化问题后重试。';
    }

    // 持久化 AI 最终回答
    if (this.persistence?.saveMessage) {
      try {
        await this.persistence.saveMessage(sessionId, 'assistant', finalAnswer, { toolLogs });
      } catch (e) { console.warn('[twin-engine] persist assistant msg failed:', e?.message); }
    }

    this.emit('done', { answer: finalAnswer, turns: turnsUsed });

    return {
      answer: finalAnswer,
      turns: turnsUsed,
      toolLogs,
      messages,
      streamed: usedStreamForFinal
    };
  }
}

// ───────────────────── 导出 ──────────────────────
module.exports = { TwinEngine, parseToolCalls, extractText };

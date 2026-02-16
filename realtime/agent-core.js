/**
 * AI Agent Core Engine
 * Implements a headless Cline-like agent for file operations
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');
const axios = require('axios');

const WORKSPACE_ROOT = '/workspace';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = Number(process.env.AGENT_TASK_MAX_TOKENS || 2048);
const DEFAULT_MAX_TURNS = Number(process.env.AGENT_MAX_TURNS || 4);
const DEFAULT_TURN_DELAY_MS = Number(process.env.AGENT_TURN_DELAY_MS || 80);

const FORBIDDEN_SHELL_TOKENS = /[;&|`$<>]/;

function resolveWithin(rootDir, targetPath) {
  const resolved = path.resolve(rootDir, targetPath);
  if (resolved === rootDir) return resolved;
  if (!resolved.startsWith(rootDir + path.sep)) {
    throw new Error('Path outside of workspace');
  }
  return resolved;
}

function normalizeRelativePath(input) {
  const raw = String(input || '').replace(/\\/g, '/').trim();
  if (!raw) return '';
  if (raw.startsWith('/')) return '';
  const normalized = path.posix.normalize(raw).replace(/^\.\/+/, '');
  if (!normalized || normalized === '.') return '';
  if (normalized.startsWith('../') || normalized.includes('/../')) return '';
  return normalized;
}

function normalizeWritePolicy(writePolicy) {
  const policy = (writePolicy && typeof writePolicy === 'object') ? writePolicy : {};
  const allowedFiles = Array.isArray(policy.allowedFiles)
    ? policy.allowedFiles.map(normalizeRelativePath).filter(Boolean)
    : [];
  const allowedDirs = Array.isArray(policy.allowedDirs)
    ? policy.allowedDirs
        .map(normalizeRelativePath)
        .map((value) => value.replace(/\/+$/, ''))
        .filter(Boolean)
    : [];
  return { allowedFiles, allowedDirs };
}

const createAnthropicClient = () => {
  const key = String(process.env.ANTHROPIC_API_KEY || '').trim();
  if (!key) return null;
  return new Anthropic({ apiKey: key });
};

const anthropic = createAnthropicClient();

/**
 * System Prompt for Agent
 */
const SYSTEM_PROMPT = `You are a Senior Vue3 Full-Stack Architect embedded in an EIS (Enterprise Information System).

**Context:**
- Tech Stack: Vue 3, Vite, Element Plus, PostgREST, PostgreSQL
- Architecture: qiankun micro-frontends (base + sub-apps)
- Style: Use Element Plus theme variables (var(--el-color-primary))

**Guidelines:**
1. Generate idiomatic Vue3 Composition API code
2. Use <script setup> syntax
3. Follow existing project structure (components/, views/, utils/)
4. For database operations, use PostgREST API (not direct SQL)
5. Avoid hardcoding values - use props/config when possible
6. Always include proper error handling

**Tool Usage:**
You must respond with JSON-structured tool calls in this format:
\`\`\`json
{
  "tool": "write_file",
  "parameters": {
    "path": "relative/path/to/file.vue",
    "content": "file content here"
  }
}
\`\`\`

Available tools:
- write_file: Create or overwrite a file
- read_file: Read file contents
- list_directory: List files in a directory
- execute_command: Run safe commands (npm install, etc.)

When the task is complete, respond with:
\`\`\`json
{"tool": "complete", "message": "Task completed successfully"}
\`\`\``;

/**
 * Tool Implementations
 */
class AgentTools {
  constructor(projectPath = 'eiscore-apps', writePolicy = null) {
    this.projectRoot = resolveWithin(WORKSPACE_ROOT, projectPath);
    this.writePolicy = normalizeWritePolicy(writePolicy);
  }

  isWriteAllowed(relativePath) {
    const targetPath = normalizeRelativePath(relativePath);
    if (!targetPath) return false;

    const fileSet = new Set(this.writePolicy.allowedFiles);
    const dirList = this.writePolicy.allowedDirs;
    const hasFileRules = fileSet.size > 0;
    const hasDirRules = dirList.length > 0;
    if (!hasFileRules && !hasDirRules) return true;
    if (hasFileRules && fileSet.has(targetPath)) return true;
    if (hasDirRules) {
      return dirList.some((dirPath) => targetPath === dirPath || targetPath.startsWith(`${dirPath}/`));
    }
    return false;
  }

  async writeFile(relativePath, content) {
    try {
      if (!this.isWriteAllowed(relativePath)) {
        return { success: false, error: `Write path not allowed: ${relativePath}`, code: 'WRITE_PATH_NOT_ALLOWED' };
      }
      const fullPath = resolveWithin(this.projectRoot, relativePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      return { success: true, path: relativePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async readFile(relativePath) {
    const fullPath = resolveWithin(this.projectRoot, relativePath);
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async listDirectory(relativePath = '.') {
    const fullPath = resolveWithin(this.projectRoot, relativePath);
    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const files = entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory()
      }));
      return { success: true, files };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async executeCommand(command) {
    // For now, only allow safe commands
    const normalized = String(command || '').trim();
    const allowedCommands = new Set(['npm install', 'npm ci', 'npm list']);
    if (FORBIDDEN_SHELL_TOKENS.test(normalized)) {
      return { success: false, error: 'Command contains forbidden shell tokens' };
    }
    if (!allowedCommands.has(normalized)) {
      return { success: false, error: 'Command not allowed' };
    }
    // Stub implementation - would use child_process.exec in production
    return { success: true, output: 'Command executed (stub)' };
  }

  async getContextFromDatabase() {
    try {
      // Fetch database schema from PostgREST
      const response = await axios.get('http://api:3000/', {
        headers: { 'Accept': 'application/openapi+json' }
      });
      return { success: true, schema: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getPackageJson(projectName = 'eiscore-apps') {
    try {
      const pkgPath = resolveWithin(WORKSPACE_ROOT, path.join(projectName, 'package.json'));
      const content = await fs.readFile(pkgPath, 'utf-8');
      return { success: true, content: JSON.parse(content) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

/**
 * Conversation Manager (for multi-turn agent interactions)
 */
class AgentConversation {
  constructor(projectPath, options = {}) {
    this.tools = new AgentTools(projectPath, options?.writePolicy || null);
    this.messages = [];
    this.maxTurns = Number.isFinite(Number(options?.maxTurns))
      ? Number(options.maxTurns)
      : DEFAULT_MAX_TURNS;
    this.turnDelayMs = Number.isFinite(Number(options?.turnDelayMs))
      ? Number(options.turnDelayMs)
      : DEFAULT_TURN_DELAY_MS;
    this.aiInvoker = typeof options?.aiInvoker === 'function' ? options.aiInvoker : null;
    this.model = String(options?.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
    this.maxTokens = Number.isFinite(Number(options?.maxTokens))
      ? Number(options.maxTokens)
      : DEFAULT_MAX_TOKENS;
    this.systemPrompt = String(options?.systemPrompt || SYSTEM_PROMPT);
  }

  async addUserMessage(content) {
    this.messages.push({
      role: 'user',
      content
    });
  }

  async executeToolCall(toolCall) {
    const { tool, parameters } = toolCall;
    
    switch (tool) {
      case 'write_file':
        return await this.tools.writeFile(parameters.path, parameters.content);
      case 'read_file':
        return await this.tools.readFile(parameters.path);
      case 'list_directory':
        return await this.tools.listDirectory(parameters.path || '.');
      case 'execute_command':
        return await this.tools.executeCommand(parameters.command);
      case 'get_db_schema':
        return await this.tools.getContextFromDatabase();
      case 'get_package_json':
        return await this.tools.getPackageJson();
      case 'complete':
        return { success: true, completed: true, message: parameters.message };
      default:
        return { success: false, error: 'Unknown tool: ' + tool };
    }
  }

  parseToolCalls(text) {
    const codeBlocks = text.match(/```json\n([\s\S]*?)\n```/g);
    const toolCalls = [];
    for (const block of (codeBlocks || [])) {
      const json = block.replace(/```json\n/, '').replace(/\n```$/, '').trim();
      try {
        const parsed = JSON.parse(json);
        if (parsed.tool) {
          toolCalls.push(parsed);
        }
      } catch (error) {
        // Ignore invalid JSON
      }
    }

    if (toolCalls.length > 0) return toolCalls;

    // Fallback: sometimes model returns raw JSON without fenced block.
    try {
      const raw = String(text || '').trim();
      if (raw.startsWith('{') && raw.endsWith('}')) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.tool) return [parsed];
      }
      if (raw.startsWith('[') && raw.endsWith(']')) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((item) => item && item.tool);
        }
      }
    } catch (error) {
      // ignore
    }

    return toolCalls;
  }

  async runTurn() {
    let assistantMessage = '';
    if (this.aiInvoker) {
      assistantMessage = await this.aiInvoker({
        model: this.model,
        maxTokens: this.maxTokens,
        systemPrompt: this.systemPrompt,
        messages: this.messages
      });
    } else {
      if (!anthropic) {
        throw new Error('AI provider not configured: missing ANTHROPIC_API_KEY');
      }
      const response = await anthropic.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: this.systemPrompt,
        messages: this.messages
      });
      assistantMessage = String(response?.content?.[0]?.text || '').trim();
    }

    if (!assistantMessage) {
      throw new Error('AI returned empty response');
    }

    this.messages.push({
      role: 'assistant',
      content: assistantMessage
    });

    const toolCalls = this.parseToolCalls(assistantMessage);
    
    if (toolCalls.length === 0) {
      return { 
        type: 'text', 
        content: assistantMessage,
        completed: false 
      };
    }

    const results = [];
    for (const toolCall of toolCalls) {
      const result = await this.executeToolCall(toolCall);
      results.push({
        tool: toolCall.tool,
        parameters: toolCall.parameters,
        result
      });

      if (result.completed) {
        return {
          type: 'tool_results',
          results,
          completed: true
        };
      }
    }

    // Add tool results back to conversation
    const toolResultsText = results.map(r => 
      `Tool: ${r.tool}\nResult: ${JSON.stringify(r.result, null, 2)}`
    ).join('\n\n');

    this.messages.push({
      role: 'user',
      content: toolResultsText
    });

    return {
      type: 'tool_results',
      results,
      completed: false
    };
  }

  async executeTask(userPrompt) {
    await this.addUserMessage(userPrompt);
    
    const executionLog = [];
    let completed = false;
    let textOnlyTurns = 0;

    for (let turn = 0; turn < this.maxTurns && !completed; turn++) {
      const result = await this.runTurn();
      executionLog.push({
        turn: turn + 1,
        type: result.type,
        data: result
      });

      if (result.completed) {
        completed = true;
        break;
      }

      // If model keeps returning plain text (no tool JSON), force one correction turn,
      // then fail fast instead of waiting all turns and causing user-visible timeout.
      if (result.type === 'text') {
        textOnlyTurns += 1;
        if (textOnlyTurns >= 2) break;
        this.messages.push({
          role: 'user',
          content: 'Return ONLY valid JSON tool call(s). Do not output plain text.'
        });
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, this.turnDelayMs));
    }

    return {
      success: completed,
      executionLog,
      totalTurns: executionLog.length
    };
  }
}

/**
 * File Watcher for HMR feedback
 */
class FileWatcher {
  constructor(watchPath, onChangeCallback) {
    this.watchPath = path.join(WORKSPACE_ROOT, watchPath);
    this.watcher = null;
    this.onChangeCallback = onChangeCallback;
  }

  start() {
    this.watcher = chokidar.watch(this.watchPath, {
      ignored: /node_modules|\.git/,
      persistent: true
    });

    this.watcher.on('change', (filePath) => {
      const relativePath = path.relative(this.watchPath, filePath);
      this.onChangeCallback({
        type: 'file_changed',
        path: relativePath,
        timestamp: new Date().toISOString()
      });
    });

    this.watcher.on('add', (filePath) => {
      const relativePath = path.relative(this.watchPath, filePath);
      this.onChangeCallback({
        type: 'file_added',
        path: relativePath,
        timestamp: new Date().toISOString()
      });
    });
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}

module.exports = {
  AgentConversation,
  AgentTools,
  FileWatcher,
  WORKSPACE_ROOT
};

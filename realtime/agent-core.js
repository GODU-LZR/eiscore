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
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 8192;

const FORBIDDEN_SHELL_TOKENS = /[;&|`$<>]/;

function resolveWithin(rootDir, targetPath) {
  const resolved = path.resolve(rootDir, targetPath);
  if (resolved === rootDir) return resolved;
  if (!resolved.startsWith(rootDir + path.sep)) {
    throw new Error('Path outside of workspace');
  }
  return resolved;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

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
  constructor(projectPath = 'eiscore-apps') {
    this.projectRoot = resolveWithin(WORKSPACE_ROOT, projectPath);
  }

  async writeFile(relativePath, content) {
    try {
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
  constructor(projectPath) {
    this.tools = new AgentTools(projectPath);
    this.messages = [];
    this.maxTurns = 10;
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
    if (!codeBlocks) return [];
    
    const toolCalls = [];
    for (const block of codeBlocks) {
      const json = block.replace(/```json\n/, '').replace(/\n```$/, '');
      try {
        const parsed = JSON.parse(json);
        if (parsed.tool) {
          toolCalls.push(parsed);
        }
      } catch (error) {
        // Ignore invalid JSON
      }
    }
    return toolCalls;
  }

  async runTurn() {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: this.messages
    });

    const assistantMessage = response.content[0].text;
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

    for (let turn = 0; turn < this.maxTurns && !completed; turn++) {
      const result = await this.runTurn();
      executionLog.push({
        turn: turn + 1,
        type: result.type,
        data: result
      });

      if (result.completed) {
        completed = true;
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
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

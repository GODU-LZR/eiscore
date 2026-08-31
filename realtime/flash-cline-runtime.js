// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const createFlashClineRuntime = ({
  command,
  projectPath,
  buildWorkdirConfigured,
  taskTimeoutMs,
  buildTimeoutMs,
  installTimeoutMs,
  selfHealMaxRounds,
  autoInstallDeps,
  historyLimit,
  attachmentPreviewMaxChars,
  agentBaseUrl,
  semanticCliScript,
  httpProxyUrl,
  buildValidateEnabled,
  normalizeText,
  normalizeProjectPath,
  normalizeRelativeAgentPath,
  sanitizeUploadFileName,
  parseJsonMaybe,
  sendWsJson,
  fsApi = fs,
  pathApi = path,
  spawnProcess = spawn,
  environment = process.env,
  processCwd = () => process.cwd(),
  moduleDir = __dirname,
  setTimer = setTimeout,
  clearTimer = clearTimeout
}) => {
  const ensureBashCompat = () => {
    try {
      if (fsApi.existsSync('/bin/bash')) return true;
      if (!fsApi.existsSync('/bin/sh')) return false;
      fsApi.symlinkSync('/bin/sh', '/bin/bash');
      return fsApi.existsSync('/bin/bash');
    } catch {
      return false;
    }
  };

  const resolveBuildWorkdir = (taskWorkdir) => {
    const directCandidates = [
      buildWorkdirConfigured,
      taskWorkdir,
      pathApi.resolve(taskWorkdir, '..'),
      pathApi.resolve(taskWorkdir, '..', '..'),
      pathApi.resolve(taskWorkdir, '..', '..', '..'),
      pathApi.resolve(processCwd(), '..', 'eiscore-apps'),
      pathApi.resolve(moduleDir, '..', 'eiscore-apps')
    ]
      .map((item) => String(item || '').trim())
      .filter(Boolean);

    for (const candidate of directCandidates) {
      try {
        if (!fsApi.existsSync(candidate)) continue;
        if (fsApi.existsSync(pathApi.join(candidate, 'package.json'))) return candidate;
      } catch {
        // ignore
      }
    }
    return directCandidates[0] || buildWorkdirConfigured;
  };

  const normalizeFlashCliError = (value) => {
    const text = normalizeText(value);
    if (!text) return '';
    if (/spawn\s+\/bin\/bash\s+ENOENT/i.test(text) || /\/bin\/bash.*not found/i.test(text)) {
      return '自动修复失败：运行环境缺少 /bin/bash，Cline 无法执行命令。请重建 agent-runtime 后重试。';
    }
    return text;
  };

  const deriveOpenAiBaseUrl = (apiUrl) => {
    const raw = String(apiUrl || '').trim();
    if (!raw) return '';
    try {
      const parsed = new URL(raw);
      if (parsed.pathname.endsWith('/chat/completions')) {
        parsed.pathname = parsed.pathname.replace(/\/chat\/completions$/, '');
      }
      return parsed.toString().replace(/\/+$/, '');
    } catch {
      return raw.replace(/\/chat\/completions$/, '').replace(/\/+$/, '');
    }
  };

  const resolveClineBin = () => {
    const candidates = [command, '/app/node_modules/.bin/cline', 'cline'];
    for (const candidate of candidates) {
      const executable = String(candidate || '').trim();
      if (!executable) continue;
      if (executable.includes('/') && fsApi.existsSync(executable)) return executable;
      if (!executable.includes('/')) return executable;
    }
    return 'cline';
  };

  const runSpawnCapture = (executable, args, options = {}) => {
    return new Promise((resolve, reject) => {
      const child = spawnProcess(executable, args, {
        cwd: options.cwd || '/app',
        env: options.env || environment,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      if (typeof options.onSpawn === 'function') {
        try {
          options.onSpawn(child);
        } catch {
          // ignore callback errors
        }
      }

      let stdout = '';
      let stderr = '';
      let timer = null;
      let killedByTimeout = false;

      if (Number.isFinite(options.timeoutMs) && options.timeoutMs > 0) {
        timer = setTimer(() => {
          killedByTimeout = true;
          child.kill('SIGKILL');
        }, options.timeoutMs);
      }

      child.stdout.on('data', (chunk) => {
        stdout += String(chunk || '');
        if (stdout.length > 8000) stdout = stdout.slice(-8000);
      });
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk || '');
        if (stderr.length > 8000) stderr = stderr.slice(-8000);
      });

      child.on('error', (error) => {
        if (timer) clearTimer(timer);
        if (typeof options.onDone === 'function') {
          try {
            options.onDone(child);
          } catch {
            // ignore callback errors
          }
        }
        reject(error);
      });

      child.on('close', (code) => {
        if (timer) clearTimer(timer);
        if (typeof options.onDone === 'function') {
          try {
            options.onDone(child);
          } catch {
            // ignore callback errors
          }
        }
        resolve({
          code: Number(code || 0),
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          timedOut: killedByTimeout
        });
      });
    });
  };

  const buildFlashCliEnv = (token = '') => {
    const result = {
      ...environment,
      FLASH_AGENT_TOKEN: String(token || ''),
      FLASH_AGENT_BASE_URL: agentBaseUrl,
      FLASH_SEMANTIC_CLI_SCRIPT: semanticCliScript
    };
    const proxyUrl = String(httpProxyUrl || '').trim();
    if (proxyUrl) {
      result.HTTP_PROXY = result.HTTP_PROXY || proxyUrl;
      result.HTTPS_PROXY = result.HTTPS_PROXY || proxyUrl;
      result.http_proxy = result.http_proxy || proxyUrl;
      result.https_proxy = result.https_proxy || proxyUrl;
      const localNoProxy = [
        'localhost',
        '127.0.0.1',
        '::1',
        'api',
        'db',
        'agent-runtime',
        'eiscore-api',
        'eiscore-db',
        'eiscore-agent-runtime',
        'host.docker.internal'
      ];
      const existingNoProxy = result.NO_PROXY || result.no_proxy || '';
      const mergedNoProxy = Array.from(new Set(
        [...String(existingNoProxy).split(','), ...localNoProxy]
          .map((item) => item.trim())
          .filter(Boolean)
      )).join(',');
      result.NO_PROXY = mergedNoProxy;
      result.no_proxy = mergedNoProxy;
    }
    return result;
  };

  const summarizeCommandOutput = (stdout, stderr, maxChars = 1800) => {
    const text = `${String(stdout || '')}\n${String(stderr || '')}`.trim();
    if (!text) return '';
    const compact = text
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/\r/g, '')
      .trim();
    if (compact.length <= maxChars) return compact;
    return compact.slice(-maxChars);
  };

  const normalizeImportSpecifier = (value) => {
    return String(value || '')
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .replace(/[?#].*$/, '')
      .trim();
  };

  const specifierToPackageName = (specifier) => {
    const target = normalizeImportSpecifier(specifier);
    if (!target) return '';
    if (
      target.startsWith('.') ||
      target.startsWith('/') ||
      target.startsWith('@/') ||
      target.startsWith('~/') ||
      target.startsWith('http://') ||
      target.startsWith('https://') ||
      target.startsWith('data:') ||
      target.startsWith('node:') ||
      target.startsWith('virtual:')
    ) {
      return '';
    }
    if (target.startsWith('@')) {
      const parts = target.split('/').filter(Boolean);
      if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
      return '';
    }
    return target.split('/')[0] || '';
  };

  const collectMissingPackagesFromBuildLog = (logText) => {
    const text = String(logText || '');
    if (!text) return [];
    const patterns = [
      /Cannot find package ['"]([^'"\r\n]+)['"]/gi,
      /Cannot find module ['"]([^'"\r\n]+)['"]/gi,
      /Failed to resolve import ["']([^"'\r\n]+)["']/gi,
      /Could not resolve ["']([^"'\r\n]+)["']/gi
    ];
    const names = new Set();
    patterns.forEach((pattern) => {
      pattern.lastIndex = 0;
      let match = pattern.exec(text);
      while (match) {
        const packageName = specifierToPackageName(match[1]);
        if (packageName) names.add(packageName);
        match = pattern.exec(text);
      }
    });
    return Array.from(names).slice(0, 6);
  };

  const isDraftScopedBuildFailure = (logText) => {
    const text = String(logText || '');
    if (!text) return false;
    if (/FlashDraft\.vue/i.test(text)) return true;
    if (/src\/views\/drafts\//i.test(text)) return true;
    const normalizedProject = normalizeProjectPath(projectPath);
    if (normalizedProject && text.includes(normalizedProject)) return true;
    return false;
  };

  const detectPackageManager = (workdir) => {
    const files = [
      ['pnpm-lock.yaml', 'pnpm'],
      ['yarn.lock', 'yarn'],
      ['package-lock.json', 'npm']
    ];
    for (const [name, manager] of files) {
      try {
        if (fsApi.existsSync(pathApi.join(workdir, name))) return manager;
      } catch {
        // ignore
      }
    }
    return 'npm';
  };

  const runBuildCommand = async (workdir, manager, options = {}) => {
    const selected = manager || detectPackageManager(workdir);
    if (selected === 'pnpm') {
      return runSpawnCapture('pnpm', ['build'], {
        cwd: workdir,
        timeoutMs: buildTimeoutMs,
        onSpawn: options.onSpawn,
        onDone: options.onDone
      });
    }
    if (selected === 'yarn') {
      return runSpawnCapture('yarn', ['build'], {
        cwd: workdir,
        timeoutMs: buildTimeoutMs,
        onSpawn: options.onSpawn,
        onDone: options.onDone
      });
    }
    return runSpawnCapture('npm', ['run', 'build'], {
      cwd: workdir,
      timeoutMs: buildTimeoutMs,
      onSpawn: options.onSpawn,
      onDone: options.onDone
    });
  };

  const runInstallCommand = async (workdir, manager, packages, options = {}) => {
    const list = Array.isArray(packages) ? packages.map((item) => String(item || '').trim()).filter(Boolean) : [];
    if (!list.length) return { code: 0, stdout: '', stderr: '', timedOut: false };
    const selected = manager || detectPackageManager(workdir);
    if (selected === 'pnpm') {
      return runSpawnCapture('pnpm', ['add', ...list], {
        cwd: workdir,
        timeoutMs: installTimeoutMs,
        onSpawn: options.onSpawn,
        onDone: options.onDone
      });
    }
    if (selected === 'yarn') {
      return runSpawnCapture('yarn', ['add', ...list], {
        cwd: workdir,
        timeoutMs: installTimeoutMs,
        onSpawn: options.onSpawn,
        onDone: options.onDone
      });
    }
    return runSpawnCapture('npm', ['install', '--save', '--no-audit', '--no-fund', ...list], {
      cwd: workdir,
      timeoutMs: installTimeoutMs,
      onSpawn: options.onSpawn,
      onDone: options.onDone
    });
  };

  const runWithManagerFallback = async (fn, manager) => {
    const primary = manager || 'npm';
    try {
      const result = await fn(primary);
      return { manager: primary, result };
    } catch (error) {
      const missingBinary = String(error?.message || '').includes('ENOENT');
      if (!missingBinary || primary === 'npm') throw error;
      const fallbackResult = await fn('npm');
      return { manager: 'npm', result: fallbackResult };
    }
  };

  const shouldForwardClineSay = (sayType, text) => {
    const key = String(sayType || '').trim().toLowerCase();
    if (!text) return false;
    const blocked = new Set([
      'task',
      'reasoning',
      'tool',
      'task_progress',
      'api_req_started',
      'api_req_finished',
      'api_req_retried',
      'api_req_completed',
      'command',
      'command_output'
    ]);
    if (blocked.has(key)) return false;
    if (text.includes('<environment_details>') || text.includes('<task>')) return false;
    return true;
  };

  const parseClineCapturedEvents = (rawText) => {
    const lines = String(rawText || '').split(/\r?\n/);
    const assistantChunks = [];
    let taskId = '';
    let errorText = '';
    lines.forEach((line) => {
      const parsed = parseJsonMaybe(line);
      if (!parsed || typeof parsed !== 'object') return;
      if (parsed.type === 'task_started' && parsed.taskId) {
        taskId = String(parsed.taskId);
        return;
      }
      if (!errorText && parsed.type === 'error') {
        errorText = normalizeText(parsed.message || parsed.text || '');
        return;
      }
      if (parsed.type === 'say') {
        const sayText = normalizeText(parsed.text);
        if (!shouldForwardClineSay(parsed.say, sayText)) return;
        assistantChunks.push(sayText);
      }
    });
    return { assistantChunks, taskId, errorText };
  };

  const buildFlashSelfHealPrompt = (originalPrompt, buildLog) => {
    const safePrompt = normalizeText(originalPrompt) || '继续修复当前草稿';
    const safeLog = summarizeCommandOutput(buildLog, '', 1600) || '构建失败但未返回详细日志。';
    return [
      '上一轮生成后执行前端构建失败，请直接修复问题直到构建通过。',
      '仅允许修改当前草稿目录文件，不要触碰路由、鉴权、基座。',
      '若错误来自导入路径/语法/类型，请直接修复代码。',
      '禁止输出思考过程、上下文复述、环境信息。',
      `原始需求：${safePrompt}`,
      '构建失败摘要：',
      safeLog
    ].join('\n');
  };

  const buildFlashCliArgs = ({ configDir, model, taskId, prompt, workdir }) => {
    const args = [
      'task',
      '--json',
      '--act',
      '--yolo',
      '--timeout',
      String(Math.max(30, Math.floor(taskTimeoutMs / 1000))),
      '--config',
      configDir,
      '--cwd',
      workdir
    ];
    if (model) args.push('--model', model);
    if (taskId) args.push('-T', taskId);
    args.push(prompt);
    return args;
  };

  const runFlashBuildSelfHeal = async ({
    ws,
    sessionId,
    session,
    clineBin,
    configDir,
    model,
    prompt,
    taskWorkdir,
    clineEnv
  }) => {
    if (!buildValidateEnabled) return { success: true, skipped: true };
    if (!ensureBashCompat()) {
      return {
        success: false,
        error: '自动修复失败：运行环境缺少 /bin/bash，无法执行命令。请重建 agent-runtime 后重试。'
      };
    }

    const buildWorkdir = resolveBuildWorkdir(taskWorkdir);
    const packageJson = pathApi.join(buildWorkdir, 'package.json');
    if (!fsApi.existsSync(packageJson)) return { success: true, skipped: true };

    let manager = detectPackageManager(buildWorkdir);
    const installedPackages = new Set();
    let round = 0;
    let lastBuildLog = '';
    const bindSessionProcess = {
      onSpawn: (child) => {
        session.process = child;
      },
      onDone: (child) => {
        if (session.process === child) session.process = null;
      }
    };

    while (round <= selfHealMaxRounds) {
      sendWsJson(ws, {
        type: 'flash:cline_status',
        sessionId,
        status: 'validating',
        message: round === 0 ? '正在校验草稿编译结果...' : `正在验证修复结果（第 ${round} 轮）...`
      });

      const buildRun = await runWithManagerFallback(
        (selected) => runBuildCommand(buildWorkdir, selected, bindSessionProcess),
        manager
      );
      manager = buildRun.manager;
      const buildResult = buildRun.result;

      if (!buildResult.timedOut && Number(buildResult.code || 0) === 0) {
        if (installedPackages.size > 0) {
          sendWsJson(ws, {
            type: 'flash:cline_status',
            sessionId,
            status: 'deps_installed',
            message: `已自动安装依赖：${Array.from(installedPackages).join(', ')}`
          });
        }
        return { success: true, installedPackages: Array.from(installedPackages), rounds: round };
      }

      lastBuildLog = summarizeCommandOutput(buildResult.stdout, buildResult.stderr, 2200);
      const missingPackages = autoInstallDeps
        ? collectMissingPackagesFromBuildLog(lastBuildLog).filter((packageName) => !installedPackages.has(packageName))
        : [];
      const draftScopedFailure = isDraftScopedBuildFailure(lastBuildLog);

      if (!draftScopedFailure && missingPackages.length === 0) {
        sendWsJson(ws, {
          type: 'flash:cline_status',
          sessionId,
          status: 'validate_warn',
          message: '检测到非草稿历史构建错误，已跳过阻塞式修复，不影响当前草稿输出。'
        });
        return { success: true, skipped: true };
      }

      if (missingPackages.length > 0) {
        sendWsJson(ws, {
          type: 'flash:cline_status',
          sessionId,
          status: 'installing',
          message: `检测到缺失依赖，自动安装：${missingPackages.join(', ')}`
        });
        const installRun = await runWithManagerFallback(
          (selected) => runInstallCommand(buildWorkdir, selected, missingPackages, bindSessionProcess),
          manager
        );
        manager = installRun.manager;
        const installResult = installRun.result;
        if (installResult.timedOut || Number(installResult.code || 0) !== 0) {
          const installError = normalizeFlashCliError(
            summarizeCommandOutput(installResult.stdout, installResult.stderr, 800)
          );
          return { success: false, error: `自动安装依赖失败：${installError || 'unknown error'}` };
        }
        missingPackages.forEach((packageName) => installedPackages.add(packageName));
        continue;
      }

      if (round >= selfHealMaxRounds) {
        return { success: false, error: `自动修复后仍构建失败：${lastBuildLog || 'no build output'}` };
      }

      round += 1;
      sendWsJson(ws, {
        type: 'flash:cline_status',
        sessionId,
        status: 'self_heal',
        message: `检测到构建失败，正在自动修复（${round}/${selfHealMaxRounds}）...`
      });
      const repairPrompt = buildFlashSelfHealPrompt(prompt, lastBuildLog);
      const repairArgs = buildFlashCliArgs({
        configDir,
        model,
        taskId: session.taskId,
        prompt: repairPrompt,
        workdir: taskWorkdir
      });
      const repairResult = await runSpawnCapture(clineBin, repairArgs, {
        cwd: '/app',
        env: clineEnv || environment,
        timeoutMs: taskTimeoutMs,
        onSpawn: bindSessionProcess.onSpawn,
        onDone: bindSessionProcess.onDone
      });
      const repairEvents = parseClineCapturedEvents(`${repairResult.stdout}\n${repairResult.stderr}`);
      if (repairEvents.taskId) session.taskId = repairEvents.taskId;
      repairEvents.assistantChunks.forEach((chunk) => {
        sendWsJson(ws, {
          type: 'flash:cline_output',
          sessionId,
          role: 'assistant',
          content: chunk,
          eventType: 'say',
          say: 'self_heal'
        });
      });

      if (repairResult.timedOut) {
        return { success: false, error: `自动修复超时（>${taskTimeoutMs}ms）` };
      }
      if (Number(repairResult.code || 0) !== 0) {
        const repairError = normalizeFlashCliError(
          repairEvents.errorText || summarizeCommandOutput(repairResult.stdout, repairResult.stderr, 900)
        );
        return { success: false, error: `自动修复失败：${repairError || 'unknown error'}` };
      }
    }

    return { success: false, error: `自动修复达到上限（${selfHealMaxRounds}）仍未通过构建` };
  };

  const clampFlashHistory = (history) => {
    if (!Array.isArray(history)) return [];
    const items = history
      .map((item) => {
        const role = String(item?.role || '').toLowerCase();
        const content = normalizeText(item?.content);
        if ((role !== 'user' && role !== 'assistant') || !content) return null;
        return { role, content: content.slice(0, 1600) };
      })
      .filter(Boolean);
    const limit = Number.isFinite(historyLimit) && historyLimit > 0 ? Math.floor(historyLimit) : 10;
    return items.slice(-limit);
  };

  const normalizeFlashAttachmentList = (attachments, taskWorkdir) => {
    if (!Array.isArray(attachments) || !taskWorkdir) return [];
    const workdirResolved = pathApi.resolve(taskWorkdir);
    let totalPreviewChars = 0;
    return attachments
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const relativePath = normalizeRelativeAgentPath(item.relativePath || item.path);
        if (!relativePath) return null;
        const absolutePath = pathApi.resolve(workdirResolved, relativePath);
        if (absolutePath !== workdirResolved && !absolutePath.startsWith(`${workdirResolved}${pathApi.sep}`)) return null;
        if (!fsApi.existsSync(absolutePath)) return null;

        const name = sanitizeUploadFileName(item.name || pathApi.posix.basename(relativePath));
        const mimeType = normalizeText(item.mimeType || item.type).slice(0, 120) || 'application/octet-stream';
        const size = Number.isFinite(Number(item.size)) ? Number(item.size) : 0;
        let textPreview = normalizeText(item.textPreview || item.preview || '');
        if (textPreview) {
          const remaining = Math.max(0, attachmentPreviewMaxChars - totalPreviewChars);
          if (remaining <= 0) {
            textPreview = '';
          } else if (textPreview.length > remaining) {
            textPreview = `${textPreview.slice(0, remaining)}...`;
            totalPreviewChars = attachmentPreviewMaxChars;
          } else {
            totalPreviewChars += textPreview.length;
          }
        }
        return {
          name,
          mimeType,
          size: Math.max(0, Math.floor(size)),
          relativePath,
          textPreview
        };
      })
      .filter(Boolean)
      .slice(0, 8);
  };

  const buildFlashCliPrompt = (prompt, history = [], attachments = []) => {
    const cleanPrompt = normalizeText(prompt);
    const lines = [
      '你是闪念应用开发助手，只允许在当前工作目录内编辑应用草稿。',
      '硬性约束：只能修改 FlashDraft.vue 及其同目录草稿文件，不要触碰路由/鉴权/核心基座文件。',
      '输出要求：先给结果，再给关键变更点，尽量简洁。',
      '严禁输出思考过程、任务计划、系统提示、工作目录、环境信息和历史上下文原文。',
      '禁止出现“用户要求”“当前用户请求”“以下是最近上下文”“从环境信息来看”等复述语句。',
      '运行态可用工具桥：在 FlashDraft.vue 中可调用 `window.EISFlash.callTool(toolId, args, options)` 或 `this.$flash.callTool(toolId, args, options)`；读工具可直接调用，写工具需传 `{ write: true }`，平台会自动补 confirmed/idempotency_key。',
      '生成业务应用时禁止把语义接口数据固化成 mock；若需要库存、仓库、流程、表格等实时数据，必须在组件运行时调用上述工具桥。',
      `可调用系统语义接口：使用命令 \`node ${semanticCliScript}\`。`,
      `先运行 \`node ${semanticCliScript} --registry\` 查看可用 tool_id。`,
      `读接口示例：\`node ${semanticCliScript} flash.app.detail --args '{"appId":"<APP_ID>"}'\`。`,
      `写接口必须添加 --confirm，例如：\`node ${semanticCliScript} flash.audit.write --args '{"payload":{"event_type":"test"}}' --confirm\`。`
    ];
    if (history.length > 0) {
      lines.push('以下是最近上下文：');
      history.forEach((item, index) => lines.push(`${index + 1}. [${item.role}] ${item.content}`));
    }
    if (attachments.length > 0) {
      lines.push('本次用户上传了附件，请结合附件内容完成界面设计和代码生成：');
      attachments.forEach((item, index) => {
        lines.push(`${index + 1}. 文件: ${item.name} | 类型: ${item.mimeType || 'unknown'} | 大小: ${item.size || 0} bytes`);
        lines.push(`   路径: ${item.relativePath}`);
        if (item.textPreview) {
          lines.push('   文本摘要(可能截断):');
          lines.push(`   ${item.textPreview.replace(/\n/g, '\n   ')}`);
        }
      });
      lines.push('你可以读取上述文件路径获取完整内容，但写入修改仍仅限草稿目录。');
    }
    lines.push('当前用户请求：');
    lines.push(cleanPrompt || '请继续优化当前草稿。');
    return lines.join('\n');
  };

  const parseClineRetryMessage = (event) => {
    if (event?.type !== 'say' || event?.say !== 'error_retry') return '';
    const parsed = parseJsonMaybe(event?.text);
    if (!parsed) return '上游请求失败，正在重试...';
    const attempt = Number(parsed.attempt || 0);
    const maxAttempts = Number(parsed.maxAttempts || 0);
    if (attempt > 0 && maxAttempts > 0) return `上游请求失败，自动重试 ${attempt}/${maxAttempts}...`;
    return '上游请求失败，正在重试...';
  };

  const createFlashCliSession = () => ({ taskId: '', running: false, process: null });

  const killFlashCliSessionProcess = (session) => {
    if (!session?.process) return;
    try {
      session.process.kill('SIGKILL');
    } catch {
      // ignore
    } finally {
      session.process = null;
      session.running = false;
    }
  };

  return Object.freeze({
    buildFlashCliArgs,
    buildFlashCliEnv,
    buildFlashCliPrompt,
    buildFlashSelfHealPrompt,
    clampFlashHistory,
    collectMissingPackagesFromBuildLog,
    createFlashCliSession,
    deriveOpenAiBaseUrl,
    detectPackageManager,
    ensureBashCompat,
    isDraftScopedBuildFailure,
    killFlashCliSessionProcess,
    normalizeFlashAttachmentList,
    normalizeFlashCliError,
    parseClineCapturedEvents,
    parseClineRetryMessage,
    resolveBuildWorkdir,
    resolveClineBin,
    runBuildCommand,
    runFlashBuildSelfHeal,
    runInstallCommand,
    runSpawnCapture,
    runWithManagerFallback,
    shouldForwardClineSay,
    specifierToPackageName,
    summarizeCommandOutput
  });
};

module.exports = {
  createFlashClineRuntime
};

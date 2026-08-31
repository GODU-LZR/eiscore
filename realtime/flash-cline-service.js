// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

'use strict';

const path = require('path');
const { spawn } = require('child_process');

const createFlashClineService = ({
  enabled,
  nodeVersion,
  projectPath,
  configRoot,
  taskTimeoutMs,
  authTimeoutMs,
  provider,
  registryVersion,
  registryCount,
  runtime,
  normalizeText,
  normalizeAppId,
  normalizeProjectPath,
  isAllowedProject,
  canUseAgent,
  getAiConfig,
  resolveTaskWorkdir,
  ensureDir,
  syncScopedDraftToPreview,
  readDraftFingerprintsSafe,
  syncPreviewDraftToScoped,
  hasFingerprintChanged,
  sendWsJson,
  logAgentEvent,
  spawnProcess = spawn,
  pathApi = path,
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout
}) => {
  if (!runtime || typeof runtime !== 'object') throw new Error('Flash Cline runtime is required');

  const {
    buildFlashCliArgs,
    buildFlashCliEnv,
    buildFlashCliPrompt,
    clampFlashHistory,
    createFlashCliSession,
    deriveOpenAiBaseUrl,
    killFlashCliSessionProcess,
    normalizeFlashAttachmentList,
    normalizeFlashCliError,
    parseClineRetryMessage,
    resolveClineBin,
    runFlashBuildSelfHeal,
    runSpawnCapture,
    shouldForwardClineSay
  } = runtime;

  const runtimeNodeMajor = Number.parseInt(String(nodeVersion || '0').split('.')[0], 10) || 0;
  const runtimeReady = runtimeNodeMajor >= 20;

  const runFlashClineTask = async (ws, payload = {}) => {
    if (!enabled) {
      sendWsJson(ws, {
        type: 'flash:cline_error',
        sessionId: String(payload?.sessionId || 'default'),
        error: 'Cline CLI shell mode is disabled by server policy'
      });
      return;
    }
    if (!runtimeReady) {
      sendWsJson(ws, {
        type: 'flash:cline_error',
        sessionId: String(payload?.sessionId || 'default'),
        error: `Node.js ${nodeVersion} is not supported by Cline CLI (requires >=20)`
      });
      return;
    }

    if (!canUseAgent(ws.user)) {
      sendWsJson(ws, {
        type: 'flash:cline_error',
        sessionId: String(payload?.sessionId || 'default'),
        error: 'Forbidden: agent access denied'
      });
      logAgentEvent('flash:cline_denied', ws.user, { reason: 'role_denied' });
      return;
    }

    const normalizedProject = normalizeProjectPath(projectPath) || 'eiscore-apps/src/views/drafts';
    if (!isAllowedProject(normalizedProject)) {
      sendWsJson(ws, {
        type: 'flash:cline_error',
        sessionId: String(payload?.sessionId || 'default'),
        error: 'Forbidden: flash project path not allowed'
      });
      logAgentEvent('flash:cline_denied', ws.user, { reason: 'project_denied', projectPath: normalizedProject });
      return;
    }

    const sessionId = String(payload?.sessionId || 'default').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default';
    const taskAppId = normalizeAppId(payload?.appId || payload?.app_id || '');
    try {
      if (!ws.flashCliSessions) ws.flashCliSessions = new Map();
      if (!ws.flashCliSessions.has(sessionId)) {
        ws.flashCliSessions.set(sessionId, createFlashCliSession());
      }
      const session = ws.flashCliSessions.get(sessionId);
      if (session.running || session.process) {
        sendWsJson(ws, {
          type: 'flash:cline_error',
          sessionId,
          error: '上一条请求尚未完成，请稍后再试'
        });
        return;
      }

      const prompt = normalizeText(payload?.prompt);
      if (!prompt) {
        sendWsJson(ws, { type: 'flash:cline_error', sessionId, error: 'Prompt is required' });
        return;
      }

      const cfg = await getAiConfig();
      if (!cfg?.api_key || !cfg?.api_url) {
        sendWsJson(ws, {
          type: 'flash:cline_error',
          sessionId,
          error: 'AI configuration is missing in system_configs.ai_glm_config'
        });
        return;
      }

      const clineBin = resolveClineBin();
      const clineEnv = buildFlashCliEnv(ws?.user?.token || '');
      const model = normalizeText(payload?.model) || normalizeText(cfg?.model) || 'gpt-4o';
      const history = clampFlashHistory(payload?.history);
      const configDir = pathApi.posix.join(configRoot, sessionId);
      const taskWorkdir = resolveTaskWorkdir();
      const attachments = normalizeFlashAttachmentList(payload?.attachments, taskWorkdir);
      const composedPrompt = buildFlashCliPrompt(prompt, history, attachments);

      await ensureDir(configDir);
      await ensureDir(taskWorkdir);
      if (taskAppId) await syncScopedDraftToPreview(taskAppId);

      const baseUrl = deriveOpenAiBaseUrl(cfg.api_url);
      const authArgs = [
        'auth',
        '-p',
        provider,
        '-k',
        String(cfg.api_key),
        '-m',
        model,
        '--config',
        configDir
      ];
      if (baseUrl) authArgs.push('-b', baseUrl);

      const authResult = await runSpawnCapture(clineBin, authArgs, {
        cwd: '/app',
        env: clineEnv,
        timeoutMs: authTimeoutMs
      });
      if (authResult.timedOut || authResult.code !== 0) {
        const authError = normalizeText(authResult.stderr || authResult.stdout || 'Cline auth failed');
        sendWsJson(ws, {
          type: 'flash:cline_error',
          sessionId,
          error: `Cline auth failed: ${authError}`
        });
        logAgentEvent('flash:cline_auth_failed', ws.user, {
          sessionId,
          error: authError.slice(0, 400)
        });
        return;
      }

      const taskArgs = buildFlashCliArgs({
        configDir,
        model,
        taskId: session.taskId,
        prompt: composedPrompt,
        workdir: taskWorkdir
      });
      const draftBefore = await readDraftFingerprintsSafe(taskAppId);
      const child = spawnProcess(clineBin, taskArgs, {
        cwd: '/app',
        env: clineEnv,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      session.running = true;
      session.process = child;
      const assistantChunks = [];
      let stdoutBuffer = '';
      let stderrBuffer = '';
      let timeoutTriggered = false;
      const startedAt = now();

      logAgentEvent('flash:cline_start', ws.user, {
        sessionId,
        appId: taskAppId,
        model,
        workdir: taskWorkdir
      });
      sendWsJson(ws, {
        type: 'flash:cline_status',
        sessionId,
        status: 'running',
        message: 'Cline CLI 正在处理...'
      });
      sendWsJson(ws, {
        type: 'flash:cline_status',
        sessionId,
        status: 'registry_meta',
        registryVersion,
        registryCount
      });

      const timeoutTimer = setTimer(() => {
        timeoutTriggered = true;
        killFlashCliSessionProcess(session);
      }, taskTimeoutMs);

      const flushCliLine = (line, source) => {
        const text = String(line || '').trim();
        if (!text) return;
        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = null;
        }
        if (!parsed) {
          if (source === 'stderr') {
            sendWsJson(ws, {
              type: 'flash:cline_status',
              sessionId,
              status: 'log',
              message: text.slice(0, 240)
            });
          }
          return;
        }

        if (parsed.type === 'task_started' && parsed.taskId) {
          session.taskId = String(parsed.taskId);
          return;
        }
        if (parsed.type === 'error') {
          const errorText = normalizeFlashCliError(parsed.message || parsed.text || 'Cline task failed');
          sendWsJson(ws, { type: 'flash:cline_error', sessionId, error: errorText });
          return;
        }
        const retryText = parseClineRetryMessage(parsed);
        if (retryText) {
          sendWsJson(ws, {
            type: 'flash:cline_status',
            sessionId,
            status: 'retry',
            message: retryText
          });
          return;
        }
        if (parsed.type === 'ask' && parsed.ask === 'api_req_failed') {
          const askError = normalizeText(parsed.text || 'AI upstream request failed');
          sendWsJson(ws, { type: 'flash:cline_error', sessionId, error: askError });
          return;
        }
        if (parsed.type === 'say') {
          const sayText = normalizeText(parsed.text);
          if (!shouldForwardClineSay(parsed.say, sayText)) return;
          assistantChunks.push(sayText);
          sendWsJson(ws, {
            type: 'flash:cline_output',
            sessionId,
            role: 'assistant',
            content: sayText,
            eventType: 'say',
            say: parsed.say || ''
          });
        }
      };

      const consumeOutput = (chunk, source) => {
        const data = String(chunk || '');
        if (source === 'stdout') {
          stdoutBuffer += data;
          const lines = stdoutBuffer.split(/\r?\n/);
          stdoutBuffer = lines.pop() || '';
          lines.forEach((line) => flushCliLine(line, source));
          return;
        }
        stderrBuffer += data;
        const lines = stderrBuffer.split(/\r?\n/);
        stderrBuffer = lines.pop() || '';
        lines.forEach((line) => flushCliLine(line, source));
      };

      child.stdout.on('data', (chunk) => consumeOutput(chunk, 'stdout'));
      child.stderr.on('data', (chunk) => consumeOutput(chunk, 'stderr'));

      child.on('error', (error) => {
        sendWsJson(ws, {
          type: 'flash:cline_error',
          sessionId,
          error: normalizeText(error?.message || 'Cline process error')
        });
      });

      child.on('close', (code) => {
        (async () => {
          clearTimer(timeoutTimer);
          if (stdoutBuffer.trim()) flushCliLine(stdoutBuffer, 'stdout');
          if (stderrBuffer.trim()) flushCliLine(stderrBuffer, 'stderr');

          let success = !timeoutTriggered && Number(code || 0) === 0;
          let exitCode = Number(code || 0);
          const elapsedMs = now() - startedAt;
          const summary = assistantChunks.filter(Boolean).join('\n\n').trim();
          let draftAfter = await readDraftFingerprintsSafe(taskAppId);
          let draftChanged = hasFingerprintChanged(draftBefore.preview, draftAfter.preview)
            || hasFingerprintChanged(draftBefore.scoped, draftAfter.scoped);

          if (taskAppId && hasFingerprintChanged(draftBefore.preview, draftAfter.preview)) {
            await syncPreviewDraftToScoped(taskAppId);
            draftAfter = await readDraftFingerprintsSafe(taskAppId);
          } else if (taskAppId && hasFingerprintChanged(draftBefore.scoped, draftAfter.scoped)) {
            await syncScopedDraftToPreview(taskAppId);
            draftAfter = await readDraftFingerprintsSafe(taskAppId);
          }

          if (summary) {
            sendWsJson(ws, {
              type: 'flash:cline_summary',
              sessionId,
              role: 'assistant',
              content: summary
            });
          }
          if (timeoutTriggered) {
            sendWsJson(ws, {
              type: 'flash:cline_error',
              sessionId,
              error: `Cline task timeout after ${taskTimeoutMs}ms`
            });
          } else if (success) {
            const healResult = await runFlashBuildSelfHeal({
              ws,
              sessionId,
              session,
              clineBin,
              configDir,
              model,
              prompt,
              taskWorkdir,
              clineEnv
            });
            if (!healResult.success) {
              success = false;
              exitCode = 2;
              sendWsJson(ws, {
                type: 'flash:cline_error',
                sessionId,
                error: healResult.error || '草稿构建校验失败'
              });
            }
          }

          session.running = false;
          session.process = null;
          sendWsJson(ws, {
            type: 'flash:cline_done',
            sessionId,
            success,
            exitCode,
            elapsedMs,
            appId: taskAppId,
            draftChanged,
            draftFingerprint: draftAfter.scoped || draftAfter.preview || null
          });
          logAgentEvent('flash:cline_done', ws.user, {
            sessionId,
            appId: taskAppId,
            success,
            exitCode,
            elapsedMs,
            draftChanged,
            draftBytes: Number((draftAfter.scoped || draftAfter.preview)?.bytes || 0)
          });
        })().catch((error) => {
          session.running = false;
          session.process = null;
          const safeError = normalizeText(error?.message || 'Cline task post-check failed');
          sendWsJson(ws, { type: 'flash:cline_error', sessionId, error: safeError });
          sendWsJson(ws, {
            type: 'flash:cline_done',
            sessionId,
            success: false,
            exitCode: 2,
            elapsedMs: now() - startedAt
          });
          logAgentEvent('flash:cline_done', ws.user, {
            sessionId,
            success: false,
            exitCode: 2,
            elapsedMs: now() - startedAt,
            error: safeError
          });
        });
      });
    } catch (error) {
      const safeError = normalizeText(error?.message || 'Cline task failed');
      sendWsJson(ws, { type: 'flash:cline_error', sessionId, error: safeError });
      logAgentEvent('flash:cline_failed', ws.user, {
        sessionId,
        error: safeError.slice(0, 400)
      });
    }
  };

  return Object.freeze({
    createFlashCliSession,
    killFlashCliSessionProcess,
    runFlashClineTask
  });
};

module.exports = {
  createFlashClineService
};

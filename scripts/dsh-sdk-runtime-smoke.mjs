import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const arg = (name, fallback = '') => {
  const inline = process.argv.find((value) => value.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)
  const index = process.argv.indexOf(name)
  return index >= 0 ? String(process.argv[index + 1] || '') : fallback
}

const binInput = arg('--bin', process.env.DSH_BIN || '')
const homeInput = arg('--home', process.env.DSH_HOME || '')
const bin = binInput ? resolve(binInput) : ''
const home = homeInput ? resolve(homeInput) : ''
const provider = arg('--provider', process.env.DSH_PROVIDER || 'deepseek-official')
const model = arg('--model', process.env.DSH_MODEL || 'deepseek-chat')
const timeoutMs = Number(arg('--timeout-ms', '45000'))

if (!bin || !existsSync(bin)) throw new Error('DSH SDK smoke requires --bin=<absolute path to dsh/lib/bin.js>')
if (!home) throw new Error('DSH SDK smoke requires --home=<absolute writable DSH_HOME>')
if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('--timeout-ms must be a positive integer')

const child = spawn(process.execPath, [bin, '--profile', 'sdk'], {
  cwd: process.cwd(),
  env: { ...process.env, DSH_HOME: home },
  stdio: ['pipe', 'pipe', 'pipe']
})
child.stdout.setEncoding('utf8')
child.stderr.setEncoding('utf8')

let buffer = ''
let stderr = ''
let initialized = false
let shutdownSent = false
let completed = false
const frames = []
const finish = (code, message = '') => {
  if (completed) return
  completed = true
  clearTimeout(timer)
  try { child.kill() } catch { /* process already exited */ }
  if (code !== 0) {
    console.error(message || `DSH SDK smoke failed (exit ${code})`)
    process.exitCode = 1
    return
  }
  console.log(JSON.stringify({ ok: true, server: frames[0]?.result?.serverInfo || null, frameCount: frames.length, stderrBytes: Buffer.byteLength(stderr) }))
}
const timer = setTimeout(() => finish(2, 'DSH SDK smoke timed out'), timeoutMs)

child.stdout.on('data', (chunk) => {
  buffer += chunk
  let index
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index).trim()
    buffer = buffer.slice(index + 1)
    if (!line) continue
    let frame
    try { frame = JSON.parse(line) } catch { continue }
    frames.push(frame)
    if (frame.error) finish(1, `DSH SDK returned JSON-RPC error: ${frame.error.message || 'unknown error'}`)
    if (frame.id === 1) {
      if (!frame.result?.serverInfo?.name) finish(1, 'DSH SDK initialize response is missing serverInfo.name')
      initialized = true
      if (!shutdownSent) {
        shutdownSent = true
        try { child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'shutdown' }) + '\n') } catch { /* best-effort teardown */ }
      }
      // Some SDK builds intentionally omit a shutdown response. Initialization
      // is the smoke contract; finish here and force-kill the child in finish().
      finish(0)
    }
  }
})
child.stderr.on('data', (chunk) => { stderr += chunk })
child.on('error', (error) => finish(1, error.message))
child.on('exit', (code) => { if (!completed && code !== 0) finish(code || 1) })

child.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { cwd: process.cwd(), provider, model }
}) + '\n')

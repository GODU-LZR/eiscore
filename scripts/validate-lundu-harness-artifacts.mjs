import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const REQUIRED_PLUGIN_FILES = Object.freeze([
  ['eiscore-auth', 'client-plugins/eiscore-auth/lib/index.js'],
  ['digital-twin', 'client-plugins/digital-twin/lib/index.js'],
  ['enterprise-bi', 'client-plugins/enterprise-bi/lib/index.js']
])
export const REQUIRED_DSH_TOOL_FILES = Object.freeze([
  ['eiscore-tools', 'eiscore-tools.mjs'],
  ['eiscore-restricted', 'eiscore-restricted.cordis.yml']
])

export class LunduHarnessArtifactValidationError extends Error {
  constructor(issues) {
    super(`Lundu Harness artifact validation failed with ${issues.length} issue(s).`)
    this.name = 'LunduHarnessArtifactValidationError'
    this.issues = issues
  }
}

const fileExists = (path) => {
  try {
    const stat = lstatSync(path)
    return stat.isFile() && !stat.isSymbolicLink()
  } catch {
    return false
  }
}

export function validateLunduHarnessArtifacts({ harnessRoot, patchFile }) {
  const issues = []
  const root = String(harnessRoot || '').trim()
  const patch = String(patchFile || '').trim()
  if (!root) issues.push('LUNDU_HARNESS_ROOT: required')
  else if (!isAbsolute(root)) issues.push('LUNDU_HARNESS_ROOT: absolute path is required')
  if (!patch) issues.push('Harness patch file: required')
  else if (!fileExists(patch)) issues.push(`Harness patch file: regular file is required (${patch})`)

  if (root && isAbsolute(root)) {
    for (const [pluginId, relativePath] of REQUIRED_PLUGIN_FILES) {
      const absolutePath = resolve(root, relativePath)
      if (!fileExists(absolutePath)) issues.push(`${pluginId}: missing compiled plugin entry (${relativePath})`)
    }
    for (const [artifactId, relativePath] of REQUIRED_DSH_TOOL_FILES) {
      const absolutePath = resolve(root, relativePath)
      if (!fileExists(absolutePath)) issues.push(`${artifactId}: missing DSH tool artifact (${relativePath})`)
    }
  }

  if (patch && fileExists(patch)) {
    const source = readFileSync(patch, 'utf8')
    for (const [pluginId, relativePath] of REQUIRED_PLUGIN_FILES) {
      if (!source.includes(`client-plugins/${pluginId}/lib/index.js`)) {
        issues.push(`Harness patch: missing ${pluginId} client plugin (${relativePath})`)
      }
    }
  }
  if (issues.length) throw new LunduHarnessArtifactValidationError(issues)
  return { harnessRoot: root, patchFile: patch, plugins: REQUIRED_PLUGIN_FILES.map(([pluginId]) => pluginId) }
}

export async function validateLunduHarnessArtifactsRuntime(options) {
  const result = validateLunduHarnessArtifacts(options)
  const issues = []
  for (const [pluginId, relativePath] of REQUIRED_PLUGIN_FILES) {
    const absolutePath = resolve(result.harnessRoot, relativePath)
    try {
      const module = await import(`${pathToFileURL(absolutePath).href}?preflight=${Date.now()}`)
      if (typeof module.apply !== 'function') issues.push(`${pluginId}: compiled entry must export apply(ctx, config)`)
      if (!Array.isArray(module.inject)) issues.push(`${pluginId}: compiled entry must export inject[]`)
    } catch (error) {
      issues.push(`${pluginId}: compiled entry cannot be imported (${error?.message || 'unknown error'})`)
    }
  }
  try {
    const toolModule = await import(`${pathToFileURL(resolve(result.harnessRoot, 'eiscore-tools.mjs')).href}?preflight=${Date.now()}`)
    if (typeof toolModule.apply !== 'function') issues.push('eiscore-tools: compiled entry must export apply(ctx)')
    if (!Array.isArray(toolModule.capabilities) || toolModule.capabilities.length === 0) issues.push('eiscore-tools: capabilities[] is required')
  } catch (error) {
    issues.push(`eiscore-tools: compiled entry cannot be imported (${error?.message || 'unknown error'})`)
  }
  if (issues.length) throw new LunduHarnessArtifactValidationError(issues)
  return result
}

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const parseArg = (args, name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : ''
}
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const args = process.argv.slice(2)
  const harnessRoot = parseArg(args, '--harness-root') || process.env.LUNDU_HARNESS_ROOT || ''
  const patchFile = parseArg(args, '--patch') || resolve(repoRoot, 'deploy/lundu/dsh-web.patch.yml')
  try {
    const result = await validateLunduHarnessArtifactsRuntime({ harnessRoot, patchFile })
    console.log(`[ok] Lundu Harness artifacts are ready (${result.plugins.join(', ')})`)
  } catch (error) {
    console.error(`[fail] ${error.message}`)
    for (const issue of error.issues || []) console.error(`- ${issue}`)
    process.exit(1)
  }
}

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { VISUAL_PACKAGES } from './prepare-harness-visual-assets.mjs'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, index, all) => {
  if (arg.startsWith('--')) pairs.push([arg.slice(2), all[index + 1]])
  return pairs
}, []))
if (!args.baseline || !args['baseline-manifest'] || !args.output) throw new Error('Usage: --baseline <captured Harness root> --baseline-manifest <capture.json> --output <new package directory>')
const original = resolve(args.baseline)
const output = resolve(args.output)
if (existsSync(output)) throw new Error('Output must be a new directory')
if (execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: sourceRoot, encoding: 'utf8' }).trim()) throw new Error('Commit source before preparing package')
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim()
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')
function inventory(root, base = '') {
  return readdirSync(join(root, base), { withFileTypes: true }).flatMap(entry => {
    const path = base ? `${base}/${entry.name}` : entry.name
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.env') || entry.name.startsWith('.credentials')) throw new Error(`Unexpected private/runtime file: ${path}`)
    const stat = lstatSync(join(root, path))
    if (stat.isSymbolicLink()) throw new Error(`Unexpected symlink: ${path}`)
    return stat.isDirectory() ? inventory(root, path) : [{ path, sha256: hash(join(root, path)), size: stat.size }]
  })
}
const captured = JSON.parse(readFileSync(resolve(args['baseline-manifest']), 'utf8'))
const inherited = inventory(original).filter(item => item.path.startsWith('client-plugins/'))
for (const file of inherited) {
  if (captured.sourceFiles?.[file.path] !== file.sha256) throw new Error('Captured plugin provenance mismatch: ' + file.path)
}
for (const name of ['eiscore-auth', 'digital-twin', 'enterprise-bi']) {
  if (!existsSync(join(original, 'client-plugins', name, 'lib/index.js'))) throw new Error(`Missing existing ${name} artifact`)
}
const overlays = [
  ['deploy/lundu/dsh-web-runner.mjs', 'dsh-web-runner.mjs'],
  ['deploy/lundu/dsh-web.patch.yml', 'dsh-web.patch.yml'],
  ['agent-harness/dsh-web-defaults.mjs', 'dsh-web-defaults.mjs'],
  ['agent-harness/business-web-ui.mjs', 'business-web-ui.mjs'],
  ['agent-harness/visual-response-policy.mjs', 'visual-response-policy.mjs'],
  ...['business-ui.js', 'business-ui.css', 'visual-runtime.js', 'visual-runtime.css'].map(file => [`agent-harness/web-ui/${file}`, `web-ui/${file}`])
]
const vendorRoot = join(sourceRoot, 'agent-harness/web-ui/vendor')
const vendor = JSON.parse(readFileSync(join(vendorRoot, 'manifest.json'), 'utf8'))
if (vendor.length !== VISUAL_PACKAGES.length || new Set(vendor.map(item => item.file)).size !== VISUAL_PACKAGES.length) throw new Error('Unexpected vendor manifest')
for (const item of vendor) {
  const locked = VISUAL_PACKAGES.find(spec => spec.file === item.file)
  if (!locked || item.version !== locked.version || item.packageIntegrity !== locked.packageIntegrity
      || hash(join(vendorRoot, item.file)) !== locked.sha256
      || hash(join(vendorRoot, item.file + '.LICENSE.txt')) !== locked.licenseSha256) throw new Error('Vendor checksum mismatch: ' + item.file)
}
mkdirSync(output, { recursive: true })
cpSync(join(original, 'client-plugins'), join(output, 'client-plugins'), { recursive: true })
for (const [from, to] of overlays) {
  mkdirSync(dirname(join(output, to)), { recursive: true })
  cpSync(join(sourceRoot, from), join(output, to))
}
cpSync(vendorRoot, join(output, 'web-ui/vendor'), { recursive: true })
for (const match of readFileSync(join(output, 'dsh-web.patch.yml'), 'utf8').matchAll(/name:\s*'\/opt\/eiscore-harness\/([^']+)'/g)) {
  if (!existsSync(join(output, match[1]))) throw new Error('Patch module missing from package: ' + match[1])
}
const files = inventory(output)
const manifest = { schemaVersion: 1, sourceCommit, files, inherited, overlays: overlays.map(([source, path]) => ({ source, path, sha256: hash(join(sourceRoot, source)) })), vendor }
writeFileSync(join(output, 'harness-package.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify({ sourceCommit, output, files: files.length, manifestSha256: hash(join(output, 'harness-package.json')) }))

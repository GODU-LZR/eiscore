import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

// Generated libraries stay out of source control. Pin both archives and served bytes.
export const VISUAL_PACKAGES = [
  {
    package: 'echarts', version: '6.1.0', file: 'echarts.min.js', member: 'package/dist/echarts.min.js', license: 'Apache-2.0',
    archive: 'https://registry.npmjs.org/echarts/-/echarts-6.1.0.tgz',
    packageIntegrity: 'sha512-q0yaFPggC9FUdsWH4blavRWFmxdrIodbkoKNAjJudAI6CA9gNPxHtV2RcZNEepZVlk4yvBYkOkbk6HIVpIyHZA==',
    sha256: 'b66b25aeb4df84e33199dc21694014d336d222cbd9deb0e5a7c14bd6aa0d0fd0',
    licenseSha256: '634293835b43a6dd2094fa39182a3d9a6b9ca43b7fdb9ac354e8037af2a3093a'
  },
  {
    package: '@viz-js/viz', version: '3.31.0', file: 'viz-standalone.js', member: 'package/dist/viz-global.js', license: 'MIT',
    archive: 'https://registry.npmjs.org/@viz-js/viz/-/viz-3.31.0.tgz',
    packageIntegrity: 'sha512-r7zlQdRvcwvIpjHGgs+KNWHeE/P5/Dq7k8ZAKaMCbZqomxCBJV78gVuQYaHzFVca+kB0mX0fMW9UFevCOBG50A==',
    sha256: 'c9e0b310f9883910e01c66054b48b7ff4be3d8695141116635e72b0af152692e',
    licenseUrl: 'https://raw.githubusercontent.com/mdaines/viz-js/c8ce050d28eb0dc1ed1629ea32ab7f3dc117db0f/LICENSE',
    licenseSha256: 'f1fb91bf7cbcb42b2af56949e4fa909e1979d5b57c2826cabacdb4b631457720'
  }
]

const digest = (bytes, algorithm = 'sha256', encoding = 'hex') => createHash(algorithm).update(bytes).digest(encoding)
export function verifyArchive(bytes, spec) {
  assert.equal(`sha512-${digest(bytes, 'sha512', 'base64')}`, spec.packageIntegrity, `${spec.package}: package integrity mismatch`)
}

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(90000) })
  assert(response.ok, `visual dependency download failed (${response.status}): ${url}`)
  return Buffer.from(await response.arrayBuffer())
}

export async function prepareVisualAssets(output, { fromVendor } = {}) {
  const scratch = mkdtempSync(join(tmpdir(), 'eiscore-visual-assets-'))
  try {
    const cachedManifest = fromVendor ? JSON.parse(readFileSync(join(fromVendor, 'manifest.json'), 'utf8')) : null
    const records = []
    const prepared = []
    for (const [index, spec] of VISUAL_PACKAGES.entries()) {
      let content, license
      if (cachedManifest) {
        const entries = cachedManifest.filter((entry) => entry.package === spec.package)
        assert.equal(entries.length, 1, `${spec.package}: cache manifest entry missing or duplicated`)
        for (const key of ['version', 'file', 'license', 'packageIntegrity', 'sha256']) assert.equal(entries[0][key], spec[key], `${spec.package}: cache manifest ${key} mismatch`)
        content = readFileSync(join(fromVendor, spec.file))
        license = readFileSync(join(fromVendor, `${spec.file}.LICENSE.txt`))
      } else {
        const archive = await download(spec.archive)
        verifyArchive(archive, spec)
        const archiveFile = join(scratch, `${index}.tgz`)
        writeFileSync(archiveFile, archive)
        const extract = (member) => execFileSync('tar', ['-xOf', archiveFile, member], { maxBuffer: 16 * 1024 * 1024, windowsHide: true })
        content = extract(spec.member)
        const members = execFileSync('tar', ['-tzf', archiveFile], { encoding: 'utf8', windowsHide: true }).split(/\r?\n/)
        const licenseMember = members.find((member) => /^package\/license(?:\.(?:txt|md))?$/i.test(member))
        license = licenseMember ? extract(licenseMember) : await download(spec.licenseUrl)
      }
      assert.equal(digest(content), spec.sha256, `${spec.package}: served library checksum mismatch`)
      assert.equal(digest(license), spec.licenseSha256, `${spec.package}: license checksum mismatch`)
      prepared.push({ spec, content, license })
      records.push({ package: spec.package, version: spec.version, file: spec.file, license: spec.license, packageIntegrity: spec.packageIntegrity, sha256: spec.sha256, bytes: content.length })
    }
    mkdirSync(output, { recursive: true })
    for (const { spec, content, license } of prepared) {
      writeFileSync(join(output, spec.file), content)
      writeFileSync(join(output, `${spec.file}.LICENSE.txt`), license)
    }
    writeFileSync(join(output, 'manifest.json'), JSON.stringify(records, null, 2) + '\n')
    return records
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { output: { type: 'string' }, 'from-vendor': { type: 'string' } }, strict: true })
  const output = resolve(values.output || join(dirname(fileURLToPath(import.meta.url)), '../output/harness-visual-assets/vendor'))
  const records = await prepareVisualAssets(output, { fromVendor: values['from-vendor'] && resolve(values['from-vendor']) })
  assert.equal(JSON.parse(readFileSync(join(output, 'manifest.json'), 'utf8')).length, VISUAL_PACKAGES.length)
  console.log(JSON.stringify({ output, source: values['from-vendor'] ? 'verified-vendor-cache' : 'pinned-npm-archives', records }, null, 2))
}

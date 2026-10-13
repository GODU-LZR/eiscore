import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const nginx = readFileSync(resolve(import.meta.dirname, '../../nginx/conf.d/default.conf'), 'utf8')
const runner = readFileSync(resolve(import.meta.dirname, '../../agent-harness/dsh-web-runner.mjs'), 'utf8')
const embed = nginx.match(/location \/harness-embed\/ \{([\s\S]*?)\n    \}/)?.[1] || ''
const api = nginx.match(/location \/harness-embed-api\/ \{([\s\S]*?)\n    \}/)?.[1] || ''

assert.match(embed, /proxy_set_header X-Forwarded-Host \$http_host;/)
assert.match(api, /proxy_set_header X-Forwarded-Host \$http_host;/)
assert.doesNotMatch(embed, /proxy_set_header X-Forwarded-Host \$host;/)
assert.doesNotMatch(api, /proxy_set_header X-Forwarded-Host \$host;/)
assert.match(runner, /const setOrigin = \(target, origin\) =>/)
assert.match(runner, /target\.hostname = value\.hostname/)
assert.match(runner, /target\.port = value\.port/)
assert.match(runner, /const getHarnessAuthReturnPath = \(value = process\.env\.EISCORE_HARNESS_AUTH_RETURN_PATH\)/)
assert.match(runner, /target\.searchParams\.set\('dsh_return', `\$\{origin\}\$\{getHarnessAuthReturnPath\(\)\}`\)/)
assert.match(runner, /target\.searchParams\.set\('dsh_return', `\$\{authOrigin\}\$\{getHarnessAuthReturnPath\(\)\}`\)/)
assert.match(runner, /const rewriteAuthStart = request\.method === 'POST'[\s\S]*?const upstreamHeaders = rewriteAuthStart \? \{ \.\.\.headers, 'accept-encoding': 'identity' \} : headers/)
assert.match(runner, /delete responseHeaders\['content-encoding'\]/)

console.log('PASS: local Harness embed auth preserves the browser origin host and port')

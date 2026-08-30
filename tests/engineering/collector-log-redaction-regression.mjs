// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')

function readSource(filePath) {
  return readFileSync(resolve(repoRoot, filePath), 'utf8')
}

const logService = readSource('collector-desktop/EISCore.Collector/Services/ClientLogService.cs')
const apiClient = readSource('collector-desktop/EISCore.Collector/Services/CollectorApiClient.cs')
const crashDumpService = readSource('collector-desktop/EISCore.Collector/Services/CrashDumpService.cs')

for (const regexName of [
  'BearerTokenRegex',
  'SensitiveKeyValueRegex',
  'SensitiveJsonStringRegex',
  'SensitiveQueryRegex',
  'WindowsUserPathRegex',
  'EscapedWindowsUserPathRegex',
  'UnixUserPathRegex',
  'DataUrlRegex',
  'PhoneRegex',
  'IdCardRegex'
]) {
  assert.ok(logService.includes(regexName), `ClientLogService should define ${regexName}.`)
}

for (const sensitiveKey of [
  'authorizationCode',
  'authorization_code',
  'deviceToken',
  'device_token',
  'auth_token',
  'access_token',
  'refresh_token',
  'password',
  'cookie'
]) {
  assert.ok(
    logService.includes(sensitiveKey),
    `ClientLogService should recognize sensitive key ${sensitiveKey}.`
  )
}

assert.match(
  logService,
  /public static ClientLogEvent SanitizeEvent\(ClientLogEvent logEvent\)[\s\S]*Message = Sanitize\(logEvent\.Message\)[\s\S]*Stack = Sanitize\(logEvent\.Stack\)[\s\S]*MetadataJson = Sanitize\(logEvent\.MetadataJson\)/,
  'ClientLogService should sanitize full log events, including message, stack and metadata.'
)

assert.match(
  logService,
  /var logEvent = SanitizeEvent\(new ClientLogEvent/,
  'ClientLogService should sanitize before writing logs to SQLite.'
)

assert.match(
  apiClient,
  /var sanitizedEvents = events\.Select\(ClientLogService\.SanitizeEvent\)\.ToList\(\);[\s\S]*events = sanitizedEvents/,
  'CollectorApiClient should sanitize pending local logs again before uploading.'
)

assert.match(
  crashDumpService,
  /message = ClientLogService\.Sanitize\(exception\.Message\),[\s\S]*stack = ClientLogService\.Sanitize\(exception\.ToString\(\)\)/,
  'Crash dump manifests should keep sanitized exception message and stack.'
)

assert.ok(logService.includes('bearer\\\\s+'), 'ClientLogService should redact Bearer tokens.')
assert.ok(logService.includes('authorizationCode'), 'ClientLogService should redact authorizationCode fields.')
assert.ok(logService.includes('deviceToken'), 'ClientLogService should redact deviceToken fields.')
assert.ok(logService.includes('auth_token'), 'ClientLogService should redact auth_token fields.')
assert.ok(logService.includes('[A-Za-z]:\\\\\\\\Users\\\\\\\\'), 'ClientLogService should redact Windows profile paths.')
assert.ok(logService.includes('(?:/home|/Users)/'), 'ClientLogService should redact Unix and macOS profile paths.')

console.log('PASS: collector log redaction regression')

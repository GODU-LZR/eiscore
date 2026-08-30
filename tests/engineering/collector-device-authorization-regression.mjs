// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')

function readSource(filePath) {
  return readFileSync(resolve(repoRoot, filePath), 'utf8')
}

const apiClient = readSource('collector-desktop/EISCore.Collector/Services/CollectorApiClient.cs')
const authException = readSource('collector-desktop/EISCore.Collector/Services/DeviceAuthorizationException.cs')
const authEventArgs = readSource('collector-desktop/EISCore.Collector/Services/DeviceAuthorizationFailedEventArgs.cs')
const uploadProcessor = readSource('collector-desktop/EISCore.Collector/Services/UploadQueueProcessor.cs')
const mainWindow = readSource('collector-desktop/EISCore.Collector/MainWindow.xaml.cs')

assert.match(
  authException,
  /public sealed class DeviceAuthorizationException : HttpRequestException/,
  'Collector should use a dedicated exception for invalid device authorization.'
)

assert.match(
  authException,
  /public HttpStatusCode ResponseStatusCode \{ get; \}/,
  'DeviceAuthorizationException should expose the response status code.'
)

assert.match(
  apiClient,
  /response\.StatusCode is HttpStatusCode\.Unauthorized or HttpStatusCode\.Forbidden[\s\S]*throw new DeviceAuthorizationException/,
  'CollectorApiClient should translate 401/403 responses into DeviceAuthorizationException.'
)

assert.match(
  authEventArgs,
  /public DeviceAuthorizationException Exception \{ get; \}/,
  'Upload queue authorization failure events should carry the authorization exception.'
)

assert.match(
  uploadProcessor,
  /public event EventHandler<DeviceAuthorizationFailedEventArgs>\? AuthorizationFailed;/,
  'UploadQueueProcessor should notify the shell when device authorization fails.'
)

assert.match(
  uploadProcessor,
  /catch \(DeviceAuthorizationException ex\)[\s\S]*UploadQueueStatus\.Queued[\s\S]*incrementRetry: false[\s\S]*"collector_device_authorization_invalid"[\s\S]*AuthorizationFailed\?\.Invoke/,
  'UploadQueueProcessor should requeue the current item without consuming retries and raise authorization failure.'
)

assert.match(
  mainWindow,
  /_uploadProcessor\.AuthorizationFailed \+= UploadProcessor_AuthorizationFailed;/,
  'MainWindow should subscribe to upload queue authorization failures.'
)

assert.match(
  mainWindow,
  /catch \(DeviceAuthorizationException ex\)[\s\S]*await HandleDeviceAuthorizationInvalidAsync\(ex\);/,
  'MainWindow should handle authorization failures from heartbeat, config sync, or log flush.'
)

assert.match(
  mainWindow,
  /private async Task HandleDeviceAuthorizationInvalidAsync\(DeviceAuthorizationException ex\)[\s\S]*_isDeviceAuthorizationInvalid = true;[\s\S]*_deviceToken = "";[\s\S]*_config\.EncryptedDeviceToken = "";[\s\S]*await _configurationService\.SaveAsync\(_config\);/,
  'MainWindow should clear and persist the invalid local device token.'
)

assert.match(
  mainWindow,
  /_heartbeatTimer\.Stop\(\);[\s\S]*await _uploadProcessor\.StopAsync\(\);[\s\S]*await _logProcessor\.StopAsync\(\);/,
  'MainWindow should pause authorized background work when device authorization is invalid.'
)

assert.match(
  mainWindow,
  /SettingsOverlay\.Visibility = Visibility\.Visible;[\s\S]*SetStatus\("设备授权已失效，请重新输入设备授权码并绑定。"\);/,
  'MainWindow should guide the operator back to the binding settings.'
)

assert.match(
  mainWindow,
  /"collector_device_authorization_invalid"/,
  'MainWindow should log the authorization invalid event locally.'
)

assert.match(
  mainWindow,
  /_isDeviceAuthorizationInvalid = false;[\s\S]*StartAuthorizedBackgroundServices\(\);/,
  'Successful device binding should clear the invalid flag and restart authorized services.'
)

assert.match(
  mainWindow,
  /private void StartAuthorizedBackgroundServices\(\)[\s\S]*_uploadProcessor\.Start\(\);[\s\S]*_logProcessor\.Start\(\);[\s\S]*_heartbeatTimer\.Start\(\);/,
  'Authorized background services should be restarted together after binding.'
)

console.log('PASS: collector device authorization regression')

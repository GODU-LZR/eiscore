using System.Text.Json;
using EISCore.Collector.Models;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace EISCore.Collector.Services;

public sealed class WebLoginUserChangedEventArgs : EventArgs
{
    public WebLoginUserChangedEventArgs(WebLoginUserSnapshot user)
    {
        User = user;
    }

    public WebLoginUserSnapshot User { get; }
}

public sealed class WebViewIdentityBridge
{
    public event EventHandler<WebLoginUserChangedEventArgs>? IdentityChanged;

    public async Task InitializeAsync(WebView2 browser, CancellationToken cancellationToken = default)
    {
        await browser.EnsureCoreWebView2Async();
        cancellationToken.ThrowIfCancellationRequested();

        browser.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;
        browser.CoreWebView2.NavigationCompleted += CoreWebView2_NavigationCompleted;
        await browser.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(IdentityProbeScript);
    }

    private async void CoreWebView2_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (!e.IsSuccess || sender is not CoreWebView2 webView) return;

        try
        {
            await webView.ExecuteScriptAsync("window.__eiscoreCollectorIdentityPublish && window.__eiscoreCollectorIdentityPublish();");
        }
        catch
        {
            // The next localStorage change or polling tick will retry the identity probe.
        }
    }

    private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            using var document = JsonDocument.Parse(e.WebMessageAsJson);
            var root = document.RootElement;
            if (!GetString(root, "source").Equals("eiscoreCollectorIdentity", StringComparison.Ordinal))
            {
                return;
            }

            var user = new WebLoginUserSnapshot
            {
                UserId = GetString(root, "userId"),
                Username = GetString(root, "username"),
                DisplayName = GetString(root, "displayName"),
                Role = GetString(root, "role")
            };

            if (string.IsNullOrWhiteSpace(user.UserId)
                && string.IsNullOrWhiteSpace(user.Username)
                && string.IsNullOrWhiteSpace(user.DisplayName))
            {
                return;
            }

            IdentityChanged?.Invoke(this, new WebLoginUserChangedEventArgs(user));
        }
        catch
        {
            // Identity sync is best-effort; malformed page messages must not break the collector shell.
        }
    }

    private static string GetString(JsonElement root, string propertyName)
    {
        return root.TryGetProperty(propertyName, out var element) && element.ValueKind == JsonValueKind.String
            ? element.GetString() ?? ""
            : "";
    }

    private const string IdentityProbeScript = """
        (function () {
          if (window.__eiscoreCollectorIdentityInstalled) return;
          window.__eiscoreCollectorIdentityInstalled = true;

          function parseJson(value) {
            if (!value || typeof value !== 'string') return null;
            try { return JSON.parse(value); } catch (_) { return null; }
          }

          function firstNonEmpty() {
            for (var i = 0; i < arguments.length; i += 1) {
              var value = arguments[i];
              if (value === undefined || value === null) continue;
              var text = String(value).trim();
              if (text) return text;
            }
            return '';
          }

          var userStorageKeys = ['user_info', 'userInfo', 'current_user', 'currentUser', 'eiscore_user', 'eiscore_user_info'];
          var tokenStorageKeys = ['auth_token', 'token', 'access_token', 'eiscore_auth_token'];

          function availableStorages() {
            var stores = [];
            try { if (window.localStorage) stores.push(window.localStorage); } catch (_) {}
            try { if (window.sessionStorage) stores.push(window.sessionStorage); } catch (_) {}
            return stores;
          }

          function readStorageText(keys) {
            var stores = availableStorages();
            for (var storeIndex = 0; storeIndex < stores.length; storeIndex += 1) {
              for (var keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
                try {
                  var value = stores[storeIndex].getItem(keys[keyIndex]) || '';
                  if (String(value).trim()) return value;
                } catch (_) {}
              }
            }
            return '';
          }

          function readStorageJson(keys) {
            var raw = readStorageText(keys);
            return parseJson(raw) || {};
          }

          function isIdentityStorageKey(key) {
            return userStorageKeys.indexOf(key) >= 0 || tokenStorageKeys.indexOf(key) >= 0;
          }

          function readAuthToken() {
            var raw = readStorageText(tokenStorageKeys);
            var parsed = parseJson(raw);
            return firstNonEmpty(parsed && parsed.token, raw);
          }

          function decodeJwtPayload(token) {
            if (!token || typeof token !== 'string') return null;
            var parts = token.split('.');
            if (parts.length !== 3) return null;
            try {
              var normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
              while (normalized.length % 4) normalized += '=';
              var json = decodeURIComponent(atob(normalized).split('').map(function (ch) {
                return '%' + ('00' + ch.charCodeAt(0).toString(16)).slice(-2);
              }).join(''));
              return JSON.parse(json);
            } catch (_) {
              return null;
            }
          }

          function readUserInfo() {
            return readStorageJson(userStorageKeys);
          }

          var lastSnapshotKey = '';

          function publishIdentity() {
            try {
              if (!window.chrome || !window.chrome.webview) return;
              var user = readUserInfo();
              var payload = decodeJwtPayload(readAuthToken()) || {};
              var username = firstNonEmpty(user.username, payload.username, payload.sub);
              var displayName = firstNonEmpty(user.full_name, user.fullName, user.display_name, user.displayName, user.name, username, payload.full_name, payload.fullName, payload.name);
              var userId = firstNonEmpty(
                user.id,
                user.user_id,
                user.userId,
                user.uid,
                user.employee_id,
                user.employeeId,
                payload.user_id,
                payload.userId,
                payload.uid,
                payload.employee_id,
                payload.employeeId,
                username,
                payload.sub
              );
              var role = firstNonEmpty(
                user.sop_role,
                user.sopRole,
                user.job_role,
                user.jobRole,
                user.app_role,
                user.appRole,
                user.role,
                user.role_name,
                user.roleName,
                user.role_code,
                user.roleCode,
                user.db_role,
                user.dbRole,
                user.role_id,
                user.roleId,
                payload.sop_role,
                payload.sopRole,
                payload.job_role,
                payload.jobRole,
                payload.app_role,
                payload.appRole,
                payload.role,
                payload.role_code,
                payload.roleCode,
                payload.db_role,
                payload.dbRole,
                payload.role_id,
                payload.roleId
              );
              var snapshot = {
                source: 'eiscoreCollectorIdentity',
                userId: userId,
                username: username,
                displayName: displayName,
                role: role,
                url: location.href,
                route: location.hash || location.pathname,
                createdAt: new Date().toISOString()
              };
              if (!snapshot.userId && !snapshot.username && !snapshot.displayName) return;
              var key = JSON.stringify({
                userId: snapshot.userId,
                username: snapshot.username,
                displayName: snapshot.displayName,
                role: snapshot.role
              });
              if (key === lastSnapshotKey) return;
              lastSnapshotKey = key;
              window.chrome.webview.postMessage(snapshot);
            } catch (_) {}
          }

          window.__eiscoreCollectorIdentityPublish = publishIdentity;

          function schedulePublish() {
            window.setTimeout(publishIdentity, 0);
          }

          function installStorageHooks(storage) {
            try {
              if (!storage || storage.__eiscoreCollectorIdentityHooked) return;
              storage.__eiscoreCollectorIdentityHooked = true;
              var originalSetItem = storage.setItem.bind(storage);
              var originalRemoveItem = storage.removeItem.bind(storage);
              var originalClear = storage.clear.bind(storage);
              storage.setItem = function (key, value) {
                var result = originalSetItem(key, value);
                if (isIdentityStorageKey(key)) schedulePublish();
                return result;
              };
              storage.removeItem = function (key) {
                var result = originalRemoveItem(key);
                if (isIdentityStorageKey(key)) schedulePublish();
                return result;
              };
              storage.clear = function () {
                var result = originalClear();
                schedulePublish();
                return result;
              };
            } catch (_) {}
          }

          availableStorages().forEach(installStorageHooks);

          window.addEventListener('storage', function (event) {
            if (!event || event.key === null || isIdentityStorageKey(event.key)) schedulePublish();
          });
          window.addEventListener('focus', schedulePublish);
          window.addEventListener('DOMContentLoaded', schedulePublish);
          window.setTimeout(publishIdentity, 250);
          window.setInterval(publishIdentity, 5000);
        })();
        """;
}

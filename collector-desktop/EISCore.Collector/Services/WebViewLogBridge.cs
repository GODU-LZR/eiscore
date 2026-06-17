using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace EISCore.Collector.Services;

public sealed class WebViewLogBridge
{
    private readonly ClientLogService _logService;

    public WebViewLogBridge(ClientLogService logService)
    {
        _logService = logService;
    }

    public async Task InitializeAsync(WebView2 browser, CancellationToken cancellationToken = default)
    {
        await browser.EnsureCoreWebView2Async();
        cancellationToken.ThrowIfCancellationRequested();

        var version = CoreWebView2Environment.GetAvailableBrowserVersionString();
        _logService.UpdateContext(await new ConfigurationService().LoadAsync(cancellationToken), version);

        browser.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;
        browser.CoreWebView2.NavigationCompleted += CoreWebView2_NavigationCompleted;
        browser.CoreWebView2.ProcessFailed += CoreWebView2_ProcessFailed;
        await browser.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(InjectionScript);
    }

    private void CoreWebView2_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (!e.IsSuccess)
        {
            _ = _logService.LogAsync(
                "error",
                "webview_navigation_error",
                $"WebView 导航失败：{e.WebErrorStatus}",
                statusCode: (int)e.HttpStatusCode);
        }
    }

    private void CoreWebView2_ProcessFailed(object? sender, CoreWebView2ProcessFailedEventArgs e)
    {
        _ = _logService.LogAsync(
            "error",
            "webview_process_failed",
            $"WebView 进程异常：{e.ProcessFailedKind}",
            metadataJson: $$"""{"process_failed_kind":"{{e.ProcessFailedKind}}"}""");
    }

    private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            using var document = JsonDocument.Parse(e.WebMessageAsJson);
            var root = document.RootElement;
            if (!TryGetString(root, "source").Equals("eiscoreCollectorLog", StringComparison.Ordinal))
            {
                return;
            }

            var level = TryGetString(root, "level", "error");
            var eventType = TryGetString(root, "eventType", "js_error");
            var message = TryGetString(root, "message");
            var stack = TryGetString(root, "stack");
            var route = TryGetString(root, "route");
            var url = TryGetString(root, "url");
            var requestUrl = TryGetString(root, "requestUrl");
            int? statusCode = root.TryGetProperty("statusCode", out var statusElement) && statusElement.TryGetInt32(out var status)
                ? status
                : null;

            _ = _logService.LogAsync(
                level,
                eventType,
                message,
                stack,
                route: route,
                url: url,
                requestUrl: requestUrl,
                statusCode: statusCode,
                metadataJson: e.WebMessageAsJson);
        }
        catch (Exception ex)
        {
            _ = _logService.LogAsync("error", "webview_message_parse_error", "WebView 日志消息解析失败", ex.ToString());
        }
    }

    private static string TryGetString(JsonElement root, string propertyName, string fallback = "")
    {
        return root.TryGetProperty(propertyName, out var element) && element.ValueKind == JsonValueKind.String
            ? element.GetString() ?? fallback
            : fallback;
    }

    private const string InjectionScript = """
        (function () {
          if (window.__eiscoreCollectorLogInstalled) return;
          window.__eiscoreCollectorLogInstalled = true;

          function post(payload) {
            try {
              if (!window.chrome || !window.chrome.webview) return;
              window.chrome.webview.postMessage(Object.assign({
                source: 'eiscoreCollectorLog',
                url: location.href,
                route: location.hash || location.pathname,
                createdAt: new Date().toISOString()
              }, payload || {}));
            } catch (_) {}
          }

          function normalizeError(error) {
            if (!error) return { message: 'Unknown error', stack: '' };
            if (typeof error === 'string') return { message: error, stack: '' };
            return {
              message: error.message || String(error),
              stack: error.stack || ''
            };
          }

          window.addEventListener('error', function (event) {
            if (event && event.target && event.target !== window) {
              post({
                level: 'error',
                eventType: 'resource_error',
                message: '资源加载失败',
                requestUrl: event.target.src || event.target.href || '',
                stack: ''
              });
              return;
            }
            var normalized = normalizeError(event.error || event.message);
            post({
              level: 'error',
              eventType: 'js_error',
              message: normalized.message,
              stack: normalized.stack
            });
          }, true);

          window.addEventListener('unhandledrejection', function (event) {
            var normalized = normalizeError(event.reason);
            post({
              level: 'error',
              eventType: 'promise_error',
              message: normalized.message,
              stack: normalized.stack
            });
          });

          ['error', 'warn'].forEach(function (level) {
            var original = console[level];
            console[level] = function () {
              var args = Array.prototype.slice.call(arguments);
              post({
                level: level === 'warn' ? 'warn' : 'error',
                eventType: level === 'warn' ? 'console_warn' : 'console_error',
                message: args.map(function (item) {
                  try { return typeof item === 'string' ? item : JSON.stringify(item); }
                  catch (_) { return String(item); }
                }).join(' '),
                stack: ''
              });
              return original.apply(console, arguments);
            };
          });

          var originalFetch = window.fetch;
          if (originalFetch) {
            window.fetch = function () {
              var requestUrl = arguments[0] && arguments[0].url ? arguments[0].url : String(arguments[0] || '');
              return originalFetch.apply(this, arguments).then(function (response) {
                if (!response.ok) {
                  post({
                    level: 'error',
                    eventType: 'http_error',
                    message: 'fetch 请求失败：' + response.status,
                    requestUrl: requestUrl,
                    statusCode: response.status
                  });
                }
                return response;
              }).catch(function (error) {
                var normalized = normalizeError(error);
                post({
                  level: 'error',
                  eventType: 'http_error',
                  message: normalized.message,
                  stack: normalized.stack,
                  requestUrl: requestUrl
                });
                throw error;
              });
            };
          }

          var originalOpen = XMLHttpRequest.prototype.open;
          var originalSend = XMLHttpRequest.prototype.send;
          XMLHttpRequest.prototype.open = function (method, url) {
            this.__eiscoreRequestUrl = url;
            return originalOpen.apply(this, arguments);
          };
          XMLHttpRequest.prototype.send = function () {
            this.addEventListener('loadend', function () {
              if (this.status >= 400) {
                post({
                  level: 'error',
                  eventType: 'http_error',
                  message: 'XHR 请求失败：' + this.status,
                  requestUrl: this.__eiscoreRequestUrl || '',
                  statusCode: this.status
                });
              }
            });
            return originalSend.apply(this, arguments);
          };
        })();
        """;
}

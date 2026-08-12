using System.Text.Json;
using EISCore.Collector.Models;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace EISCore.Collector.Services;

public sealed class WebViewLogBridge
{
    private readonly ClientLogService _logService;
    private readonly object _uploadOwnerLock = new();
    private UploadOwnerContext _currentUploadOwner = new();
    private string _trustedServerBaseUrl = "";
    private string _lastRejectedOriginKey = "";

    public WebViewLogBridge(ClientLogService logService)
    {
        _logService = logService;
    }

    public event EventHandler<UploadOwnerContext>? UploadOwnerChanged;

    public UploadOwnerContext CurrentUploadOwner
    {
        get
        {
            lock (_uploadOwnerLock)
            {
                return _currentUploadOwner.Clone();
            }
        }
    }

    public async Task InitializeAsync(WebView2 browser, AppConfig config, CancellationToken cancellationToken = default)
    {
        UpdateTrustedServerBaseUrl(config.ServerBaseUrl);
        var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: AppPaths.WebViewUserDataDirectory);
        await browser.EnsureCoreWebView2Async(environment);
        cancellationToken.ThrowIfCancellationRequested();

        var version = CoreWebView2Environment.GetAvailableBrowserVersionString();
        config.WebViewVersion = version;
        _logService.UpdateContext(config, version);

        browser.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;
        browser.CoreWebView2.NavigationCompleted += CoreWebView2_NavigationCompleted;
        browser.CoreWebView2.WebResourceResponseReceived += CoreWebView2_WebResourceResponseReceived;
        browser.CoreWebView2.ProcessFailed += CoreWebView2_ProcessFailed;
        await browser.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(InjectionScript);
    }

    public void UpdateTrustedServerBaseUrl(string serverBaseUrl)
    {
        _trustedServerBaseUrl = (serverBaseUrl ?? "").Trim();
    }

    private void CoreWebView2_NavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (!e.IsSuccess)
        {
            var sourceUrl = sender is CoreWebView2 webView ? webView.Source : "";
            var webErrorStatus = e.WebErrorStatus.ToString();
            var navigationFailure = CollectorWebViewNavigationFailurePolicy.Describe(
                sourceUrl,
                webErrorStatus,
                (int)e.HttpStatusCode);
            CollectorBackgroundTask.Forget(_logService.LogAsync(
                "error",
                "webview_navigation_error",
                navigationFailure.DiagnosticMessage,
                url: sourceUrl,
                statusCode: (int)e.HttpStatusCode,
                metadataJson: ClientLogMetadata.Serialize(new
                {
                    webErrorStatus,
                    httpStatusCode = (int)e.HttpStatusCode,
                    failureKind = navigationFailure.FailureKind,
                    diagnosticMessage = navigationFailure.DiagnosticMessage
                })));
        }
    }

    private void CoreWebView2_ProcessFailed(object? sender, CoreWebView2ProcessFailedEventArgs e)
    {
        CollectorBackgroundTask.Forget(_logService.LogAsync(
            "error",
            "webview_process_failed",
            $"WebView 进程异常：{e.ProcessFailedKind}",
            metadataJson: ClientLogMetadata.Serialize(new { processFailedKind = e.ProcessFailedKind.ToString() })));
    }

    private void CoreWebView2_WebResourceResponseReceived(object? sender, CoreWebView2WebResourceResponseReceivedEventArgs e)
    {
        var statusCode = e.Response.StatusCode;
        if (!WebViewLogPolicy.ShouldLogHttpStatus(statusCode)
            || WebViewLogPolicy.ShouldIgnoreRequestUrl(e.Request.Uri ?? ""))
        {
            return;
        }

        CollectorBackgroundTask.Forget(_logService.LogAsync(
            WebViewLogPolicy.ResolveHttpLevel(statusCode),
            "webview_http_error",
            $"WebView 网络响应异常：{statusCode} {e.Response.ReasonPhrase}",
            requestUrl: e.Request.Uri ?? "",
            statusCode: statusCode,
            metadataJson: ClientLogMetadata.Serialize(new
            {
                method = e.Request.Method,
                reasonPhrase = e.Response.ReasonPhrase
            })));
    }

    private void CoreWebView2_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            using var document = JsonDocument.Parse(e.WebMessageAsJson);
            var root = document.RootElement;
            var source = ReadString(root, "source");
            var isCollectorContext = source.Equals("eiscoreCollectorContext", StringComparison.Ordinal);
            var isCollectorLog = source.Equals("eiscoreCollectorLog", StringComparison.Ordinal);
            if (!isCollectorContext && !isCollectorLog)
            {
                return;
            }

            var url = ReadString(root, "url");
            var originState = CollectorWebViewMessageOriginPolicy.Evaluate(_trustedServerBaseUrl, e.Source, url);
            if (!originState.CanAccept)
            {
                LogRejectedMessageOriginOnce(originState, source);
                return;
            }

            if (isCollectorContext)
            {
                CaptureUploadOwner(root, allowClear: true);
                return;
            }

            CaptureUploadOwner(root, allowClear: false);
            var level = ReadString(root, "level", "error");
            var eventType = ReadString(root, "eventType", "js_error");
            var message = ReadString(root, "message");
            var stack = ReadString(root, "stack");
            var route = ReadString(root, "route");
            var requestUrl = ReadString(root, "requestUrl");
            var appModule = ReadString(root, "appModule");
            var traceId = ReadString(root, "traceId");
            var aiImportBatchId = ReadString(root, "aiImportBatchId");
            var sourceFileHash = ReadString(root, "sourceFileHash");
            var userId = ReadString(root, "userId");
            var username = ReadString(root, "username");
            var role = ReadString(root, "role");
            var statusCode = WebViewMessagePolicy.ReadStatusCode(root);

            CollectorBackgroundTask.Forget(_logService.LogAsync(
                level,
                eventType,
                message,
                stack,
                route: route,
                url: url,
                requestUrl: requestUrl,
                statusCode: statusCode,
                metadataJson: e.WebMessageAsJson,
                appModule: appModule,
                traceId: traceId,
                aiImportBatchId: aiImportBatchId,
                sourceFileHash: sourceFileHash,
                userId: userId,
                username: username,
                role: role));
        }
        catch (Exception ex)
        {
            CollectorBackgroundTask.Forget(_logService.LogAsync("error", "webview_message_parse_error", "WebView 日志消息解析失败", ex.ToString()));
        }
    }

    private static string ReadString(JsonElement root, string propertyName, string fallback = "")
    {
        return WebViewMessagePolicy.ReadString(root, propertyName, fallback);
    }

    private static string ReadContextString(JsonElement root, string propertyName, string fallback = "")
    {
        return WebViewMessagePolicy.ReadContextString(root, propertyName, fallback);
    }

    private void LogRejectedMessageOriginOnce(CollectorWebViewMessageOriginResult originState, string messageSource)
    {
        var key = $"{originState.Reason}:{originState.TrustedOrigin}:{originState.MessageOrigin}:{messageSource}";
        if (string.Equals(_lastRejectedOriginKey, key, StringComparison.Ordinal))
        {
            return;
        }

        _lastRejectedOriginKey = key;
        CollectorBackgroundTask.Forget(_logService.LogAsync(
            "warn",
            "webview_message_untrusted_origin",
            "已拒绝非可信来源的 WebView 消息。",
            metadataJson: ClientLogMetadata.Serialize(new
            {
                originState.Reason,
                originState.TrustedOrigin,
                originState.MessageOrigin,
                messageSource
            })));
    }

    private void CaptureUploadOwner(JsonElement root, bool allowClear)
    {
        var next = new UploadOwnerContext
        {
            UserId = FirstNonEmpty(
                ReadString(root, "userId"),
                ReadString(root, "user_id"),
                ReadString(root, "id"),
                ReadString(root, "uid"),
                ReadString(root, "sub"),
                ReadString(root, "employeeId"),
                ReadString(root, "employee_id"),
                ReadString(root, "employeeNo"),
                ReadString(root, "employee_no"),
                ReadString(root, "staffId"),
                ReadString(root, "staff_id"),
                ReadString(root, "staffNo"),
                ReadString(root, "staff_no"),
                ReadString(root, "workerId"),
                ReadString(root, "worker_id"),
                ReadFirstNestedContextString(root,
                    new[] { "user", "id" },
                    new[] { "user", "userId" },
                    new[] { "user", "user_id" },
                    new[] { "currentUser", "id" },
                    new[] { "currentUser", "userId" },
                    new[] { "current_user", "id" },
                    new[] { "data", "user", "id" },
                    new[] { "data", "user", "userId" },
                    new[] { "profile", "id" },
                    new[] { "profile", "employeeNo" },
                    new[] { "user_metadata", "id" },
                    new[] { "userMetadata", "id" })),
            Username = FirstNonEmpty(
                ReadString(root, "username"),
                ReadString(root, "name"),
                ReadString(root, "displayName"),
                ReadString(root, "display_name"),
                ReadString(root, "realName"),
                ReadString(root, "real_name"),
                ReadString(root, "fullName"),
                ReadString(root, "full_name"),
                ReadString(root, "employeeName"),
                ReadString(root, "employee_name"),
                ReadString(root, "staffName"),
                ReadString(root, "staff_name"),
                ReadString(root, "nickName"),
                ReadString(root, "nick_name"),
                ReadString(root, "nickname"),
                ReadFirstNestedContextString(root,
                    new[] { "user", "username" },
                    new[] { "user", "name" },
                    new[] { "user", "displayName" },
                    new[] { "currentUser", "username" },
                    new[] { "currentUser", "name" },
                    new[] { "current_user", "username" },
                    new[] { "data", "user", "username" },
                    new[] { "data", "user", "name" },
                    new[] { "profile", "username" },
                    new[] { "profile", "displayName" },
                    new[] { "user_metadata", "name" },
                    new[] { "userMetadata", "name" },
                    new[] { "email" })),
            Role = FirstNonEmpty(
                ReadContextString(root, "role"),
                ReadContextString(root, "roles"),
                ReadContextString(root, "roleName"),
                ReadContextString(root, "role_name"),
                ReadContextString(root, "appRole"),
                ReadContextString(root, "app_role"),
                ReadContextString(root, "sopRole"),
                ReadContextString(root, "sop_role"),
                ReadContextString(root, "dbRole"),
                ReadContextString(root, "db_role"),
                ReadContextString(root, "position"),
                ReadContextString(root, "positionName"),
                ReadContextString(root, "position_name"),
                ReadContextString(root, "post"),
                ReadContextString(root, "postName"),
                ReadContextString(root, "post_name"),
                ReadContextString(root, "jobTitle"),
                ReadContextString(root, "job_title"),
                ReadContextString(root, "departmentName"),
                ReadContextString(root, "department_name"),
                ReadContextString(root, "department"),
                ReadFirstNestedContextString(root,
                    new[] { "user", "role" },
                    new[] { "user", "roles" },
                    new[] { "user", "roleName" },
                    new[] { "user", "appRole" },
                    new[] { "data", "user", "role" },
                    new[] { "data", "user", "roles" },
                    new[] { "profile", "role" },
                    new[] { "profile", "roles" },
                    new[] { "user_metadata", "roles" },
                    new[] { "userMetadata", "roles" })),
            TenantId = FirstNonEmpty(
                ReadString(root, "tenantId"),
                ReadString(root, "tenant_id"),
                ReadString(root, "enterpriseId"),
                ReadString(root, "enterprise_id"),
                ReadString(root, "enterpriseCode"),
                ReadString(root, "enterprise_code"),
                ReadString(root, "companyId"),
                ReadString(root, "company_id"),
                ReadString(root, "companyCode"),
                ReadString(root, "company_code"),
                ReadString(root, "orgId"),
                ReadString(root, "org_id"),
                ReadString(root, "orgCode"),
                ReadString(root, "org_code"),
                ReadString(root, "organizationId"),
                ReadString(root, "organization_id"),
                ReadString(root, "organizationCode"),
                ReadString(root, "organization_code"),
                ReadFirstNestedContextString(root,
                    new[] { "tenant", "id" },
                    new[] { "tenant", "code" },
                    new[] { "enterprise", "id" },
                    new[] { "enterprise", "code" },
                    new[] { "user", "tenantId" },
                    new[] { "user", "enterpriseCode" },
                    new[] { "data", "tenant", "id" },
                    new[] { "data", "enterprise", "code" },
                    new[] { "data", "user", "tenantId" })),
            TenantName = FirstNonEmpty(
                ReadString(root, "tenantName"),
                ReadString(root, "tenant_name"),
                ReadString(root, "enterpriseName"),
                ReadString(root, "enterprise_name"),
                ReadString(root, "companyName"),
                ReadString(root, "company_name"),
                ReadString(root, "orgName"),
                ReadString(root, "org_name"),
                ReadString(root, "organizationName"),
                ReadString(root, "organization_name"),
                ReadFirstNestedContextString(root,
                    new[] { "tenant", "name" },
                    new[] { "enterprise", "name" },
                    new[] { "company", "name" },
                    new[] { "user", "tenantName" },
                    new[] { "data", "tenant", "name" },
                    new[] { "data", "enterprise", "name" })),
            DepartmentId = FirstNonEmpty(
                ReadString(root, "departmentId"),
                ReadString(root, "department_id"),
                ReadString(root, "departmentCode"),
                ReadString(root, "department_code"),
                ReadString(root, "deptId"),
                ReadString(root, "dept_id"),
                ReadString(root, "deptCode"),
                ReadString(root, "dept_code"),
                ReadFirstNestedContextString(root,
                    new[] { "department", "id" },
                    new[] { "department", "code" },
                    new[] { "dept", "id" },
                    new[] { "dept", "code" },
                    new[] { "user", "departmentId" },
                    new[] { "data", "user", "departmentId" })),
            DepartmentName = FirstNonEmpty(
                ReadString(root, "departmentName"),
                ReadString(root, "department_name"),
                ReadContextString(root, "department"),
                ReadString(root, "deptName"),
                ReadString(root, "dept_name"),
                ReadContextString(root, "dept"),
                ReadFirstNestedContextString(root,
                    new[] { "department", "name" },
                    new[] { "dept", "name" },
                    new[] { "user", "departmentName" },
                    new[] { "data", "user", "departmentName" })),
            LoginContextSource = FirstNonEmpty(
                ReadString(root, "loginContextSource"),
                ReadString(root, "contextSource")),
            LastSyncedAt = ParseTimestamp(ReadString(root, "createdAt")) ?? DateTimeOffset.Now
        };

        if (!next.HasContext)
        {
            next.LoginContextSource = "";
            next.LastSyncedAt = null;
        }

        if (!next.HasContext && !allowClear) return;

        UploadOwnerContext snapshot;
        lock (_uploadOwnerLock)
        {
            if (UploadOwnerEquals(_currentUploadOwner, next))
            {
                return;
            }

            _currentUploadOwner = next;
            snapshot = _currentUploadOwner.Clone();
        }

        UploadOwnerChanged?.Invoke(this, snapshot);
    }

    private static string ReadFirstNestedContextString(JsonElement root, params string[][] paths)
    {
        foreach (var path in paths)
        {
            var value = ReadNestedContextString(root, path);
            if (!string.IsNullOrWhiteSpace(value)) return value;
        }

        return "";
    }

    private static string ReadNestedContextString(JsonElement root, IReadOnlyList<string> path)
    {
        if (path.Count == 0) return "";

        var current = root;
        for (var index = 0; index < path.Count - 1; index++)
        {
            if (current.ValueKind != JsonValueKind.Object || !current.TryGetProperty(path[index], out var next))
            {
                return "";
            }

            current = next;
        }

        return current.ValueKind == JsonValueKind.Object
            ? ReadContextString(current, path[^1])
            : "";
    }

    private static bool UploadOwnerEquals(UploadOwnerContext left, UploadOwnerContext right)
    {
        return string.Equals(left.UserId ?? "", right.UserId ?? "", StringComparison.Ordinal)
            && string.Equals(left.Username ?? "", right.Username ?? "", StringComparison.Ordinal)
            && string.Equals(left.Role ?? "", right.Role ?? "", StringComparison.Ordinal)
            && string.Equals(left.TenantId ?? "", right.TenantId ?? "", StringComparison.Ordinal)
            && string.Equals(left.TenantName ?? "", right.TenantName ?? "", StringComparison.Ordinal)
            && string.Equals(left.DepartmentId ?? "", right.DepartmentId ?? "", StringComparison.Ordinal)
            && string.Equals(left.DepartmentName ?? "", right.DepartmentName ?? "", StringComparison.Ordinal)
            && string.Equals(left.LoginContextSource ?? "", right.LoginContextSource ?? "", StringComparison.Ordinal);
    }

    private static DateTimeOffset? ParseTimestamp(string value)
    {
        return DateTimeOffset.TryParse(value, out var parsed)
            ? parsed
            : null;
    }

    private static string FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value)) return value.Trim();
        }

        return "";
    }

    private const string InjectionScript = """
        (function () {
          if (window.__eiscoreCollectorLogInstalled) return;
          window.__eiscoreCollectorLogInstalled = true;

          function normalizePayload(payload) {
            if (typeof payload === 'string') return { message: payload };
            return payload && typeof payload === 'object' ? payload : {};
          }

          function post(payload) {
            try {
              if (!window.chrome || !window.chrome.webview) return;
              var context = window.__eiscoreCollectorLogContext || {};
              window.chrome.webview.postMessage(Object.assign({
                source: 'eiscoreCollectorLog',
                url: location.href,
                route: location.hash || location.pathname,
                createdAt: new Date().toISOString()
              }, context, normalizePayload(payload)));
            } catch (_) {}
          }

          function postContext() {
            try {
              if (!window.chrome || !window.chrome.webview) return;
              var context = window.__eiscoreCollectorLogContext || {};
              window.chrome.webview.postMessage(Object.assign({
                source: 'eiscoreCollectorContext',
                url: location.href,
                route: location.hash || location.pathname,
                createdAt: new Date().toISOString()
              }, context));
            } catch (_) {}
          }

          var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
          var loginContextProbePaths = [
            '/agent/api/auth/me',
            '/agent/api/auth/user',
            '/agent/api/me',
            '/agent/auth/me',
            '/api/auth/me',
            '/api/auth/user',
            '/api/user/me',
            '/api/users/me',
            '/api/me',
            '/api/profile',
            '/api/current-user',
            '/api/currentUser',
            '/auth/me',
            '/user/me',
            '/users/me',
            '/me',
            '/profile'
          ];
          var loginContextProbeInFlight = false;
          var lastLoginContextProbeAt = 0;
          var lastLoginContextFingerprint = '';

          function readPath(source, path) {
            var current = source;
            for (var i = 0; i < path.length; i += 1) {
              if (!current || typeof current !== 'object') return '';
              current = current[path[i]];
            }
            return current == null ? '' : String(current).trim();
          }

          function firstIdentityValue(source, paths) {
            for (var i = 0; i < paths.length; i += 1) {
              var value = readPath(source, paths[i]);
              if (value) return value;
            }
            return '';
          }

          function firstContextValue(candidate, sourceRoot, paths) {
            return firstIdentityValue(candidate, paths) || firstIdentityValue(sourceRoot, paths);
          }

          function hasIdentityShape(value) {
            if (!value || typeof value !== 'object') return false;
            return !!firstIdentityValue(value, [
              ['id'], ['userId'], ['user_id'], ['uid'], ['sub'],
              ['employeeId'], ['employee_id'], ['employeeNo'], ['employee_no'],
              ['staffId'], ['staff_id'], ['staffNo'], ['staff_no'], ['workerId'], ['worker_id'],
              ['username'], ['name'], ['displayName'], ['display_name'],
              ['realName'], ['real_name'], ['fullName'], ['full_name'], ['email'],
              ['employeeName'], ['employee_name'], ['staffName'], ['staff_name'],
              ['nickName'], ['nick_name'], ['nickname'],
              ['role'], ['roles'], ['roleName'], ['role_name'], ['appRole'], ['app_role'],
              ['sopRole'], ['sop_role'], ['dbRole'], ['db_role'],
              ['position'], ['positionName'], ['position_name'],
              ['post'], ['postName'], ['post_name'],
              ['jobTitle'], ['job_title'], ['departmentName'], ['department_name'], ['department'],
              ['tenantId'], ['tenant_id'], ['enterpriseId'], ['enterprise_id'], ['enterpriseCode'], ['enterprise_code'],
              ['companyCode'], ['company_code'], ['orgCode'], ['org_code'], ['organizationCode'], ['organization_code']
            ]);
          }

          function findIdentityCandidate(value, depth) {
            if (!value || typeof value !== 'object' || depth > 5) return null;
            if (hasIdentityShape(value)) return value;

            var preferredKeys = [
              'user', 'currentUser', 'current_user', 'profile', 'account',
              'operator', 'employee', 'staff', 'member', 'data', 'payload',
              'result', 'session'
            ];
            for (var i = 0; i < preferredKeys.length; i += 1) {
              var nested = value[preferredKeys[i]];
              var found = findIdentityCandidate(nested, depth + 1);
              if (found) return found;
            }

            if (Array.isArray(value)) {
              for (var j = 0; j < Math.min(value.length, 8); j += 1) {
                var foundInArray = findIdentityCandidate(value[j], depth + 1);
                if (foundInArray) return foundInArray;
              }
            }
            return null;
          }

          function buildLoginContext(candidate, sourceName, sourceRoot) {
            var user = candidate || {};
            var root = sourceRoot || user;
            return {
              appModule: 'eiscore-webview',
              loginContextSource: sourceName || '',
              userId: firstContextValue(user, root, [
                ['id'], ['userId'], ['user_id'], ['uid'], ['sub'],
                ['employeeId'], ['employee_id'], ['employeeNo'], ['employee_no'],
                ['staffId'], ['staff_id'], ['staffNo'], ['staff_no'], ['workerId'], ['worker_id'],
                ['user', 'id'], ['user', 'userId'], ['user', 'user_id'],
                ['user', 'employeeId'], ['user', 'employeeNo'], ['user', 'staffId'], ['user', 'staffNo'],
                ['currentUser', 'id'], ['currentUser', 'userId'], ['current_user', 'id'],
                ['data', 'id'], ['data', 'userId'], ['data', 'user_id'],
                ['data', 'employeeId'], ['data', 'employeeNo'], ['data', 'staffId'], ['data', 'staffNo'],
                ['data', 'user', 'id'], ['data', 'user', 'userId'], ['data', 'user', 'user_id'],
                ['data', 'user', 'employeeId'], ['data', 'user', 'employeeNo'], ['data', 'user', 'staffId'], ['data', 'user', 'staffNo'],
                ['profile', 'id'], ['profile', 'employeeId'], ['profile', 'employeeNo'], ['profile', 'staffId'], ['profile', 'staffNo'],
                ['user_metadata', 'id'], ['userMetadata', 'id']
              ]),
              username: firstContextValue(user, root, [
                ['username'], ['name'], ['displayName'], ['display_name'],
                ['realName'], ['real_name'], ['fullName'], ['full_name'],
                ['employeeName'], ['employee_name'], ['staffName'], ['staff_name'],
                ['nickName'], ['nick_name'], ['nickname'],
                ['user', 'username'], ['user', 'name'], ['user', 'displayName'],
                ['user', 'employeeName'], ['user', 'staffName'],
                ['currentUser', 'username'], ['currentUser', 'name'], ['current_user', 'username'],
                ['data', 'username'], ['data', 'name'], ['data', 'displayName'],
                ['data', 'employeeName'], ['data', 'staffName'],
                ['data', 'user', 'username'], ['data', 'user', 'name'], ['data', 'user', 'displayName'],
                ['data', 'user', 'employeeName'], ['data', 'user', 'staffName'],
                ['profile', 'username'], ['profile', 'name'], ['profile', 'displayName'],
                ['profile', 'employeeName'], ['profile', 'staffName'],
                ['user_metadata', 'username'], ['user_metadata', 'name'], ['user_metadata', 'displayName'],
                ['userMetadata', 'username'], ['userMetadata', 'name'], ['userMetadata', 'displayName'],
                ['email']
              ]),
              role: firstContextValue(user, root, [
                ['role'], ['roles'], ['roleName'], ['role_name'],
                ['appRole'], ['app_role'], ['sopRole'], ['sop_role'], ['dbRole'], ['db_role'],
                ['position'], ['positionName'], ['position_name'],
                ['post'], ['postName'], ['post_name'],
                ['jobTitle'], ['job_title'],
                ['departmentName'], ['department_name'], ['department'],
                ['user', 'role'], ['user', 'roles'], ['user', 'roleName'], ['user', 'appRole'],
                ['user', 'position'], ['user', 'positionName'], ['user', 'jobTitle'],
                ['data', 'user', 'role'], ['data', 'user', 'roles'], ['data', 'user', 'roleName'], ['data', 'user', 'appRole'],
                ['data', 'user', 'position'], ['data', 'user', 'positionName'], ['data', 'user', 'jobTitle'],
                ['profile', 'role'], ['profile', 'roles'], ['profile', 'roleName'], ['profile', 'appRole'],
                ['profile', 'position'], ['profile', 'positionName'], ['profile', 'jobTitle'],
                ['user_metadata', 'role'], ['user_metadata', 'roles'], ['user_metadata', 'position'], ['user_metadata', 'positionName'], ['user_metadata', 'jobTitle'],
                ['userMetadata', 'role'], ['userMetadata', 'roles'], ['userMetadata', 'position'], ['userMetadata', 'positionName'], ['userMetadata', 'jobTitle']
              ]),
              tenantId: firstContextValue(user, root, [
                ['tenantId'], ['tenant_id'], ['enterpriseId'], ['enterprise_id'], ['enterpriseCode'], ['enterprise_code'],
                ['companyId'], ['company_id'], ['companyCode'], ['company_code'],
                ['orgId'], ['org_id'], ['orgCode'], ['org_code'],
                ['organizationId'], ['organization_id'], ['organizationCode'], ['organization_code'],
                ['tenant', 'id'], ['tenant', 'tenantId'], ['tenant', 'code'], ['tenant', 'enterpriseCode'],
                ['enterprise', 'id'], ['enterprise', 'code'], ['company', 'id'], ['company', 'code'],
                ['organization', 'id'], ['organization', 'code'], ['org', 'id'], ['org', 'code'],
                ['data', 'tenantId'], ['data', 'tenant_id'], ['data', 'enterpriseId'], ['data', 'enterprise_code'],
                ['data', 'companyCode'], ['data', 'orgCode'], ['data', 'organizationCode'],
                ['data', 'tenant', 'id'], ['data', 'tenant', 'code'], ['data', 'enterprise', 'id'], ['data', 'enterprise', 'code'],
                ['data', 'company', 'code'], ['data', 'organization', 'code'], ['data', 'org', 'code'],
                ['user', 'tenantId'], ['user', 'tenant_id'], ['user', 'enterpriseId'], ['user', 'enterprise_code']
              ]),
              tenantName: firstContextValue(user, root, [
                ['tenantName'], ['tenant_name'], ['enterpriseName'], ['enterprise_name'],
                ['companyName'], ['company_name'], ['orgName'], ['org_name'], ['organizationName'], ['organization_name'],
                ['tenant', 'name'], ['enterprise', 'name'], ['company', 'name'],
                ['data', 'tenantName'], ['data', 'tenant_name'], ['data', 'enterpriseName'], ['data', 'enterprise_name'],
                ['data', 'tenant', 'name'], ['data', 'enterprise', 'name'],
                ['user', 'tenantName'], ['user', 'tenant_name'], ['user', 'enterpriseName'], ['user', 'enterprise_name']
              ]),
              enterpriseCode: firstContextValue(user, root, [
                ['enterpriseCode'], ['enterprise_code'], ['tenantId'], ['tenant_id'],
                ['enterprise', 'code'], ['tenant', 'code'], ['data', 'enterpriseCode'], ['data', 'enterprise_code']
              ]),
              enterpriseName: firstContextValue(user, root, [
                ['enterpriseName'], ['enterprise_name'], ['tenantName'], ['tenant_name'],
                ['enterprise', 'name'], ['tenant', 'name'], ['data', 'enterpriseName'], ['data', 'enterprise_name']
              ]),
              departmentId: firstContextValue(user, root, [
                ['departmentId'], ['department_id'], ['departmentCode'], ['department_code'],
                ['deptId'], ['dept_id'], ['deptCode'], ['dept_code'],
                ['department', 'id'], ['dept', 'id'], ['user', 'departmentId'], ['user', 'department_id'],
                ['department', 'code'], ['dept', 'code'], ['user', 'departmentCode'], ['user', 'deptCode'],
                ['data', 'departmentId'], ['data', 'department_id'], ['data', 'departmentCode'], ['data', 'deptCode'],
                ['data', 'user', 'departmentId'], ['data', 'user', 'department_id'], ['data', 'user', 'departmentCode'], ['data', 'user', 'deptCode']
              ]),
              departmentName: firstContextValue(user, root, [
                ['departmentName'], ['department_name'], ['department'], ['deptName'], ['dept_name'],
                ['department', 'name'], ['dept', 'name'], ['user', 'departmentName'], ['user', 'department_name'],
                ['data', 'departmentName'], ['data', 'department_name'], ['data', 'user', 'departmentName'], ['data', 'user', 'department_name']
              ])
            };
          }

          function syncDetectedLoginContext(candidate, sourceName, sourceRoot) {
            var context = buildLoginContext(candidate, sourceName, sourceRoot);
            if (!context.userId && !context.username && !context.role && !context.tenantId && !context.tenantName) return false;
            if (!context.tenantId && context.enterpriseCode) context.tenantId = context.enterpriseCode;
            if (!context.tenantName && context.enterpriseName) context.tenantName = context.enterpriseName;
            var fingerprint = [
              context.userId,
              context.username,
              context.role,
              context.tenantId,
              context.tenantName,
              context.departmentId,
              context.departmentName
            ].join('\n');
            if (fingerprint === lastLoginContextFingerprint) return true;

            lastLoginContextFingerprint = fingerprint;
            window.__eiscoreCollectorLogContext = Object.assign(
              {},
              window.__eiscoreCollectorLogContext || {},
              context
            );
            postContext();
            return true;
          }

          function parseBase64UrlJson(segment) {
            try {
              var normalized = String(segment || '').replace(/-/g, '+').replace(/_/g, '/');
              while (normalized.length % 4) normalized += '=';
              var binary = atob(normalized);
              if (typeof TextDecoder !== 'undefined') {
                var bytes = new Uint8Array(binary.length);
                for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
                return JSON.parse(new TextDecoder('utf-8').decode(bytes));
              }
              return JSON.parse(decodeURIComponent(Array.prototype.map.call(binary, function (char) {
                return '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2);
              }).join('')));
            } catch (_) {
              return null;
            }
          }

          function readJwtPayload(value) {
            var token = String(value || '').trim().replace(/^Bearer\s+/i, '');
            var parts = token.split('.');
            if (parts.length < 2 || !parts[1]) return null;
            var payload = parseBase64UrlJson(parts[1]);
            return payload && typeof payload === 'object' ? payload : null;
          }

          function scanStoredLoginContext() {
            var stores = ['localStorage', 'sessionStorage'];
            for (var s = 0; s < stores.length; s += 1) {
              var storage;
              try { storage = window[stores[s]]; } catch (_) { storage = null; }
              if (!storage) continue;
              for (var i = 0; i < Math.min(storage.length, 120); i += 1) {
                var key = '';
                var raw = '';
                try {
                  key = storage.key(i) || '';
                  raw = storage.getItem(key) || '';
                } catch (_) {
                  continue;
                }
                var jwtPayload = readJwtPayload(raw);
                if (jwtPayload) {
                  var jwtCandidate = findIdentityCandidate(jwtPayload, 0);
                  if (syncDetectedLoginContext(jwtCandidate, stores[s] + ':' + key + ':jwt', jwtPayload)) return true;
                }
                var firstChar = raw.trim().charAt(0);
                if (firstChar !== '{' && firstChar !== '[') continue;
                try {
                  var parsed = JSON.parse(raw);
                  var candidate = findIdentityCandidate(parsed, 0);
                  if (syncDetectedLoginContext(candidate, stores[s] + ':' + key, parsed)) return true;
                } catch (_) {}
              }
            }
            return false;
          }

          function buildLoginProbeUrl(path) {
            var url = new URL(path, location.origin);
            url.searchParams.set('__eiscore_collector_probe', 'login-context');
            return url.toString();
          }

          function readStoredAuthToken() {
            var keys = ['auth_token', 'jwt_token', 'token', 'access_token', 'jwt', 'jwtToken'];
            var stores = ['localStorage', 'sessionStorage'];
            for (var s = 0; s < stores.length; s += 1) {
              var storage;
              try { storage = window[stores[s]]; } catch (_) { storage = null; }
              if (!storage) continue;
              for (var i = 0; i < keys.length; i += 1) {
                try {
                  var value = storage.getItem(keys[i]);
                  if (value && String(value).trim()) return String(value).trim();
                } catch (_) {}
              }
            }
            return '';
          }

          function buildLoginProbeHeaders() {
            var headers = {
              Accept: 'application/json',
              'X-EISCore-Collector-Probe': 'login-context'
            };
            var token = readStoredAuthToken();
            if (token) headers.Authorization = 'Bearer ' + token;
            return headers;
          }

          function probeLoginContext(reason, force) {
            if (!nativeFetch) return Promise.resolve(false);
            if (!/^https?:$/.test(location.protocol)) return Promise.resolve(false);
            if (scanStoredLoginContext()) return Promise.resolve(true);

            var now = Date.now();
            if (!force && (loginContextProbeInFlight || now - lastLoginContextProbeAt < 15000)) {
              return Promise.resolve(false);
            }

            loginContextProbeInFlight = true;
            lastLoginContextProbeAt = now;
            var index = 0;

            function tryNext() {
              if (index >= loginContextProbePaths.length) {
                loginContextProbeInFlight = false;
                return false;
              }

              var requestUrl = buildLoginProbeUrl(loginContextProbePaths[index]);
              index += 1;
              var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
              var timeout = controller ? setTimeout(function () { try { controller.abort(); } catch (_) {} }, 4500) : null;
              return nativeFetch(requestUrl, {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store',
                headers: buildLoginProbeHeaders(),
                signal: controller ? controller.signal : undefined
              }).then(function (response) {
                if (timeout) clearTimeout(timeout);
                if (!response || !response.ok) return tryNext();
                var contentType = response.headers && response.headers.get
                  ? response.headers.get('content-type') || ''
                  : '';
                if (contentType && contentType.toLowerCase().indexOf('json') === -1) {
                  return tryNext();
                }
                return response.json().then(function (payload) {
                  var candidate = findIdentityCandidate(payload, 0);
                  if (syncDetectedLoginContext(candidate, loginContextProbePaths[index - 1], payload)) {
                    loginContextProbeInFlight = false;
                    return true;
                  }
                  return tryNext();
                }, tryNext);
              }, function () {
                if (timeout) clearTimeout(timeout);
                return tryNext();
              });
            }

            return Promise.resolve(tryNext()).then(function (found) {
              loginContextProbeInFlight = false;
              return found;
            }, function () {
              loginContextProbeInFlight = false;
              return false;
            });
          }

          function scheduleLoginContextProbe(reason, delay, force) {
            setTimeout(function () {
              probeLoginContext(reason || 'scheduled', !!force);
            }, delay || 0);
          }

          window.__eiscoreCollectorLogContext = window.__eiscoreCollectorLogContext || {};
          window.eiscoreCollectorLog = {
            setContext: function (context) {
              try {
                if (!context || typeof context !== 'object') return;
                window.__eiscoreCollectorLogContext = Object.assign(
                  {},
                  window.__eiscoreCollectorLogContext || {},
                  context
                );
                postContext();
              } catch (_) {}
            },
            log: function (payload) {
              var data = normalizePayload(payload);
              post(Object.assign({
                level: data.level || 'info',
                eventType: data.eventType || 'frontend_event',
                message: data.message || ''
              }, data));
            },
            info: function (eventType, message, metadata) {
              post(Object.assign({ level: 'info', eventType: eventType || 'frontend_event', message: message || '' }, metadata || {}));
            },
            warn: function (eventType, message, metadata) {
              post(Object.assign({ level: 'warn', eventType: eventType || 'frontend_warn', message: message || '' }, metadata || {}));
            },
            error: function (eventType, message, metadata) {
              post(Object.assign({ level: 'error', eventType: eventType || 'frontend_error', message: message || '' }, metadata || {}));
            },
            syncLoginContext: function () {
              return probeLoginContext('manual', true);
            }
          };

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
                  eventType: 'fetch_exception',
                  message: 'fetch 异常：' + normalized.message,
                  stack: normalized.stack,
                  requestUrl: requestUrl
                });
                throw error;
              });
            };
          }

          if (window.XMLHttpRequest && XMLHttpRequest.prototype) {
            var originalOpen = XMLHttpRequest.prototype.open;
            var originalSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.open = function (method, url) {
              this.__eiscoreRequestMethod = method || '';
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
                    statusCode: this.status,
                    method: this.__eiscoreRequestMethod || ''
                  });
                }
              });
              ['error', 'timeout', 'abort'].forEach(function (eventName) {
                this.addEventListener(eventName, function () {
                  var statusText = eventName === 'timeout'
                    ? '请求超时'
                    : eventName === 'abort'
                      ? '请求取消'
                      : '网络异常';
                  post({
                    level: 'error',
                    eventType: 'xhr_exception',
                    message: 'XHR ' + statusText,
                    requestUrl: this.__eiscoreRequestUrl || '',
                    method: this.__eiscoreRequestMethod || '',
                    stack: ''
                  });
                });
              }, this);
              return originalSend.apply(this, arguments);
            };
          }

          var originalPushState = history.pushState;
          var originalReplaceState = history.replaceState;
          history.pushState = function () {
            var result = originalPushState.apply(this, arguments);
            scheduleLoginContextProbe('pushState', 250, false);
            return result;
          };
          history.replaceState = function () {
            var result = originalReplaceState.apply(this, arguments);
            scheduleLoginContextProbe('replaceState', 250, false);
            return result;
          };
          window.addEventListener('popstate', function () { scheduleLoginContextProbe('popstate', 250, false); });
          window.addEventListener('focus', function () { scheduleLoginContextProbe('focus', 250, false); });
          document.addEventListener('visibilitychange', function () {
            if (!document.hidden) scheduleLoginContextProbe('visible', 250, false);
          });
          scheduleLoginContextProbe('initial', 900, true);
          setInterval(function () { probeLoginContext('interval', false); }, 30000);
        })();
        """;
}

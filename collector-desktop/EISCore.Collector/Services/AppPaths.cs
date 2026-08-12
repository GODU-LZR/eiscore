namespace EISCore.Collector.Services;

public static class AppPaths
{
    public static string RootDirectory
    {
        get
        {
            var overridePath = Environment.GetEnvironmentVariable("EISCORE_COLLECTOR_DATA_DIR");
            var path = string.IsNullOrWhiteSpace(overridePath)
                ? Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "EISCore",
                    "Collector")
                : overridePath.Trim();
            Directory.CreateDirectory(path);
            return path;
        }
    }

    public static string ConfigPath => Path.Combine(RootDirectory, "collector-config.json");
    public static string DatabasePath => Path.Combine(RootDirectory, "collector.db");
    public static string CrashDumpDirectory
    {
        get
        {
            var path = Path.Combine(RootDirectory, "crash-dumps");
            Directory.CreateDirectory(path);
            return path;
        }
    }

    public static string WebViewUserDataDirectory
    {
        get
        {
            var path = Path.Combine(RootDirectory, "webview-user-data");
            Directory.CreateDirectory(path);
            return path;
        }
    }

    public static string UpdateDirectory
    {
        get
        {
            var path = Path.Combine(RootDirectory, "updates");
            Directory.CreateDirectory(path);
            return path;
        }
    }
}

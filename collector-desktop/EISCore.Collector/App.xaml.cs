using System.Windows;
using System.Windows.Threading;
using EISCore.Collector.Services;

namespace EISCore.Collector;

public partial class App : Application
{
    private MainWindow? _mainWindow;

    protected override void OnStartup(StartupEventArgs e)
    {
        DispatcherUnhandledException += App_DispatcherUnhandledException;
        AppDomain.CurrentDomain.UnhandledException += CurrentDomain_UnhandledException;
        TaskScheduler.UnobservedTaskException += TaskScheduler_UnobservedTaskException;

        base.OnStartup(e);
        _mainWindow = new MainWindow();
        _mainWindow.Show();
    }

    private void App_DispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        CrashDumpService.WriteCrashReport(e.Exception, "dispatcher_unhandled", isTerminating: false);
        e.Handled = false;
    }

    private static void CurrentDomain_UnhandledException(object sender, UnhandledExceptionEventArgs e)
    {
        var exception = e.ExceptionObject as Exception
            ?? new InvalidOperationException(e.ExceptionObject?.ToString() ?? "Unknown unhandled exception");
        CrashDumpService.WriteCrashReport(exception, "appdomain_unhandled", e.IsTerminating);
    }

    private static void TaskScheduler_UnobservedTaskException(object? sender, UnobservedTaskExceptionEventArgs e)
    {
        CrashDumpService.WriteCrashReport(e.Exception, "task_unobserved", isTerminating: false);
        e.SetObserved();
    }
}

namespace EISCore.Collector.Services;

public enum CollectorWindowCloseAction
{
    HideToTray,
    MinimizeToTaskbar,
    AllowClose
}

public static class CollectorWindowClosePolicy
{
    public static CollectorWindowCloseAction Decide(bool isExitRequested, bool isSessionEnding, bool isTrayAvailable = true)
    {
        if (isExitRequested || isSessionEnding)
        {
            return CollectorWindowCloseAction.AllowClose;
        }

        return isTrayAvailable
            ? CollectorWindowCloseAction.HideToTray
            : CollectorWindowCloseAction.MinimizeToTaskbar;
    }
}

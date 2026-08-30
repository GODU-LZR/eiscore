namespace EISCore.Collector.Services;

public sealed class DeviceAuthorizationFailedEventArgs : EventArgs
{
    public DeviceAuthorizationFailedEventArgs(DeviceAuthorizationException exception)
    {
        Exception = exception;
    }

    public DeviceAuthorizationException Exception { get; }
}

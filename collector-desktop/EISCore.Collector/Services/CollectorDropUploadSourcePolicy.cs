using EISCore.Collector.Models;

namespace EISCore.Collector.Services;

public static class CollectorDropUploadSourcePolicy
{
    public const string ManualDragDrop = "manual_drag_drop";
    public const string WebDragDrop = "web_drag_drop";

    public static string Resolve(UploadOwnerContext? webOwner)
    {
        return webOwner?.HasIdentity == true ? WebDragDrop : ManualDragDrop;
    }
}

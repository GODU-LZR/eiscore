namespace EISCore.Collector.Services;

public static class CollectorFileBatchStatusPolicy
{
    public static string Format(int totalCount, int acceptedCount)
    {
        var total = Math.Max(0, totalCount);
        var accepted = Math.Clamp(acceptedCount, 0, total);
        var skipped = total - accepted;

        if (total == 0)
        {
            return "未选择可处理文件。";
        }

        if (skipped == 0)
        {
            return $"{accepted} 个文件已入队或已存在队列。";
        }

        if (accepted == 0)
        {
            return $"{total} 个文件均未入队，请检查设备绑定状态、文件类型、大小或本地日志。";
        }

        return $"{accepted} 个文件已入队或已存在队列，{skipped} 个文件未入队。";
    }
}

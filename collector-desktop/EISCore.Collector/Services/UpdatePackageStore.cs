using System.Security.Cryptography;

namespace EISCore.Collector.Services;

public static class UpdatePackageStore
{
    public static async Task SaveAtomicallyAsync(
        Stream input,
        string installerPath,
        string expectedSha256,
        CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(installerPath) ?? AppPaths.UpdateDirectory);
        var tempPath = $"{installerPath}.{Environment.ProcessId}.{Guid.NewGuid():N}.download";

        try
        {
            await using (var output = new FileStream(tempPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 1024 * 128, useAsync: true))
            {
                await input.CopyToAsync(output, cancellationToken);
                await output.FlushAsync(cancellationToken);
            }

            var expectedHash = CollectorUpdateHashPolicy.EvaluateSha256(expectedSha256);
            if (!expectedHash.IsValid)
            {
                throw new InvalidOperationException(expectedHash.StatusMessage);
            }

            var actualHash = await ComputeSha256Async(tempPath, cancellationToken);
            if (!string.Equals(actualHash, expectedHash.NormalizedSha256, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("更新包 SHA256 校验失败。");
            }

            File.Move(tempPath, installerPath, overwrite: true);
        }
        finally
        {
            if (File.Exists(tempPath))
            {
                try
                {
                    File.Delete(tempPath);
                }
                catch
                {
                }
            }
        }
    }

    private static async Task<string> ComputeSha256Async(string filePath, CancellationToken cancellationToken)
    {
        await using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read, 1024 * 128, useAsync: true);
        using var sha = SHA256.Create();
        var hash = await sha.ComputeHashAsync(stream, cancellationToken);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}

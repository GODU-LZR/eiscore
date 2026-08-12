using System.Security.Cryptography;
using System.Text;

namespace EISCore.Collector.Services;

public sealed class DeviceTokenProtector
{
    private const string DpapiPrefix = "dpapi:";
    private const string LocalPrefix = "local-v1:";
    private const int LocalKeyBytes = 32;
    private const int LocalNonceBytes = 12;
    private const int LocalTagBytes = 16;

    private static readonly byte[] DpapiEntropy = Encoding.UTF8.GetBytes("EISCore.Collector.DeviceToken.v1");

    public string Protect(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return "";

        var clearBytes = Encoding.UTF8.GetBytes(token);
        return OperatingSystem.IsWindows()
            ? DpapiPrefix + Convert.ToBase64String(ProtectedData.Protect(
                clearBytes,
                DpapiEntropy,
                DataProtectionScope.CurrentUser))
            : ProtectWithLocalKey(clearBytes);
    }

    public string Unprotect(string protectedToken)
    {
        var normalized = (protectedToken ?? "").Trim();
        if (string.IsNullOrWhiteSpace(normalized)) return "";

        try
        {
            if (normalized.StartsWith(DpapiPrefix, StringComparison.OrdinalIgnoreCase))
            {
                return UnprotectDpapi(normalized[DpapiPrefix.Length..], useEntropy: true);
            }

            if (normalized.StartsWith(LocalPrefix, StringComparison.OrdinalIgnoreCase))
            {
                return UnprotectWithLocalKey(normalized[LocalPrefix.Length..]);
            }

            return OperatingSystem.IsWindows()
                ? UnprotectDpapi(normalized, useEntropy: false)
                : "";
        }
        catch
        {
            return "";
        }
    }

    private static string UnprotectDpapi(string payload, bool useEntropy)
    {
        if (!OperatingSystem.IsWindows()) return "";

        var encryptedBytes = Convert.FromBase64String(payload);
        var clearBytes = ProtectedData.Unprotect(
            encryptedBytes,
            useEntropy ? DpapiEntropy : null,
            DataProtectionScope.CurrentUser);
        return Encoding.UTF8.GetString(clearBytes);
    }

    private static string ProtectWithLocalKey(byte[] clearBytes)
    {
        var key = GetOrCreateLocalKey();
        var nonce = RandomNumberGenerator.GetBytes(LocalNonceBytes);
        var cipherBytes = new byte[clearBytes.Length];
        var tag = new byte[LocalTagBytes];

        using var aes = new AesGcm(key);
        aes.Encrypt(nonce, clearBytes, cipherBytes, tag);

        var payload = new byte[LocalNonceBytes + LocalTagBytes + cipherBytes.Length];
        Buffer.BlockCopy(nonce, 0, payload, 0, nonce.Length);
        Buffer.BlockCopy(tag, 0, payload, nonce.Length, tag.Length);
        Buffer.BlockCopy(cipherBytes, 0, payload, nonce.Length + tag.Length, cipherBytes.Length);
        return LocalPrefix + Convert.ToBase64String(payload);
    }

    private static string UnprotectWithLocalKey(string payload)
    {
        var protectedBytes = Convert.FromBase64String(payload);
        if (protectedBytes.Length < LocalNonceBytes + LocalTagBytes)
        {
            return "";
        }

        var nonce = protectedBytes[..LocalNonceBytes];
        var tag = protectedBytes[LocalNonceBytes..(LocalNonceBytes + LocalTagBytes)];
        var cipherBytes = protectedBytes[(LocalNonceBytes + LocalTagBytes)..];
        var clearBytes = new byte[cipherBytes.Length];

        using var aes = new AesGcm(GetOrCreateLocalKey());
        aes.Decrypt(nonce, cipherBytes, tag, clearBytes);
        return Encoding.UTF8.GetString(clearBytes);
    }

    private static byte[] GetOrCreateLocalKey()
    {
        Directory.CreateDirectory(AppPaths.RootDirectory);
        var keyPath = Path.Combine(AppPaths.RootDirectory, "collector-token.key");

        if (File.Exists(keyPath))
        {
            try
            {
                var existing = Convert.FromBase64String(File.ReadAllText(keyPath).Trim());
                if (existing.Length == LocalKeyBytes)
                {
                    return existing;
                }
            }
            catch
            {
            }
        }

        var key = RandomNumberGenerator.GetBytes(LocalKeyBytes);
        File.WriteAllText(keyPath, Convert.ToBase64String(key));
        try
        {
            File.SetAttributes(keyPath, File.GetAttributes(keyPath) | FileAttributes.Hidden);
        }
        catch
        {
        }

        return key;
    }
}

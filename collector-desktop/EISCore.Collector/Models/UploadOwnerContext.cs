namespace EISCore.Collector.Models;

public sealed class UploadOwnerContext
{
    public string UserId { get; set; } = "";
    public string Username { get; set; } = "";
    public string Role { get; set; } = "";
    public string TenantId { get; set; } = "";
    public string TenantName { get; set; } = "";
    public string DepartmentId { get; set; } = "";
    public string DepartmentName { get; set; } = "";
    public string LoginContextSource { get; set; } = "";
    public DateTimeOffset? LastSyncedAt { get; set; }

    public bool HasIdentity =>
        !string.IsNullOrWhiteSpace(UserId)
        || !string.IsNullOrWhiteSpace(Username)
        || !string.IsNullOrWhiteSpace(Role);

    public bool HasTenant =>
        !string.IsNullOrWhiteSpace(TenantId)
        || !string.IsNullOrWhiteSpace(TenantName);

    public bool HasContext => HasIdentity || HasTenant;

    public UploadOwnerContext Clone()
    {
        return new UploadOwnerContext
        {
            UserId = UserId,
            Username = Username,
            Role = Role,
            TenantId = TenantId,
            TenantName = TenantName,
            DepartmentId = DepartmentId,
            DepartmentName = DepartmentName,
            LoginContextSource = LoginContextSource,
            LastSyncedAt = LastSyncedAt
        };
    }
}

public sealed class UploadOwnership
{
    public string UploadedByUserId { get; set; } = "";
    public string UploadedByUsername { get; set; } = "";
    public string UploadedByRole { get; set; } = "";
    public string OperatorSource { get; set; } = "";
}

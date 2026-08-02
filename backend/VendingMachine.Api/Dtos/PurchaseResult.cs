namespace VendingMachine.Api.Dtos;

public enum PurchaseStatus
{
    Success,
    ProductNotFound,
    OutOfStock,
    InsufficientFunds,
    ChangeUnavailable
}

public record PurchaseResult(
    PurchaseStatus Status,
    ProductDto? Product = null,
    int ChangeDueCents = 0,
    IReadOnlyList<CoinCount>? ChangeBreakdown = null,
    int AmountStillNeededCents = 0);

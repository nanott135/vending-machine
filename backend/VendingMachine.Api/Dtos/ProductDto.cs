using VendingMachine.Api.Models;

namespace VendingMachine.Api.Dtos;

public record ProductDto(
    string Code,
    string Name,
    int PriceCents,
    int Quantity,
    bool IsOutOfStock,
    bool IsLowStock,
    int SlotOrder)
{
    /// <summary>A product still in stock at or below this quantity is flagged as running low.</summary>
    public const int LowStockThreshold = 5;

    /// <summary>
    /// The single place the derived stock flags are computed - both the products list and the
    /// purchase result map through here so the two can't drift apart. The flags are mutually
    /// exclusive: a product at quantity 0 is out of stock, not low.
    /// </summary>
    public static ProductDto FromProduct(Product product) => new(
        product.Code,
        product.Name,
        product.PriceCents,
        product.Quantity,
        product.Quantity == 0,
        product.Quantity > 0 && product.Quantity <= LowStockThreshold,
        product.SlotOrder);
}

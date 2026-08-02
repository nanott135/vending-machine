namespace VendingMachine.Api.Models;

public class Product
{
    public int Id { get; set; }
    public required string Code { get; set; }
    public required string Name { get; set; }
    public int PriceCents { get; set; }
    public int Quantity { get; set; }

    /// <summary>1-12, row-major position in the 3x4 grid (matches Code).</summary>
    public int SlotOrder { get; set; }
}

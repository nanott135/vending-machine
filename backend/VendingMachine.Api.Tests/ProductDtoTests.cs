using VendingMachine.Api.Dtos;
using VendingMachine.Api.Models;

namespace VendingMachine.Api.Tests;

public class ProductDtoTests
{
    private static Product Product(int quantity) =>
        new() { Id = 1, Code = "A1", Name = "Cola", PriceCents = 125, Quantity = quantity, SlotOrder = 1 };

    [Theory]
    // quantity, expected IsOutOfStock, expected IsLowStock - the boundaries either side of the
    // threshold, plus 0 (out of stock is NOT also low stock).
    [InlineData(0, true, false)]
    [InlineData(1, false, true)]
    [InlineData(4, false, true)]
    [InlineData(5, false, true)]
    [InlineData(6, false, false)]
    [InlineData(25, false, false)]
    public void FromProduct_SetsStockFlagsFromQuantity(int quantity, bool expectedOutOfStock, bool expectedLowStock)
    {
        var dto = ProductDto.FromProduct(Product(quantity));

        Assert.Equal(quantity, dto.Quantity);
        Assert.Equal(expectedOutOfStock, dto.IsOutOfStock);
        Assert.Equal(expectedLowStock, dto.IsLowStock);
    }

    [Fact]
    public void FromProduct_StockFlagsAreMutuallyExclusive()
    {
        foreach (var quantity in Enumerable.Range(0, 30))
        {
            var dto = ProductDto.FromProduct(Product(quantity));
            Assert.False(dto.IsOutOfStock && dto.IsLowStock, $"both flags set at quantity {quantity}");
        }
    }

    [Fact]
    public void FromProduct_CopiesTheRemainingFields()
    {
        var dto = ProductDto.FromProduct(Product(10));

        Assert.Equal("A1", dto.Code);
        Assert.Equal("Cola", dto.Name);
        Assert.Equal(125, dto.PriceCents);
        Assert.Equal(1, dto.SlotOrder);
    }
}

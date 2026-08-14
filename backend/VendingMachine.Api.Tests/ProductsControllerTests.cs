using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VendingMachine.Api.Controllers;
using VendingMachine.Api.Data;
using VendingMachine.Api.Dtos;

namespace VendingMachine.Api.Tests;

// Same approach as VendingMachineServiceTests: a per-test SQLite in-memory database carrying the
// real HasData seed, so these assertions are about the seeded catalogue, not a hand-rolled fixture.
public class ProductsControllerTests : IDisposable
{
    private readonly TestDatabase _database = new();

    private VendingMachineDbContext CreateContext() => _database.CreateContext();

    public void Dispose() => _database.Dispose();

    private static async Task<IReadOnlyList<ProductDto>> GetProductsAsync(VendingMachineDbContext context)
    {
        var result = await new ProductsController(context).GetProducts(CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        return Assert.IsAssignableFrom<IReadOnlyList<ProductDto>>(ok.Value);
    }

    [Fact]
    public async Task GetProducts_AgainstSeedData_FlagsOnlyD3AsLowStock()
    {
        await using var context = CreateContext();

        var products = await GetProductsAsync(context);

        // D3 (Crackers) is the only product seeded inside the 1..5 low-stock band.
        var low = products.Where(p => p.IsLowStock).ToList();
        var only = Assert.Single(low);
        Assert.Equal("D3", only.Code);
        Assert.Equal(5, only.Quantity);
        Assert.False(only.IsOutOfStock);
    }

    [Fact]
    public async Task GetProducts_AgainstSeedData_OutOfStockProductsAreNotAlsoLowStock()
    {
        await using var context = CreateContext();

        var products = await GetProductsAsync(context);

        // A3 (Root Beer) and C2 (Pretzels) are seeded at quantity 0.
        Assert.Equal(
            new[] { "A3", "C2" },
            products.Where(p => p.IsOutOfStock).Select(p => p.Code).Order().ToArray());
        Assert.All(products.Where(p => p.IsOutOfStock), p => Assert.False(p.IsLowStock));
    }

    [Theory]
    [InlineData(0, true, false)]
    [InlineData(1, false, true)]
    [InlineData(5, false, true)]
    [InlineData(6, false, false)]
    public async Task GetProducts_ReportsStockFlagsAtTheThresholdBoundaries(
        int quantity, bool expectedOutOfStock, bool expectedLowStock)
    {
        await using var context = CreateContext();
        var a1 = await context.Products.SingleAsync(p => p.Code == "A1");
        a1.Quantity = quantity;
        await context.SaveChangesAsync();

        var products = await GetProductsAsync(context);

        var product = products.Single(p => p.Code == "A1");
        Assert.Equal(quantity, product.Quantity);
        Assert.Equal(expectedOutOfStock, product.IsOutOfStock);
        Assert.Equal(expectedLowStock, product.IsLowStock);
    }

    [Fact]
    public async Task GetProducts_ReturnsEveryProductInSlotOrder()
    {
        await using var context = CreateContext();

        var products = await GetProductsAsync(context);

        Assert.Equal(12, products.Count);
        Assert.Equal(products.OrderBy(p => p.SlotOrder).Select(p => p.Code), products.Select(p => p.Code));
    }
}

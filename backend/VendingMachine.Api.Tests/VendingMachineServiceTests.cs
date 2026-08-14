using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using VendingMachine.Api.Data;
using VendingMachine.Api.Dtos;
using VendingMachine.Api.Models;
using VendingMachine.Api.Services;

namespace VendingMachine.Api.Tests;

public class VendingMachineServiceTests
{
    // Each test gets its own isolated in-memory store, but the DbContext's HasData seed
    // (12 products incl. A3/C2 at qty 0, starting coin inventory) is applied to every one -
    // tests reuse that real seed data instead of re-seeding by hand.
    private static VendingMachineDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<VendingMachineDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            // The in-memory provider doesn't support real transactions (unlike SQL Server,
            // which this was verified against manually); ignore the warning in tests.
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        var context = new VendingMachineDbContext(options);
        context.Database.EnsureCreated(); // applies the model's HasData seed for the InMemory provider
        return context;
    }

    [Fact]
    public async Task PurchaseAsync_UnknownProductCode_ReturnsProductNotFound()
    {
        await using var context = CreateContext();
        var sut = new VendingMachineService(context, new MachineStateService(), new ChangeMakingService());

        var result = await sut.PurchaseAsync("Z9");

        Assert.Equal(PurchaseStatus.ProductNotFound, result.Status);
    }

    [Fact]
    public async Task PurchaseAsync_ProductOutOfStock_ReturnsOutOfStock()
    {
        await using var context = CreateContext();
        var sut = new VendingMachineService(context, new MachineStateService(), new ChangeMakingService());

        // A3 (Root Beer) is seeded at Quantity = 0.
        var result = await sut.PurchaseAsync("A3");

        Assert.Equal(PurchaseStatus.OutOfStock, result.Status);
        Assert.Equal(0, result.Product!.Quantity);
        Assert.True(result.Product.IsOutOfStock);
        Assert.False(result.Product.IsLowStock); // out of stock is not also "running low"
    }

    [Fact]
    public async Task PurchaseAsync_DroppingIntoTheLowStockBand_FlagsTheProductAsLowStock()
    {
        await using var context = CreateContext();
        var machineState = new MachineStateService();
        var sut = new VendingMachineService(context, machineState, new ChangeMakingService());

        // B1 (Orange Soda) is seeded at 150 cents, quantity 6 - one above the threshold.
        machineState.InsertCoin(CoinDenomination.Dollar);
        machineState.InsertCoin(CoinDenomination.Dollar);

        var result = await sut.PurchaseAsync("B1");

        Assert.Equal(PurchaseStatus.Success, result.Status);
        Assert.Equal(5, result.Product!.Quantity);
        Assert.False(result.Product.IsOutOfStock);
        Assert.True(result.Product.IsLowStock);
    }

    [Fact]
    public async Task PurchaseAsync_AboveTheLowStockThreshold_LeavesBothStockFlagsClear()
    {
        await using var context = CreateContext();
        var machineState = new MachineStateService();
        var sut = new VendingMachineService(context, machineState, new ChangeMakingService());

        // C1 (Chips) is seeded at 175 cents, quantity 7 -> 6 after this sale.
        machineState.InsertCoin(CoinDenomination.Dollar);
        machineState.InsertCoin(CoinDenomination.Dollar);

        var result = await sut.PurchaseAsync("C1");

        Assert.Equal(PurchaseStatus.Success, result.Status);
        Assert.Equal(6, result.Product!.Quantity);
        Assert.False(result.Product.IsOutOfStock);
        Assert.False(result.Product.IsLowStock);
    }

    [Fact]
    public async Task PurchaseAsync_BalanceBelowPrice_ReturnsInsufficientFundsAndKeepsBalance()
    {
        await using var context = CreateContext();
        var machineState = new MachineStateService();
        var sut = new VendingMachineService(context, machineState, new ChangeMakingService());

        machineState.InsertCoin(CoinDenomination.Quarter); // 25 cents

        // C3 (Candy Bar) is seeded at 125 cents.
        var result = await sut.PurchaseAsync("C3");

        Assert.Equal(PurchaseStatus.InsufficientFunds, result.Status);
        Assert.Equal(100, result.AmountStillNeededCents);
        Assert.Equal(25, machineState.BalanceCents); // balance untouched, not reset
    }

    [Fact]
    public async Task PurchaseAsync_SufficientFunds_DecrementsStockAndDispensesChange()
    {
        await using var context = CreateContext();
        var machineState = new MachineStateService();
        var sut = new VendingMachineService(context, machineState, new ChangeMakingService());

        // D2 (Gum) is seeded at 75 cents, quantity 25.
        machineState.InsertCoin(CoinDenomination.Dollar); // 100 cents -> 25 cents change

        var result = await sut.PurchaseAsync("D2");

        Assert.Equal(PurchaseStatus.Success, result.Status);
        Assert.Equal(25, result.ChangeDueCents);
        Assert.Equal(24, result.Product!.Quantity);
        var change = Assert.Single(result.ChangeBreakdown!);
        Assert.Equal(CoinDenomination.Quarter, change.Denomination);
        Assert.Equal(1, change.Count);

        // persisted correctly
        var product = await context.Products.SingleAsync(p => p.Code == "D2");
        Assert.Equal(24, product.Quantity);
        var dollars = await context.CoinInventory.SingleAsync(c => c.Denomination == CoinDenomination.Dollar);
        Assert.Equal(16, dollars.Count); // seeded 15 + 1 inserted
        var quarters = await context.CoinInventory.SingleAsync(c => c.Denomination == CoinDenomination.Quarter);
        Assert.Equal(39, quarters.Count); // seeded 40 - 1 dispensed as change

        // pending transaction cleared
        Assert.Equal(0, machineState.BalanceCents);
    }

    [Fact]
    public async Task PurchaseAsync_NoExactChangeAvailable_RejectsPurchaseWithoutMutatingState()
    {
        await using var context = CreateContext();

        var coinItems = await context.CoinInventory.ToListAsync();
        foreach (var item in coinItems)
        {
            item.Count = 0;
        }
        await context.SaveChangesAsync();

        var machineState = new MachineStateService();
        var sut = new VendingMachineService(context, machineState, new ChangeMakingService());

        // A1 (Cola) is seeded at 125 cents; paying with $2.00 needs 75 cents change
        // that the (now empty) machine can't make.
        machineState.InsertCoin(CoinDenomination.Dollar);
        machineState.InsertCoin(CoinDenomination.Dollar);

        var result = await sut.PurchaseAsync("A1");

        Assert.Equal(PurchaseStatus.ChangeUnavailable, result.Status);
        Assert.Equal(75, result.ChangeDueCents);

        // nothing was mutated: balance, stock, and inventory all unchanged
        Assert.Equal(200, machineState.BalanceCents);
        var product = await context.Products.SingleAsync(p => p.Code == "A1");
        Assert.Equal(10, product.Quantity);
        Assert.All(await context.CoinInventory.ToListAsync(), c => Assert.Equal(0, c.Count));
    }
}

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using VendingMachine.Api.Controllers;
using VendingMachine.Api.Data;
using VendingMachine.Api.Dtos;
using VendingMachine.Api.Models;
using VendingMachine.Api.Services;

namespace VendingMachine.Api.Tests;

public class MachineControllerTests
{
    // Same approach as the other DB-backed tests: an isolated in-memory store carrying the real
    // HasData seed (coin inventory 40 nickels / 40 dimes / 40 quarters / 15 dollars).
    private static VendingMachineDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<VendingMachineDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        var context = new VendingMachineDbContext(options);
        context.Database.EnsureCreated();
        return context;
    }

    private static async Task<MachineInventoryDto> GetInventoryAsync(
        VendingMachineDbContext context,
        IMachineStateService? machineState = null)
    {
        var controller = new MachineController(machineState ?? new MachineStateService(), context);
        var result = await controller.GetInventory(CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        return Assert.IsType<MachineInventoryDto>(ok.Value);
    }

    [Fact]
    public async Task GetInventory_ReturnsEveryDenominationOrderedByValueDescending()
    {
        await using var context = CreateContext();

        var inventory = await GetInventoryAsync(context);

        Assert.Equal(
            new[]
            {
                CoinDenomination.Dollar,
                CoinDenomination.Quarter,
                CoinDenomination.Dime,
                CoinDenomination.Nickel
            },
            inventory.Coins.Select(c => c.Denomination).ToArray());
        Assert.Equal(new[] { 15, 40, 40, 40 }, inventory.Coins.Select(c => c.Count).ToArray());
    }

    [Fact]
    public async Task GetInventory_AgainstSeedData_TotalsTheWeightedValueOfEveryCoin()
    {
        await using var context = CreateContext();

        var inventory = await GetInventoryAsync(context);

        // 15 * 100 + 40 * 25 + 40 * 10 + 40 * 5 = 1500 + 1000 + 400 + 200
        Assert.Equal(3100, inventory.TotalCents);
    }

    [Fact]
    public async Task GetInventory_AfterInventoryChanges_ReflectsTheStoredCountsAndTotal()
    {
        await using var context = CreateContext();
        var dollars = await context.CoinInventory.SingleAsync(c => c.Denomination == CoinDenomination.Dollar);
        dollars.Count = 0;
        var nickels = await context.CoinInventory.SingleAsync(c => c.Denomination == CoinDenomination.Nickel);
        nickels.Count = 3;
        await context.SaveChangesAsync();

        var inventory = await GetInventoryAsync(context);

        Assert.Equal(0, inventory.Coins.Single(c => c.Denomination == CoinDenomination.Dollar).Count);
        Assert.Equal(3, inventory.Coins.Single(c => c.Denomination == CoinDenomination.Nickel).Count);
        // A depleted denomination still reports a row, so the caller can show a zero rather than a gap.
        Assert.Equal(4, inventory.Coins.Count);
        // 0 * 100 + 40 * 25 + 40 * 10 + 3 * 5 = 1415
        Assert.Equal(1415, inventory.TotalCents);
    }

    [Fact]
    public async Task GetInventory_IgnoresCoinsInsertedForThePendingTransaction()
    {
        await using var context = CreateContext();
        var machineState = new MachineStateService();
        machineState.InsertCoin(CoinDenomination.Dollar);
        machineState.InsertCoin(CoinDenomination.Quarter);

        var inventory = await GetInventoryAsync(context, machineState);

        // The pending 125c is the customer's until the sale completes - it isn't banked, so it must
        // not show up in what the machine can pay change from.
        Assert.Equal(125, machineState.BalanceCents);
        Assert.Equal(15, inventory.Coins.Single(c => c.Denomination == CoinDenomination.Dollar).Count);
        Assert.Equal(40, inventory.Coins.Single(c => c.Denomination == CoinDenomination.Quarter).Count);
        Assert.Equal(3100, inventory.TotalCents);
    }
}

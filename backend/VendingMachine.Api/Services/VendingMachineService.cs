using Microsoft.EntityFrameworkCore;
using VendingMachine.Api.Data;
using VendingMachine.Api.Dtos;
using VendingMachine.Api.Models;

namespace VendingMachine.Api.Services;

public class VendingMachineService(
    VendingMachineDbContext dbContext,
    IMachineStateService machineState,
    IChangeMakingService changeMakingService) : IVendingMachineService
{
    public async Task<PurchaseResult> PurchaseAsync(string productCode, CancellationToken cancellationToken = default)
    {
        var product = await dbContext.Products.SingleOrDefaultAsync(p => p.Code == productCode, cancellationToken);
        if (product is null)
        {
            return new PurchaseResult(PurchaseStatus.ProductNotFound);
        }

        if (product.Quantity <= 0)
        {
            return new PurchaseResult(PurchaseStatus.OutOfStock, ToDto(product));
        }

        var balanceCents = machineState.BalanceCents;
        if (balanceCents < product.PriceCents)
        {
            return new PurchaseResult(
                PurchaseStatus.InsufficientFunds,
                ToDto(product),
                AmountStillNeededCents: product.PriceCents - balanceCents);
        }

        var changeDueCents = balanceCents - product.PriceCents;
        var insertedCoins = machineState.InsertedCoins;

        var inventoryItems = await dbContext.CoinInventory.ToListAsync(cancellationToken);
        var availableForChange = inventoryItems.ToDictionary(i => i.Denomination, i => i.Count);
        foreach (var (denomination, count) in insertedCoins)
        {
            availableForChange[denomination] = availableForChange.GetValueOrDefault(denomination) + count;
        }

        var changeCoins = changeMakingService.MakeChange(changeDueCents, availableForChange);
        if (changeCoins is null)
        {
            return new PurchaseResult(PurchaseStatus.ChangeUnavailable, ToDto(product), changeDueCents);
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        product.Quantity -= 1;

        var inventoryByDenomination = inventoryItems.ToDictionary(i => i.Denomination);
        foreach (var (denomination, count) in insertedCoins)
        {
            inventoryByDenomination[denomination].Count += count;
        }
        foreach (var (denomination, count) in changeCoins)
        {
            inventoryByDenomination[denomination].Count -= count;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        machineState.Reset();

        var changeBreakdown = changeCoins
            .Select(kvp => new CoinCount(kvp.Key, kvp.Value))
            .OrderByDescending(c => (int)c.Denomination)
            .ToList();

        return new PurchaseResult(PurchaseStatus.Success, ToDto(product), changeDueCents, changeBreakdown);
    }

    private static ProductDto ToDto(Product product) =>
        new(product.Code, product.Name, product.PriceCents, product.Quantity, product.Quantity == 0, product.SlotOrder);
}

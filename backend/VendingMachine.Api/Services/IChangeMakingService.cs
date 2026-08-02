using VendingMachine.Api.Models;

namespace VendingMachine.Api.Services;

public interface IChangeMakingService
{
    /// <summary>
    /// Attempts to make exact change for <paramref name="amountCents"/> from the given coin
    /// inventory. Returns null if exact change isn't possible with what's available.
    /// </summary>
    IReadOnlyDictionary<CoinDenomination, int>? MakeChange(
        int amountCents,
        IReadOnlyDictionary<CoinDenomination, int> availableInventory);
}

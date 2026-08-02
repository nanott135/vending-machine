using VendingMachine.Api.Models;

namespace VendingMachine.Api.Services;

/// <summary>
/// Tracks the machine's single pending transaction: the balance and coin denominations
/// inserted so far but not yet spent or returned. Ephemeral by design (see PLAN.md) -
/// a real machine has exactly one pending sale at a time and it doesn't survive a power cycle.
/// </summary>
public interface IMachineStateService
{
    int BalanceCents { get; }

    IReadOnlyDictionary<CoinDenomination, int> InsertedCoins { get; }

    int InsertCoin(CoinDenomination denomination);

    (int ReturnedCents, IReadOnlyDictionary<CoinDenomination, int> ReturnedCoins) ReturnCoins();

    void Reset();
}

using VendingMachine.Api.Models;

namespace VendingMachine.Api.Services;

/// <summary>
/// Greedy largest-denomination-first change making. This is optimal (not just a heuristic)
/// for the standard US coin system used here (nickel/dime/quarter/dollar).
/// </summary>
public class ChangeMakingService : IChangeMakingService
{
    private static readonly CoinDenomination[] DenominationsDescending =
        [.. Enum.GetValues<CoinDenomination>().OrderDescending()];

    public IReadOnlyDictionary<CoinDenomination, int>? MakeChange(
        int amountCents,
        IReadOnlyDictionary<CoinDenomination, int> availableInventory)
    {
        var result = new Dictionary<CoinDenomination, int>();
        var remaining = amountCents;

        foreach (var denomination in DenominationsDescending)
        {
            if (remaining <= 0)
            {
                break;
            }

            var value = (int)denomination;
            var available = availableInventory.GetValueOrDefault(denomination);
            var count = Math.Min(available, remaining / value);

            if (count > 0)
            {
                result[denomination] = count;
                remaining -= count * value;
            }
        }

        return remaining == 0 ? result : null;
    }
}

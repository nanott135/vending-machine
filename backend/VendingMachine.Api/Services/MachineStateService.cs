using VendingMachine.Api.Models;

namespace VendingMachine.Api.Services;

/// <summary>Singleton - a real machine has exactly one pending transaction at a time.</summary>
public class MachineStateService : IMachineStateService
{
    private readonly Lock _lock = new();
    private readonly Dictionary<CoinDenomination, int> _insertedCoins = [];

    public int BalanceCents { get; private set; }

    public IReadOnlyDictionary<CoinDenomination, int> InsertedCoins
    {
        get
        {
            lock (_lock)
            {
                return new Dictionary<CoinDenomination, int>(_insertedCoins);
            }
        }
    }

    public int InsertCoin(CoinDenomination denomination)
    {
        lock (_lock)
        {
            _insertedCoins[denomination] = _insertedCoins.GetValueOrDefault(denomination) + 1;
            BalanceCents += (int)denomination;
            return BalanceCents;
        }
    }

    public (int ReturnedCents, IReadOnlyDictionary<CoinDenomination, int> ReturnedCoins) ReturnCoins()
    {
        lock (_lock)
        {
            var returnedCoins = new Dictionary<CoinDenomination, int>(_insertedCoins);
            var returnedCents = BalanceCents;

            _insertedCoins.Clear();
            BalanceCents = 0;

            return (returnedCents, returnedCoins);
        }
    }

    public void Reset()
    {
        lock (_lock)
        {
            _insertedCoins.Clear();
            BalanceCents = 0;
        }
    }
}

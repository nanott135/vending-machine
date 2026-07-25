using VendingMachine.Api.Models;
using VendingMachine.Api.Services;

namespace VendingMachine.Api.Tests;

public class ChangeMakingServiceTests
{
    private readonly ChangeMakingService _sut = new();

    [Fact]
    public void MakeChange_ZeroAmount_ReturnsEmptyBreakdown()
    {
        var result = _sut.MakeChange(0, new Dictionary<CoinDenomination, int>());

        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public void MakeChange_ExactChangeAvailable_PrefersLargestDenominationsFirst()
    {
        var inventory = new Dictionary<CoinDenomination, int>
        {
            [CoinDenomination.Dollar] = 5,
            [CoinDenomination.Quarter] = 5,
            [CoinDenomination.Dime] = 5,
            [CoinDenomination.Nickel] = 5,
        };

        var result = _sut.MakeChange(125, inventory);

        Assert.NotNull(result);
        Assert.Equal(1, result[CoinDenomination.Dollar]);
        Assert.Equal(1, result[CoinDenomination.Quarter]);
        Assert.False(result.ContainsKey(CoinDenomination.Dime));
        Assert.False(result.ContainsKey(CoinDenomination.Nickel));
    }

    [Fact]
    public void MakeChange_FallsBackToSmallerDenominationsWhenLargerUnavailable()
    {
        var inventory = new Dictionary<CoinDenomination, int>
        {
            [CoinDenomination.Dollar] = 0,
            [CoinDenomination.Quarter] = 4,
            [CoinDenomination.Dime] = 0,
            [CoinDenomination.Nickel] = 0,
        };

        var result = _sut.MakeChange(100, inventory);

        Assert.NotNull(result);
        Assert.Equal(4, result[CoinDenomination.Quarter]);
    }

    [Fact]
    public void MakeChange_InsufficientInventory_ReturnsNull()
    {
        var inventory = new Dictionary<CoinDenomination, int>
        {
            [CoinDenomination.Dollar] = 10,
            [CoinDenomination.Quarter] = 10,
            [CoinDenomination.Dime] = 5,
            [CoinDenomination.Nickel] = 0,
        };

        // 5 cents owed but no nickels, and every other denomination is too large.
        var result = _sut.MakeChange(5, inventory);

        Assert.Null(result);
    }
}

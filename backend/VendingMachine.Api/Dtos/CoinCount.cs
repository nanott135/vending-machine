using VendingMachine.Api.Models;

namespace VendingMachine.Api.Dtos;

public record CoinCount(CoinDenomination Denomination, int Count);

using VendingMachine.Api.Models;

namespace VendingMachine.Api.Dtos;

public record InsertCoinRequest(CoinDenomination Denomination);

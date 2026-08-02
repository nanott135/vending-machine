namespace VendingMachine.Api.Dtos;

public record MachineBalanceDto(int BalanceCents);

public record ReturnCoinsResult(int ReturnedCents, IReadOnlyList<CoinCount> ReturnedCoins);

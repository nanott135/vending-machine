namespace VendingMachine.Api.Dtos;

/// <summary>
/// The coins physically loaded in the machine - the durable DB inventory it can pay change from,
/// not the ephemeral coins inserted for the current pending transaction.
/// </summary>
public record MachineInventoryDto(IReadOnlyList<CoinCount> Coins, int TotalCents);

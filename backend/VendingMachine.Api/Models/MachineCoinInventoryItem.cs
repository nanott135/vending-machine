namespace VendingMachine.Api.Models;

/// <summary>Coins physically loaded in the machine, used to accept deposits and dispense change.</summary>
public class MachineCoinInventoryItem
{
    public int Id { get; set; }
    public CoinDenomination Denomination { get; set; }
    public int Count { get; set; }
}

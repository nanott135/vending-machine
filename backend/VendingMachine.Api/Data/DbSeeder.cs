using VendingMachine.Api.Models;

namespace VendingMachine.Api.Data;

/// <summary>Seed data baked into the initial EF Core migration via HasData.</summary>
public static class DbSeeder
{
    public static IReadOnlyList<Product> Products { get; } =
    [
        new() { Id = 1, Code = "A1", Name = "Cola", PriceCents = 125, Quantity = 10, SlotOrder = 1 },
        new() { Id = 2, Code = "A2", Name = "Diet Cola", PriceCents = 125, Quantity = 8, SlotOrder = 2 },
        new() { Id = 3, Code = "A3", Name = "Root Beer", PriceCents = 125, Quantity = 0, SlotOrder = 3 },
        new() { Id = 4, Code = "B1", Name = "Orange Soda", PriceCents = 150, Quantity = 6, SlotOrder = 4 },
        new() { Id = 5, Code = "B2", Name = "Sparkling Water", PriceCents = 150, Quantity = 12, SlotOrder = 5 },
        new() { Id = 6, Code = "B3", Name = "Bottled Water", PriceCents = 100, Quantity = 15, SlotOrder = 6 },
        new() { Id = 7, Code = "C1", Name = "Chips", PriceCents = 175, Quantity = 7, SlotOrder = 7 },
        new() { Id = 8, Code = "C2", Name = "Pretzels", PriceCents = 150, Quantity = 0, SlotOrder = 8 },
        new() { Id = 9, Code = "C3", Name = "Candy Bar", PriceCents = 125, Quantity = 20, SlotOrder = 9 },
        new() { Id = 10, Code = "D1", Name = "Chocolate Bar", PriceCents = 150, Quantity = 9, SlotOrder = 10 },
        new() { Id = 11, Code = "D2", Name = "Gum", PriceCents = 75, Quantity = 25, SlotOrder = 11 },
        new() { Id = 12, Code = "D3", Name = "Crackers", PriceCents = 175, Quantity = 5, SlotOrder = 12 },
    ];

    public static IReadOnlyList<MachineCoinInventoryItem> CoinInventory { get; } =
    [
        new() { Id = 1, Denomination = CoinDenomination.Nickel, Count = 40 },
        new() { Id = 2, Denomination = CoinDenomination.Dime, Count = 40 },
        new() { Id = 3, Denomination = CoinDenomination.Quarter, Count = 40 },
        new() { Id = 4, Denomination = CoinDenomination.Dollar, Count = 15 },
    ];
}

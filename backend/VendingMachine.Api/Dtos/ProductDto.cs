namespace VendingMachine.Api.Dtos;

public record ProductDto(string Code, string Name, int PriceCents, int Quantity, bool IsOutOfStock, int SlotOrder);

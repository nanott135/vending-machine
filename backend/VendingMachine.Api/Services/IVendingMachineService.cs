using VendingMachine.Api.Dtos;

namespace VendingMachine.Api.Services;

public interface IVendingMachineService
{
    Task<PurchaseResult> PurchaseAsync(string productCode, CancellationToken cancellationToken = default);
}

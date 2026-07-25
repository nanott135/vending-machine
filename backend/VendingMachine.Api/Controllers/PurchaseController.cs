using Microsoft.AspNetCore.Mvc;
using VendingMachine.Api.Dtos;
using VendingMachine.Api.Services;

namespace VendingMachine.Api.Controllers;

[ApiController]
[Route("api/purchase")]
public class PurchaseController(IVendingMachineService vendingMachineService) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<PurchaseResult>> Purchase(
        [FromBody] PurchaseRequest request,
        CancellationToken cancellationToken)
    {
        var result = await vendingMachineService.PurchaseAsync(request.ProductCode, cancellationToken);

        return result.Status switch
        {
            PurchaseStatus.Success => Ok(result),
            PurchaseStatus.ProductNotFound => NotFound(result),
            PurchaseStatus.OutOfStock => Conflict(result),
            PurchaseStatus.ChangeUnavailable => Conflict(result),
            PurchaseStatus.InsufficientFunds => StatusCode(StatusCodes.Status402PaymentRequired, result),
            _ => StatusCode(StatusCodes.Status500InternalServerError, result)
        };
    }
}

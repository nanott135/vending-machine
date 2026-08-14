using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VendingMachine.Api.Data;
using VendingMachine.Api.Dtos;
using VendingMachine.Api.Services;

namespace VendingMachine.Api.Controllers;

[ApiController]
[Route("api/machine")]
public class MachineController(
    IMachineStateService machineState,
    VendingMachineDbContext dbContext) : ControllerBase
{
    [HttpGet("balance")]
    public ActionResult<MachineBalanceDto> GetBalance() =>
        Ok(new MachineBalanceDto(machineState.BalanceCents));

    /// <summary>
    /// The coins loaded in the machine. This is the durable inventory only - coins inserted for the
    /// pending transaction aren't banked yet, so they're deliberately not counted here.
    /// </summary>
    [HttpGet("inventory")]
    public async Task<ActionResult<MachineInventoryDto>> GetInventory(CancellationToken cancellationToken)
    {
        // Denomination is persisted as its underlying int, so ordering by the enum is ordering by
        // coin value - largest first, matching how change breakdowns are reported.
        var inventory = await dbContext.CoinInventory
            .AsNoTracking()
            .OrderByDescending(c => c.Denomination)
            .Select(c => new CoinCount(c.Denomination, c.Count))
            .ToListAsync(cancellationToken);

        var totalCents = inventory.Sum(c => (int)c.Denomination * c.Count);

        return Ok(new MachineInventoryDto(inventory, totalCents));
    }

    [HttpPost("coins")]
    public ActionResult<MachineBalanceDto> InsertCoin([FromBody] InsertCoinRequest request)
    {
        var balanceCents = machineState.InsertCoin(request.Denomination);
        return Ok(new MachineBalanceDto(balanceCents));
    }

    [HttpPost("coins/return")]
    public ActionResult<ReturnCoinsResult> ReturnCoins()
    {
        var (returnedCents, returnedCoins) = machineState.ReturnCoins();

        var breakdown = returnedCoins
            .Select(kvp => new CoinCount(kvp.Key, kvp.Value))
            .OrderByDescending(c => (int)c.Denomination)
            .ToList();

        return Ok(new ReturnCoinsResult(returnedCents, breakdown));
    }
}

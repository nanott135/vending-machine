using Microsoft.AspNetCore.Mvc;
using VendingMachine.Api.Dtos;
using VendingMachine.Api.Services;

namespace VendingMachine.Api.Controllers;

[ApiController]
[Route("api/machine")]
public class MachineController(IMachineStateService machineState) : ControllerBase
{
    [HttpGet("balance")]
    public ActionResult<MachineBalanceDto> GetBalance() =>
        Ok(new MachineBalanceDto(machineState.BalanceCents));

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

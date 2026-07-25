using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VendingMachine.Api.Data;
using VendingMachine.Api.Dtos;

namespace VendingMachine.Api.Controllers;

[ApiController]
[Route("api/products")]
public class ProductsController(VendingMachineDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> GetProducts(CancellationToken cancellationToken)
    {
        var products = await dbContext.Products
            .OrderBy(p => p.SlotOrder)
            .Select(p => new ProductDto(p.Code, p.Name, p.PriceCents, p.Quantity, p.Quantity == 0, p.SlotOrder))
            .ToListAsync(cancellationToken);

        return Ok(products);
    }
}

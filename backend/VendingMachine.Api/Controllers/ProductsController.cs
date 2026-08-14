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
        // Materialise first, then map: the derived stock flags live in ProductDto.FromProduct so
        // this list and the purchase result can't disagree, and that method isn't translatable to
        // SQL. It's 12 rows, so pulling the entities back costs nothing.
        var products = await dbContext.Products
            .AsNoTracking()
            .OrderBy(p => p.SlotOrder)
            .ToListAsync(cancellationToken);

        return Ok(products.Select(ProductDto.FromProduct).ToList());
    }
}

using Microsoft.EntityFrameworkCore;
using VendingMachine.Api.Models;

namespace VendingMachine.Api.Data;

public class VendingMachineDbContext(DbContextOptions<VendingMachineDbContext> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<MachineCoinInventoryItem> CoinInventory => Set<MachineCoinInventoryItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>(entity =>
        {
            entity.Property(p => p.Code).HasMaxLength(4).IsRequired();
            entity.Property(p => p.Name).HasMaxLength(100).IsRequired();
            entity.HasIndex(p => p.Code).IsUnique();
            entity.HasData(DbSeeder.Products);
        });

        modelBuilder.Entity<MachineCoinInventoryItem>(entity =>
        {
            entity.HasIndex(c => c.Denomination).IsUnique();
            entity.HasData(DbSeeder.CoinInventory);
        });
    }
}

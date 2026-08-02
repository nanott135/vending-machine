using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace VendingMachine.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CoinInventory",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Denomination = table.Column<int>(type: "int", nullable: false),
                    Count = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CoinInventory", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Products",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PriceCents = table.Column<int>(type: "int", nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    SlotOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Products", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "CoinInventory",
                columns: new[] { "Id", "Count", "Denomination" },
                values: new object[,]
                {
                    { 1, 40, 5 },
                    { 2, 40, 10 },
                    { 3, 40, 25 },
                    { 4, 15, 100 }
                });

            migrationBuilder.InsertData(
                table: "Products",
                columns: new[] { "Id", "Code", "Name", "PriceCents", "Quantity", "SlotOrder" },
                values: new object[,]
                {
                    { 1, "A1", "Cola", 125, 10, 1 },
                    { 2, "A2", "Diet Cola", 125, 8, 2 },
                    { 3, "A3", "Root Beer", 125, 0, 3 },
                    { 4, "B1", "Orange Soda", 150, 6, 4 },
                    { 5, "B2", "Sparkling Water", 150, 12, 5 },
                    { 6, "B3", "Bottled Water", 100, 15, 6 },
                    { 7, "C1", "Chips", 175, 7, 7 },
                    { 8, "C2", "Pretzels", 150, 0, 8 },
                    { 9, "C3", "Candy Bar", 125, 20, 9 },
                    { 10, "D1", "Chocolate Bar", 150, 9, 10 },
                    { 11, "D2", "Gum", 75, 25, 11 },
                    { 12, "D3", "Crackers", 175, 5, 12 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_CoinInventory_Denomination",
                table: "CoinInventory",
                column: "Denomination",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Products_Code",
                table: "Products",
                column: "Code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CoinInventory");

            migrationBuilder.DropTable(
                name: "Products");
        }
    }
}

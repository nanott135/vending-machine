using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using VendingMachine.Api.Data;

namespace VendingMachine.Api.Tests;

/// <summary>
/// A throwaway relational database for a single test, backed by SQLite's in-memory mode.
/// </summary>
/// <remarks>
/// <para>
/// SQLite rather than EF Core's InMemory provider because SQLite is a real relational engine with
/// real transactions: <c>BeginTransaction</c>/<c>Commit</c>/rollback actually do something, so a
/// test can prove that a purchase failing partway leaves nothing half-written. The InMemory
/// provider silently ignores transactions (which is why the tests used to have to suppress
/// <c>TransactionIgnoredWarning</c>), so it could never pin that behaviour down.
/// </para>
/// <para>
/// A <c>DataSource=:memory:</c> database lives and dies with its connection, so the connection is
/// opened here and held for the lifetime of this object - close it and the schema and data vanish.
/// That is also what makes <see cref="CreateContext"/> useful: every context built from these
/// options shares the one connection, and therefore the one database, so a test can verify what
/// was actually committed by reading through a second, independent change tracker.
/// </para>
/// <para>
/// <c>EnsureCreated()</c> builds the schema from the model and applies its <c>HasData</c> seed, so
/// each test starts from the same 12 products and 40/40/40/15 coin inventory the real application
/// starts from.
/// </para>
/// </remarks>
public sealed class TestDatabase : IDisposable
{
    private readonly SqliteConnection _connection;

    public TestDatabase()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        Options = new DbContextOptionsBuilder<VendingMachineDbContext>()
            .UseSqlite(_connection)
            .Options;

        using var context = new VendingMachineDbContext(Options);
        context.Database.EnsureCreated();
    }

    /// <summary>Options bound to this test's connection, for constructing a context by hand.</summary>
    public DbContextOptions<VendingMachineDbContext> Options { get; }

    /// <summary>A fresh context - and therefore a fresh change tracker - over the same database.</summary>
    public VendingMachineDbContext CreateContext() => new(Options);

    public void Dispose() => _connection.Dispose();
}

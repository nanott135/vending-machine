using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using VendingMachine.Api.Data;
using VendingMachine.Api.Services;

const string AngularDevCorsPolicy = "AngularDev";

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<VendingMachineDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("VendingMachineDb")));

builder.Services.AddSingleton<IMachineStateService, MachineStateService>();
builder.Services.AddSingleton<IChangeMakingService, ChangeMakingService>();
builder.Services.AddScoped<IVendingMachineService, VendingMachineService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy(AngularDevCorsPolicy, policy =>
    {
        policy.WithOrigins("http://localhost:4200")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors(AngularDevCorsPolicy);

app.UseAuthorization();

app.MapControllers();

app.Run();

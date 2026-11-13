using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SRF.Inadimplencia.Api.Aplicacao.Servicos;
using SRF.Inadimplencia.Api.Dados;
using SRF.Inadimplencia.Api.Infraestrutura;

var builder = WebApplication.CreateBuilder(args);
var configuracao = builder.Configuration;

// ---------------------------------------------------------------------------
// Configuração obrigatória: falhar cedo, com mensagem clara, é melhor que subir inseguro.
// ---------------------------------------------------------------------------
var opcoesJwt = configuracao.GetSection("Jwt").Get<OpcoesJwt>() ?? new OpcoesJwt();
if (string.IsNullOrWhiteSpace(opcoesJwt.Chave) || Encoding.UTF8.GetByteCount(opcoesJwt.Chave) < 32)
{
    throw new InvalidOperationException(
        "Configure Jwt:Chave (variável de ambiente Jwt__Chave) com um segredo de pelo menos 32 caracteres. " +
        "Gere um com: openssl rand -base64 48");
}

var textoDeConexao = configuracao.GetConnectionString("Padrao");
if (string.IsNullOrWhiteSpace(textoDeConexao))
{
    throw new InvalidOperationException("Configure ConnectionStrings:Padrao (variável ConnectionStrings__Padrao).");
}

// ---------------------------------------------------------------------------
// Serviços
// ---------------------------------------------------------------------------
builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlServer(textoDeConexao));
builder.Services.AddHttpContextAccessor();

builder.Services.Configure<OpcoesJwt>(configuracao.GetSection("Jwt"));
builder.Services.AddSingleton<IRelogio, RelogioBrasilia>();
builder.Services.AddScoped<IServicoDeToken, ServicoDeToken>();
builder.Services.AddScoped<IAuditoria, Auditoria>();

builder.Services.AddScoped<ServicoSituacao>();
builder.Services.AddScoped<ServicoRotina>();
builder.Services.AddScoped<ServicoCobrancas>();
builder.Services.AddScoped<ServicoContratos>();
builder.Services.AddScoped<ServicoClientes>();
builder.Services.AddScoped<ServicoSolicitacoes>();
builder.Services.AddScoped<ServicoPainel>();
builder.Services.AddScoped<ServicoConfiguracoes>();
builder.Services.AddScoped<ServicoUsuarios>();
builder.Services.AddScoped<ServicoConsultas>();

builder.Services.AddHostedService<RotinaDiariaService>();

builder.Services
    .AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
    .ConfigureApiBehaviorOptions(o =>
    {
        // JSON malformado ou de tipo errado: resposta no mesmo formato dos demais erros da API.
        o.InvalidModelStateResponseFactory = _ => new BadRequestObjectResult(new
        {
            codigo = "REQUISICAO_INVALIDA",
            mensagem = "Os dados enviados não puderam ser lidos. Confira os campos e tente de novo."
        });
    });

// Autenticação JWT (RNF03: perfis Admin e Operacional vêm da claim "role").
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = opcoesJwt.Emissor,
            ValidateAudience = true,
            ValidAudience = opcoesJwt.Audiencia,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(opcoesJwt.Chave)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
            NameClaimType = "name",
            RoleClaimType = "role"
        };
        o.Events = new JwtBearerEvents
        {
            // Um usuário desativado, ou com perfil alterado, perde o acesso na hora, sem esperar o token expirar.
            OnTokenValidated = async contexto =>
            {
                var db = contexto.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var idTexto = contexto.Principal?.FindFirstValue("sub");
                var perfilNoToken = contexto.Principal?.FindFirstValue("role");
                if (!int.TryParse(idTexto, out var id))
                {
                    contexto.Fail("Token sem identificação do usuário.");
                    return;
                }
                var atual = await db.Usuarios.AsNoTracking()
                    .Where(u => u.Id == id)
                    .Select(u => new { u.Ativo, u.Perfil })
                    .FirstOrDefaultAsync(contexto.HttpContext.RequestAborted);
                if (atual is null || !atual.Ativo || atual.Perfil.ToString() != perfilNoToken)
                {
                    contexto.Fail("Sessão inválida.");
                }
            },
            OnChallenge = async contexto =>
            {
                contexto.HandleResponse();
                contexto.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await contexto.Response.WriteAsJsonAsync(new
                {
                    codigo = "NAO_AUTENTICADO",
                    mensagem = "Sua sessão terminou. Entre novamente."
                });
            },
            OnForbidden = async contexto =>
            {
                contexto.Response.StatusCode = StatusCodes.Status403Forbidden;
                await contexto.Response.WriteAsJsonAsync(new
                {
                    codigo = "SEM_PERMISSAO",
                    mensagem = "Esta ação é exclusiva do perfil Financeiro/Admin."
                });
            }
        };
    });

// Tudo exige login, exceto o que for marcado com [AllowAnonymous].
builder.Services.AddAuthorization(o =>
{
    o.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
});

// Freio contra adivinhação de senha: 10 tentativas por minuto por endereço de origem.
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy("login", contexto => RateLimitPartition.GetFixedWindowLimiter(
        contexto.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        }));
});

// CORS só é necessário se o site for hospedado em outro endereço que a API.
var origens = configuracao.GetSection("Cors:Origens").Get<string[]>() ?? Array.Empty<string>();
if (origens.Length > 0)
{
    builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origens).AllowAnyHeader().AllowAnyMethod()));
}

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(o =>
    {
        o.SwaggerDoc("v1", new OpenApiInfo { Title = "SRF Controle de Inadimplência", Version = "v1" });
        o.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Name = "Authorization",
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            In = ParameterLocation.Header,
            Description = "Cole o token devolvido por POST /api/auth/login."
        });
        o.AddSecurityRequirement(new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
                Array.Empty<string>()
            }
        });
    });
}

var app = builder.Build();

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

// Atrás de um proxy que termina o HTTPS (nginx, IIS, Azure), habilite para o redirecionamento e o
// limite de login enxergarem o protocolo e o endereço reais. Só habilite se a API for acessível APENAS pelo proxy.
if (configuracao.GetValue("Proxy:ConfiarEmCabecalhosEncaminhados", false))
{
    var encaminhados = new ForwardedHeadersOptions
    {
        ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
    };
    encaminhados.KnownNetworks.Clear();
    encaminhados.KnownProxies.Clear();
    app.UseForwardedHeaders(encaminhados);
}

app.UseMiddleware<TratadorDeErros>();

if (!app.Environment.IsDevelopment())
{
    // RNF02: tráfego somente por HTTPS.
    app.UseHsts();
    app.UseHttpsRedirection();
}
else
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseDefaultFiles();
app.UseStaticFiles();

if (origens.Length > 0) app.UseCors();

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Verificação de saúde para monitoramento (sem dados sensíveis).
app.MapGet("/saude", async (AppDbContext db, CancellationToken ct) =>
{
    var bancoOk = false;
    try
    {
        bancoOk = await db.Database.CanConnectAsync(ct);
    }
    catch
    {
        // Banco inacessível: reportado abaixo.
    }
    return Results.Json(new { status = bancoOk ? "ok" : "banco_indisponivel", banco = bancoOk },
        statusCode: bancoOk ? StatusCodes.Status200OK : StatusCodes.Status503ServiceUnavailable);
}).AllowAnonymous();

// O site (React, já compilado em wwwroot) responde por qualquer endereço que não seja da API.
// Endereços /api/... inexistentes devolvem 404 em JSON em vez de abrir o site.
app.MapFallback(async contexto =>
{
    var arquivo = Path.Combine(app.Environment.WebRootPath ?? "", "index.html");
    if (contexto.Request.Path.StartsWithSegments("/api") || !File.Exists(arquivo))
    {
        contexto.Response.StatusCode = StatusCodes.Status404NotFound;
        await contexto.Response.WriteAsJsonAsync(new { codigo = "NAO_ENCONTRADO", mensagem = "Endereço não encontrado." });
        return;
    }
    contexto.Response.ContentType = "text/html; charset=utf-8";
    await contexto.Response.SendFileAsync(arquivo);
}).AllowAnonymous();

await SemeadorDeSenhas.ExecutarAsync(app.Services, configuracao, app.Logger);

app.Run();

// Permite que testes de integração referenciem o ponto de entrada.
public partial class Program;

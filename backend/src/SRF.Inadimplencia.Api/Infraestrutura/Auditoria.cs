using SRF.Inadimplencia.Api.Dados;
using SRF.Inadimplencia.Api.Dominio;

namespace SRF.Inadimplencia.Api.Infraestrutura;

/// <summary>Trilha de auditoria: logins, alterações, baixas, mudanças de status.</summary>
public interface IAuditoria
{
    /// <summary>Adiciona o registro ao contexto; ele é gravado no próximo SaveChanges da operação.</summary>
    void Registrar(int? usuarioId, string acao, string? detalhes = null);
}

public sealed class Auditoria : IAuditoria
{
    private readonly AppDbContext _db;
    private readonly IRelogio _relogio;
    private readonly IHttpContextAccessor _http;

    public Auditoria(AppDbContext db, IRelogio relogio, IHttpContextAccessor http)
    {
        _db = db;
        _relogio = relogio;
        _http = http;
    }

    public void Registrar(int? usuarioId, string acao, string? detalhes = null)
    {
        if (detalhes is { Length: > 500 }) detalhes = detalhes[..500];
        _db.LogsAcesso.Add(new LogAcesso
        {
            UsuarioId = usuarioId,
            Acao = acao,
            Detalhes = detalhes,
            // Sem requisição (rotina de madrugada) não há endereço de origem.
            Ip = _http.HttpContext?.Connection.RemoteIpAddress?.ToString(),
            DataHora = _relogio.AgoraUtc
        });
    }
}

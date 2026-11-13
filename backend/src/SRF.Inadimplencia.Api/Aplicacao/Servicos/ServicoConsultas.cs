using Microsoft.EntityFrameworkCore;
using SRF.Inadimplencia.Api.Dados;

namespace SRF.Inadimplencia.Api.Aplicacao.Servicos;

/// <summary>Consultas somente leitura: avisos da régua de cobrança e registros de auditoria.</summary>
public class ServicoConsultas
{
    private const int Limite = 300;

    private readonly AppDbContext _db;

    public ServicoConsultas(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<AvisoDto>> ListarAvisosAsync(CancellationToken ct)
    {
        var avisos = await _db.Avisos.AsNoTracking()
            .Include(a => a.Cliente).Include(a => a.Parcela)
            .OrderByDescending(a => a.CriadoEm).ThenByDescending(a => a.Id)
            .Take(Limite)
            .ToListAsync(ct);
        return avisos.Select(Mapeadores.Aviso).ToList();
    }

    public async Task<List<RegistroDto>> ListarRegistrosAsync(CancellationToken ct)
    {
        var logs = await _db.LogsAcesso.AsNoTracking()
            .Include(l => l.Usuario)
            .OrderByDescending(l => l.DataHora).ThenByDescending(l => l.Id)
            .Take(Limite)
            .ToListAsync(ct);
        return logs
            .Select(l => new RegistroDto(l.Id, l.DataHora, l.Usuario?.Nome ?? "Sistema", l.Acao, l.Detalhes, l.Ip))
            .ToList();
    }
}

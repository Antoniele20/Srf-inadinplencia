using Microsoft.EntityFrameworkCore;
using SRF.Inadimplencia.Api.Dados;
using SRF.Inadimplencia.Api.Dominio;
using SRF.Inadimplencia.Api.Dominio.Regras;
using SRF.Inadimplencia.Api.Infraestrutura;

namespace SRF.Inadimplencia.Api.Aplicacao.Servicos;

/// <summary>
/// Calcula a situação financeira (semáforo, atraso, valor atualizado, bloqueio) de clientes a partir
/// das cobranças em aberto e das liberações. Só lê o banco; quem grava mudanças de status é o ServicoRotina.
/// </summary>
public class ServicoSituacao
{
    private readonly AppDbContext _db;
    private readonly IRelogio _relogio;

    public ServicoSituacao(AppDbContext db, IRelogio relogio)
    {
        _db = db;
        _relogio = relogio;
    }

    public DateOnly Hoje => _relogio.Hoje;

    /// <summary>Taxas e prazo de bloqueio vigentes. Sem linha de configuração, usa os valores padrão.</summary>
    public async Task<ConfigRegras> ObterRegrasAsync(CancellationToken ct)
    {
        var c = await _db.Configuracoes.AsNoTracking().FirstOrDefaultAsync(x => x.Id == 1, ct);
        return c is null
            ? ConfigRegras.Padrao
            : new ConfigRegras(c.MultaPercentual, c.JurosDiarioPercentual, c.DiasParaBloqueio, c.DiasAvisoPreVencimento);
    }

    /// <summary>Situação de cada cliente informado (sem cobranças em aberto = Verde).</summary>
    public async Task<Dictionary<int, SituacaoDoCliente>> AvaliarAsync(
        IReadOnlyCollection<int> clienteIds, ConfigRegras regras, CancellationToken ct)
    {
        var hoje = _relogio.Hoje;

        var abertas = await (
            from p in _db.Parcelas.AsNoTracking()
            join ct2 in _db.Contratos.AsNoTracking() on p.ContratoId equals ct2.Id
            where p.Status == StatusParcela.Aberta && clienteIds.Contains(ct2.ClienteId)
            select new { ct2.ClienteId, p.ValorOriginal, p.DataVencimento }
        ).ToListAsync(ct);

        var liberacoes = await _db.Liberacoes.AsNoTracking()
            .Where(l => clienteIds.Contains(l.ClienteId))
            .Select(l => new { l.ClienteId, l.DataFim, Revogada = l.RevogadaEm != null })
            .ToListAsync(ct);

        var parcelasPorCliente = abertas
            .GroupBy(x => x.ClienteId)
            .ToDictionary(g => g.Key, g => g.Select(x => new ParcelaEmAberto(x.ValorOriginal, x.DataVencimento)).ToList());
        var liberacoesPorCliente = liberacoes
            .GroupBy(x => x.ClienteId)
            .ToDictionary(g => g.Key, g => g.Select(x => new VigenciaLiberacao(x.DataFim, x.Revogada)).ToList());

        var resultado = new Dictionary<int, SituacaoDoCliente>();
        foreach (var id in clienteIds)
        {
            parcelasPorCliente.TryGetValue(id, out var parcelas);
            liberacoesPorCliente.TryGetValue(id, out var libs);
            resultado[id] = AvaliadorDeSituacao.Avaliar(
                parcelas ?? new List<ParcelaEmAberto>(),
                libs ?? new List<VigenciaLiberacao>(),
                regras,
                hoje);
        }
        return resultado;
    }

    public async Task<SituacaoDoCliente> AvaliarClienteAsync(int clienteId, CancellationToken ct)
    {
        var regras = await ObterRegrasAsync(ct);
        var mapa = await AvaliarAsync(new[] { clienteId }, regras, ct);
        return mapa[clienteId];
    }

    /// <summary>Resumo (com situação, contratos ativos e valor mensal) de uma lista de clientes.</summary>
    public async Task<List<ClienteResumoDto>> ResumirAsync(IReadOnlyCollection<Cliente> clientes, CancellationToken ct)
    {
        if (clientes.Count == 0) return new List<ClienteResumoDto>();

        var ids = clientes.Select(c => c.Id).ToList();
        var regras = await ObterRegrasAsync(ct);
        var situacoes = await AvaliarAsync(ids, regras, ct);

        var contratosAtivos = await _db.Contratos.AsNoTracking()
            .Where(c => c.Ativo && ids.Contains(c.ClienteId))
            .Select(c => new { c.ClienteId, c.ValorMensal })
            .ToListAsync(ct);
        var porCliente = contratosAtivos
            .GroupBy(c => c.ClienteId)
            .ToDictionary(g => g.Key, g => (Quantidade: g.Count(), Valor: g.Sum(x => x.ValorMensal)));

        return clientes.Select(c =>
        {
            porCliente.TryGetValue(c.Id, out var contratos);
            return Mapeadores.Resumo(
                c, situacoes[c.Id], contratos.Quantidade, CalculadoraDeEncargos.Arredondar(contratos.Valor));
        }).ToList();
    }

    public async Task<ClienteResumoDto> ResumirClienteAsync(Cliente cliente, CancellationToken ct) =>
        (await ResumirAsync(new[] { cliente }, ct))[0];
}

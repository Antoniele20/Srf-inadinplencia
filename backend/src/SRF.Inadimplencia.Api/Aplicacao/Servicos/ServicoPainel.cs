using Microsoft.EntityFrameworkCore;
using SRF.Inadimplencia.Api.Dados;
using SRF.Inadimplencia.Api.Dominio;
using SRF.Inadimplencia.Api.Dominio.Regras;
using SRF.Inadimplencia.Api.Infraestrutura;

namespace SRF.Inadimplencia.Api.Aplicacao.Servicos;

/// <summary>Painel gerencial (RF04): semáforo, totais, aging, evolução mensal e itens que pedem atenção.</summary>
public class ServicoPainel
{
    private readonly AppDbContext _db;
    private readonly ServicoSituacao _situacao;
    private readonly IRelogio _relogio;

    public ServicoPainel(AppDbContext db, ServicoSituacao situacao, IRelogio relogio)
    {
        _db = db;
        _situacao = situacao;
        _relogio = relogio;
    }

    public async Task<PainelDto> ObterAsync(CancellationToken ct)
    {
        var hoje = _relogio.Hoje;
        var regras = await _situacao.ObterRegrasAsync(ct);
        var arredondar = CalculadoraDeEncargos.Arredondar;

        // Clientes ativos e sua situação.
        var clientes = await _db.Clientes.AsNoTracking().Where(c => c.Ativo).ToListAsync(ct);
        var ativos = await _situacao.ResumirAsync(clientes, ct);

        var semaforo = new SemaforoDto(
            Verde: ativos.Count(c => c.Status == StatusCliente.Verde),
            Amarelo: ativos.Count(c => c.Status == StatusCliente.Amarelo),
            Vermelho: ativos.Count(c => c.Status == StatusCliente.Vermelho),
            Bloqueados: ativos.Count(c => c.Bloqueado),
            LiberadosTemporariamente: ativos.Count(c => c.LiberacaoAte is not null));

        var faixas = AvaliadorDeSituacao.Faixas
            .Select(faixa =>
            {
                var doGrupo = ativos.Where(c => c.FaixaAtraso == faixa).ToList();
                return new FaixaDto(faixa, doGrupo.Count, arredondar(doGrupo.Sum(c => c.ValorAtualizado)));
            })
            .ToList();

        int? proximoBloqueio = ativos
            .Where(c => c.DiasAteBloqueio is not null)
            .Select(c => c.DiasAteBloqueio)
            .Min();

        // Cobranças (apenas colunas necessárias para os totais).
        var parcelas = await _db.Parcelas.AsNoTracking()
            .Where(p => p.Status != StatusParcela.Cancelada)
            .Select(p => new
            {
                p.Status,
                p.DataVencimento,
                p.DataPagamento,
                p.ValorOriginal,
                p.ValorPago
            })
            .ToListAsync(ct);
        var abertas = parcelas.Where(p => p.Status == StatusParcela.Aberta).ToList();

        var limite30 = hoje.AddDays(30);
        var mesAtual = new DateOnly(hoje.Year, hoje.Month, 1);

        var totais = new TotaisDto(
            ValorVencido: arredondar(ativos.Sum(c => c.ValorVencido)),
            ValorEncargos: arredondar(ativos.Sum(c => c.ValorEncargos)),
            ValorAtualizado: arredondar(ativos.Sum(c => c.ValorAtualizado)),
            ValorAVencer30: arredondar(abertas
                .Where(p => p.DataVencimento >= hoje && p.DataVencimento <= limite30)
                .Sum(p => p.ValorOriginal)),
            RecebidoNoMes: arredondar(parcelas
                .Where(p => p.Status == StatusParcela.Paga && p.DataPagamento is not null
                            && p.DataPagamento.Value.Year == hoje.Year && p.DataPagamento.Value.Month == hoje.Month)
                .Sum(p => p.ValorPago ?? 0m)),
            CobrancasVencidas: abertas.Count(p => p.DataVencimento < hoje),
            ContratosAtivos: await _db.Contratos.CountAsync(c => c.Ativo, ct),
            ClientesAtivos: ativos.Count,
            ValorVencidoAmarelo: arredondar(ativos.Where(c => c.Status == StatusCliente.Amarelo).Sum(c => c.ValorAtualizado)),
            ValorVencidoVermelho: arredondar(ativos.Where(c => c.Status == StatusCliente.Vermelho).Sum(c => c.ValorAtualizado)),
            ProximoBloqueioEmDias: proximoBloqueio);

        // Honorários dos últimos seis meses, pelo mês de vencimento.
        var mensal = new List<MensalDto>();
        for (var i = 5; i >= 0; i--)
        {
            var mes = mesAtual.AddMonths(-i);
            var doMes = parcelas.Where(p => p.DataVencimento.Year == mes.Year && p.DataVencimento.Month == mes.Month).ToList();
            var recebido = doMes.Where(p => p.Status == StatusParcela.Paga).Sum(p => p.ValorOriginal);
            var emAberto = doMes.Where(p => p.Status == StatusParcela.Aberta).Sum(p => p.ValorOriginal);
            mensal.Add(new MensalDto(mes.ToString("yyyy-MM"), arredondar(recebido), arredondar(emAberto), arredondar(recebido + emAberto)));
        }

        var atencao = ativos
            .Where(c => c.DiasAtraso > 0)
            .OrderByDescending(c => c.DiasAtraso)
            .Take(6)
            .ToList();

        var limite7 = hoje.AddDays(7);
        var proximas = await _db.Parcelas.AsNoTracking()
            .Include(p => p.Contrato).ThenInclude(c => c.Cliente)
            .Include(p => p.BaixadaPor)
            .Where(p => p.Status == StatusParcela.Aberta && p.DataVencimento >= hoje && p.DataVencimento <= limite7)
            .OrderBy(p => p.DataVencimento).ThenBy(p => p.Id)
            .Take(6)
            .ToListAsync(ct);

        var recentes = await _db.Avisos.AsNoTracking()
            .Include(a => a.Cliente).Include(a => a.Parcela)
            .OrderByDescending(a => a.CriadoEm).ThenByDescending(a => a.Id)
            .Take(5)
            .ToListAsync(ct);

        return new PainelDto(
            hoje,
            semaforo,
            totais,
            faixas,
            mensal,
            atencao,
            proximas.Select(p => Mapeadores.Cobranca(p, regras, hoje)).ToList(),
            recentes.Select(Mapeadores.Aviso).ToList());
    }
}

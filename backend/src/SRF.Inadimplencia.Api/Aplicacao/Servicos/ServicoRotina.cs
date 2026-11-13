using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SRF.Inadimplencia.Api.Dados;
using SRF.Inadimplencia.Api.Dominio;
using SRF.Inadimplencia.Api.Dominio.Regras;
using SRF.Inadimplencia.Api.Infraestrutura;

namespace SRF.Inadimplencia.Api.Aplicacao.Servicos;

/// <summary>
/// Rotina diária (requisito RNF05) e recálculo do semáforo.
///   1. gera as cobranças mensais que ainda não existem;
///   2. recalcula o status de cada cliente e registra a mudança (Verde, Amarelo, Vermelho);
///   3. emite os avisos da régua de cobrança (lembrete, atraso por marcos, bloqueio).
/// A rotina é idempotente: pode rodar várias vezes no mesmo dia sem duplicar cobranças nem avisos
/// (índices únicos no banco garantem isso mesmo em caso de corrida).
/// </summary>
public class ServicoRotina
{
    private readonly AppDbContext _db;
    private readonly ServicoSituacao _situacao;
    private readonly IRelogio _relogio;
    private readonly IAuditoria _auditoria;

    public ServicoRotina(AppDbContext db, ServicoSituacao situacao, IRelogio relogio, IAuditoria auditoria)
    {
        _db = db;
        _situacao = situacao;
        _relogio = relogio;
        _auditoria = auditoria;
    }

    /// <summary>
    /// Adiciona ao contexto as cobranças mensais que faltam nos contratos ativos de clientes ativos.
    /// Não grava: quem chama faz o SaveChanges. Devolve quantas foram adicionadas.
    /// </summary>
    public async Task<int> GerarParcelasPendentesAsync(CancellationToken ct)
    {
        var hoje = _relogio.Hoje;
        var agora = _relogio.AgoraUtc;

        var contratos = await _db.Contratos.Where(c => c.Ativo && c.Cliente.Ativo).ToListAsync(ct);
        var existentes = (await _db.Parcelas.AsNoTracking()
                .Select(p => new { p.ContratoId, p.Competencia })
                .ToListAsync(ct))
            .Select(x => (x.ContratoId, x.Competencia))
            .ToHashSet();

        var geradas = 0;
        foreach (var contrato in contratos)
        {
            var devidos = GeradorDeVencimentos.Devidos(
                contrato.Ativo, contrato.DataInicio, contrato.DataFim, contrato.DiaVencimento, hoje);
            foreach (var devido in devidos)
            {
                if (!existentes.Add((contrato.Id, devido.Competencia))) continue;
                _db.Parcelas.Add(new Parcela
                {
                    ContratoId = contrato.Id,
                    Competencia = devido.Competencia,
                    DataVencimento = devido.DataVencimento,
                    ValorOriginal = contrato.ValorMensal,
                    Status = StatusParcela.Aberta,
                    CriadoEm = agora
                });
                geradas++;
            }
        }
        return geradas;
    }

    /// <summary>
    /// Aplica ao cliente o status calculado. Se mudou, registra no histórico e emite o aviso correspondente
    /// (Regularização ao voltar para Verde; Bloqueio ao ficar Vermelho). Não grava: quem chama faz o SaveChanges.
    /// </summary>
    public bool AplicarSituacao(Cliente cliente, SituacaoDoCliente situacao, ConfigRegras regras, int? usuarioId)
    {
        var anterior = cliente.Status;
        if (anterior == situacao.Status) return false;

        cliente.Status = situacao.Status;
        cliente.StatusDesde = _relogio.AgoraUtc;
        _auditoria.Registrar(usuarioId, "StatusAlterado", $"{cliente.Nome}: {anterior} para {situacao.Status}");

        if (cliente.Ativo && situacao.Status == StatusCliente.Verde)
        {
            AdicionarAviso(cliente, null, TipoAviso.Regularizacao, null, new DadosDoAviso());
        }
        if (cliente.Ativo && situacao.Status == StatusCliente.Vermelho)
        {
            AdicionarAviso(cliente, null, TipoAviso.Bloqueio, null, new DadosDoAviso
            {
                DiasParaBloqueio = regras.DiasParaBloqueio,
                ValorAtualizado = situacao.ValorAtualizado
            });
        }
        return true;
    }

    /// <summary>Monta o texto do aviso e adiciona ao contexto (canal "Sistema": nada é enviado para fora).</summary>
    public void AdicionarAviso(Cliente cliente, int? parcelaId, TipoAviso tipo, int? marco, DadosDoAviso dados)
    {
        var texto = ModelosDeAviso.Montar(tipo, dados with { Cliente = cliente.Nome });
        _db.Avisos.Add(new Aviso
        {
            ClienteId = cliente.Id,
            ParcelaId = parcelaId,
            Tipo = tipo,
            Marco = marco,
            Canal = "Sistema",
            Assunto = texto.Assunto,
            Mensagem = texto.Mensagem,
            Enviado = false,
            CriadoEm = _relogio.AgoraUtc
        });
    }

    /// <summary>Executa a rotina completa. <paramref name="origem"/> aparece no histórico (ex.: "Agendada 01:00").</summary>
    public async Task<ResultadoRotinaDto> ProcessarAsync(string origem, int? usuarioId, CancellationToken ct)
    {
        var hoje = _relogio.Hoje;

        var parcelasGeradas = await GerarParcelasPendentesAsync(ct);
        await _db.SaveChangesAsync(ct);

        var regras = await _situacao.ObterRegrasAsync(ct);
        var clientes = await _db.Clientes.Where(c => c.Ativo).ToListAsync(ct);
        var situacoes = await _situacao.AvaliarAsync(clientes.Select(c => c.Id).ToList(), regras, ct);

        var alterados = 0;
        foreach (var cliente in clientes)
        {
            if (AplicarSituacao(cliente, situacoes[cliente.Id], regras, null)) alterados++;
        }
        await _db.SaveChangesAsync(ct);

        var avisosGerados = await GerarAvisosDaReguaAsync(clientes, situacoes, regras, hoje, ct);
        var bloqueados = situacoes.Values.Count(s => s.Bloqueado);

        _auditoria.Registrar(usuarioId, "RotinaExecutada", string.Create(CultureInfo.InvariantCulture,
            $"{origem}: {parcelasGeradas} cobranças geradas, {alterados} mudanças de status, {avisosGerados} avisos, {bloqueados} bloqueados"));
        await _db.SaveChangesAsync(ct);

        return new ResultadoRotinaDto(hoje, _relogio.AgoraUtc, origem, parcelasGeradas, alterados, avisosGerados, bloqueados);
    }

    /// <summary>Data (Brasília) da última execução registrada, ou nulo se a rotina nunca rodou.</summary>
    public async Task<DateOnly?> DataDaUltimaRotinaAsync(CancellationToken ct)
    {
        var ultima = await _db.LogsAcesso.AsNoTracking()
            .Where(l => l.Acao == "RotinaExecutada")
            .OrderByDescending(l => l.DataHora)
            .Select(l => (DateTime?)l.DataHora)
            .FirstOrDefaultAsync(ct);
        return ultima is null ? null : _relogio.DataLocal(ultima.Value);
    }

    /// <summary>Régua de cobrança: lembretes, avisos de atraso por marco e aviso de bloqueio. Adiciona ao contexto.</summary>
    private async Task<int> GerarAvisosDaReguaAsync(
        List<Cliente> clientes,
        Dictionary<int, SituacaoDoCliente> situacoes,
        ConfigRegras regras,
        DateOnly hoje,
        CancellationToken ct)
    {
        var ids = clientes.Select(c => c.Id).ToList();

        var abertas = await (
            from p in _db.Parcelas.AsNoTracking()
            join c in _db.Contratos.AsNoTracking() on p.ContratoId equals c.Id
            where p.Status == StatusParcela.Aberta && ids.Contains(c.ClienteId)
            select new { p.Id, c.ClienteId, p.Competencia, p.DataVencimento, p.ValorOriginal }
        ).ToListAsync(ct);
        var abertasPorCliente = abertas.ToLookup(p => p.ClienteId);

        var emitidos = (await _db.Avisos.AsNoTracking()
                .Where(a => a.ParcelaId != null)
                .Select(a => new { a.ParcelaId, a.Tipo, a.Marco })
                .ToListAsync(ct))
            .Select(a => (a.ParcelaId!.Value, a.Tipo, a.Marco))
            .ToHashSet();

        var ultimosBloqueios = await _db.Avisos.AsNoTracking()
            .Where(a => a.Tipo == TipoAviso.Bloqueio)
            .GroupBy(a => a.ClienteId)
            .Select(g => new { ClienteId = g.Key, Ultimo = g.Max(a => a.CriadoEm) })
            .ToDictionaryAsync(x => x.ClienteId, x => x.Ultimo, ct);

        var gerados = 0;
        foreach (var cliente in clientes)
        {
            foreach (var p in abertasPorCliente[cliente.Id])
            {
                var dias = CalculadoraDeEncargos.DiasDeAtraso(p.DataVencimento, hoje);
                var numero = Numeracao.DaCobranca(p.DataVencimento, p.Id);

                if (dias == 0)
                {
                    var lembrar = ReguaDeCobranca.DeveLembrarVencimento(p.DataVencimento, hoje, regras.DiasAvisoPreVencimento);
                    if (lembrar && emitidos.Add((p.Id, TipoAviso.Lembrete, null)))
                    {
                        AdicionarAviso(cliente, p.Id, TipoAviso.Lembrete, null, new DadosDoAviso
                        {
                            Numero = numero,
                            Competencia = p.Competencia,
                            Vencimento = p.DataVencimento,
                            Valor = p.ValorOriginal,
                            Faltam = p.DataVencimento.DayNumber - hoje.DayNumber
                        });
                        gerados++;
                    }
                    continue;
                }

                var marco = ReguaDeCobranca.MarcoDeAtraso(dias);
                if (marco is not null && emitidos.Add((p.Id, TipoAviso.Atraso, marco)))
                {
                    var encargos = CalculadoraDeEncargos.Calcular(p.ValorOriginal, p.DataVencimento, hoje, regras);
                    AdicionarAviso(cliente, p.Id, TipoAviso.Atraso, marco, new DadosDoAviso
                    {
                        Numero = numero,
                        Vencimento = p.DataVencimento,
                        Dias = dias,
                        ValorAtualizado = encargos.ValorAtualizado,
                        DiasParaBloqueio = regras.DiasParaBloqueio
                    });
                    gerados++;
                }
            }

            // Um aviso de bloqueio por período em Vermelho.
            if (cliente.Status == StatusCliente.Vermelho)
            {
                var avisado = ultimosBloqueios.TryGetValue(cliente.Id, out var ultimo) && ultimo >= cliente.StatusDesde;
                if (!avisado)
                {
                    AdicionarAviso(cliente, null, TipoAviso.Bloqueio, null, new DadosDoAviso
                    {
                        DiasParaBloqueio = regras.DiasParaBloqueio,
                        ValorAtualizado = situacoes[cliente.Id].ValorAtualizado
                    });
                    gerados++;
                }
            }
        }

        await _db.SaveChangesAsync(ct);
        return gerados;
    }
}

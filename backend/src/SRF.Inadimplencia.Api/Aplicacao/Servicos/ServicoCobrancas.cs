using Microsoft.EntityFrameworkCore;
using SRF.Inadimplencia.Api.Dados;
using SRF.Inadimplencia.Api.Dominio;
using SRF.Inadimplencia.Api.Dominio.Regras;
using SRF.Inadimplencia.Api.Infraestrutura;

namespace SRF.Inadimplencia.Api.Aplicacao.Servicos;

/// <summary>
/// Cobranças (parcelas mensais): consulta, edição, baixa manual, estorno e cancelamento.
/// Toda alteração recalcula o semáforo do cliente na mesma requisição, então o desbloqueio
/// após a baixa é imediato (requisito RNF01, limite de 5 segundos).
/// </summary>
public class ServicoCobrancas
{
    private readonly AppDbContext _db;
    private readonly ServicoSituacao _situacao;
    private readonly ServicoRotina _rotina;
    private readonly IRelogio _relogio;
    private readonly IAuditoria _auditoria;

    public ServicoCobrancas(
        AppDbContext db, ServicoSituacao situacao, ServicoRotina rotina, IRelogio relogio, IAuditoria auditoria)
    {
        _db = db;
        _situacao = situacao;
        _rotina = rotina;
        _relogio = relogio;
        _auditoria = auditoria;
    }

    private IQueryable<Parcela> ComDetalhes() =>
        _db.Parcelas.Include(p => p.Contrato).ThenInclude(c => c.Cliente).Include(p => p.BaixadaPor);

    public async Task<List<CobrancaDto>> ListarAsync(string? situacao, int? clienteId, string? busca, CancellationToken ct)
    {
        var regras = await _situacao.ObterRegrasAsync(ct);
        var hoje = _relogio.Hoje;

        var consulta = ComDetalhes().AsNoTracking();
        if (clienteId is not null) consulta = consulta.Where(p => p.Contrato.ClienteId == clienteId);
        var parcelas = await consulta.ToListAsync(ct);

        var dtos = parcelas.Select(p => Mapeadores.Cobranca(p, regras, hoje));

        if (Enum.TryParse<SituacaoCobranca>(situacao, out var situacaoFiltro) && !string.IsNullOrWhiteSpace(situacao))
            dtos = dtos.Where(c => c.Situacao == situacaoFiltro);

        var termo = (busca ?? "").Trim();
        if (termo.Length > 0)
        {
            dtos = dtos.Where(c =>
                c.ClienteNome.Contains(termo, StringComparison.OrdinalIgnoreCase) ||
                c.Numero.Contains(termo, StringComparison.OrdinalIgnoreCase));
        }

        return dtos.OrderByDescending(c => c.DataVencimento).ThenByDescending(c => c.Id).ToList();
    }

    public async Task<ResultadoAlteracaoCobrancaDto> AtualizarAsync(
        int id, CobrancaEdicaoDto dto, int usuarioId, CancellationToken ct)
    {
        var parcela = await BuscarAsync(id, ct);
        if (parcela.Status != StatusParcela.Aberta)
            throw Erros.Regra("Só é possível alterar cobranças em aberto.");

        var erros = new Dictionary<string, string>();
        if (dto.ValorOriginal is null or <= 0) erros["valorOriginal"] = "Informe um valor maior que zero.";
        if (dto.DataVencimento is null) erros["dataVencimento"] = "Informe o vencimento.";
        Erros.ExigirSemErros(erros);

        var antes = await EstadoAntesAsync(parcela, ct);

        parcela.ValorOriginal = CalculadoraDeEncargos.Arredondar(dto.ValorOriginal!.Value);
        parcela.DataVencimento = dto.DataVencimento!.Value;
        parcela.Observacao = Texto(dto.Observacao, 500);
        _auditoria.Registrar(usuarioId, "CobrancaAlterada", FormattableString.Invariant(
            $"{Numeracao.DaCobranca(parcela.DataVencimento, parcela.Id)}: valor {parcela.ValorOriginal}, vencimento {parcela.DataVencimento:yyyy-MM-dd}"));
        await _db.SaveChangesAsync(ct);

        return await ConcluirAsync(parcela, antes, usuarioId, ct);
    }

    /// <summary>Baixa manual: registra o recebimento informado pelo Financeiro/Admin e libera o cliente se regularizou.</summary>
    public async Task<ResultadoAlteracaoCobrancaDto> BaixarAsync(
        int id, BaixaDto dto, int usuarioId, CancellationToken ct)
    {
        var parcela = await BuscarAsync(id, ct);
        if (parcela.Status != StatusParcela.Aberta)
            throw Erros.Regra("Esta cobrança não está em aberto.");

        var hoje = _relogio.Hoje;
        var erros = new Dictionary<string, string>();
        if (dto.DataPagamento is null) erros["dataPagamento"] = "Informe a data do pagamento.";
        else if (dto.DataPagamento > hoje) erros["dataPagamento"] = "A data do pagamento não pode ser futura.";
        if (dto.ValorPago is null or <= 0) erros["valorPago"] = "Informe o valor recebido.";
        Erros.ExigirSemErros(erros);

        var antes = await EstadoAntesAsync(parcela, ct);

        parcela.Status = StatusParcela.Paga;
        parcela.DataPagamento = dto.DataPagamento;
        parcela.ValorPago = CalculadoraDeEncargos.Arredondar(dto.ValorPago!.Value);
        parcela.BaixadaPor = await _db.Usuarios.FindAsync(new object[] { usuarioId }, ct);
        parcela.Observacao = Texto(dto.Observacao, 500) ?? parcela.Observacao;
        _auditoria.Registrar(usuarioId, "PagamentoRegistrado", FormattableString.Invariant(
            $"{Numeracao.DaCobranca(parcela.DataVencimento, parcela.Id)}: {parcela.ValorPago} em {parcela.DataPagamento:yyyy-MM-dd}"));
        await _db.SaveChangesAsync(ct);

        return await ConcluirAsync(parcela, antes, usuarioId, ct);
    }

    public async Task<ResultadoAlteracaoCobrancaDto> EstornarAsync(int id, int usuarioId, CancellationToken ct)
    {
        var parcela = await BuscarAsync(id, ct);
        if (parcela.Status != StatusParcela.Paga)
            throw Erros.Regra("Só é possível estornar cobranças pagas.");

        var antes = await EstadoAntesAsync(parcela, ct);

        parcela.Status = StatusParcela.Aberta;
        parcela.DataPagamento = null;
        parcela.ValorPago = null;
        parcela.BaixadaPor = null;
        parcela.BaixadaPorUsuarioId = null;
        _auditoria.Registrar(usuarioId, "PagamentoEstornado", Numeracao.DaCobranca(parcela.DataVencimento, parcela.Id));
        await _db.SaveChangesAsync(ct);

        return await ConcluirAsync(parcela, antes, usuarioId, ct);
    }

    public async Task<ResultadoAlteracaoCobrancaDto> CancelarAsync(
        int id, CancelamentoDto dto, int usuarioId, CancellationToken ct)
    {
        var parcela = await BuscarAsync(id, ct);
        if (parcela.Status != StatusParcela.Aberta)
            throw Erros.Regra("Só é possível cancelar cobranças em aberto.");

        var motivo = Texto(dto.Motivo, 500);
        if (motivo is null || motivo.Length < 5)
            throw Erros.Validacao(new Dictionary<string, string> { ["motivo"] = "Informe o motivo do cancelamento." });

        var antes = await EstadoAntesAsync(parcela, ct);

        parcela.Status = StatusParcela.Cancelada;
        parcela.Observacao = motivo;
        _auditoria.Registrar(usuarioId, "CobrancaCancelada",
            $"{Numeracao.DaCobranca(parcela.DataVencimento, parcela.Id)}: {motivo}");
        await _db.SaveChangesAsync(ct);

        return await ConcluirAsync(parcela, antes, usuarioId, ct);
    }

    // -----------------------------------------------------------------------

    private async Task<Parcela> BuscarAsync(int id, CancellationToken ct) =>
        await ComDetalhes().FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw Erros.NaoEncontrado("Cobrança");

    private readonly record struct EstadoAnterior(StatusCliente Status, bool Bloqueado);

    /// <summary>Situação do cliente antes de mexer na cobrança, para a tela mostrar o que mudou.</summary>
    private async Task<EstadoAnterior> EstadoAntesAsync(Parcela parcela, CancellationToken ct)
    {
        var cliente = parcela.Contrato.Cliente;
        var situacao = await _situacao.AvaliarClienteAsync(cliente.Id, ct);
        return new EstadoAnterior(cliente.Status, situacao.Bloqueado);
    }

    /// <summary>Recalcula o semáforo do cliente após a alteração e monta a resposta.</summary>
    private async Task<ResultadoAlteracaoCobrancaDto> ConcluirAsync(
        Parcela parcela, EstadoAnterior antes, int usuarioId, CancellationToken ct)
    {
        var cliente = parcela.Contrato.Cliente;
        var regras = await _situacao.ObterRegrasAsync(ct);
        var situacao = (await _situacao.AvaliarAsync(new[] { cliente.Id }, regras, ct))[cliente.Id];

        _rotina.AplicarSituacao(cliente, situacao, regras, usuarioId);
        await _db.SaveChangesAsync(ct);

        var resumo = await _situacao.ResumirClienteAsync(cliente, ct);
        return new ResultadoAlteracaoCobrancaDto(
            Mapeadores.Cobranca(parcela, regras, _relogio.Hoje),
            resumo,
            antes.Status,
            resumo.Status,
            antes.Bloqueado && !resumo.Bloqueado);
    }

    private static string? Texto(string? valor, int maximo)
    {
        var t = (valor ?? "").Trim();
        if (t.Length == 0) return null;
        return t.Length > maximo ? t[..maximo] : t;
    }
}

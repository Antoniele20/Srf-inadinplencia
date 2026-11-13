using Microsoft.EntityFrameworkCore;
using SRF.Inadimplencia.Api.Dados;
using SRF.Inadimplencia.Api.Dominio;
using SRF.Inadimplencia.Api.Dominio.Regras;
using SRF.Inadimplencia.Api.Infraestrutura;

namespace SRF.Inadimplencia.Api.Aplicacao.Servicos;

/// <summary>Contratos de honorário mensal (RF01): valor e dia de vencimento de cada cliente.</summary>
public class ServicoContratos
{
    private readonly AppDbContext _db;
    private readonly ServicoSituacao _situacao;
    private readonly ServicoRotina _rotina;
    private readonly IRelogio _relogio;
    private readonly IAuditoria _auditoria;

    public ServicoContratos(
        AppDbContext db, ServicoSituacao situacao, ServicoRotina rotina, IRelogio relogio, IAuditoria auditoria)
    {
        _db = db;
        _situacao = situacao;
        _rotina = rotina;
        _relogio = relogio;
        _auditoria = auditoria;
    }

    /// <summary>Contratos ativos primeiro, depois por nome do cliente. Com <paramref name="clienteId"/>, só os dele.</summary>
    public async Task<List<ContratoDto>> ListarAsync(int? clienteId, CancellationToken ct)
    {
        var hoje = _relogio.Hoje;

        var consulta = _db.Contratos.AsNoTracking().Include(c => c.Cliente).AsQueryable();
        if (clienteId is not null) consulta = consulta.Where(c => c.ClienteId == clienteId);
        var contratos = await consulta.ToListAsync(ct);

        var ids = contratos.Select(c => c.Id).ToList();
        var vencidas = await _db.Parcelas.AsNoTracking()
            .Where(p => p.Status == StatusParcela.Aberta && p.DataVencimento < hoje && ids.Contains(p.ContratoId))
            .GroupBy(p => p.ContratoId)
            .Select(g => new { ContratoId = g.Key, Quantidade = g.Count() })
            .ToDictionaryAsync(x => x.ContratoId, x => x.Quantidade, ct);

        return contratos
            .Select(c => Mapeadores.Contrato(c, vencidas.TryGetValue(c.Id, out var q) ? q : 0))
            .OrderByDescending(c => c.Ativo)
            .ThenBy(c => c.ClienteNome, StringComparer.Create(new System.Globalization.CultureInfo("pt-BR"), true))
            .ToList();
    }

    public async Task<ContratoDto> CriarAsync(ContratoEntradaDto dto, int usuarioId, CancellationToken ct)
    {
        var erros = new Dictionary<string, string>();
        var cliente = dto.ClienteId is null
            ? null
            : await _db.Clientes.FirstOrDefaultAsync(c => c.Id == dto.ClienteId, ct);
        if (cliente is null || !cliente.Ativo) erros["clienteId"] = "Escolha um cliente ativo.";
        if (dto.DataInicio is null) erros["dataInicio"] = "Informe a data de início.";
        ValidarCampos(dto.Descricao, dto.ValorMensal, dto.DiaVencimento, erros);
        Erros.ExigirSemErros(erros);

        var contrato = new Contrato
        {
            ClienteId = cliente!.Id,
            Descricao = dto.Descricao!.Trim(),
            ValorMensal = CalculadoraDeEncargos.Arredondar(dto.ValorMensal!.Value),
            DiaVencimento = dto.DiaVencimento!.Value,
            DataInicio = dto.DataInicio!.Value,
            Ativo = true,
            CriadoEm = _relogio.AgoraUtc
        };
        _db.Contratos.Add(contrato);
        await _db.SaveChangesAsync(ct);

        // As cobranças do contrato nascem na hora; o semáforo do cliente é recalculado em seguida.
        await _rotina.GerarParcelasPendentesAsync(ct);
        await _db.SaveChangesAsync(ct);

        var regras = await _situacao.ObterRegrasAsync(ct);
        var situacao = (await _situacao.AvaliarAsync(new[] { cliente.Id }, regras, ct))[cliente.Id];
        _rotina.AplicarSituacao(cliente, situacao, regras, usuarioId);
        _auditoria.Registrar(usuarioId, "ContratoCriado",
            $"{Numeracao.DoContrato(contrato.DataInicio, contrato.Id)} para {cliente.Nome}");
        await _db.SaveChangesAsync(ct);

        contrato.Cliente = cliente;
        return Mapeadores.Contrato(contrato, await ContarVencidasAsync(contrato.Id, ct));
    }

    public async Task<ContratoDto> AtualizarAsync(int id, ContratoEntradaDto dto, int usuarioId, CancellationToken ct)
    {
        var contrato = await BuscarAsync(id, ct);
        if (!contrato.Ativo) throw Erros.Regra("Contrato encerrado não pode ser alterado.");

        var erros = new Dictionary<string, string>();
        ValidarCampos(dto.Descricao, dto.ValorMensal, dto.DiaVencimento, erros);
        Erros.ExigirSemErros(erros);

        // Valor e dia valem para as próximas cobranças; as já emitidas não mudam.
        contrato.Descricao = dto.Descricao!.Trim();
        contrato.ValorMensal = CalculadoraDeEncargos.Arredondar(dto.ValorMensal!.Value);
        contrato.DiaVencimento = dto.DiaVencimento!.Value;
        _auditoria.Registrar(usuarioId, "ContratoAlterado", Numeracao.DoContrato(contrato.DataInicio, contrato.Id));
        await _db.SaveChangesAsync(ct);

        return Mapeadores.Contrato(contrato, await ContarVencidasAsync(contrato.Id, ct));
    }

    /// <summary>
    /// Encerra o contrato. Cobranças que ainda não venceram deixam de ser devidas (canceladas);
    /// as vencidas continuam em aberto e seguem valendo para o semáforo.
    /// </summary>
    public async Task<ContratoDto> EncerrarAsync(int id, int usuarioId, CancellationToken ct)
    {
        var contrato = await BuscarAsync(id, ct);
        if (!contrato.Ativo) throw Erros.Regra("Este contrato já está encerrado.");

        var hoje = _relogio.Hoje;
        contrato.Ativo = false;
        // O banco exige DataFim >= DataInicio (um contrato com início futuro também pode ser encerrado).
        contrato.DataFim = hoje > contrato.DataInicio ? hoje : contrato.DataInicio;

        var futuras = await _db.Parcelas
            .Where(p => p.ContratoId == contrato.Id && p.Status == StatusParcela.Aberta && p.DataVencimento > hoje)
            .ToListAsync(ct);
        foreach (var parcela in futuras)
        {
            parcela.Status = StatusParcela.Cancelada;
            parcela.Observacao = "Cancelada no encerramento do contrato.";
        }

        _auditoria.Registrar(usuarioId, "ContratoEncerrado", Numeracao.DoContrato(contrato.DataInicio, contrato.Id));
        await _db.SaveChangesAsync(ct);

        return Mapeadores.Contrato(contrato, await ContarVencidasAsync(contrato.Id, ct));
    }

    // -----------------------------------------------------------------------

    private async Task<Contrato> BuscarAsync(int id, CancellationToken ct) =>
        await _db.Contratos.Include(c => c.Cliente).FirstOrDefaultAsync(c => c.Id == id, ct)
        ?? throw Erros.NaoEncontrado("Contrato");

    private async Task<int> ContarVencidasAsync(int contratoId, CancellationToken ct)
    {
        var hoje = _relogio.Hoje;
        return await _db.Parcelas.AsNoTracking().CountAsync(
            p => p.ContratoId == contratoId && p.Status == StatusParcela.Aberta && p.DataVencimento < hoje, ct);
    }

    private static void ValidarCampos(string? descricao, decimal? valorMensal, int? diaVencimento, Dictionary<string, string> erros)
    {
        var texto = (descricao ?? "").Trim();
        if (texto.Length < 3) erros["descricao"] = "Descreva o serviço contratado.";
        else if (texto.Length > 200) erros["descricao"] = "A descrição pode ter no máximo 200 caracteres.";

        if (valorMensal is null or <= 0) erros["valorMensal"] = "Informe o valor do honorário mensal.";
        else if (valorMensal > 9_999_999_999m) erros["valorMensal"] = "Valor acima do permitido.";

        if (diaVencimento is null or < 1 or > 28) erros["diaVencimento"] = "Escolha um dia entre 1 e 28.";
    }
}

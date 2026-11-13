using Microsoft.EntityFrameworkCore;
using SRF.Inadimplencia.Api.Dados;
using SRF.Inadimplencia.Api.Dominio;
using SRF.Inadimplencia.Api.Dominio.Regras;
using SRF.Inadimplencia.Api.Infraestrutura;

namespace SRF.Inadimplencia.Api.Aplicacao.Servicos;

/// <summary>Parâmetros de multa, juros, prazo de bloqueio e antecedência dos lembretes (RF02).</summary>
public class ServicoConfiguracoes
{
    private readonly AppDbContext _db;
    private readonly ServicoSituacao _situacao;
    private readonly ServicoRotina _rotina;
    private readonly IRelogio _relogio;
    private readonly IAuditoria _auditoria;

    public ServicoConfiguracoes(
        AppDbContext db, ServicoSituacao situacao, ServicoRotina rotina, IRelogio relogio, IAuditoria auditoria)
    {
        _db = db;
        _situacao = situacao;
        _rotina = rotina;
        _relogio = relogio;
        _auditoria = auditoria;
    }

    public async Task<ConfiguracaoDto> ObterAsync(CancellationToken ct)
    {
        var c = await _db.Configuracoes.AsNoTracking().Include(x => x.AtualizadoPor).FirstOrDefaultAsync(x => x.Id == 1, ct);
        if (c is null)
        {
            var p = ConfigRegras.Padrao;
            return new ConfiguracaoDto(p.MultaPercentual, p.JurosDiarioPercentual, p.DiasParaBloqueio, p.DiasAvisoPreVencimento,
                _relogio.AgoraUtc, null);
        }
        return Mapear(c);
    }

    public async Task<ConfiguracaoDto> SalvarAsync(ConfiguracaoEntradaDto dto, int usuarioId, CancellationToken ct)
    {
        var erros = new Dictionary<string, string>();
        var multa = dto.MultaPercentual;
        var juros = dto.JurosDiarioPercentual;
        var dias = dto.DiasParaBloqueio;
        var antecedencia = dto.DiasAvisoPreVencimento;

        if (multa is null or < 0 or > 20) erros["multaPercentual"] = "Informe um percentual entre 0 e 20.";
        if (juros is null or < 0 or > 1) erros["jurosDiarioPercentual"] = "Informe um percentual entre 0 e 1 ao dia.";
        if (dias is null || dias != decimal.Truncate(dias.Value) || dias < 1 || dias > 180)
            erros["diasParaBloqueio"] = "Informe um prazo entre 1 e 180 dias.";
        if (antecedencia is null || antecedencia != decimal.Truncate(antecedencia.Value) || antecedencia < 0 || antecedencia > 15)
            erros["diasAvisoPreVencimento"] = "Informe de 0 a 15 dias.";
        Erros.ExigirSemErros(erros);

        var config = await _db.Configuracoes.FirstOrDefaultAsync(x => x.Id == 1, ct);
        if (config is null)
        {
            config = new Configuracao { Id = 1 };
            _db.Configuracoes.Add(config);
        }
        config.MultaPercentual = multa!.Value;
        config.JurosDiarioPercentual = juros!.Value;
        config.DiasParaBloqueio = (int)dias!.Value;
        config.DiasAvisoPreVencimento = (int)antecedencia!.Value;
        config.AtualizadoEm = _relogio.AgoraUtc;
        config.AtualizadoPorUsuarioId = usuarioId;

        _auditoria.Registrar(usuarioId, "ConfiguracaoAlterada", FormattableString.Invariant(
            $"multa {config.MultaPercentual}%, juros {config.JurosDiarioPercentual}% ao dia, bloqueio após {config.DiasParaBloqueio} dias"));
        await _db.SaveChangesAsync(ct);

        // O prazo de bloqueio pode ter mudado: o semáforo de todos é recalculado na hora.
        var regras = await _situacao.ObterRegrasAsync(ct);
        var clientes = await _db.Clientes.Where(c => c.Ativo).ToListAsync(ct);
        var situacoes = await _situacao.AvaliarAsync(clientes.Select(c => c.Id).ToList(), regras, ct);
        foreach (var cliente in clientes) _rotina.AplicarSituacao(cliente, situacoes[cliente.Id], regras, usuarioId);
        await _db.SaveChangesAsync(ct);

        return await ObterAsync(ct);
    }

    private static ConfiguracaoDto Mapear(Configuracao c) => new(
        c.MultaPercentual, c.JurosDiarioPercentual, c.DiasParaBloqueio, c.DiasAvisoPreVencimento,
        c.AtualizadoEm, c.AtualizadoPor?.Nome);
}

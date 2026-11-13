using Microsoft.EntityFrameworkCore;
using SRF.Inadimplencia.Api.Dados;
using SRF.Inadimplencia.Api.Dominio;
using SRF.Inadimplencia.Api.Infraestrutura;

namespace SRF.Inadimplencia.Api.Aplicacao.Servicos;

/// <summary>
/// Solicitações operacionais ("Nova Solicitação" e "Abertura de Processo").
/// É AQUI que o bloqueio operacional é imposto: cliente Vermelho, sem liberação temporária vigente,
/// não recebe novas demandas. A regra vive no servidor; esconder o botão na tela não basta.
/// </summary>
public class ServicoSolicitacoes
{
    private readonly AppDbContext _db;
    private readonly ServicoSituacao _situacao;
    private readonly IRelogio _relogio;
    private readonly IAuditoria _auditoria;

    public ServicoSolicitacoes(AppDbContext db, ServicoSituacao situacao, IRelogio relogio, IAuditoria auditoria)
    {
        _db = db;
        _situacao = situacao;
        _relogio = relogio;
        _auditoria = auditoria;
    }

    public async Task<List<SolicitacaoDto>> ListarAsync(CancellationToken ct)
    {
        var solicitacoes = await _db.Solicitacoes.AsNoTracking()
            .Include(s => s.Cliente).Include(s => s.Usuario)
            .OrderByDescending(s => s.CriadoEm).ThenByDescending(s => s.Id)
            .ToListAsync(ct);
        return solicitacoes.Select(Mapeadores.Solicitacao).ToList();
    }

    public async Task<SolicitacaoDto> CriarAsync(SolicitacaoEntradaDto dto, int usuarioId, CancellationToken ct)
    {
        var erros = new Dictionary<string, string>();
        var cliente = dto.ClienteId is null
            ? null
            : await _db.Clientes.FirstOrDefaultAsync(c => c.Id == dto.ClienteId, ct);
        var descricao = (dto.Descricao ?? "").Trim();

        if (cliente is null || !cliente.Ativo) erros["clienteId"] = "Escolha um cliente ativo.";
        if (!Enum.TryParse<TipoSolicitacao>(dto.Tipo, out var tipo) || !Enum.IsDefined(tipo))
            erros["tipo"] = "Escolha o tipo.";
        if (descricao.Length < 5) erros["descricao"] = "Descreva a demanda.";
        else if (descricao.Length > 1000) erros["descricao"] = "A descrição pode ter no máximo 1000 caracteres.";
        Erros.ExigirSemErros(erros);

        // Bloqueio operacional.
        var situacao = await _situacao.AvaliarClienteAsync(cliente!.Id, ct);
        if (situacao.Bloqueado)
        {
            _auditoria.Registrar(usuarioId, "SolicitacaoBloqueada",
                $"{cliente.Nome}: tentativa recusada, {situacao.DiasAtraso} dias de atraso");
            await _db.SaveChangesAsync(ct); // o registro da tentativa precisa ficar, mesmo com a recusa
            throw new ErroDeNegocio(
                $"{cliente.Nome} está bloqueado por inadimplência ({situacao.DiasAtraso} dias de atraso). " +
                "Novas solicitações ficam suspensas até a regularização ou até uma liberação temporária do Financeiro.",
                "CLIENTE_BLOQUEADO");
        }

        var usuario = await _db.Usuarios.FindAsync(new object[] { usuarioId }, ct)
                      ?? throw new ErroDeNegocio("Sua sessão terminou. Entre novamente.", "NAO_AUTENTICADO", 401);
        var solicitacao = new Solicitacao
        {
            Cliente = cliente,
            Usuario = usuario,
            Tipo = tipo,
            Descricao = descricao,
            Status = StatusSolicitacao.Aberta,
            CriadoEm = _relogio.AgoraUtc
        };
        _db.Solicitacoes.Add(solicitacao);
        _auditoria.Registrar(usuarioId, "SolicitacaoCriada",
            $"{cliente.Nome}: {(descricao.Length > 80 ? descricao[..80] : descricao)}");
        await _db.SaveChangesAsync(ct);

        return Mapeadores.Solicitacao(solicitacao);
    }

    public async Task<SolicitacaoDto> ConcluirAsync(int id, int usuarioId, CancellationToken ct)
    {
        var solicitacao = await _db.Solicitacoes
                              .Include(s => s.Cliente).Include(s => s.Usuario)
                              .FirstOrDefaultAsync(s => s.Id == id, ct)
                          ?? throw Erros.NaoEncontrado("Solicitação");
        if (solicitacao.Status == StatusSolicitacao.Concluida)
            throw Erros.Regra("Esta solicitação já foi concluída.");

        solicitacao.Status = StatusSolicitacao.Concluida;
        solicitacao.ConcluidaEm = _relogio.AgoraUtc;
        _auditoria.Registrar(usuarioId, "SolicitacaoConcluida", $"#{solicitacao.Id}");
        await _db.SaveChangesAsync(ct);

        return Mapeadores.Solicitacao(solicitacao);
    }
}

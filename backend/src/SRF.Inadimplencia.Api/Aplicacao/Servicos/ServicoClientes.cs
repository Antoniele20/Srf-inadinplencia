using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SRF.Inadimplencia.Api.Dados;
using SRF.Inadimplencia.Api.Dominio;
using SRF.Inadimplencia.Api.Dominio.Regras;
using SRF.Inadimplencia.Api.Infraestrutura;

namespace SRF.Inadimplencia.Api.Aplicacao.Servicos;

/// <summary>Clientes, liberações temporárias e a lista de inadimplentes.</summary>
public class ServicoClientes
{
    private static readonly StringComparer OrdemPtBr = StringComparer.Create(new CultureInfo("pt-BR"), true);

    private readonly AppDbContext _db;
    private readonly ServicoSituacao _situacao;
    private readonly ServicoRotina _rotina;
    private readonly ServicoContratos _contratos;
    private readonly IRelogio _relogio;
    private readonly IAuditoria _auditoria;

    public ServicoClientes(
        AppDbContext db, ServicoSituacao situacao, ServicoRotina rotina, ServicoContratos contratos,
        IRelogio relogio, IAuditoria auditoria)
    {
        _db = db;
        _situacao = situacao;
        _rotina = rotina;
        _contratos = contratos;
        _relogio = relogio;
        _auditoria = auditoria;
    }

    public async Task<List<ClienteResumoDto>> ListarAsync(
        string? busca, string? status, bool incluirInativos, CancellationToken ct)
    {
        var consulta = _db.Clientes.AsNoTracking().AsQueryable();
        if (!incluirInativos) consulta = consulta.Where(c => c.Ativo);
        var resumos = await _situacao.ResumirAsync(await consulta.ToListAsync(ct), ct);

        IEnumerable<ClienteResumoDto> filtrados = resumos;
        if (Enum.TryParse<StatusCliente>(status, out var statusFiltro) && !string.IsNullOrWhiteSpace(status))
            filtrados = filtrados.Where(c => c.Status == statusFiltro);

        var termo = (busca ?? "").Trim();
        if (termo.Length > 0)
        {
            var digitos = Documento.SomenteDigitos(termo);
            filtrados = filtrados.Where(c =>
                c.Nome.Contains(termo, StringComparison.OrdinalIgnoreCase) ||
                c.Email.Contains(termo, StringComparison.OrdinalIgnoreCase) ||
                (digitos.Length > 0 && c.Documento.Contains(digitos)));
        }

        return filtrados.OrderBy(c => c.Nome, OrdemPtBr).ToList();
    }

    /// <summary>Clientes ativos com atraso, do mais crítico (Vermelho, mais dias) para o menos.</summary>
    public async Task<List<ClienteResumoDto>> ListarInadimplentesAsync(CancellationToken ct)
    {
        var ativos = await _db.Clientes.AsNoTracking().Where(c => c.Ativo).ToListAsync(ct);
        var resumos = await _situacao.ResumirAsync(ativos, ct);
        return resumos
            .Where(c => c.DiasAtraso > 0)
            .OrderBy(c => c.Status == StatusCliente.Vermelho ? 0 : c.Status == StatusCliente.Amarelo ? 1 : 2)
            .ThenByDescending(c => c.DiasAtraso)
            .ToList();
    }

    public async Task<ClienteDetalheDto> ObterAsync(int id, CancellationToken ct)
    {
        var cliente = await _db.Clientes.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct)
                      ?? throw Erros.NaoEncontrado("Cliente");
        var resumo = await _situacao.ResumirClienteAsync(cliente, ct);
        var regras = await _situacao.ObterRegrasAsync(ct);
        var hoje = _relogio.Hoje;

        var contratos = await _contratos.ListarAsync(id, ct);

        var parcelas = await _db.Parcelas.AsNoTracking()
            .Include(p => p.Contrato).ThenInclude(c => c.Cliente)
            .Include(p => p.BaixadaPor)
            .Where(p => p.Contrato.ClienteId == id)
            .OrderByDescending(p => p.DataVencimento).ThenByDescending(p => p.Id)
            .Take(36)
            .ToListAsync(ct);

        var avisos = await _db.Avisos.AsNoTracking()
            .Include(a => a.Cliente).Include(a => a.Parcela)
            .Where(a => a.ClienteId == id)
            .OrderByDescending(a => a.CriadoEm).ThenByDescending(a => a.Id)
            .Take(20)
            .ToListAsync(ct);

        var liberacoes = await _db.Liberacoes.AsNoTracking()
            .Include(l => l.Cliente).Include(l => l.Usuario)
            .Where(l => l.ClienteId == id)
            .OrderByDescending(l => l.DataInicio).ThenByDescending(l => l.Id)
            .ToListAsync(ct);

        var solicitacoes = await _db.Solicitacoes.AsNoTracking()
            .Include(s => s.Cliente).Include(s => s.Usuario)
            .Where(s => s.ClienteId == id)
            .OrderByDescending(s => s.CriadoEm).ThenByDescending(s => s.Id)
            .Take(20)
            .ToListAsync(ct);

        return new ClienteDetalheDto
        {
            Id = resumo.Id,
            Nome = resumo.Nome,
            Documento = resumo.Documento,
            Email = resumo.Email,
            Telefone = resumo.Telefone,
            Responsavel = resumo.Responsavel,
            Ativo = resumo.Ativo,
            Status = resumo.Status,
            StatusDesde = resumo.StatusDesde,
            Bloqueado = resumo.Bloqueado,
            LiberacaoAte = resumo.LiberacaoAte,
            DiasAtraso = resumo.DiasAtraso,
            FaixaAtraso = resumo.FaixaAtraso,
            DiasAteBloqueio = resumo.DiasAteBloqueio,
            ParcelasVencidas = resumo.ParcelasVencidas,
            ValorVencido = resumo.ValorVencido,
            ValorMulta = resumo.ValorMulta,
            ValorJuros = resumo.ValorJuros,
            ValorEncargos = resumo.ValorEncargos,
            ValorAtualizado = resumo.ValorAtualizado,
            ValorAVencer = resumo.ValorAVencer,
            ContratosAtivos = resumo.ContratosAtivos,
            ValorMensal = resumo.ValorMensal,
            Observacoes = cliente.Observacoes,
            CriadoEm = cliente.CriadoEm,
            Contratos = contratos,
            Cobrancas = parcelas.Select(p => Mapeadores.Cobranca(p, regras, hoje)).ToList(),
            Avisos = avisos.Select(Mapeadores.Aviso).ToList(),
            Liberacoes = liberacoes.Select(l => Mapeadores.Liberacao(l, hoje)).ToList(),
            Solicitacoes = solicitacoes.Select(Mapeadores.Solicitacao).ToList()
        };
    }

    public async Task<ClienteResumoDto> CriarAsync(ClienteEntradaDto dto, int usuarioId, CancellationToken ct)
    {
        var dados = await ValidarAsync(dto, null, ct);
        var agora = _relogio.AgoraUtc;
        var cliente = new Cliente
        {
            Nome = dados.Nome,
            Documento = dados.Documento,
            Email = dados.Email,
            Telefone = dados.Telefone,
            Responsavel = dados.Responsavel,
            Observacoes = dados.Observacoes,
            Ativo = true,
            Status = StatusCliente.Verde,
            StatusDesde = agora,
            CriadoEm = agora
        };
        _db.Clientes.Add(cliente);
        _auditoria.Registrar(usuarioId, "ClienteCriado", cliente.Nome);
        await _db.SaveChangesAsync(ct);
        return await _situacao.ResumirClienteAsync(cliente, ct);
    }

    public async Task<ClienteResumoDto> AtualizarAsync(int id, ClienteEntradaDto dto, int usuarioId, CancellationToken ct)
    {
        var cliente = await BuscarAsync(id, ct);
        var dados = await ValidarAsync(dto, id, ct);
        cliente.Nome = dados.Nome;
        cliente.Documento = dados.Documento;
        cliente.Email = dados.Email;
        cliente.Telefone = dados.Telefone;
        cliente.Responsavel = dados.Responsavel;
        cliente.Observacoes = dados.Observacoes;
        _auditoria.Registrar(usuarioId, "ClienteAlterado", cliente.Nome);
        await _db.SaveChangesAsync(ct);
        return await _situacao.ResumirClienteAsync(cliente, ct);
    }

    /// <summary>Inativar ou reativar. Ao reativar, gera as cobranças que faltam e recalcula o semáforo.</summary>
    public async Task<ClienteResumoDto> AlterarAtivoAsync(int id, bool ativo, int usuarioId, CancellationToken ct)
    {
        var cliente = await BuscarAsync(id, ct);
        cliente.Ativo = ativo;
        _auditoria.Registrar(usuarioId, ativo ? "ClienteReativado" : "ClienteInativado", cliente.Nome);
        await _db.SaveChangesAsync(ct);

        if (ativo)
        {
            await _rotina.GerarParcelasPendentesAsync(ct);
            await _db.SaveChangesAsync(ct);

            var regras = await _situacao.ObterRegrasAsync(ct);
            var situacao = (await _situacao.AvaliarAsync(new[] { cliente.Id }, regras, ct))[cliente.Id];
            _rotina.AplicarSituacao(cliente, situacao, regras, usuarioId);
            await _db.SaveChangesAsync(ct);
        }
        return await _situacao.ResumirClienteAsync(cliente, ct);
    }

    // -----------------------------------------------------------------------
    // Liberação temporária (RF06)
    // -----------------------------------------------------------------------

    public async Task<LiberacaoDto> ConcederLiberacaoAsync(
        int clienteId, LiberacaoEntradaDto dto, int usuarioId, CancellationToken ct)
    {
        var cliente = await BuscarAsync(clienteId, ct);
        var hoje = _relogio.Hoje;

        var situacao = await _situacao.AvaliarClienteAsync(cliente.Id, ct);
        if (situacao.Status != StatusCliente.Vermelho)
            throw Erros.Regra("A liberação temporária só se aplica a clientes com status Vermelho.");

        var erros = new Dictionary<string, string>();
        var motivo = (dto.Motivo ?? "").Trim();
        if (dto.DataFim is null || dto.DataFim < hoje) erros["dataFim"] = "Escolha uma data a partir de hoje.";
        else if (dto.DataFim.Value.DayNumber - hoje.DayNumber > 60)
            erros["dataFim"] = "A liberação temporária pode durar no máximo 60 dias.";
        if (motivo.Length < 10) erros["motivo"] = "Explique o motivo com pelo menos 10 caracteres.";
        else if (motivo.Length > 500) erros["motivo"] = "O motivo pode ter no máximo 500 caracteres.";
        Erros.ExigirSemErros(erros);

        var usuario = await _db.Usuarios.FindAsync(new object[] { usuarioId }, ct)
                      ?? throw new ErroDeNegocio("Sua sessão terminou. Entre novamente.", "NAO_AUTENTICADO", 401);
        var dataFim = dto.DataFim!.Value;

        var liberacao = new Liberacao
        {
            Cliente = cliente,
            Usuario = usuario,
            Motivo = motivo,
            DataInicio = _relogio.AgoraUtc,
            DataFim = dataFim
        };
        _db.Liberacoes.Add(liberacao);
        _rotina.AdicionarAviso(cliente, null, TipoAviso.Liberacao, null, new DadosDoAviso { DataFim = dataFim });
        _auditoria.Registrar(usuarioId, "LiberacaoConcedida",
            $"{cliente.Nome} até {dataFim:yyyy-MM-dd}: {motivo}");
        await _db.SaveChangesAsync(ct);

        return Mapeadores.Liberacao(liberacao, hoje);
    }

    public async Task<LiberacaoDto> RevogarLiberacaoAsync(int liberacaoId, int usuarioId, CancellationToken ct)
    {
        var liberacao = await _db.Liberacoes
                            .Include(l => l.Cliente).Include(l => l.Usuario)
                            .FirstOrDefaultAsync(l => l.Id == liberacaoId, ct)
                        ?? throw Erros.NaoEncontrado("Liberação");
        if (liberacao.RevogadaEm is not null) throw Erros.Regra("Esta liberação já foi revogada.");

        liberacao.RevogadaEm = _relogio.AgoraUtc;
        liberacao.RevogadaPorUsuarioId = usuarioId;
        _auditoria.Registrar(usuarioId, "LiberacaoRevogada", liberacao.Cliente.Nome);
        await _db.SaveChangesAsync(ct);

        return Mapeadores.Liberacao(liberacao, _relogio.Hoje);
    }

    // -----------------------------------------------------------------------

    private async Task<Cliente> BuscarAsync(int id, CancellationToken ct) =>
        await _db.Clientes.FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw Erros.NaoEncontrado("Cliente");

    private readonly record struct DadosValidos(
        string Nome, string Documento, string Email, string? Telefone, string? Responsavel, string? Observacoes);

    private async Task<DadosValidos> ValidarAsync(ClienteEntradaDto dto, int? idAtual, CancellationToken ct)
    {
        var erros = new Dictionary<string, string>();
        var nome = (dto.Nome ?? "").Trim();
        var documento = Documento.SomenteDigitos(dto.Documento);
        var email = (dto.Email ?? "").Trim();

        if (nome.Length < 3) erros["nome"] = "Informe o nome ou a razão social.";
        else if (nome.Length > 160) erros["nome"] = "O nome pode ter no máximo 160 caracteres.";

        if (!Documento.Valido(documento)) erros["documento"] = "Informe um CPF ou CNPJ válido.";
        else if (await _db.Clientes.AnyAsync(c => c.Documento == documento && c.Id != idAtual, ct))
            erros["documento"] = "Já existe um cliente com este documento.";

        if (!Documento.EmailValido(email)) erros["email"] = "Informe um e-mail válido.";

        Erros.ExigirSemErros(erros);
        return new DadosValidos(
            nome, documento, email,
            Opcional(dto.Telefone, 30), Opcional(dto.Responsavel, 120), Opcional(dto.Observacoes, 1000));
    }

    private static string? Opcional(string? valor, int maximo)
    {
        var t = (valor ?? "").Trim();
        if (t.Length == 0) return null;
        return t.Length > maximo ? t[..maximo] : t;
    }
}

using SRF.Inadimplencia.Api.Dominio;
using SRF.Inadimplencia.Api.Dominio.Regras;

namespace SRF.Inadimplencia.Api.Aplicacao;

/// <summary>
/// Converte entidades em DTOs. Cada método exige que as navegações citadas estejam carregadas
/// (Include) e diz quais são.
/// </summary>
public static class Mapeadores
{
    public static ClienteResumoDto Resumo(Cliente c, SituacaoDoCliente s, int contratosAtivos, decimal valorMensal) => new()
    {
        Id = c.Id,
        Nome = c.Nome,
        Documento = c.Documento,
        Email = c.Email,
        Telefone = c.Telefone,
        Responsavel = c.Responsavel,
        Ativo = c.Ativo,
        Status = s.Status,
        StatusDesde = c.StatusDesde,
        Bloqueado = s.Bloqueado,
        LiberacaoAte = s.LiberacaoAte,
        DiasAtraso = s.DiasAtraso,
        FaixaAtraso = s.FaixaAtraso,
        DiasAteBloqueio = s.DiasAteBloqueio,
        ParcelasVencidas = s.ParcelasVencidas,
        ValorVencido = s.ValorVencido,
        ValorMulta = s.ValorMulta,
        ValorJuros = s.ValorJuros,
        ValorEncargos = s.ValorEncargos,
        ValorAtualizado = s.ValorAtualizado,
        ValorAVencer = s.ValorAVencer,
        ContratosAtivos = contratosAtivos,
        ValorMensal = valorMensal
    };

    /// <summary>Exige: c.Cliente.</summary>
    public static ContratoDto Contrato(Contrato c, int parcelasVencidas) => new(
        c.Id,
        Numeracao.DoContrato(c.DataInicio, c.Id),
        c.ClienteId,
        c.Cliente.Nome,
        c.Descricao,
        c.ValorMensal,
        c.DiaVencimento,
        c.DataInicio,
        c.DataFim,
        c.Ativo,
        parcelasVencidas,
        parcelasVencidas > 0);

    /// <summary>Exige: p.Contrato.Cliente e p.BaixadaPor (se houver baixa).</summary>
    public static CobrancaDto Cobranca(Parcela p, ConfigRegras config, DateOnly hoje)
    {
        var encargos = p.Status == StatusParcela.Aberta
            ? CalculadoraDeEncargos.Calcular(p.ValorOriginal, p.DataVencimento, hoje, config)
            : new ResultadoEncargos(0, 0m, 0m, p.ValorOriginal);

        return new CobrancaDto(
            p.Id,
            Numeracao.DaCobranca(p.DataVencimento, p.Id),
            p.ContratoId,
            Numeracao.DoContrato(p.Contrato.DataInicio, p.Contrato.Id),
            p.Contrato.ClienteId,
            p.Contrato.Cliente.Nome,
            p.Competencia,
            p.DataVencimento,
            p.ValorOriginal,
            p.Status,
            Numeracao.SituacaoDaCobranca(p.Status, p.DataVencimento, hoje),
            encargos.DiasAtraso,
            encargos.Multa,
            encargos.Juros,
            encargos.ValorAtualizado,
            p.DataPagamento,
            p.ValorPago,
            p.Observacao,
            p.BaixadaPor?.Nome);
    }

    /// <summary>Exige: a.Cliente e a.Parcela (se houver).</summary>
    public static AvisoDto Aviso(Aviso a) => new(
        a.Id,
        a.ClienteId,
        a.Cliente.Nome,
        a.ParcelaId,
        a.Parcela is null ? null : Numeracao.DaCobranca(a.Parcela.DataVencimento, a.Parcela.Id),
        a.Tipo,
        a.Canal,
        a.Assunto,
        a.Mensagem,
        a.Enviado,
        a.CriadoEm);

    /// <summary>Exige: l.Cliente e l.Usuario.</summary>
    public static LiberacaoDto Liberacao(Liberacao l, DateOnly hoje) => new(
        l.Id,
        l.ClienteId,
        l.Cliente.Nome,
        l.Motivo,
        l.DataInicio,
        l.DataFim,
        l.RevogadaEm,
        l.Usuario.Nome,
        l.RevogadaEm is null && l.DataFim >= hoje);

    /// <summary>Exige: s.Cliente e s.Usuario.</summary>
    public static SolicitacaoDto Solicitacao(Solicitacao s) => new(
        s.Id,
        s.ClienteId,
        s.Cliente.Nome,
        s.Tipo,
        s.Descricao,
        s.Status,
        s.CriadoEm,
        s.Usuario.Nome,
        s.ConcluidaEm);

    public static UsuarioDto Usuario(Usuario u) => new(u.Id, u.Nome, u.Email, u.Perfil, u.Ativo, u.CriadoEm, u.UltimoAcesso);
}

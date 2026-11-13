using SRF.Inadimplencia.Api.Dominio;

namespace SRF.Inadimplencia.Api.Aplicacao;

// Contrato JSON com o front-end (frontend/src/api/http.js). Os nomes saem em camelCase.
// Os campos de ENTRADA são todos opcionais de propósito: quem recusa um campo vazio ou
// inválido é o serviço, com a mensagem do campo, no formato { erros: { campo: "mensagem" } }.

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

public sealed record LoginDto(string? Email, string? Senha);

public sealed record ClienteEntradaDto(
    string? Nome, string? Documento, string? Email, string? Telefone, string? Responsavel, string? Observacoes);

public sealed record AtivoDto(bool? Ativo);

public sealed record LiberacaoEntradaDto(DateOnly? DataFim, string? Motivo);

public sealed record ContratoEntradaDto(
    int? ClienteId, string? Descricao, decimal? ValorMensal, int? DiaVencimento, DateOnly? DataInicio);

public sealed record CobrancaEdicaoDto(decimal? ValorOriginal, DateOnly? DataVencimento, string? Observacao);

public sealed record BaixaDto(DateOnly? DataPagamento, decimal? ValorPago, string? Observacao);

public sealed record CancelamentoDto(string? Motivo);

public sealed record SolicitacaoEntradaDto(int? ClienteId, string? Tipo, string? Descricao);

public sealed record ConfiguracaoEntradaDto(
    decimal? MultaPercentual, decimal? JurosDiarioPercentual, decimal? DiasParaBloqueio, decimal? DiasAvisoPreVencimento);

public sealed record UsuarioEntradaDto(string? Nome, string? Email, string? Perfil, string? Senha, bool? Ativo);

// ---------------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------------

public sealed record UsuarioSessaoDto(int Id, string Nome, string Email, PerfilUsuario Perfil);

public sealed record SessaoDto(string Token, DateTime ExpiraEm, UsuarioSessaoDto Usuario);

public sealed record UsuarioDto(
    int Id, string Nome, string Email, PerfilUsuario Perfil, bool Ativo, DateTime CriadoEm, DateTime? UltimoAcesso);

public class ClienteResumoDto
{
    public int Id { get; init; }
    public string Nome { get; init; } = "";
    public string Documento { get; init; } = "";
    public string Email { get; init; } = "";
    public string? Telefone { get; init; }
    public string? Responsavel { get; init; }
    public bool Ativo { get; init; }
    public StatusCliente Status { get; init; }
    public DateTime StatusDesde { get; init; }
    public bool Bloqueado { get; init; }
    public DateOnly? LiberacaoAte { get; init; }
    public int DiasAtraso { get; init; }
    public string FaixaAtraso { get; init; } = "";
    public int? DiasAteBloqueio { get; init; }
    public int ParcelasVencidas { get; init; }
    public decimal ValorVencido { get; init; }
    public decimal ValorMulta { get; init; }
    public decimal ValorJuros { get; init; }
    public decimal ValorEncargos { get; init; }
    public decimal ValorAtualizado { get; init; }
    public decimal ValorAVencer { get; init; }
    public int ContratosAtivos { get; init; }
    public decimal ValorMensal { get; init; }
}

public sealed class ClienteDetalheDto : ClienteResumoDto
{
    public string? Observacoes { get; init; }
    public DateTime CriadoEm { get; init; }
    public List<ContratoDto> Contratos { get; init; } = new();
    public List<CobrancaDto> Cobrancas { get; init; } = new();
    public List<AvisoDto> Avisos { get; init; } = new();
    public List<LiberacaoDto> Liberacoes { get; init; } = new();
    public List<SolicitacaoDto> Solicitacoes { get; init; } = new();
}

public sealed record ContratoDto(
    int Id, string Numero, int ClienteId, string ClienteNome, string Descricao, decimal ValorMensal,
    int DiaVencimento, DateOnly DataInicio, DateOnly? DataFim, bool Ativo, int ParcelasVencidas, bool Inadimplente);

public sealed record CobrancaDto(
    int Id, string Numero, int ContratoId, string ContratoNumero, int ClienteId, string ClienteNome,
    DateOnly Competencia, DateOnly DataVencimento, decimal ValorOriginal, StatusParcela Status,
    SituacaoCobranca Situacao, int DiasAtraso, decimal Multa, decimal Juros, decimal ValorAtualizado,
    DateOnly? DataPagamento, decimal? ValorPago, string? Observacao, string? BaixadaPor);

public sealed record AvisoDto(
    int Id, int ClienteId, string ClienteNome, int? CobrancaId, string? CobrancaNumero, TipoAviso Tipo,
    string Canal, string Assunto, string Mensagem, bool Enviado, DateTime CriadoEm);

public sealed record LiberacaoDto(
    int Id, int ClienteId, string ClienteNome, string Motivo, DateTime DataInicio, DateOnly DataFim,
    DateTime? RevogadaEm, string? ConcedidaPor, bool Ativa);

public sealed record SolicitacaoDto(
    int Id, int ClienteId, string ClienteNome, TipoSolicitacao Tipo, string Descricao, StatusSolicitacao Status,
    DateTime CriadoEm, string? CriadoPor, DateTime? ConcluidaEm);

public sealed record ConfiguracaoDto(
    decimal MultaPercentual, decimal JurosDiarioPercentual, int DiasParaBloqueio, int DiasAvisoPreVencimento,
    DateTime AtualizadoEm, string? AtualizadoPor);

public sealed record RegistroDto(long Id, DateTime DataHora, string Usuario, string Acao, string? Detalhes, string? Ip);

public sealed record ResultadoRotinaDto(
    DateOnly DataReferencia, DateTime ExecutadaEm, string Origem, int ParcelasGeradas,
    int ClientesComStatusAlterado, int AvisosGerados, int Bloqueados);

/// <summary>Resposta de baixa, estorno, edição e cancelamento: mostra o que mudou para o cliente.</summary>
public sealed record ResultadoAlteracaoCobrancaDto(
    CobrancaDto Cobranca, ClienteResumoDto Cliente, StatusCliente StatusAnterior, StatusCliente StatusAtual, bool Liberado);

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------

public sealed record SemaforoDto(int Verde, int Amarelo, int Vermelho, int Bloqueados, int LiberadosTemporariamente);

public sealed record TotaisDto(
    decimal ValorVencido, decimal ValorEncargos, decimal ValorAtualizado, decimal ValorAVencer30,
    decimal RecebidoNoMes, int CobrancasVencidas, int ContratosAtivos, int ClientesAtivos,
    decimal ValorVencidoAmarelo, decimal ValorVencidoVermelho, int? ProximoBloqueioEmDias);

public sealed record FaixaDto(string Faixa, int Clientes, decimal Valor);

public sealed record MensalDto(string Mes, decimal Recebido, decimal EmAberto, decimal Previsto);

public sealed record PainelDto(
    DateOnly DataReferencia,
    SemaforoDto Semaforo,
    TotaisDto Totais,
    List<FaixaDto> Faixas,
    List<MensalDto> Mensal,
    List<ClienteResumoDto> Atencao,
    List<CobrancaDto> ProximosVencimentos,
    List<AvisoDto> AvisosRecentes);

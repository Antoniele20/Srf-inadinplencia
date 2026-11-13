namespace SRF.Inadimplencia.Api.Dominio;

// Entidades mapeadas para as tabelas criadas em database/01_criar_banco.sql.
// Datas "puras" (vencimento, competência, pagamento) são DateOnly; instantes são DateTime em UTC.

public class Usuario
{
    public int Id { get; set; }
    public string Nome { get; set; } = "";
    public string Email { get; set; } = "";
    /// <summary>Hash BCrypt. Nulo = ainda sem senha: o login é recusado.</summary>
    public string? SenhaHash { get; set; }
    public PerfilUsuario Perfil { get; set; }
    public bool Ativo { get; set; } = true;
    public DateTime CriadoEm { get; set; }
    public DateTime? UltimoAcesso { get; set; }
}

public class Cliente
{
    public int Id { get; set; }
    public string Nome { get; set; } = "";
    /// <summary>Somente dígitos do CPF ou CNPJ.</summary>
    public string Documento { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Telefone { get; set; }
    public string? Responsavel { get; set; }
    public string? Observacoes { get; set; }
    public bool Ativo { get; set; } = true;
    public StatusCliente Status { get; set; } = StatusCliente.Verde;
    public DateTime StatusDesde { get; set; }
    public DateTime CriadoEm { get; set; }

    public List<Contrato> Contratos { get; set; } = new();
    public List<Liberacao> Liberacoes { get; set; } = new();
    public List<Aviso> Avisos { get; set; } = new();
    public List<Solicitacao> Solicitacoes { get; set; } = new();
}

public class Contrato
{
    public int Id { get; set; }
    public int ClienteId { get; set; }
    public Cliente Cliente { get; set; } = null!;
    public string Descricao { get; set; } = "";
    public decimal ValorMensal { get; set; }
    public int DiaVencimento { get; set; }
    public DateOnly DataInicio { get; set; }
    public DateOnly? DataFim { get; set; }
    public bool Ativo { get; set; } = true;
    public DateTime CriadoEm { get; set; }

    public List<Parcela> Parcelas { get; set; } = new();
}

public class Parcela
{
    public int Id { get; set; }
    public int ContratoId { get; set; }
    public Contrato Contrato { get; set; } = null!;
    /// <summary>Sempre o dia 1 do mês de competência.</summary>
    public DateOnly Competencia { get; set; }
    public DateOnly DataVencimento { get; set; }
    public decimal ValorOriginal { get; set; }
    public StatusParcela Status { get; set; } = StatusParcela.Aberta;
    public DateOnly? DataPagamento { get; set; }
    public decimal? ValorPago { get; set; }
    public int? BaixadaPorUsuarioId { get; set; }
    public Usuario? BaixadaPor { get; set; }
    public string? Observacao { get; set; }
    public DateTime CriadoEm { get; set; }
}

public class Configuracao
{
    /// <summary>Linha única: Id = 1.</summary>
    public int Id { get; set; } = 1;
    public decimal MultaPercentual { get; set; }
    public decimal JurosDiarioPercentual { get; set; }
    public int DiasParaBloqueio { get; set; }
    public int DiasAvisoPreVencimento { get; set; }
    public DateTime AtualizadoEm { get; set; }
    public int? AtualizadoPorUsuarioId { get; set; }
    public Usuario? AtualizadoPor { get; set; }
}

public class Aviso
{
    public int Id { get; set; }
    public int ClienteId { get; set; }
    public Cliente Cliente { get; set; } = null!;
    public int? ParcelaId { get; set; }
    public Parcela? Parcela { get; set; }
    public TipoAviso Tipo { get; set; }
    /// <summary>Dias de atraso do marco da régua (avisos de atraso). Nulo nos demais.</summary>
    public int? Marco { get; set; }
    /// <summary>Hoje sempre "Sistema". Reservado para "Email" e "WhatsApp".</summary>
    public string Canal { get; set; } = "Sistema";
    public string Assunto { get; set; } = "";
    public string Mensagem { get; set; } = "";
    public bool Enviado { get; set; }
    public DateTime CriadoEm { get; set; }
}

public class Liberacao
{
    public int Id { get; set; }
    public int ClienteId { get; set; }
    public Cliente Cliente { get; set; } = null!;
    public int UsuarioId { get; set; }
    public Usuario Usuario { get; set; } = null!;
    public string Motivo { get; set; } = "";
    public DateTime DataInicio { get; set; }
    public DateOnly DataFim { get; set; }
    public DateTime? RevogadaEm { get; set; }
    public int? RevogadaPorUsuarioId { get; set; }
    public Usuario? RevogadaPor { get; set; }
}

public class Solicitacao
{
    public int Id { get; set; }
    public int ClienteId { get; set; }
    public Cliente Cliente { get; set; } = null!;
    public int UsuarioId { get; set; }
    public Usuario Usuario { get; set; } = null!;
    public TipoSolicitacao Tipo { get; set; }
    public string Descricao { get; set; } = "";
    public StatusSolicitacao Status { get; set; } = StatusSolicitacao.Aberta;
    public DateTime CriadoEm { get; set; }
    public DateTime? ConcluidaEm { get; set; }
}

public class LogAcesso
{
    public long Id { get; set; }
    public int? UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }
    public string Acao { get; set; } = "";
    public string? Detalhes { get; set; }
    public string? Ip { get; set; }
    public DateTime DataHora { get; set; }
}

namespace SRF.Inadimplencia.Api.Dominio;

/// <summary>Admin = Financeiro/Admin (acesso total). Operacional = somente leitura dos status.</summary>
public enum PerfilUsuario
{
    Admin,
    Operacional
}

/// <summary>Semáforo de inadimplência.</summary>
public enum StatusCliente
{
    Verde,
    Amarelo,
    Vermelho
}

public enum StatusParcela
{
    Aberta,
    Paga,
    Cancelada
}

/// <summary>Situação de exibição de uma cobrança (derivada do status e do vencimento).</summary>
public enum SituacaoCobranca
{
    EmAberto,
    Vencida,
    Paga,
    Cancelada
}

public enum TipoAviso
{
    Lembrete,
    Atraso,
    Bloqueio,
    Regularizacao,
    Liberacao
}

public enum TipoSolicitacao
{
    NovaSolicitacao,
    AberturaProcesso
}

public enum StatusSolicitacao
{
    Aberta,
    Concluida
}

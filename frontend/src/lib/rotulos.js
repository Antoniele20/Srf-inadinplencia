// Textos e cores de exibição para os valores que a API devolve como código.

export const COR_TIPO_AVISO = { Lembrete: 'azul', Atraso: 'amarelo', Bloqueio: 'vermelho', Regularizacao: 'verde', Liberacao: 'ouro' };

export const ROTULO_TIPO_SOLICITACAO = { NovaSolicitacao: 'Nova solicitação', AberturaProcesso: 'Abertura de processo' };

export const ROTULO_CANAL = { Sistema: 'Registrado no sistema', Email: 'E-mail' };

export const ROTULO_ACAO = {
  Login: 'Entrou no sistema',
  LoginInvalido: 'Tentativa de login recusada',
  ClienteCriado: 'Cliente cadastrado',
  ClienteAlterado: 'Cliente alterado',
  ClienteInativado: 'Cliente inativado',
  ClienteReativado: 'Cliente reativado',
  ContratoCriado: 'Contrato criado',
  ContratoAlterado: 'Contrato alterado',
  ContratoEncerrado: 'Contrato encerrado',
  CobrancaAlterada: 'Cobrança alterada',
  CobrancaCancelada: 'Cobrança cancelada',
  PagamentoRegistrado: 'Pagamento registrado',
  PagamentoEstornado: 'Pagamento estornado',
  StatusAlterado: 'Semáforo alterado',
  LiberacaoConcedida: 'Liberação temporária concedida',
  LiberacaoRevogada: 'Liberação temporária revogada',
  SolicitacaoCriada: 'Solicitação registrada',
  SolicitacaoBloqueada: 'Solicitação recusada por bloqueio',
  SolicitacaoConcluida: 'Solicitação concluída',
  ConfiguracaoAlterada: 'Regras alteradas',
  UsuarioCriado: 'Usuário criado',
  UsuarioAlterado: 'Usuário alterado',
  RotinaExecutada: 'Rotina diária executada',
};

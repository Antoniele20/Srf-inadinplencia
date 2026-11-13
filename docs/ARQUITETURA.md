# Arquitetura e decisões

## Visão geral

```
Navegador ── HTTPS ──> ASP.NET Core 8 (API + site compilado) ──> SQL Server
  React SPA              Controllers → Serviços → Regras de domínio     tabelas, view e índices únicos
```

- **Controllers** (`Controllers/`): rotas e perfis de acesso; sem regra de negócio.
- **Serviços** (`Aplicacao/Servicos/`): casos de uso, transações e auditoria.
- **Regras de domínio** (`Dominio/Regras/`): funções puras e testáveis (encargos, semáforo, régua, vencimentos).
- **Dados** (`Dados/`): EF Core. O banco é *database-first*: os scripts SQL são a fonte da estrutura.
- **Front-end** (`frontend/src`): páginas, componentes, regras espelhadas para exibição e dois clientes de API
  (`api/http.js` real e `api/apiDemo.js` fictício) com o mesmo contrato.

## Conflito entre os documentos e a decisão tomada

Os PDFs não concordam entre si:

| Tema | Plano de Projeto / Apresentação | Especificação do Sistema de Cobrança | Decisão |
|---|---|---|---|
| Natureza | Controle **gerencial** de inadimplência | Cobrança com gateway, e-mail e WhatsApp | Seguir o Plano (escopo mais enxuto e coerente com o prazo) |
| Pagamento | Baixa manual | Gateway/PIX/boleto | Baixa manual |
| Avisos | Régua e bloqueio | Envio automático por canais externos | Avisos registrados no canal "Sistema"; a coluna `Avisos.Canal` já aceita `Email` e `WhatsApp` |

## Perguntas em aberto do cliente e premissas adotadas

Todas ficam em **Configurações** (perfil Admin), exceto onde indicado.

1. **Quantos dias de atraso para bloquear?** 30 (`DiasParaBloqueio`).
2. **Multa e juros?** 2% única e 0,033% ao dia, juros simples, apenas exibidos (não alteram o valor original).
3. **Haverá gateway de pagamento?** Não nesta versão.
4. **Por onde avisar o cliente?** Registro no sistema; envio externo é evolução futura.
5. **Quem libera um cliente bloqueado?** Perfil Admin (Financeiro/Admin), por até 60 dias, com motivo de no mínimo 10 caracteres, somente para clientes Vermelhos.

## Regras de negócio

- **Situação**: Verde = nenhuma parcela vencida; Amarelo = maior atraso de 1 a `DiasParaBloqueio` dias; Vermelho = maior atraso acima disso.
- **Bloqueio operacional**: cliente Vermelho sem liberação ativa não pode receber "Nova solicitação" nem "Abertura de processo".
  O front-end desabilita o botão; o servidor recusa com HTTP 409 e código `CLIENTE_BLOQUEADO`.
- **Parcelas**: geradas todo mês por contrato ativo, com horizonte de 10 dias; índice único `(ContratoId, Competencia)` impede duplicidade.
- **Régua**: marcos de 1, 7, 15, 30, 45, 60 e 90 dias de atraso, lembrete 3 dias antes do vencimento, mais avisos de bloqueio, regularização e liberação. Índice único filtrado `(ParcelaId, Tipo, Marco)` garante um aviso por marco.
- **Rotina diária** (`RotinaDiariaService`): 01:00 de Brasília. Ao iniciar, executa o que ficou pendente (RNF05). Idempotente.
- **Datas**: o "hoje" do sistema é a data de Brasília, nunca a do servidor.

## Segurança

HTTPS, JWT com expiração de 8 h, senhas com BCrypt, perfis verificados no servidor (`[Authorize(Roles = ...)]`), limitação de taxa no login,
validação de entradas, erros padronizados sem detalhes internos e trilha de auditoria (`LogsAcesso`).
O segredo JWT e a string de conexão **não** ficam no repositório: use variáveis de ambiente.

## Evoluções futuras

Envio real de e-mail/WhatsApp, integração com gateway (PIX/boleto), conciliação bancária, portal do cliente, relatórios exportáveis.

# Referência da API

Base: `/api`. JSON em camelCase, enums como texto, datas `yyyy-MM-dd`. Autenticação: `Authorization: Bearer <token>`.
Erros: `{ "codigo": "...", "mensagem": "...", "erros": { "campo": ["..."] } }`. Swagger em `/swagger` (desenvolvimento).

Perfis: **A** = somente Admin; **T** = qualquer usuário autenticado.

| Método e rota | Perfil | Função |
|---|---|---|
| POST `/auth/login` | público | Login (e-mail e senha) → token e usuário |
| GET `/auth/eu` | T | Usuário logado |
| GET `/painel` | T | Indicadores do painel |
| GET `/clientes` · GET `/clientes/{id}` | T | Listar / detalhar (com situação e encargos) |
| POST `/clientes` · PUT `/clientes/{id}` | A | Criar / editar |
| PATCH `/clientes/{id}/ativo` | A | Ativar / inativar |
| POST `/clientes/{id}/liberacoes` | A | Liberação temporária (máx. 60 dias, motivo ≥ 10 caracteres, só Vermelho) |
| POST `/liberacoes/{id}/revogar` | A | Revogar liberação |
| GET `/contratos` | T | Listar |
| POST `/contratos` · PUT `/contratos/{id}` · POST `/contratos/{id}/encerrar` | A | Criar / editar / encerrar |
| GET `/cobrancas` | T | Listar com filtros |
| PUT `/cobrancas/{id}` | A | Editar valor ou vencimento |
| POST `/cobrancas/{id}/baixa` · `/estorno` · `/cancelamento` | A | Registrar pagamento / estornar / cancelar |
| GET `/inadimplencia` | T | Clientes por situação |
| POST `/inadimplencia/processar` | A | Executar a rotina manualmente |
| GET `/solicitacoes` · POST `/solicitacoes` · POST `/solicitacoes/{id}/concluir` | T | Solicitações (criar é recusado com 409 para cliente bloqueado) |
| GET `/avisos` | T | Avisos da régua |
| GET `/configuracoes` · PUT `/configuracoes` | T · A | Parâmetros do sistema |
| GET/POST `/usuarios` · PUT `/usuarios/{id}` | A | Gestão de usuários |
| GET `/registros` | A | Trilha de auditoria |
| GET `/saude` | público | Verificação de saúde |

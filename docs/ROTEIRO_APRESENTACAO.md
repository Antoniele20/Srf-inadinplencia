# Roteiro de apresentação (13/11/2026) — cerca de 10 minutos

1. **Problema (1 min)** — a SRF não tem visão única de quem deve, há quanto tempo e quanto; o operacional continua abrindo demandas para inadimplentes.
2. **Solução (1 min)** — aplicação web com semáforo, bloqueio operacional, régua de cobrança e rotina diária. Escopo gerencial: sem gateway.
3. **Arquitetura (1 min)** — React + ASP.NET Core + SQL Server; regras no servidor; JWT e perfis.
4. **Demonstração — abrir `frontend/dist-demo/index.html` (5 min)**
   - Entrar como Financeiro/Admin → **Painel**.
   - **Inadimplência**: mostrar Amarelos e Vermelhos e os encargos (multa 2% + juros 0,033%/dia).
   - **Cobranças** → "Dar baixa" numa parcela e ver o cliente mudar de cor.
   - **Liberar** temporariamente um cliente Vermelho (motivo obrigatório).
   - Sair e entrar como **Operacional** → Solicitações → "Nova solicitação" para *Comércio Gama (bloqueado)*: o botão fica desabilitado e a mensagem explica o bloqueio; repetir com *Corporativo Eta (liberado)*: funciona.
   - **Avisos**: régua registrada. **Configurações**: parâmetros ajustáveis.
5. **Decisões e premissas (1 min)** — respostas às 5 perguntas em aberto (docs/ARQUITETURA.md) e a escolha de seguir o Plano de Projeto.
6. **Próximos passos (30 s)** — e-mail/WhatsApp, gateway PIX/boleto, portal do cliente.

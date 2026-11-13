# Sistema de Controle de Inadimplência — SRF Serviços de Advocacia Ltda.

Sistema gerencial para acompanhar honorários em atraso dos clientes do escritório, classificar cada cliente
por um **semáforo** (Verde / Amarelo / Vermelho), **bloquear operacionalmente** novas demandas de quem está
inadimplente há muito tempo e **registrar a régua de cobrança** (avisos). Projeto acadêmico, entrega em 13/11/2026.

## É um site ou uma aplicação?

É uma **aplicação web**: o usuário acessa por um navegador (Chrome, Edge…), sem instalar nada. Ela tem três partes:

| Parte | Tecnologia | Pasta |
|---|---|---|
| Interface (o "site") | React + Vite (SPA) | `frontend/` |
| Regras de negócio e API | ASP.NET Core 8 (C#) + Entity Framework Core | `backend/` |
| Banco de dados | SQL Server | `database/` |

Em produção a API também entrega o site compilado (pasta `wwwroot`), então basta publicar **um** serviço e o banco.

## Escopo implementado

Segue o **Plano de Projeto / Apresentação** (controle gerencial). Veja as decisões em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

- Cadastro de clientes, contratos e cobranças mensais (parcelas geradas automaticamente).
- Baixa manual de pagamento, estorno e cancelamento de cobrança.
- Multa de 2% (única) e juros de 0,033% ao dia (simples) calculados para exibição.
- Semáforo: Verde (em dia), Amarelo (1 a 30 dias de atraso), Vermelho (mais de 30 dias; limite configurável).
- Bloqueio operacional de "Nova solicitação" e "Abertura de processo" para clientes Vermelhos, aplicado também no servidor.
- Liberação temporária (Financeiro/Admin, até 60 dias, com motivo obrigatório).
- Régua de cobrança (avisos aos 1, 7, 15, 30, 45, 60 e 90 dias, lembrete 3 dias antes, avisos de bloqueio/regularização/liberação). Os avisos são **registrados no sistema**; nada é enviado por e-mail/WhatsApp (evolução futura).
- Rotina diária automática às 01:00 (horário de Brasília), com recuperação ao iniciar caso o servidor tenha ficado desligado.
- Perfis: **Admin (Financeiro/Admin)** e **Operacional**. Login com JWT, senhas com BCrypt, registro de auditoria.
- Painel, relatórios, configurações, usuários e registros de acesso.

**Fora do escopo (de propósito):** gateway de pagamento, PIX, boleto, envio real de e-mail/WhatsApp.

## Experimente agora (sem instalar nada)

Abra `frontend/dist-demo/index.html` com duplo clique. É a interface completa com dados fictícios guardados no
navegador (botões "Entrar como Financeiro/Admin" e "Entrar como Operacional"). Ideal para a apresentação.

Para regerar: `cd frontend && npm install && npm run build:offline`.

## Como rodar o sistema completo

Pré-requisitos: **.NET SDK 8**, **SQL Server** (2019+ ou Express/Docker) e **Node 18+**.

### 1. Banco de dados

Execute, nesta ordem, no SSMS, Azure Data Studio ou `sqlcmd`:

```
database/01_criar_banco.sql        -- cria o banco SRF_Inadimplencia e as tabelas
database/02_dados_iniciais.sql     -- configurações padrão e o usuário admin@srf.local
database/03_dados_demonstracao.sql -- (opcional) clientes, contratos e cobranças de exemplo
```

O script 03 só roda em um banco recém-criado (ele aborta se já houver outros usuários). Para regerá-lo com datas
relativas a hoje: `node database/gerar_dados_demo.mjs`.

### 2. API

```bash
cd backend/src/SRF.Inadimplencia.Api
export ConnectionStrings__Padrao="Server=localhost,1433;Database=SRF_Inadimplencia;User Id=sa;Password=SUA_SENHA;TrustServerCertificate=True"
export Jwt__Chave="$(openssl rand -base64 48)"     # obrigatório, mínimo 32 caracteres
export Seed__SenhaInicial="Srf@2026"                # senha definida para usuários ainda sem senha
dotnet run
```

Na primeira execução a API grava o hash BCrypt da senha inicial nos usuários criados pelos scripts SQL.
Troque as senhas depois pelo cadastro de usuários. Swagger (em desenvolvimento): `/swagger`.

Usuários de exemplo (script 03): `admin@srf.local` (Admin), `financeiro@srf.local` (Admin),
`operacional@srf.local` e `davi@srf.local` (Operacional).

### 3. Interface

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173, repassa /api para http://localhost:5080
npm run demo       # modo demonstração (sem API)
npm test           # testes das regras e do modo demonstração
```

### 4. Publicar tudo junto

```bash
cd frontend && npm run build
cp -r dist/* ../backend/src/SRF.Inadimplencia.Api/wwwroot/      # crie a pasta se não existir
cd ../backend/src/SRF.Inadimplencia.Api && dotnet publish -c Release -o publicar
```

Coloque a API atrás de HTTPS (proxy reverso ou certificado). A rotina diária roda dentro da API: mantenha **uma única
instância** ativa (ou desative com `Rotina__Habilitada=false` nas demais; as operações são idempotentes).

### Testes do back-end

```bash
cd backend && dotnet test
```

## Estrutura

```
database/   scripts SQL (fonte da estrutura do banco) e gerador dos dados de demonstração
backend/    API ASP.NET Core (src/) e testes xUnit (tests/)
frontend/   interface React, testes e build de demonstração offline
docs/       arquitetura e decisões, API, manual do usuário, roteiro de apresentação
```

## Aviso de verificação

No ambiente em que este projeto foi gerado não havia .NET SDK nem SQL Server. Por isso o código C# e os scripts SQL
**não foram compilados nem executados lá**; o front-end foi testado (29 testes + navegação em todas as telas no
navegador). Na primeira execução, rode `dotnet build`, `dotnet test` e os scripts SQL, e corrija qualquer ajuste
pequeno de compilação que apareça.

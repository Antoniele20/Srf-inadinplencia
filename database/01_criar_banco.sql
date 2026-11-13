/* ============================================================================
   SRF Serviços de Advocacia Ltda. - Sistema de Controle de Inadimplência
   Script 01: criação do banco, tabelas, restrições, índices e visão.

   Alvo: SQL Server 2019 ou superior (também funciona no Azure SQL).
   Ordem de execução: 01_criar_banco.sql -> 02_dados_iniciais.sql
                      -> (opcional) 03_dados_demonstracao.sql

   O script pode ser executado mais de uma vez: ele só cria o que não existe.
   ATENÇÃO: o banco é criado vazio. Para recomeçar do zero, apague o banco
   SRF_Inadimplencia antes de rodar de novo.
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF DB_ID(N'SRF_Inadimplencia') IS NULL
BEGIN
    -- CI_AI: busca sem diferenciar maiúsculas nem acentos ("joao" encontra "João").
    CREATE DATABASE SRF_Inadimplencia COLLATE Latin1_General_100_CI_AI_SC;
END
GO

USE SRF_Inadimplencia;
GO

/* ---------------------------------------------------------------------------
   Usuarios: quem acessa o sistema.
   Perfil 'Admin' = Financeiro/Admin (acesso total).
   Perfil 'Operacional' = somente leitura dos status e abertura de solicitações.
   SenhaHash guarda o hash BCrypt. NULL = usuário ainda sem senha definida: a API
   recusa o login até que a senha inicial seja gravada (ver README).
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.Usuarios', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Usuarios
    (
        Id            INT            IDENTITY(1,1) NOT NULL,
        Nome          NVARCHAR(120)  NOT NULL,
        Email         NVARCHAR(160)  NOT NULL,
        SenhaHash     NVARCHAR(100)  NULL,
        Perfil        VARCHAR(20)    NOT NULL,
        Ativo         BIT            NOT NULL CONSTRAINT DF_Usuarios_Ativo DEFAULT (1),
        CriadoEm      DATETIME2(0)   NOT NULL CONSTRAINT DF_Usuarios_CriadoEm DEFAULT (SYSUTCDATETIME()),
        UltimoAcesso  DATETIME2(0)   NULL,
        CONSTRAINT PK_Usuarios PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_Usuarios_Email UNIQUE (Email),
        CONSTRAINT CK_Usuarios_Perfil CHECK (Perfil IN ('Admin', 'Operacional'))
    );
END
GO

/* ---------------------------------------------------------------------------
   Clientes: pessoas físicas e jurídicas atendidas pelo escritório.
   Documento guarda só os dígitos do CPF (11) ou CNPJ (14).
   Status é o semáforo gravado (Verde/Amarelo/Vermelho); StatusDesde marca
   quando o status atual começou. A API recalcula e grava a cada mudança.
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.Clientes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Clientes
    (
        Id           INT            IDENTITY(1,1) NOT NULL,
        Nome         NVARCHAR(160)  NOT NULL,
        Documento    VARCHAR(14)    NOT NULL,
        Email        NVARCHAR(160)  NOT NULL,
        Telefone     NVARCHAR(30)   NULL,
        Responsavel  NVARCHAR(120)  NULL,
        Observacoes  NVARCHAR(1000) NULL,
        Ativo        BIT            NOT NULL CONSTRAINT DF_Clientes_Ativo DEFAULT (1),
        Status       VARCHAR(10)    NOT NULL CONSTRAINT DF_Clientes_Status DEFAULT ('Verde'),
        StatusDesde  DATETIME2(0)   NOT NULL CONSTRAINT DF_Clientes_StatusDesde DEFAULT (SYSUTCDATETIME()),
        CriadoEm     DATETIME2(0)   NOT NULL CONSTRAINT DF_Clientes_CriadoEm DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_Clientes PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_Clientes_Documento UNIQUE (Documento),
        CONSTRAINT CK_Clientes_Status CHECK (Status IN ('Verde', 'Amarelo', 'Vermelho')),
        CONSTRAINT CK_Clientes_Documento CHECK (LEN(Documento) IN (11, 14) AND Documento NOT LIKE '%[^0-9]%')
    );
    CREATE INDEX IX_Clientes_Nome   ON dbo.Clientes (Nome);
    CREATE INDEX IX_Clientes_Status ON dbo.Clientes (Status) WHERE Ativo = 1;
END
GO

/* ---------------------------------------------------------------------------
   Contratos: honorário mensal combinado com o cliente.
   DiaVencimento vai de 1 a 28 para existir em todos os meses.
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.Contratos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Contratos
    (
        Id             INT            IDENTITY(1,1) NOT NULL,
        ClienteId      INT            NOT NULL,
        Descricao      NVARCHAR(200)  NOT NULL,
        ValorMensal    DECIMAL(12,2)  NOT NULL,
        DiaVencimento  TINYINT        NOT NULL,
        DataInicio     DATE           NOT NULL,
        DataFim        DATE           NULL,
        Ativo          BIT            NOT NULL CONSTRAINT DF_Contratos_Ativo DEFAULT (1),
        CriadoEm       DATETIME2(0)   NOT NULL CONSTRAINT DF_Contratos_CriadoEm DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_Contratos PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_Contratos_Clientes FOREIGN KEY (ClienteId) REFERENCES dbo.Clientes (Id),
        CONSTRAINT CK_Contratos_Valor CHECK (ValorMensal > 0),
        CONSTRAINT CK_Contratos_Dia CHECK (DiaVencimento BETWEEN 1 AND 28),
        CONSTRAINT CK_Contratos_Periodo CHECK (DataFim IS NULL OR DataFim >= DataInicio)
    );
    CREATE INDEX IX_Contratos_Cliente ON dbo.Contratos (ClienteId);
END
GO

/* ---------------------------------------------------------------------------
   Parcelas: uma cobrança por contrato e por mês de competência.
   O par (ContratoId, Competencia) é único: a rotina diária pode rodar quantas
   vezes for preciso sem duplicar cobranças.
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.Parcelas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Parcelas
    (
        Id                    INT            IDENTITY(1,1) NOT NULL,
        ContratoId            INT            NOT NULL,
        Competencia           DATE           NOT NULL,
        DataVencimento        DATE           NOT NULL,
        ValorOriginal         DECIMAL(12,2)  NOT NULL,
        Status                VARCHAR(10)    NOT NULL CONSTRAINT DF_Parcelas_Status DEFAULT ('Aberta'),
        DataPagamento         DATE           NULL,
        ValorPago             DECIMAL(12,2)  NULL,
        BaixadaPorUsuarioId   INT            NULL,
        Observacao            NVARCHAR(500)  NULL,
        CriadoEm              DATETIME2(0)   NOT NULL CONSTRAINT DF_Parcelas_CriadoEm DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_Parcelas PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_Parcelas_Contratos FOREIGN KEY (ContratoId) REFERENCES dbo.Contratos (Id),
        CONSTRAINT FK_Parcelas_Usuarios FOREIGN KEY (BaixadaPorUsuarioId) REFERENCES dbo.Usuarios (Id),
        CONSTRAINT UQ_Parcelas_Contrato_Competencia UNIQUE (ContratoId, Competencia),
        CONSTRAINT CK_Parcelas_Status CHECK (Status IN ('Aberta', 'Paga', 'Cancelada')),
        CONSTRAINT CK_Parcelas_Valor CHECK (ValorOriginal > 0),
        CONSTRAINT CK_Parcelas_Competencia CHECK (DAY(Competencia) = 1),
        CONSTRAINT CK_Parcelas_Pagamento CHECK
        (
            (Status = 'Paga' AND DataPagamento IS NOT NULL AND ValorPago IS NOT NULL AND ValorPago > 0)
            OR (Status <> 'Paga' AND DataPagamento IS NULL AND ValorPago IS NULL)
        )
    );
    CREATE INDEX IX_Parcelas_Vencimento_Abertas ON dbo.Parcelas (DataVencimento) INCLUDE (ContratoId, ValorOriginal) WHERE Status = 'Aberta';
    CREATE INDEX IX_Parcelas_Contrato ON dbo.Parcelas (ContratoId, DataVencimento DESC);
END
GO

/* ---------------------------------------------------------------------------
   Configuracoes: parâmetros editáveis no painel administrativo. Linha única.
   JurosDiarioPercentual: 0,033% ao dia equivale a cerca de 1% ao mês.
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.Configuracoes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Configuracoes
    (
        Id                       INT           NOT NULL,
        MultaPercentual          DECIMAL(5,2)  NOT NULL,
        JurosDiarioPercentual    DECIMAL(6,4)  NOT NULL,
        DiasParaBloqueio         INT           NOT NULL,
        DiasAvisoPreVencimento   INT           NOT NULL,
        AtualizadoEm             DATETIME2(0)  NOT NULL CONSTRAINT DF_Configuracoes_AtualizadoEm DEFAULT (SYSUTCDATETIME()),
        AtualizadoPorUsuarioId   INT           NULL,
        CONSTRAINT PK_Configuracoes PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_Configuracoes_Usuarios FOREIGN KEY (AtualizadoPorUsuarioId) REFERENCES dbo.Usuarios (Id),
        CONSTRAINT CK_Configuracoes_Unica CHECK (Id = 1),
        CONSTRAINT CK_Configuracoes_Multa CHECK (MultaPercentual BETWEEN 0 AND 20),
        CONSTRAINT CK_Configuracoes_Juros CHECK (JurosDiarioPercentual BETWEEN 0 AND 1),
        CONSTRAINT CK_Configuracoes_Bloqueio CHECK (DiasParaBloqueio BETWEEN 1 AND 180),
        CONSTRAINT CK_Configuracoes_Aviso CHECK (DiasAvisoPreVencimento BETWEEN 0 AND 15)
    );
END
GO

/* ---------------------------------------------------------------------------
   Avisos: régua de cobrança. Nesta versão os avisos ficam registrados no
   sistema (Canal = 'Sistema', Enviado = 0). A coluna Canal já permite, no
   futuro, 'Email' ou 'WhatsApp' sem mudar a estrutura.
   O índice único impede o mesmo aviso (parcela + tipo + marco) duas vezes.
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.Avisos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Avisos
    (
        Id          INT            IDENTITY(1,1) NOT NULL,
        ClienteId   INT            NOT NULL,
        ParcelaId   INT            NULL,
        Tipo        VARCHAR(15)    NOT NULL,
        Marco       INT            NULL,
        Canal       VARCHAR(10)    NOT NULL CONSTRAINT DF_Avisos_Canal DEFAULT ('Sistema'),
        Assunto     NVARCHAR(200)  NOT NULL,
        Mensagem    NVARCHAR(1000) NOT NULL,
        Enviado     BIT            NOT NULL CONSTRAINT DF_Avisos_Enviado DEFAULT (0),
        CriadoEm    DATETIME2(0)   NOT NULL CONSTRAINT DF_Avisos_CriadoEm DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_Avisos PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_Avisos_Clientes FOREIGN KEY (ClienteId) REFERENCES dbo.Clientes (Id),
        CONSTRAINT FK_Avisos_Parcelas FOREIGN KEY (ParcelaId) REFERENCES dbo.Parcelas (Id),
        CONSTRAINT CK_Avisos_Tipo CHECK (Tipo IN ('Lembrete', 'Atraso', 'Bloqueio', 'Regularizacao', 'Liberacao')),
        CONSTRAINT CK_Avisos_Canal CHECK (Canal IN ('Sistema', 'Email', 'WhatsApp'))
    );
    CREATE INDEX IX_Avisos_Cliente ON dbo.Avisos (ClienteId, CriadoEm DESC);
    CREATE UNIQUE INDEX UX_Avisos_Parcela_Tipo_Marco ON dbo.Avisos (ParcelaId, Tipo, Marco) WHERE ParcelaId IS NOT NULL;
END
GO

/* ---------------------------------------------------------------------------
   Liberacoes: desbloqueio temporário de exceção (renegociação).
   Vale enquanto RevogadaEm for nulo e DataFim ainda não tiver passado.
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.Liberacoes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Liberacoes
    (
        Id                     INT            IDENTITY(1,1) NOT NULL,
        ClienteId              INT            NOT NULL,
        UsuarioId              INT            NOT NULL,
        Motivo                 NVARCHAR(500)  NOT NULL,
        DataInicio             DATETIME2(0)   NOT NULL CONSTRAINT DF_Liberacoes_DataInicio DEFAULT (SYSUTCDATETIME()),
        DataFim                DATE           NOT NULL,
        RevogadaEm             DATETIME2(0)   NULL,
        RevogadaPorUsuarioId   INT            NULL,
        CONSTRAINT PK_Liberacoes PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_Liberacoes_Clientes FOREIGN KEY (ClienteId) REFERENCES dbo.Clientes (Id),
        CONSTRAINT FK_Liberacoes_Usuarios FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios (Id),
        CONSTRAINT FK_Liberacoes_Revogador FOREIGN KEY (RevogadaPorUsuarioId) REFERENCES dbo.Usuarios (Id),
        CONSTRAINT CK_Liberacoes_Revogacao CHECK ((RevogadaEm IS NULL AND RevogadaPorUsuarioId IS NULL) OR (RevogadaEm IS NOT NULL AND RevogadaPorUsuarioId IS NOT NULL))
    );
    CREATE INDEX IX_Liberacoes_Cliente ON dbo.Liberacoes (ClienteId, DataFim DESC);
END
GO

/* ---------------------------------------------------------------------------
   Solicitacoes: demandas operacionais ("Nova Solicitação" e "Abertura de
   Processo"). É a função que o bloqueio operacional suspende para clientes
   em status Vermelho.
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.Solicitacoes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Solicitacoes
    (
        Id           INT            IDENTITY(1,1) NOT NULL,
        ClienteId    INT            NOT NULL,
        UsuarioId    INT            NOT NULL,
        Tipo         VARCHAR(20)    NOT NULL,
        Descricao    NVARCHAR(1000) NOT NULL,
        Status       VARCHAR(10)    NOT NULL CONSTRAINT DF_Solicitacoes_Status DEFAULT ('Aberta'),
        CriadoEm     DATETIME2(0)   NOT NULL CONSTRAINT DF_Solicitacoes_CriadoEm DEFAULT (SYSUTCDATETIME()),
        ConcluidaEm  DATETIME2(0)   NULL,
        CONSTRAINT PK_Solicitacoes PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_Solicitacoes_Clientes FOREIGN KEY (ClienteId) REFERENCES dbo.Clientes (Id),
        CONSTRAINT FK_Solicitacoes_Usuarios FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios (Id),
        CONSTRAINT CK_Solicitacoes_Tipo CHECK (Tipo IN ('NovaSolicitacao', 'AberturaProcesso')),
        CONSTRAINT CK_Solicitacoes_Status CHECK (Status IN ('Aberta', 'Concluida')),
        CONSTRAINT CK_Solicitacoes_Conclusao CHECK ((Status = 'Concluida' AND ConcluidaEm IS NOT NULL) OR (Status = 'Aberta' AND ConcluidaEm IS NULL))
    );
    CREATE INDEX IX_Solicitacoes_Cliente ON dbo.Solicitacoes (ClienteId, CriadoEm DESC);
END
GO

/* ---------------------------------------------------------------------------
   LogsAcesso: trilha de auditoria (logins, alterações, baixas, bloqueios).
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.LogsAcesso', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.LogsAcesso
    (
        Id         BIGINT         IDENTITY(1,1) NOT NULL,
        UsuarioId  INT            NULL,
        Acao       VARCHAR(40)    NOT NULL,
        Detalhes   NVARCHAR(500)  NULL,
        Ip         VARCHAR(45)    NULL,
        DataHora   DATETIME2(0)   NOT NULL CONSTRAINT DF_LogsAcesso_DataHora DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_LogsAcesso PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_LogsAcesso_Usuarios FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios (Id)
    );
    CREATE INDEX IX_LogsAcesso_DataHora ON dbo.LogsAcesso (DataHora DESC);
END
GO

/* ---------------------------------------------------------------------------
   Visão de apoio para consultas e relatórios feitos direto no banco.
   Lista as cobranças em aberto com dias de atraso e valor atualizado, usando
   as taxas da tabela Configuracoes. A API usa as mesmas regras em C#; esta
   visão serve para conferência e para quem consulta o banco por fora.
   A data de hoje é a de Brasília.
   --------------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_CobrancasEmAberto
AS
SELECT
    p.Id                                   AS ParcelaId,
    cl.Id                                  AS ClienteId,
    cl.Nome                                AS ClienteNome,
    ct.Id                                  AS ContratoId,
    p.Competencia,
    p.DataVencimento,
    p.ValorOriginal,
    d.DiasAtraso,
    CASE WHEN d.DiasAtraso > 0 THEN ROUND(p.ValorOriginal * cfg.MultaPercentual / 100, 2) ELSE 0 END AS Multa,
    CASE WHEN d.DiasAtraso > 0 THEN ROUND(p.ValorOriginal * cfg.JurosDiarioPercentual / 100 * d.DiasAtraso, 2) ELSE 0 END AS Juros,
    p.ValorOriginal
        + CASE WHEN d.DiasAtraso > 0 THEN ROUND(p.ValorOriginal * cfg.MultaPercentual / 100, 2) ELSE 0 END
        + CASE WHEN d.DiasAtraso > 0 THEN ROUND(p.ValorOriginal * cfg.JurosDiarioPercentual / 100 * d.DiasAtraso, 2) ELSE 0 END
                                           AS ValorAtualizado
FROM dbo.Parcelas p
JOIN dbo.Contratos ct ON ct.Id = p.ContratoId
JOIN dbo.Clientes  cl ON cl.Id = ct.ClienteId
CROSS JOIN dbo.Configuracoes cfg
CROSS APPLY
(
    SELECT CASE
               WHEN DATEDIFF(DAY, p.DataVencimento, CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time' AS DATE)) > 0
               THEN DATEDIFF(DAY, p.DataVencimento, CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time' AS DATE))
               ELSE 0
           END AS DiasAtraso
) d
WHERE p.Status = 'Aberta';
GO

PRINT N'Banco SRF_Inadimplencia criado com sucesso.';
GO

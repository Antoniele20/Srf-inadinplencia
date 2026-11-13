/* ============================================================================
   Script 03: MASSA DE DADOS FICTÍCIA PARA DEMONSTRAÇÃO.
   NÃO EXECUTE EM PRODUÇÃO. Todos os clientes, valores e documentos são inventados.

   Arquivo GERADO por database/gerar_dados_demo.mjs (não edite à mão: rode o
   gerador de novo). Requer os scripts 01 e 02 já executados e o banco sem clientes.

   O que cria: 4 usuários, 14 clientes, 15 contratos, 117 cobranças, 1 liberação
   temporária e 6 solicitações. Os vencimentos são relativos ao dia de hoje,
   então o semáforo sempre mostra: 6 verdes, 4 amarelos e 3 vermelhos (clientes ativos).

   Senha de todos os usuários de demonstração: Srf@2026
   (a API grava o hash na primeira subida, ver README, "Primeiro acesso").
   ============================================================================ */

USE SRF_Inadimplencia;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF EXISTS (SELECT 1 FROM dbo.Clientes)
    THROW 50001, N'O banco já possui clientes. A massa de demonstração só pode ser carregada em banco sem clientes.', 1;
IF (SELECT COUNT(*) FROM dbo.Usuarios) <> 1 OR NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Id = 1 AND Email = N'admin@srf.local')
    THROW 50002, N'Execute o script 02 antes e não crie outros usuários antes desta carga.', 1;
GO

-- "Hoje" em Brasília. Todas as datas abaixo são calculadas a partir daqui.
DECLARE @hoje DATE = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time' AS DATE);

BEGIN TRANSACTION;

UPDATE dbo.Usuarios SET Nome = N'Renata Siqueira' WHERE Id = 1;

SET IDENTITY_INSERT dbo.Usuarios ON;
INSERT INTO dbo.Usuarios (Id, Nome, Email, SenhaHash, Perfil, Ativo, CriadoEm)
VALUES
    (2, N'Caio Brandão', N'financeiro@srf.local', NULL, 'Admin', 1, DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0)))),
    (3, N'Bruna Teixeira', N'operacional@srf.local', NULL, 'Operacional', 1, DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0)))),
    (4, N'Davi Monteiro', N'davi@srf.local', NULL, 'Operacional', 1, DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0))));
SET IDENTITY_INSERT dbo.Usuarios OFF;

SET IDENTITY_INSERT dbo.Clientes ON;
INSERT INTO dbo.Clientes (Id, Nome, Documento, Email, Telefone, Responsavel, Observacoes, Ativo, Status, StatusDesde, CriadoEm)
VALUES
    (1, N'Empresa Alfa Ltda.', '30512441000133', N'financeiro@alfa.example', N'(41) 3555-0101', N'Helena Prado', NULL, 1, 'Verde', DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0))), DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0)))),
    (2, N'Construtora Beta', '41883027000157', N'financeiro@beta.example', N'(41) 3555-0102', N'Otávio Rangel', NULL, 1, 'Amarelo', DATEADD(HOUR, 4, CAST(DATEADD(DAY, -14, @hoje) AS DATETIME2(0))), DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0)))),
    (3, N'Comércio Gama S.A.', '12774563000116', N'contato@gama.example', N'(41) 3555-0103', N'Lívia Sampaio', NULL, 1, 'Vermelho', DATEADD(HOUR, 4, CAST(DATEADD(DAY, -8, @hoje) AS DATETIME2(0))), DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0)))),
    (4, N'Indústria Delta Ltda.', '56230918000181', N'financeiro@delta.example', N'(41) 3555-0104', N'Marcos Villar', NULL, 1, 'Vermelho', DATEADD(HOUR, 4, CAST(DATEADD(DAY, -45, @hoje) AS DATETIME2(0))), DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0)))),
    (5, N'Serviços Épsilon', '23991654000120', N'adm@epsilon.example', N'(41) 3555-0105', N'Paula Quintana', NULL, 1, 'Amarelo', DATEADD(HOUR, 4, CAST(DATEADD(DAY, -8, @hoje) AS DATETIME2(0))), DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0)))),
    (6, N'Transportes Zeta', '67448102000145', N'contato@zeta.example', N'(41) 3555-0106', N'Rogério Antunes', NULL, 1, 'Verde', DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0))), DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0)))),
    (7, N'Corporativo Eta S.A.', '08335779000108', N'financeiro@eta.example', N'(41) 3555-0107', N'Simone Lacerda', NULL, 1, 'Vermelho', DATEADD(HOUR, 4, CAST(DATEADD(DAY, -14, @hoje) AS DATETIME2(0))), DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0)))),
    (8, N'Clínica Teta', '45106238000134', N'administrativo@teta.example', N'(41) 3555-0108', N'Dr. Ivan Moura', NULL, 1, 'Amarelo', DATEADD(HOUR, 4, CAST(DATEADD(DAY, -25, @hoje) AS DATETIME2(0))), DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0)))),
    (9, N'Logística Iota Ltda.', '19664085000130', N'contas@iota.example', N'(41) 3555-0109', N'Tatiane Rocha', NULL, 1, 'Verde', DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0))), DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0)))),
    (10, N'Agropecuária Kappa', '72881546000100', N'escritorio@kappa.example', N'(42) 3555-0110', N'Valter Bittencourt', NULL, 1, 'Verde', DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0))), DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0)))),
    (11, N'Tecnologia Lambda S.A.', '34779012000188', N'financeiro@lambda.example', N'(41) 3555-0111', N'Aline Furtado', NULL, 1, 'Amarelo', DATEADD(HOUR, 4, CAST(DATEADD(DAY, -4, @hoje) AS DATETIME2(0))), DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0)))),
    (12, N'Editora Sigma', '59002467000113', N'contato@sigma.example', N'(41) 3555-0112', N'Eduardo Paixão', NULL, 1, 'Verde', DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0))), DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0)))),
    (13, N'Marina Duarte Albuquerque', '41852736062', N'marina.albuquerque@pessoal.example', N'(41) 95555-0113', NULL, NULL, 1, 'Verde', DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0))), DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0)))),
    (14, N'Mercado Ômega Ltda.', '81663729000140', N'contato@omega.example', N'(41) 3555-0114', N'Nádia Corrêa', NULL, 0, 'Verde', DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0))), DATEADD(HOUR, 13, CAST(DATEADD(DAY, -300, @hoje) AS DATETIME2(0))));
SET IDENTITY_INSERT dbo.Clientes OFF;

SET IDENTITY_INSERT dbo.Contratos ON;
INSERT INTO dbo.Contratos (Id, ClienteId, Descricao, ValorMensal, DiaVencimento, DataInicio, DataFim, Ativo, CriadoEm)
VALUES
    (1, 1, N'Assessoria jurídica empresarial', 5000.00, 4, DATEADD(DAY, -268, @hoje), NULL, 1, DATEADD(HOUR, 13, CAST(DATEADD(DAY, -268, @hoje) AS DATETIME2(0)))),
    (2, 2, N'Consultivo e contencioso cível', 8450.00, 28, DATEADD(DAY, -244, @hoje), NULL, 1, DATEADD(HOUR, 13, CAST(DATEADD(DAY, -244, @hoje) AS DATETIME2(0)))),
    (3, 3, N'Assessoria trabalhista', 7800.00, 4, DATEADD(DAY, -268, @hoje), NULL, 1, DATEADD(HOUR, 13, CAST(DATEADD(DAY, -268, @hoje) AS DATETIME2(0)))),
    (4, 4, N'Contencioso tributário', 12300.00, 28, DATEADD(DAY, -303, @hoje), NULL, 1, DATEADD(HOUR, 13, CAST(DATEADD(DAY, -303, @hoje) AS DATETIME2(0)))),
    (5, 5, N'Assessoria contratual', 6120.00, 3, DATEADD(DAY, -208, @hoje), NULL, 1, DATEADD(HOUR, 13, CAST(DATEADD(DAY, -208, @hoje) AS DATETIME2(0)))),
    (6, 6, N'Consultivo regulatório de transportes', 4950.00, 23, DATEADD(DAY, -249, @hoje), NULL, 1, DATEADD(HOUR, 13, CAST(DATEADD(DAY, -249, @hoje) AS DATETIME2(0)))),
    (7, 7, N'Assessoria societária', 9600.00, 28, DATEADD(DAY, -272, @hoje), NULL, 1, DATEADD(HOUR, 13, CAST(DATEADD(DAY, -272, @hoje) AS DATETIME2(0)))),
    (8, 8, N'Assessoria em direito médico', 3200.00, 17, DATEADD(DAY, -194, @hoje), NULL, 1, DATEADD(HOUR, 13, CAST(DATEADD(DAY, -194, @hoje) AS DATETIME2(0)))),
    (9, 9, N'Contencioso cível e cobranças', 6700.00, 9, DATEADD(DAY, -232, @hoje), NULL, 1, DATEADD(HOUR, 13, CAST(DATEADD(DAY, -232, @hoje) AS DATETIME2(0)))),
    (10, 10, N'Assessoria agrária e ambiental', 11000.00, 15, DATEADD(DAY, -316, @hoje), NULL, 1, DATEADD(HOUR, 13, CAST(DATEADD(DAY, -316, @hoje) AS DATETIME2(0)))),
    (11, 11, N'Proteção de dados e contratos de tecnologia', 4200.00, 7, DATEADD(DAY, -204, @hoje), NULL, 1, DATEADD(HOUR, 13, CAST(DATEADD(DAY, -204, @hoje) AS DATETIME2(0)))),
    (12, 11, N'Propriedade intelectual', 2800.00, 25, DATEADD(DAY, -186, @hoje), NULL, 1, DATEADD(HOUR, 13, CAST(DATEADD(DAY, -186, @hoje) AS DATETIME2(0)))),
    (13, 12, N'Direitos autorais e contratos editoriais', 2500.00, 10, DATEADD(DAY, -231, @hoje), NULL, 1, DATEADD(HOUR, 13, CAST(DATEADD(DAY, -231, @hoje) AS DATETIME2(0)))),
    (14, 13, N'Planejamento patrimonial e sucessório', 1800.00, 2, DATEADD(DAY, -178, @hoje), NULL, 1, DATEADD(HOUR, 13, CAST(DATEADD(DAY, -178, @hoje) AS DATETIME2(0)))),
    (15, 14, N'Assessoria consumerista', 3900.00, 3, DATEADD(DAY, -238, @hoje), DATEADD(DAY, -70, @hoje), 0, DATEADD(HOUR, 13, CAST(DATEADD(DAY, -238, @hoje) AS DATETIME2(0))));
SET IDENTITY_INSERT dbo.Contratos OFF;

SET IDENTITY_INSERT dbo.Parcelas ON;
INSERT INTO dbo.Parcelas (Id, ContratoId, Competencia, DataVencimento, ValorOriginal, Status, DataPagamento, ValorPago, BaixadaPorUsuarioId, Observacao, CriadoEm)
VALUES
    (1, 1, DATEADD(DAY, -256, @hoje), DATEADD(DAY, -253, @hoje), 5000.00, 'Paga', DATEADD(DAY, -254, @hoje), 5000.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -263, @hoje) AS DATETIME2(0)))),
    (2, 1, DATEADD(DAY, -225, @hoje), DATEADD(DAY, -222, @hoje), 5000.00, 'Paga', DATEADD(DAY, -220, @hoje), 5103.30, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -232, @hoje) AS DATETIME2(0)))),
    (3, 1, DATEADD(DAY, -195, @hoje), DATEADD(DAY, -192, @hoje), 5000.00, 'Paga', DATEADD(DAY, -193, @hoje), 5000.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -202, @hoje) AS DATETIME2(0)))),
    (4, 1, DATEADD(DAY, -164, @hoje), DATEADD(DAY, -161, @hoje), 5000.00, 'Paga', DATEADD(DAY, -159, @hoje), 5103.30, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -171, @hoje) AS DATETIME2(0)))),
    (5, 1, DATEADD(DAY, -134, @hoje), DATEADD(DAY, -131, @hoje), 5000.00, 'Paga', DATEADD(DAY, -132, @hoje), 5000.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -141, @hoje) AS DATETIME2(0)))),
    (6, 1, DATEADD(DAY, -103, @hoje), DATEADD(DAY, -100, @hoje), 5000.00, 'Paga', DATEADD(DAY, -98, @hoje), 5103.30, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -110, @hoje) AS DATETIME2(0)))),
    (7, 1, DATEADD(DAY, -72, @hoje), DATEADD(DAY, -69, @hoje), 5000.00, 'Paga', DATEADD(DAY, -70, @hoje), 5000.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -79, @hoje) AS DATETIME2(0)))),
    (8, 1, DATEADD(DAY, -42, @hoje), DATEADD(DAY, -39, @hoje), 5000.00, 'Paga', DATEADD(DAY, -37, @hoje), 5103.30, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -49, @hoje) AS DATETIME2(0)))),
    (9, 1, DATEADD(DAY, -11, @hoje), DATEADD(DAY, -8, @hoje), 5000.00, 'Paga', DATEADD(DAY, -9, @hoje), 5000.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -18, @hoje) AS DATETIME2(0)))),
    (10, 2, DATEADD(DAY, -256, @hoje), DATEADD(DAY, -229, @hoje), 8450.00, 'Paga', DATEADD(DAY, -226, @hoje), 8627.37, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -239, @hoje) AS DATETIME2(0)))),
    (11, 2, DATEADD(DAY, -225, @hoje), DATEADD(DAY, -198, @hoje), 8450.00, 'Paga', DATEADD(DAY, -198, @hoje), 8450.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -208, @hoje) AS DATETIME2(0)))),
    (12, 2, DATEADD(DAY, -195, @hoje), DATEADD(DAY, -168, @hoje), 8450.00, 'Paga', DATEADD(DAY, -165, @hoje), 8627.37, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -178, @hoje) AS DATETIME2(0)))),
    (13, 2, DATEADD(DAY, -164, @hoje), DATEADD(DAY, -137, @hoje), 8450.00, 'Paga', DATEADD(DAY, -137, @hoje), 8450.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -147, @hoje) AS DATETIME2(0)))),
    (14, 2, DATEADD(DAY, -134, @hoje), DATEADD(DAY, -107, @hoje), 8450.00, 'Paga', DATEADD(DAY, -104, @hoje), 8627.37, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -117, @hoje) AS DATETIME2(0)))),
    (15, 2, DATEADD(DAY, -103, @hoje), DATEADD(DAY, -76, @hoje), 8450.00, 'Paga', DATEADD(DAY, -76, @hoje), 8450.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -86, @hoje) AS DATETIME2(0)))),
    (16, 2, DATEADD(DAY, -72, @hoje), DATEADD(DAY, -45, @hoje), 8450.00, 'Paga', DATEADD(DAY, -42, @hoje), 8627.37, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -55, @hoje) AS DATETIME2(0)))),
    (17, 2, DATEADD(DAY, -42, @hoje), DATEADD(DAY, -15, @hoje), 8450.00, 'Aberta', NULL, NULL, NULL, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -25, @hoje) AS DATETIME2(0)))),
    (18, 3, DATEADD(DAY, -256, @hoje), DATEADD(DAY, -253, @hoje), 7800.00, 'Paga', DATEADD(DAY, -252, @hoje), 7958.57, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -263, @hoje) AS DATETIME2(0)))),
    (19, 3, DATEADD(DAY, -225, @hoje), DATEADD(DAY, -222, @hoje), 7800.00, 'Paga', DATEADD(DAY, -224, @hoje), 7800.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -232, @hoje) AS DATETIME2(0)))),
    (20, 3, DATEADD(DAY, -195, @hoje), DATEADD(DAY, -192, @hoje), 7800.00, 'Paga', DATEADD(DAY, -191, @hoje), 7958.57, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -202, @hoje) AS DATETIME2(0)))),
    (21, 3, DATEADD(DAY, -164, @hoje), DATEADD(DAY, -161, @hoje), 7800.00, 'Paga', DATEADD(DAY, -163, @hoje), 7800.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -171, @hoje) AS DATETIME2(0)))),
    (22, 3, DATEADD(DAY, -134, @hoje), DATEADD(DAY, -131, @hoje), 7800.00, 'Paga', DATEADD(DAY, -130, @hoje), 7958.57, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -141, @hoje) AS DATETIME2(0)))),
    (23, 3, DATEADD(DAY, -103, @hoje), DATEADD(DAY, -100, @hoje), 7800.00, 'Paga', DATEADD(DAY, -102, @hoje), 7800.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -110, @hoje) AS DATETIME2(0)))),
    (24, 3, DATEADD(DAY, -72, @hoje), DATEADD(DAY, -69, @hoje), 7800.00, 'Paga', DATEADD(DAY, -68, @hoje), 7958.57, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -79, @hoje) AS DATETIME2(0)))),
    (25, 3, DATEADD(DAY, -42, @hoje), DATEADD(DAY, -39, @hoje), 7800.00, 'Aberta', NULL, NULL, NULL, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -49, @hoje) AS DATETIME2(0)))),
    (26, 3, DATEADD(DAY, -11, @hoje), DATEADD(DAY, -8, @hoje), 7800.00, 'Aberta', NULL, NULL, NULL, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -18, @hoje) AS DATETIME2(0)))),
    (27, 4, DATEADD(DAY, -315, @hoje), DATEADD(DAY, -288, @hoje), 12300.00, 'Paga', DATEADD(DAY, -289, @hoje), 12300.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -298, @hoje) AS DATETIME2(0)))),
    (28, 4, DATEADD(DAY, -284, @hoje), DATEADD(DAY, -257, @hoje), 12300.00, 'Paga', DATEADD(DAY, -255, @hoje), 12554.12, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -267, @hoje) AS DATETIME2(0)))),
    (29, 4, DATEADD(DAY, -256, @hoje), DATEADD(DAY, -229, @hoje), 12300.00, 'Paga', DATEADD(DAY, -230, @hoje), 12300.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -239, @hoje) AS DATETIME2(0)))),
    (30, 4, DATEADD(DAY, -225, @hoje), DATEADD(DAY, -198, @hoje), 12300.00, 'Paga', DATEADD(DAY, -196, @hoje), 12554.12, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -208, @hoje) AS DATETIME2(0)))),
    (31, 4, DATEADD(DAY, -195, @hoje), DATEADD(DAY, -168, @hoje), 12300.00, 'Paga', DATEADD(DAY, -169, @hoje), 12300.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -178, @hoje) AS DATETIME2(0)))),
    (32, 4, DATEADD(DAY, -164, @hoje), DATEADD(DAY, -137, @hoje), 12300.00, 'Paga', DATEADD(DAY, -135, @hoje), 12554.12, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -147, @hoje) AS DATETIME2(0)))),
    (33, 4, DATEADD(DAY, -134, @hoje), DATEADD(DAY, -107, @hoje), 12300.00, 'Paga', DATEADD(DAY, -108, @hoje), 12300.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -117, @hoje) AS DATETIME2(0)))),
    (34, 4, DATEADD(DAY, -103, @hoje), DATEADD(DAY, -76, @hoje), 12300.00, 'Aberta', NULL, NULL, NULL, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -86, @hoje) AS DATETIME2(0)))),
    (35, 4, DATEADD(DAY, -72, @hoje), DATEADD(DAY, -45, @hoje), 12300.00, 'Aberta', NULL, NULL, NULL, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -55, @hoje) AS DATETIME2(0)))),
    (36, 4, DATEADD(DAY, -42, @hoje), DATEADD(DAY, -15, @hoje), 12300.00, 'Aberta', NULL, NULL, NULL, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -25, @hoje) AS DATETIME2(0)))),
    (37, 5, DATEADD(DAY, -195, @hoje), DATEADD(DAY, -193, @hoje), 6120.00, 'Paga', DATEADD(DAY, -190, @hoje), 6248.46, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -203, @hoje) AS DATETIME2(0)))),
    (38, 5, DATEADD(DAY, -164, @hoje), DATEADD(DAY, -162, @hoje), 6120.00, 'Paga', DATEADD(DAY, -162, @hoje), 6120.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -172, @hoje) AS DATETIME2(0)))),
    (39, 5, DATEADD(DAY, -134, @hoje), DATEADD(DAY, -132, @hoje), 6120.00, 'Paga', DATEADD(DAY, -129, @hoje), 6248.46, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -142, @hoje) AS DATETIME2(0)))),
    (40, 5, DATEADD(DAY, -103, @hoje), DATEADD(DAY, -101, @hoje), 6120.00, 'Paga', DATEADD(DAY, -101, @hoje), 6120.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -111, @hoje) AS DATETIME2(0)))),
    (41, 5, DATEADD(DAY, -72, @hoje), DATEADD(DAY, -70, @hoje), 6120.00, 'Paga', DATEADD(DAY, -67, @hoje), 6248.46, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -80, @hoje) AS DATETIME2(0)))),
    (42, 5, DATEADD(DAY, -42, @hoje), DATEADD(DAY, -40, @hoje), 6120.00, 'Paga', DATEADD(DAY, -40, @hoje), 6120.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -50, @hoje) AS DATETIME2(0)))),
    (43, 5, DATEADD(DAY, -11, @hoje), DATEADD(DAY, -9, @hoje), 6120.00, 'Aberta', NULL, NULL, NULL, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -19, @hoje) AS DATETIME2(0)))),
    (44, 6, DATEADD(DAY, -256, @hoje), DATEADD(DAY, -234, @hoje), 4950.00, 'Paga', DATEADD(DAY, -233, @hoje), 5050.63, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -244, @hoje) AS DATETIME2(0)))),
    (45, 6, DATEADD(DAY, -225, @hoje), DATEADD(DAY, -203, @hoje), 4950.00, 'Paga', DATEADD(DAY, -205, @hoje), 4950.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -213, @hoje) AS DATETIME2(0)))),
    (46, 6, DATEADD(DAY, -195, @hoje), DATEADD(DAY, -173, @hoje), 4950.00, 'Paga', DATEADD(DAY, -172, @hoje), 5050.63, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -183, @hoje) AS DATETIME2(0)))),
    (47, 6, DATEADD(DAY, -164, @hoje), DATEADD(DAY, -142, @hoje), 4950.00, 'Paga', DATEADD(DAY, -144, @hoje), 4950.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -152, @hoje) AS DATETIME2(0)))),
    (48, 6, DATEADD(DAY, -134, @hoje), DATEADD(DAY, -112, @hoje), 4950.00, 'Paga', DATEADD(DAY, -111, @hoje), 5050.63, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -122, @hoje) AS DATETIME2(0)))),
    (49, 6, DATEADD(DAY, -103, @hoje), DATEADD(DAY, -81, @hoje), 4950.00, 'Paga', DATEADD(DAY, -83, @hoje), 4950.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -91, @hoje) AS DATETIME2(0)))),
    (50, 6, DATEADD(DAY, -72, @hoje), DATEADD(DAY, -50, @hoje), 4950.00, 'Paga', DATEADD(DAY, -49, @hoje), 5050.63, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -60, @hoje) AS DATETIME2(0)))),
    (51, 6, DATEADD(DAY, -42, @hoje), DATEADD(DAY, -20, @hoje), 4950.00, 'Paga', DATEADD(DAY, -22, @hoje), 4950.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -30, @hoje) AS DATETIME2(0)))),
    (52, 7, DATEADD(DAY, -284, @hoje), DATEADD(DAY, -257, @hoje), 9600.00, 'Paga', DATEADD(DAY, -258, @hoje), 9600.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -267, @hoje) AS DATETIME2(0)))),
    (53, 7, DATEADD(DAY, -256, @hoje), DATEADD(DAY, -229, @hoje), 9600.00, 'Paga', DATEADD(DAY, -227, @hoje), 9798.34, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -239, @hoje) AS DATETIME2(0)))),
    (54, 7, DATEADD(DAY, -225, @hoje), DATEADD(DAY, -198, @hoje), 9600.00, 'Paga', DATEADD(DAY, -199, @hoje), 9600.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -208, @hoje) AS DATETIME2(0)))),
    (55, 7, DATEADD(DAY, -195, @hoje), DATEADD(DAY, -168, @hoje), 9600.00, 'Paga', DATEADD(DAY, -166, @hoje), 9798.34, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -178, @hoje) AS DATETIME2(0)))),
    (56, 7, DATEADD(DAY, -164, @hoje), DATEADD(DAY, -137, @hoje), 9600.00, 'Paga', DATEADD(DAY, -138, @hoje), 9600.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -147, @hoje) AS DATETIME2(0)))),
    (57, 7, DATEADD(DAY, -134, @hoje), DATEADD(DAY, -107, @hoje), 9600.00, 'Paga', DATEADD(DAY, -105, @hoje), 9798.34, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -117, @hoje) AS DATETIME2(0)))),
    (58, 7, DATEADD(DAY, -103, @hoje), DATEADD(DAY, -76, @hoje), 9600.00, 'Paga', DATEADD(DAY, -77, @hoje), 9600.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -86, @hoje) AS DATETIME2(0)))),
    (59, 7, DATEADD(DAY, -72, @hoje), DATEADD(DAY, -45, @hoje), 9600.00, 'Aberta', NULL, NULL, NULL, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -55, @hoje) AS DATETIME2(0)))),
    (60, 7, DATEADD(DAY, -42, @hoje), DATEADD(DAY, -15, @hoje), 9600.00, 'Aberta', NULL, NULL, NULL, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -25, @hoje) AS DATETIME2(0)))),
    (61, 8, DATEADD(DAY, -195, @hoje), DATEADD(DAY, -179, @hoje), 3200.00, 'Paga', DATEADD(DAY, -176, @hoje), 3267.17, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -189, @hoje) AS DATETIME2(0)))),
    (62, 8, DATEADD(DAY, -164, @hoje), DATEADD(DAY, -148, @hoje), 3200.00, 'Paga', DATEADD(DAY, -148, @hoje), 3200.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -158, @hoje) AS DATETIME2(0)))),
    (63, 8, DATEADD(DAY, -134, @hoje), DATEADD(DAY, -118, @hoje), 3200.00, 'Paga', DATEADD(DAY, -115, @hoje), 3267.17, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -128, @hoje) AS DATETIME2(0)))),
    (64, 8, DATEADD(DAY, -103, @hoje), DATEADD(DAY, -87, @hoje), 3200.00, 'Paga', DATEADD(DAY, -87, @hoje), 3200.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -97, @hoje) AS DATETIME2(0)))),
    (65, 8, DATEADD(DAY, -72, @hoje), DATEADD(DAY, -56, @hoje), 3200.00, 'Paga', DATEADD(DAY, -53, @hoje), 3267.17, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -66, @hoje) AS DATETIME2(0)))),
    (66, 8, DATEADD(DAY, -42, @hoje), DATEADD(DAY, -26, @hoje), 3200.00, 'Aberta', NULL, NULL, NULL, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -36, @hoje) AS DATETIME2(0)))),
    (67, 9, DATEADD(DAY, -225, @hoje), DATEADD(DAY, -217, @hoje), 6700.00, 'Paga', DATEADD(DAY, -219, @hoje), 6700.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -227, @hoje) AS DATETIME2(0)))),
    (68, 9, DATEADD(DAY, -195, @hoje), DATEADD(DAY, -187, @hoje), 6700.00, 'Paga', DATEADD(DAY, -186, @hoje), 6836.21, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -197, @hoje) AS DATETIME2(0)))),
    (69, 9, DATEADD(DAY, -164, @hoje), DATEADD(DAY, -156, @hoje), 6700.00, 'Paga', DATEADD(DAY, -158, @hoje), 6700.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -166, @hoje) AS DATETIME2(0)))),
    (70, 9, DATEADD(DAY, -134, @hoje), DATEADD(DAY, -126, @hoje), 6700.00, 'Paga', DATEADD(DAY, -125, @hoje), 6836.21, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -136, @hoje) AS DATETIME2(0)))),
    (71, 9, DATEADD(DAY, -103, @hoje), DATEADD(DAY, -95, @hoje), 6700.00, 'Paga', DATEADD(DAY, -97, @hoje), 6700.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -105, @hoje) AS DATETIME2(0)))),
    (72, 9, DATEADD(DAY, -72, @hoje), DATEADD(DAY, -64, @hoje), 6700.00, 'Paga', DATEADD(DAY, -63, @hoje), 6836.21, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -74, @hoje) AS DATETIME2(0)))),
    (73, 9, DATEADD(DAY, -42, @hoje), DATEADD(DAY, -34, @hoje), 6700.00, 'Paga', DATEADD(DAY, -36, @hoje), 6700.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -44, @hoje) AS DATETIME2(0)))),
    (74, 9, DATEADD(DAY, -11, @hoje), DATEADD(DAY, -3, @hoje), 6700.00, 'Paga', DATEADD(DAY, -2, @hoje), 6836.21, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -13, @hoje) AS DATETIME2(0)))),
    (75, 10, DATEADD(DAY, -315, @hoje), DATEADD(DAY, -301, @hoje), 11000.00, 'Paga', DATEADD(DAY, -302, @hoje), 11000.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -311, @hoje) AS DATETIME2(0)))),
    (76, 10, DATEADD(DAY, -284, @hoje), DATEADD(DAY, -270, @hoje), 11000.00, 'Paga', DATEADD(DAY, -268, @hoje), 11227.26, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -280, @hoje) AS DATETIME2(0)))),
    (77, 10, DATEADD(DAY, -256, @hoje), DATEADD(DAY, -242, @hoje), 11000.00, 'Paga', DATEADD(DAY, -243, @hoje), 11000.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -252, @hoje) AS DATETIME2(0)))),
    (78, 10, DATEADD(DAY, -225, @hoje), DATEADD(DAY, -211, @hoje), 11000.00, 'Paga', DATEADD(DAY, -209, @hoje), 11227.26, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -221, @hoje) AS DATETIME2(0)))),
    (79, 10, DATEADD(DAY, -195, @hoje), DATEADD(DAY, -181, @hoje), 11000.00, 'Paga', DATEADD(DAY, -182, @hoje), 11000.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -191, @hoje) AS DATETIME2(0)))),
    (80, 10, DATEADD(DAY, -164, @hoje), DATEADD(DAY, -150, @hoje), 11000.00, 'Paga', DATEADD(DAY, -148, @hoje), 11227.26, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -160, @hoje) AS DATETIME2(0)))),
    (81, 10, DATEADD(DAY, -134, @hoje), DATEADD(DAY, -120, @hoje), 11000.00, 'Paga', DATEADD(DAY, -121, @hoje), 11000.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -130, @hoje) AS DATETIME2(0)))),
    (82, 10, DATEADD(DAY, -103, @hoje), DATEADD(DAY, -89, @hoje), 11000.00, 'Paga', DATEADD(DAY, -87, @hoje), 11227.26, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -99, @hoje) AS DATETIME2(0)))),
    (83, 10, DATEADD(DAY, -72, @hoje), DATEADD(DAY, -58, @hoje), 11000.00, 'Paga', DATEADD(DAY, -59, @hoje), 11000.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -68, @hoje) AS DATETIME2(0)))),
    (84, 10, DATEADD(DAY, -42, @hoje), DATEADD(DAY, -28, @hoje), 11000.00, 'Paga', DATEADD(DAY, -26, @hoje), 11227.26, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -38, @hoje) AS DATETIME2(0)))),
    (85, 11, DATEADD(DAY, -195, @hoje), DATEADD(DAY, -189, @hoje), 4200.00, 'Paga', DATEADD(DAY, -186, @hoje), 4288.16, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -199, @hoje) AS DATETIME2(0)))),
    (86, 11, DATEADD(DAY, -164, @hoje), DATEADD(DAY, -158, @hoje), 4200.00, 'Paga', DATEADD(DAY, -158, @hoje), 4200.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -168, @hoje) AS DATETIME2(0)))),
    (87, 11, DATEADD(DAY, -134, @hoje), DATEADD(DAY, -128, @hoje), 4200.00, 'Paga', DATEADD(DAY, -125, @hoje), 4288.16, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -138, @hoje) AS DATETIME2(0)))),
    (88, 11, DATEADD(DAY, -103, @hoje), DATEADD(DAY, -97, @hoje), 4200.00, 'Paga', DATEADD(DAY, -97, @hoje), 4200.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -107, @hoje) AS DATETIME2(0)))),
    (89, 11, DATEADD(DAY, -72, @hoje), DATEADD(DAY, -66, @hoje), 4200.00, 'Paga', DATEADD(DAY, -63, @hoje), 4288.16, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -76, @hoje) AS DATETIME2(0)))),
    (90, 11, DATEADD(DAY, -42, @hoje), DATEADD(DAY, -36, @hoje), 4200.00, 'Paga', DATEADD(DAY, -36, @hoje), 4200.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -46, @hoje) AS DATETIME2(0)))),
    (91, 11, DATEADD(DAY, -11, @hoje), DATEADD(DAY, -5, @hoje), 4200.00, 'Aberta', NULL, NULL, NULL, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -15, @hoje) AS DATETIME2(0)))),
    (92, 12, DATEADD(DAY, -195, @hoje), DATEADD(DAY, -171, @hoje), 2800.00, 'Paga', DATEADD(DAY, -170, @hoje), 2856.92, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -181, @hoje) AS DATETIME2(0)))),
    (93, 12, DATEADD(DAY, -164, @hoje), DATEADD(DAY, -140, @hoje), 2800.00, 'Paga', DATEADD(DAY, -142, @hoje), 2800.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -150, @hoje) AS DATETIME2(0)))),
    (94, 12, DATEADD(DAY, -134, @hoje), DATEADD(DAY, -110, @hoje), 2800.00, 'Paga', DATEADD(DAY, -109, @hoje), 2856.92, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -120, @hoje) AS DATETIME2(0)))),
    (95, 12, DATEADD(DAY, -103, @hoje), DATEADD(DAY, -79, @hoje), 2800.00, 'Paga', DATEADD(DAY, -81, @hoje), 2800.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -89, @hoje) AS DATETIME2(0)))),
    (96, 12, DATEADD(DAY, -72, @hoje), DATEADD(DAY, -48, @hoje), 2800.00, 'Paga', DATEADD(DAY, -47, @hoje), 2856.92, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -58, @hoje) AS DATETIME2(0)))),
    (97, 12, DATEADD(DAY, -42, @hoje), DATEADD(DAY, -18, @hoje), 2800.00, 'Paga', DATEADD(DAY, -20, @hoje), 2800.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -28, @hoje) AS DATETIME2(0)))),
    (98, 13, DATEADD(DAY, -225, @hoje), DATEADD(DAY, -216, @hoje), 2500.00, 'Paga', DATEADD(DAY, -214, @hoje), 2551.65, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -226, @hoje) AS DATETIME2(0)))),
    (99, 13, DATEADD(DAY, -195, @hoje), DATEADD(DAY, -186, @hoje), 2500.00, 'Paga', DATEADD(DAY, -187, @hoje), 2500.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -196, @hoje) AS DATETIME2(0)))),
    (100, 13, DATEADD(DAY, -164, @hoje), DATEADD(DAY, -155, @hoje), 2500.00, 'Paga', DATEADD(DAY, -153, @hoje), 2551.65, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -165, @hoje) AS DATETIME2(0)))),
    (101, 13, DATEADD(DAY, -134, @hoje), DATEADD(DAY, -125, @hoje), 2500.00, 'Paga', DATEADD(DAY, -126, @hoje), 2500.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -135, @hoje) AS DATETIME2(0)))),
    (102, 13, DATEADD(DAY, -103, @hoje), DATEADD(DAY, -94, @hoje), 2500.00, 'Paga', DATEADD(DAY, -92, @hoje), 2551.65, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -104, @hoje) AS DATETIME2(0)))),
    (103, 13, DATEADD(DAY, -72, @hoje), DATEADD(DAY, -63, @hoje), 2500.00, 'Paga', DATEADD(DAY, -64, @hoje), 2500.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -73, @hoje) AS DATETIME2(0)))),
    (104, 13, DATEADD(DAY, -42, @hoje), DATEADD(DAY, -33, @hoje), 2500.00, 'Paga', DATEADD(DAY, -31, @hoje), 2551.65, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -43, @hoje) AS DATETIME2(0)))),
    (105, 13, DATEADD(DAY, -11, @hoje), DATEADD(DAY, -2, @hoje), 2500.00, 'Paga', DATEADD(DAY, -3, @hoje), 2500.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -12, @hoje) AS DATETIME2(0)))),
    (106, 14, DATEADD(DAY, -164, @hoje), DATEADD(DAY, -163, @hoje), 1800.00, 'Paga', DATEADD(DAY, -160, @hoje), 1837.78, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -173, @hoje) AS DATETIME2(0)))),
    (107, 14, DATEADD(DAY, -134, @hoje), DATEADD(DAY, -133, @hoje), 1800.00, 'Paga', DATEADD(DAY, -133, @hoje), 1800.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -143, @hoje) AS DATETIME2(0)))),
    (108, 14, DATEADD(DAY, -103, @hoje), DATEADD(DAY, -102, @hoje), 1800.00, 'Paga', DATEADD(DAY, -99, @hoje), 1837.78, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -112, @hoje) AS DATETIME2(0)))),
    (109, 14, DATEADD(DAY, -72, @hoje), DATEADD(DAY, -71, @hoje), 1800.00, 'Paga', DATEADD(DAY, -71, @hoje), 1800.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -81, @hoje) AS DATETIME2(0)))),
    (110, 14, DATEADD(DAY, -42, @hoje), DATEADD(DAY, -41, @hoje), 1800.00, 'Paga', DATEADD(DAY, -38, @hoje), 1837.78, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -51, @hoje) AS DATETIME2(0)))),
    (111, 14, DATEADD(DAY, -11, @hoje), DATEADD(DAY, -10, @hoje), 1800.00, 'Paga', DATEADD(DAY, -10, @hoje), 1800.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -20, @hoje) AS DATETIME2(0)))),
    (112, 15, DATEADD(DAY, -225, @hoje), DATEADD(DAY, -223, @hoje), 3900.00, 'Paga', DATEADD(DAY, -225, @hoje), 3900.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -233, @hoje) AS DATETIME2(0)))),
    (113, 15, DATEADD(DAY, -195, @hoje), DATEADD(DAY, -193, @hoje), 3900.00, 'Paga', DATEADD(DAY, -192, @hoje), 3979.29, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -203, @hoje) AS DATETIME2(0)))),
    (114, 15, DATEADD(DAY, -164, @hoje), DATEADD(DAY, -162, @hoje), 3900.00, 'Paga', DATEADD(DAY, -164, @hoje), 3900.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -172, @hoje) AS DATETIME2(0)))),
    (115, 15, DATEADD(DAY, -134, @hoje), DATEADD(DAY, -132, @hoje), 3900.00, 'Paga', DATEADD(DAY, -131, @hoje), 3979.29, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -142, @hoje) AS DATETIME2(0)))),
    (116, 15, DATEADD(DAY, -103, @hoje), DATEADD(DAY, -101, @hoje), 3900.00, 'Paga', DATEADD(DAY, -103, @hoje), 3900.00, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -111, @hoje) AS DATETIME2(0)))),
    (117, 15, DATEADD(DAY, -72, @hoje), DATEADD(DAY, -70, @hoje), 3900.00, 'Paga', DATEADD(DAY, -69, @hoje), 3979.29, 2, NULL, DATEADD(HOUR, 4, CAST(DATEADD(DAY, -80, @hoje) AS DATETIME2(0))));
SET IDENTITY_INSERT dbo.Parcelas OFF;

SET IDENTITY_INSERT dbo.Liberacoes ON;
INSERT INTO dbo.Liberacoes (Id, ClienteId, UsuarioId, Motivo, DataInicio, DataFim, RevogadaEm, RevogadaPorUsuarioId)
VALUES
    (1, 7, 2, N'Renegociação em andamento: proposta de parcelamento em três vezes aguardando assinatura.', DATEADD(HOUR, 17, CAST(DATEADD(DAY, -2, @hoje) AS DATETIME2(0))), DATEADD(DAY, 8, @hoje), NULL, NULL);
SET IDENTITY_INSERT dbo.Liberacoes OFF;

SET IDENTITY_INSERT dbo.Solicitacoes ON;
INSERT INTO dbo.Solicitacoes (Id, ClienteId, UsuarioId, Tipo, Descricao, Status, CriadoEm, ConcluidaEm)
VALUES
    (1, 1, 3, 'NovaSolicitacao', N'Revisão do contrato de fornecimento com a distribuidora regional.', 'Concluida', DATEADD(HOUR, 14, CAST(DATEADD(DAY, -12, @hoje) AS DATETIME2(0))), DATEADD(HOUR, 19, CAST(DATEADD(DAY, -6, @hoje) AS DATETIME2(0)))),
    (2, 6, 4, 'AberturaProcesso', N'Defesa em auto de infração da ANTT, prazo de 30 dias.', 'Aberta', DATEADD(HOUR, 14, CAST(DATEADD(DAY, -9, @hoje) AS DATETIME2(0))), NULL),
    (3, 9, 3, 'NovaSolicitacao', N'Notificação extrajudicial de três devedores.', 'Aberta', DATEADD(HOUR, 14, CAST(DATEADD(DAY, -5, @hoje) AS DATETIME2(0))), NULL),
    (4, 2, 4, 'NovaSolicitacao', N'Parecer sobre aditivo de obra com reajuste de prazo.', 'Aberta', DATEADD(HOUR, 14, CAST(DATEADD(DAY, -3, @hoje) AS DATETIME2(0))), NULL),
    (5, 10, 3, 'AberturaProcesso', N'Ação de regularização fundiária da Fazenda Boa Vista.', 'Concluida', DATEADD(HOUR, 14, CAST(DATEADD(DAY, -20, @hoje) AS DATETIME2(0))), DATEADD(HOUR, 19, CAST(DATEADD(DAY, -2, @hoje) AS DATETIME2(0)))),
    (6, 13, 3, 'NovaSolicitacao', N'Minuta de doação com reserva de usufruto.', 'Aberta', DATEADD(HOUR, 14, CAST(DATEADD(DAY, -1, @hoje) AS DATETIME2(0))), NULL);
SET IDENTITY_INSERT dbo.Solicitacoes OFF;

UPDATE dbo.Configuracoes SET AtualizadoPorUsuarioId = 1 WHERE Id = 1;

COMMIT TRANSACTION;
GO

PRINT N'Massa de demonstração carregada. Suba a API: ela gera os avisos e confere o semáforo na primeira execução.';
GO

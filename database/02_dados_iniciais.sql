/* ============================================================================
   Script 02: dados mínimos para o sistema funcionar (produção ou demonstração).
   - Configuração padrão (multa 2%, juros 0,033% ao dia, bloqueio após 30 dias).
   - Um usuário Financeiro/Admin inicial, SEM senha.

   O usuário nasce com SenhaHash = NULL e não consegue entrar. Na primeira
   subida, a API grava o hash BCrypt da senha informada em Seed:SenhaInicial
   (variável de ambiente Seed__SenhaInicial). Veja o README, seção "Primeiro acesso".
   ============================================================================ */

USE SRF_Inadimplencia;
GO

SET NOCOUNT ON;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Configuracoes WHERE Id = 1)
BEGIN
    INSERT INTO dbo.Configuracoes (Id, MultaPercentual, JurosDiarioPercentual, DiasParaBloqueio, DiasAvisoPreVencimento)
    VALUES (1, 2.00, 0.0330, 30, 3);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Email = N'admin@srf.local')
BEGIN
    INSERT INTO dbo.Usuarios (Nome, Email, SenhaHash, Perfil, Ativo)
    VALUES (N'Administrador SRF', N'admin@srf.local', NULL, 'Admin', 1);
END
GO

PRINT N'Dados iniciais gravados.';
GO

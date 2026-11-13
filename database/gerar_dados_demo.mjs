// Gera database/03_dados_demonstracao.sql a partir da MESMA massa fictícia do modo
// demonstração do front-end (frontend/src/api/demo/sementes.js).
//
// Uso (na pasta database):   node gerar_dados_demo.mjs
//
// As datas saem como DATEADD(DAY, n, @hoje): o script monta tudo em relação ao dia em que
// for executado, então o semáforo mostra sempre a mesma distribuição de verdes, amarelos
// e vermelhos, não importa o dia da apresentação.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { montarBancoInicial, SENHA_DEMO } from '../frontend/src/api/demo/sementes.js';
import { sincronizarStatusInicial } from '../frontend/src/api/demo/motor.js';
import { diasEntre, hojeISO } from '../frontend/src/lib/datas.js';

const pasta = dirname(fileURLToPath(import.meta.url));
const REFERENCIA = hojeISO();

const banco = montarBancoInicial(REFERENCIA);
banco.deslocamentoDias = 0;
sincronizarStatusInicial(banco);

// ---------------------------------------------------------------------------
// Formatadores T-SQL
// ---------------------------------------------------------------------------

const texto = (v) => (v === null || v === undefined ? 'NULL' : `N'${String(v).replace(/'/g, "''")}'`);
const simples = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const numero = (v) => (v === null || v === undefined ? 'NULL' : String(v));
const bit = (v) => (v ? '1' : '0');

/** 'AAAA-MM-DD' -> expressão de DATE relativa a @hoje. */
function dia(iso) {
  if (!iso) return 'NULL';
  const n = diasEntre(REFERENCIA, String(iso).slice(0, 10));
  return n === 0 ? '@hoje' : `DATEADD(DAY, ${n}, @hoje)`;
}

/** 'AAAA-MM-DDTHH:00:00Z' -> expressão de DATETIME2 (UTC) relativa a @hoje. */
function instante(iso) {
  if (!iso) return 'NULL';
  const data = String(iso).slice(0, 10);
  const hora = Number(String(iso).slice(11, 13));
  const n = diasEntre(REFERENCIA, data);
  const base = n === 0 ? 'CAST(@hoje AS DATETIME2(0))' : `CAST(DATEADD(DAY, ${n}, @hoje) AS DATETIME2(0))`;
  return hora === 0 ? base : `DATEADD(HOUR, ${hora}, ${base})`;
}

function insercao(tabela, colunas, linhas, { identidade = true } = {}) {
  if (linhas.length === 0) return '';
  const corpo = linhas.map((l) => `    (${l.join(', ')})`).join(',\n');
  const abrir = identidade ? `SET IDENTITY_INSERT dbo.${tabela} ON;\n` : '';
  const fechar = identidade ? `\nSET IDENTITY_INSERT dbo.${tabela} OFF;` : '';
  return `${abrir}INSERT INTO dbo.${tabela} (${colunas.join(', ')})\nVALUES\n${corpo};${fechar}\n`;
}

// ---------------------------------------------------------------------------
// Tabelas
// ---------------------------------------------------------------------------

// O usuário 1 já existe (script 02). Os demais entram com os Ids do modo demonstração.
const usuarios = insercao(
  'Usuarios',
  ['Id', 'Nome', 'Email', 'SenhaHash', 'Perfil', 'Ativo', 'CriadoEm'],
  banco.usuarios
    .filter((u) => u.id !== 1)
    .map((u) => [numero(u.id), texto(u.nome), texto(u.email), 'NULL', simples(u.perfil), bit(u.ativo), instante(u.criadoEm)]),
);

const clientes = insercao(
  'Clientes',
  ['Id', 'Nome', 'Documento', 'Email', 'Telefone', 'Responsavel', 'Observacoes', 'Ativo', 'Status', 'StatusDesde', 'CriadoEm'],
  banco.clientes.map((c) => [
    numero(c.id), texto(c.nome), simples(c.documento), texto(c.email), texto(c.telefone), texto(c.responsavel),
    texto(c.observacoes), bit(c.ativo), simples(c.status), instante(c.statusDesde), instante(c.criadoEm),
  ]),
);

const contratos = insercao(
  'Contratos',
  ['Id', 'ClienteId', 'Descricao', 'ValorMensal', 'DiaVencimento', 'DataInicio', 'DataFim', 'Ativo', 'CriadoEm'],
  banco.contratos.map((c) => [
    numero(c.id), numero(c.clienteId), texto(c.descricao), numero(c.valorMensal.toFixed(2)), numero(c.diaVencimento),
    dia(c.dataInicio), dia(c.dataFim), bit(c.ativo), instante(c.criadoEm),
  ]),
);

const parcelas = insercao(
  'Parcelas',
  ['Id', 'ContratoId', 'Competencia', 'DataVencimento', 'ValorOriginal', 'Status', 'DataPagamento', 'ValorPago', 'BaixadaPorUsuarioId', 'Observacao', 'CriadoEm'],
  banco.parcelas.map((p) => [
    numero(p.id), numero(p.contratoId), dia(p.competencia), dia(p.dataVencimento), numero(p.valorOriginal.toFixed(2)),
    simples(p.status), dia(p.dataPagamento), p.valorPago === null ? 'NULL' : numero(p.valorPago.toFixed(2)),
    numero(p.baixadaPorUsuarioId), texto(p.observacao), instante(p.criadoEm),
  ]),
);

const liberacoes = insercao(
  'Liberacoes',
  ['Id', 'ClienteId', 'UsuarioId', 'Motivo', 'DataInicio', 'DataFim', 'RevogadaEm', 'RevogadaPorUsuarioId'],
  banco.liberacoes.map((l) => [
    numero(l.id), numero(l.clienteId), numero(l.usuarioId), texto(l.motivo), instante(l.dataInicio), dia(l.dataFim),
    instante(l.revogadaEm), numero(l.revogadaPorUsuarioId),
  ]),
);

const solicitacoes = insercao(
  'Solicitacoes',
  ['Id', 'ClienteId', 'UsuarioId', 'Tipo', 'Descricao', 'Status', 'CriadoEm', 'ConcluidaEm'],
  banco.solicitacoes.map((s) => [
    numero(s.id), numero(s.clienteId), numero(s.usuarioId), simples(s.tipo), texto(s.descricao), simples(s.status),
    instante(s.criadoEm), instante(s.concluidaEm),
  ]),
);

// ---------------------------------------------------------------------------
// Arquivo final
// ---------------------------------------------------------------------------

const sql = `/* ============================================================================
   Script 03: MASSA DE DADOS FICTÍCIA PARA DEMONSTRAÇÃO.
   NÃO EXECUTE EM PRODUÇÃO. Todos os clientes, valores e documentos são inventados.

   Arquivo GERADO por database/gerar_dados_demo.mjs (não edite à mão: rode o
   gerador de novo). Requer os scripts 01 e 02 já executados e o banco sem clientes.

   O que cria: 4 usuários, 14 clientes, 15 contratos, ${banco.parcelas.length} cobranças, 1 liberação
   temporária e ${banco.solicitacoes.length} solicitações. Os vencimentos são relativos ao dia de hoje,
   então o semáforo sempre mostra: 8 clientes em dia/ativos... ver distribuição no README.

   Senha de todos os usuários de demonstração: ${SENHA_DEMO}
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

UPDATE dbo.Usuarios SET Nome = ${texto(banco.usuarios[0].nome)} WHERE Id = 1;

${usuarios}
${clientes}
${contratos}
${parcelas}
${liberacoes}
${solicitacoes}
UPDATE dbo.Configuracoes SET AtualizadoPorUsuarioId = 1 WHERE Id = 1;

COMMIT TRANSACTION;
GO

PRINT N'Massa de demonstração carregada. Suba a API: ela gera os avisos e confere o semáforo na primeira execução.';
GO
`;

// Texto de cabeçalho com a distribuição real, calculada pelo próprio motor de regras.
const contagem = { Verde: 0, Amarelo: 0, Vermelho: 0 };
for (const c of banco.clientes.filter((x) => x.ativo)) contagem[c.status] += 1;
const final = sql.replace(
  'então o semáforo sempre mostra: 8 clientes em dia/ativos... ver distribuição no README.',
  `então o semáforo sempre mostra: ${contagem.Verde} verdes, ${contagem.Amarelo} amarelos e ${contagem.Vermelho} vermelhos (clientes ativos).`,
);

writeFileSync(join(pasta, '03_dados_demonstracao.sql'), final, 'utf8');
console.log(`03_dados_demonstracao.sql gerado (referência ${REFERENCIA}): ${JSON.stringify(contagem)}, ${banco.parcelas.length} cobranças.`);

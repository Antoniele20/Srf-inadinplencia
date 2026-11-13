// Testes de fluxo sobre a API de demonstração: semáforo, bloqueio operacional,
// baixa com liberação imediata, liberação temporária, perfis e passagem do tempo.

import test from 'node:test';
import assert from 'node:assert/strict';

import { criarApiDemo, criarBancoDemo } from '../src/api/demo/apiDemo.js';
import { definirRelogio, situacaoDoCliente } from '../src/api/demo/motor.js';
import { CLIENTES_DEMO } from '../src/api/demo/sementes.js';
import { documentoValido } from '../src/lib/formatos.js';

const ESPERADO = {
  1: 'Verde', 2: 'Amarelo', 3: 'Vermelho', 4: 'Vermelho', 5: 'Amarelo', 6: 'Verde', 7: 'Vermelho',
  8: 'Amarelo', 9: 'Verde', 10: 'Verde', 11: 'Amarelo', 12: 'Verde', 13: 'Verde',
};

function fixarData(iso) {
  definirRelogio(() => new Date(`${iso}T12:00:00`));
}

async function apiComo(email) {
  const api = criarApiDemo({ persistir: false });
  const sessao = await api.auth.entrar(email, 'Srf@2026');
  api.definirToken(sessao.token);
  return api;
}

test('massa de demonstração: documentos fictícios têm dígitos verificadores válidos', () => {
  for (const cliente of CLIENTES_DEMO) {
    assert.equal(documentoValido(cliente.documento), true, cliente.nome);
  }
});

test('massa de demonstração: o semáforo é o mesmo em qualquer dia do ano', () => {
  const inicio = new Date(Date.UTC(2026, 0, 1));
  for (let i = 0; i < 800; i += 1) {
    const dia = new Date(inicio.getTime() + i * 86400000).toISOString().slice(0, 10);
    fixarData(dia);
    const banco = criarBancoDemo();
    for (const cliente of banco.clientes.filter((c) => c.ativo)) {
      assert.equal(cliente.status, ESPERADO[cliente.id], `${dia}: ${cliente.nome}`);
    }
    const eta = situacaoDoCliente(banco, banco.clientes.find((c) => c.id === 7));
    assert.equal(eta.bloqueado, false, `${dia}: Eta deveria estar com liberação temporária`);
    const teta = situacaoDoCliente(banco, banco.clientes.find((c) => c.id === 8));
    assert.ok(teta.diasAteBloqueio >= 1 && teta.diasAteBloqueio <= 6, `${dia}: Teta bloqueia em ${teta.diasAteBloqueio} dias`);
    // Nenhuma cobrança duplicada por contrato e competência.
    const chaves = new Set(banco.parcelas.map((p) => `${p.contratoId}|${p.competencia}`));
    assert.equal(chaves.size, banco.parcelas.length, `${dia}: cobrança duplicada`);
    // Pagamentos nunca no futuro.
    assert.ok(banco.parcelas.every((p) => !p.dataPagamento || p.dataPagamento <= dia), `${dia}: pagamento futuro`);
  }
  definirRelogio(null);
});

test('login: credenciais erradas são recusadas e as corretas devolvem o perfil', async () => {
  const api = criarApiDemo({ persistir: false });
  await assert.rejects(api.auth.entrar('admin@srf.local', 'errada'), { codigo: 'CREDENCIAIS_INVALIDAS' });
  const sessao = await api.auth.entrar('ADMIN@srf.local', 'Srf@2026');
  assert.equal(sessao.usuario.perfil, 'Admin');
  await assert.rejects(api.painel.obter(), { codigo: 'NAO_AUTENTICADO' });
});

test('painel: contagens do semáforo batem com a lista de clientes', async () => {
  const api = await apiComo('operacional@srf.local');
  const painel = await api.painel.obter();
  assert.deepEqual(
    { verde: painel.semaforo.verde, amarelo: painel.semaforo.amarelo, vermelho: painel.semaforo.vermelho },
    { verde: 6, amarelo: 4, vermelho: 3 },
  );
  assert.equal(painel.semaforo.bloqueados, 2);
  assert.equal(painel.semaforo.liberadosTemporariamente, 1);
  assert.equal(painel.mensal.length, 6);
  const clientes = await api.clientes.listar();
  assert.equal(clientes.length, 13);
  const soma = clientes.reduce((t, c) => t + c.valorAtualizado, 0);
  assert.ok(Math.abs(soma - painel.totais.valorAtualizado) < 0.01);
  for (const mes of painel.mensal) {
    assert.ok(Math.abs(mes.recebido + mes.emAberto - mes.previsto) < 0.01);
  }
});

test('perfil Operacional: consulta, mas não registra pagamento nem altera regras', async () => {
  const api = await apiComo('operacional@srf.local');
  const cobrancas = await api.cobrancas.listar({ situacao: 'Vencida' });
  assert.ok(cobrancas.length > 0);
  await assert.rejects(api.cobrancas.baixar(cobrancas[0].id, { dataPagamento: '2026-01-01', valorPago: 1 }), { codigo: 'SEM_PERMISSAO' });
  await assert.rejects(api.configuracoes.salvar({ multaPercentual: 5 }), { codigo: 'SEM_PERMISSAO' });
  await assert.rejects(api.clientes.concederLiberacao(3, { dataFim: '2099-01-01', motivo: 'tentativa indevida' }), { codigo: 'SEM_PERMISSAO' });
  await assert.rejects(api.usuarios.listar(), { codigo: 'SEM_PERMISSAO' });
  await assert.rejects(api.registros.listar(), { codigo: 'SEM_PERMISSAO' });
  assert.equal((await api.configuracoes.obter()).diasParaBloqueio, 30);
});

test('bloqueio operacional: cliente vermelho não recebe nova solicitação', async () => {
  const api = await apiComo('operacional@srf.local');
  const dados = { tipo: 'NovaSolicitacao', descricao: 'Análise de contrato de locação.' };

  await assert.rejects(api.solicitacoes.criar({ ...dados, clienteId: 3 }), { codigo: 'CLIENTE_BLOQUEADO', status: 409 });
  await assert.rejects(api.solicitacoes.criar({ ...dados, clienteId: 4, tipo: 'AberturaProcesso' }), { codigo: 'CLIENTE_BLOQUEADO' });

  // Amarelo e verde seguem atendidos; vermelho com liberação temporária também.
  assert.equal((await api.solicitacoes.criar({ ...dados, clienteId: 2 })).status, 'Aberta');
  assert.equal((await api.solicitacoes.criar({ ...dados, clienteId: 1 })).status, 'Aberta');
  assert.equal((await api.solicitacoes.criar({ ...dados, clienteId: 7 })).status, 'Aberta');
});

test('baixa: quitar as cobranças vencidas libera o cliente na hora', async () => {
  const admin = await apiComo('financeiro@srf.local');
  const hoje = (await admin.painel.obter()).dataReferencia;
  const vencidas = (await admin.cobrancas.listar({ situacao: 'Vencida', clienteId: 3 })).reverse();
  assert.equal(vencidas.length, 2);

  const primeira = await admin.cobrancas.baixar(vencidas[0].id, { dataPagamento: hoje, valorPago: vencidas[0].valorAtualizado });
  assert.equal(primeira.statusAnterior, 'Vermelho');
  assert.equal(primeira.statusAtual, 'Amarelo'); // sobrou a parcela de 8 dias
  assert.equal(primeira.liberado, true);

  const segunda = await admin.cobrancas.baixar(vencidas[1].id, { dataPagamento: hoje, valorPago: vencidas[1].valorAtualizado });
  assert.equal(segunda.statusAtual, 'Verde');
  assert.equal(segunda.cliente.valorAtualizado, 0);

  const solicitacao = await admin.solicitacoes.criar({ clienteId: 3, tipo: 'NovaSolicitacao', descricao: 'Demanda após regularização.' });
  assert.equal(solicitacao.status, 'Aberta');

  const avisos = await admin.avisos.listar();
  assert.ok(avisos.some((a) => a.clienteId === 3 && a.tipo === 'Regularizacao'));

  // O estorno devolve o cliente à situação anterior.
  const estorno = await admin.cobrancas.estornar(vencidas[0].id);
  assert.equal(estorno.statusAtual, 'Vermelho');
  await assert.rejects(admin.solicitacoes.criar({ clienteId: 3, tipo: 'NovaSolicitacao', descricao: 'Demanda após estorno.' }), { codigo: 'CLIENTE_BLOQUEADO' });
});

test('baixa: validações', async () => {
  const admin = await apiComo('admin@srf.local');
  const [cobranca] = await admin.cobrancas.listar({ situacao: 'Vencida', clienteId: 2 });
  await assert.rejects(admin.cobrancas.baixar(cobranca.id, { dataPagamento: '2099-01-01', valorPago: 100 }), { codigo: 'VALIDACAO' });
  await assert.rejects(admin.cobrancas.baixar(cobranca.id, { dataPagamento: cobranca.dataVencimento, valorPago: 0 }), { codigo: 'VALIDACAO' });
  const [paga] = await admin.cobrancas.listar({ situacao: 'Paga', clienteId: 2 });
  await assert.rejects(admin.cobrancas.baixar(paga.id, { dataPagamento: cobranca.dataVencimento, valorPago: 10 }), { codigo: 'REGRA_NEGOCIO' });
});

test('liberação temporária: só para vermelho, libera e pode ser revogada', async () => {
  const admin = await apiComo('admin@srf.local');
  const hoje = (await admin.painel.obter()).dataReferencia;
  const amanha = new Date(Date.parse(hoje) + 86400000).toISOString().slice(0, 10);
  const dados = { dataFim: amanha, motivo: 'Acordo de parcelamento em negociação.' };

  await assert.rejects(admin.clientes.concederLiberacao(1, dados), { codigo: 'REGRA_NEGOCIO' });
  await assert.rejects(admin.clientes.concederLiberacao(4, { ...dados, motivo: 'curto' }), { codigo: 'VALIDACAO' });

  const liberacao = await admin.clientes.concederLiberacao(4, dados);
  assert.equal(liberacao.ativa, true);
  let delta = await admin.clientes.obter(4);
  assert.equal(delta.status, 'Vermelho');
  assert.equal(delta.bloqueado, false);
  assert.equal(delta.liberacaoAte, amanha);
  await admin.solicitacoes.criar({ clienteId: 4, tipo: 'AberturaProcesso', descricao: 'Recurso administrativo fiscal.' });

  await admin.clientes.revogarLiberacao(liberacao.id);
  delta = await admin.clientes.obter(4);
  assert.equal(delta.bloqueado, true);
});

test('passagem do tempo: amarelo vira vermelho e é bloqueado sem intervenção', async () => {
  const admin = await apiComo('admin@srf.local');
  let teta = await admin.clientes.obter(8);
  assert.equal(teta.status, 'Amarelo');
  const dias = teta.diasAteBloqueio;

  await admin.demo.avancarDias(dias - 1);
  teta = await admin.clientes.obter(8);
  assert.equal(teta.status, 'Amarelo');
  assert.equal(teta.diasAteBloqueio, 1);

  const rotina = await admin.demo.avancarDias(1);
  assert.ok(rotina.clientesComStatusAlterado >= 1);
  teta = await admin.clientes.obter(8);
  assert.equal(teta.status, 'Vermelho');
  assert.equal(teta.bloqueado, true);
  assert.ok(teta.avisos.some((a) => a.tipo === 'Bloqueio'));
  await assert.rejects(admin.solicitacoes.criar({ clienteId: 8, tipo: 'NovaSolicitacao', descricao: 'Consulta sobre prontuários.' }), { codigo: 'CLIENTE_BLOQUEADO' });

  const registros = await admin.registros.listar();
  assert.ok(registros.some((r) => r.acao === 'StatusAlterado' && r.detalhes.includes('Clínica Teta')));
  assert.ok(registros.some((r) => r.acao === 'SolicitacaoBloqueada'));
});

test('configurações: mudar o prazo de bloqueio recalcula o semáforo', async () => {
  const admin = await apiComo('admin@srf.local');
  assert.equal((await admin.clientes.obter(2)).status, 'Amarelo'); // 12 dias de atraso
  await admin.configuracoes.salvar({ multaPercentual: 2, jurosDiarioPercentual: 0.033, diasParaBloqueio: 10, diasAvisoPreVencimento: 3 });
  assert.equal((await admin.clientes.obter(2)).status, 'Vermelho');
  await assert.rejects(admin.configuracoes.salvar({ multaPercentual: 50, jurosDiarioPercentual: 0.033, diasParaBloqueio: 10, diasAvisoPreVencimento: 3 }), { codigo: 'VALIDACAO' });
});

test('contratos: novo contrato gera a primeira cobrança; encerramento cancela as que não venceram', async () => {
  const admin = await apiComo('admin@srf.local');
  const hoje = (await admin.painel.obter()).dataReferencia;
  const antes = (await admin.cobrancas.listar({ clienteId: 12 })).length;
  const contrato = await admin.contratos.criar({ clienteId: 12, descricao: 'Consultoria em licenciamento', valorMensal: 1500, diaVencimento: 28, dataInicio: hoje });
  assert.match(contrato.numero, /^CT-\d{4}-\d{3}$/);
  const depois = await admin.cobrancas.listar({ clienteId: 12 });
  assert.ok(depois.length > antes);
  await assert.rejects(admin.contratos.criar({ clienteId: 12, descricao: 'x', valorMensal: 0, diaVencimento: 31, dataInicio: '' }), { codigo: 'VALIDACAO' });

  const encerrado = await admin.contratos.encerrar(contrato.id);
  assert.equal(encerrado.ativo, false);
  const doContrato = (await admin.cobrancas.listar({ clienteId: 12 })).filter((c) => c.contratoId === contrato.id);
  assert.ok(doContrato.every((c) => c.situacao === 'Cancelada' || c.dataVencimento <= hoje));
});

test('clientes e usuários: validações de cadastro', async () => {
  const admin = await apiComo('admin@srf.local');
  await assert.rejects(admin.clientes.criar({ nome: 'Novo Cliente', documento: '11.111.111/1111-11', email: 'a@b.example' }), { codigo: 'VALIDACAO' });
  const novo = await admin.clientes.criar({ nome: 'Padaria Fictícia Ltda.', documento: '11.222.333/0001-81', email: 'contato@padaria.example' });
  assert.equal(novo.status, 'Verde');
  await assert.rejects(admin.clientes.criar({ nome: 'Duplicado', documento: '11222333000181', email: 'x@y.example' }), { codigo: 'VALIDACAO' });

  await assert.rejects(admin.usuarios.criar({ nome: 'Fulano de Tal', email: 'admin@srf.local', perfil: 'Operacional', senha: '12345678' }), { codigo: 'VALIDACAO' });
  const usuario = await admin.usuarios.criar({ nome: 'Fulano de Tal', email: 'fulano@srf.local', perfil: 'Operacional', senha: '12345678' });
  assert.equal(usuario.senha, undefined);
  await assert.rejects(admin.usuarios.atualizar(1, { nome: 'Renata Siqueira', email: 'admin@srf.local', perfil: 'Operacional' }), { codigo: 'REGRA_NEGOCIO' });
});

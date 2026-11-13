// Testes das regras de negócio. Rode com: npm test
// Os mesmos casos existem em C# (backend/tests), com os mesmos valores esperados.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONFIG_PADRAO,
  avaliarSituacao,
  calcularEncargos,
  classificarStatus,
  deveLembrarVencimento,
  faixaDeAtraso,
  marcoDeAtraso,
  situacaoDaCobranca,
  vencimentosDevidos,
} from '../src/regras/calculos.js';
import { cnpjValido, cpfValido, documento, lerNumero } from '../src/lib/formatos.js';
import { diasEntre, somarDias, somarMeses } from '../src/lib/datas.js';

const config = { ...CONFIG_PADRAO }; // multa 2%, juros 0,033% ao dia, bloqueio após 30 dias

test('datas: soma de dias e meses e diferença em dias', () => {
  assert.equal(somarDias('2026-10-31', 1), '2026-11-01');
  assert.equal(somarDias('2026-03-01', -1), '2026-02-28');
  assert.equal(somarMeses('2026-01-31', 1), '2026-02-28');
  assert.equal(somarMeses('2026-11-10', -2), '2026-09-10');
  assert.equal(diasEntre('2026-10-01', '2026-11-15'), 45);
  assert.equal(diasEntre('2026-11-15', '2026-10-01'), -45);
});

test('encargos: sem atraso não há multa nem juros', () => {
  assert.deepEqual(calcularEncargos(5000, '2026-10-01', '2026-10-01', config), {
    diasAtraso: 0, multa: 0, juros: 0, valorAtualizado: 5000,
  });
  assert.equal(calcularEncargos(5000, '2026-10-10', '2026-10-01', config).valorAtualizado, 5000);
});

test('encargos: multa única de 2% e juros de 0,033% ao dia sobre o principal', () => {
  assert.deepEqual(calcularEncargos(5000, '2026-10-01', '2026-10-02', config), {
    diasAtraso: 1, multa: 100, juros: 1.65, valorAtualizado: 5101.65,
  });
  assert.deepEqual(calcularEncargos(5000, '2026-10-01', '2026-11-15', config), {
    diasAtraso: 45, multa: 100, juros: 74.25, valorAtualizado: 5174.25,
  });
  assert.deepEqual(calcularEncargos(12300, '2026-08-28', '2026-11-12', config), {
    diasAtraso: 76, multa: 246, juros: 308.48, valorAtualizado: 12854.48,
  });
});

test('encargos: usam as taxas configuradas', () => {
  const outra = { ...config, multaPercentual: 10, jurosDiarioPercentual: 0.1 };
  assert.deepEqual(calcularEncargos(1000, '2026-11-01', '2026-11-11', outra), {
    diasAtraso: 10, multa: 100, juros: 10, valorAtualizado: 1110,
  });
});

test('semáforo: verde em dia, amarelo de 1 dia até o prazo, vermelho acima do prazo', () => {
  assert.equal(classificarStatus(0, 30), 'Verde');
  assert.equal(classificarStatus(1, 30), 'Amarelo');
  assert.equal(classificarStatus(30, 30), 'Amarelo');
  assert.equal(classificarStatus(31, 30), 'Vermelho');
  assert.equal(classificarStatus(15, 15), 'Amarelo');
  assert.equal(classificarStatus(16, 15), 'Vermelho');
});

test('faixas de atraso', () => {
  assert.equal(faixaDeAtraso(0), 'Em dia');
  assert.equal(faixaDeAtraso(1), '1 a 30 dias');
  assert.equal(faixaDeAtraso(30), '1 a 30 dias');
  assert.equal(faixaDeAtraso(31), '31 a 60 dias');
  assert.equal(faixaDeAtraso(60), '31 a 60 dias');
  assert.equal(faixaDeAtraso(61), 'Acima de 60 dias');
});

test('situação: cliente sem cobranças em aberto fica verde e liberado', () => {
  const s = avaliarSituacao([], [], config, '2026-11-12');
  assert.equal(s.status, 'Verde');
  assert.equal(s.bloqueado, false);
  assert.equal(s.valorAtualizado, 0);
  assert.equal(s.diasAteBloqueio, null);
});

test('situação: gatilho de Amarelo para Vermelho no 31º dia de atraso', () => {
  const parcelas = [{ valorOriginal: 3200, dataVencimento: '2026-10-01' }];

  const dia30 = avaliarSituacao(parcelas, [], config, '2026-10-31');
  assert.equal(dia30.diasAtraso, 30);
  assert.equal(dia30.status, 'Amarelo');
  assert.equal(dia30.bloqueado, false);
  assert.equal(dia30.diasAteBloqueio, 1);

  const dia31 = avaliarSituacao(parcelas, [], config, '2026-11-01');
  assert.equal(dia31.diasAtraso, 31);
  assert.equal(dia31.status, 'Vermelho');
  assert.equal(dia31.bloqueado, true);
  assert.equal(dia31.diasAteBloqueio, null);
});

test('situação: soma principal, multa e juros das vencidas e separa o que ainda vai vencer', () => {
  const parcelas = [
    { valorOriginal: 5000, dataVencimento: '2026-10-01' }, // 45 dias
    { valorOriginal: 5000, dataVencimento: '2026-11-01' }, // 14 dias
    { valorOriginal: 5000, dataVencimento: '2026-12-01' }, // a vencer
  ];
  const s = avaliarSituacao(parcelas, [], config, '2026-11-15');
  assert.equal(s.parcelasVencidas, 2);
  assert.equal(s.diasAtraso, 45);
  assert.equal(s.vencimentoMaisAntigo, '2026-10-01');
  assert.equal(s.valorVencido, 10000);
  assert.equal(s.valorMulta, 200);
  assert.equal(s.valorJuros, 97.35); // 74,25 + 23,10
  assert.equal(s.valorAtualizado, 10297.35);
  assert.equal(s.valorAVencer, 5000);
  assert.equal(s.faixaAtraso, '31 a 60 dias');
});

test('bloqueio: liberação temporária vigente libera; vencida ou revogada não', () => {
  const parcelas = [{ valorOriginal: 9600, dataVencimento: '2026-09-28' }];
  const hoje = '2026-11-12';

  const vigente = avaliarSituacao(parcelas, [{ dataFim: '2026-11-20', revogadaEm: null }], config, hoje);
  assert.equal(vigente.status, 'Vermelho');
  assert.equal(vigente.bloqueado, false);
  assert.equal(vigente.liberacaoAte, '2026-11-20');

  const ultimoDia = avaliarSituacao(parcelas, [{ dataFim: hoje, revogadaEm: null }], config, hoje);
  assert.equal(ultimoDia.bloqueado, false);

  const vencida = avaliarSituacao(parcelas, [{ dataFim: '2026-11-11', revogadaEm: null }], config, hoje);
  assert.equal(vencida.bloqueado, true);
  assert.equal(vencida.liberacaoAte, null);

  const revogada = avaliarSituacao(parcelas, [{ dataFim: '2026-11-20', revogadaEm: '2026-11-10T12:00:00Z' }], config, hoje);
  assert.equal(revogada.bloqueado, true);
});

test('régua: maior marco de atraso já alcançado', () => {
  assert.equal(marcoDeAtraso(0), null);
  assert.equal(marcoDeAtraso(1), 1);
  assert.equal(marcoDeAtraso(6), 1);
  assert.equal(marcoDeAtraso(7), 7);
  assert.equal(marcoDeAtraso(29), 15);
  assert.equal(marcoDeAtraso(30), 30);
  assert.equal(marcoDeAtraso(100), 90);
});

test('régua: lembrete da antecedência configurada até o dia do vencimento', () => {
  assert.equal(deveLembrarVencimento('2026-11-15', '2026-11-11', 3), false);
  assert.equal(deveLembrarVencimento('2026-11-15', '2026-11-12', 3), true);
  assert.equal(deveLembrarVencimento('2026-11-15', '2026-11-15', 3), true);
  assert.equal(deveLembrarVencimento('2026-11-15', '2026-11-16', 3), false);
});

test('geração de cobranças: uma por mês a partir do primeiro vencimento do contrato', () => {
  const contrato = { ativo: true, dataInicio: '2026-08-20', dataFim: null, diaVencimento: 10 };

  assert.deepEqual(vencimentosDevidos(contrato, '2026-11-12'), [
    { competencia: '2026-09-01', dataVencimento: '2026-09-10' },
    { competencia: '2026-10-01', dataVencimento: '2026-10-10' },
    { competencia: '2026-11-01', dataVencimento: '2026-11-10' },
  ]);

  // A dez dias ou menos da virada do mês, a cobrança do mês seguinte já é gerada.
  const comDezembro = vencimentosDevidos(contrato, '2026-11-25');
  assert.equal(comDezembro.length, 4);
  assert.deepEqual(comDezembro[3], { competencia: '2026-12-01', dataVencimento: '2026-12-10' });

  assert.deepEqual(vencimentosDevidos({ ...contrato, ativo: false }, '2026-11-12'), []);
  assert.equal(vencimentosDevidos({ ...contrato, dataFim: '2026-10-15' }, '2026-11-12').length, 2);
});

test('situação de exibição da cobrança', () => {
  assert.equal(situacaoDaCobranca({ status: 'Aberta', dataVencimento: '2026-11-12' }, '2026-11-12'), 'EmAberto');
  assert.equal(situacaoDaCobranca({ status: 'Aberta', dataVencimento: '2026-11-11' }, '2026-11-12'), 'Vencida');
  assert.equal(situacaoDaCobranca({ status: 'Paga', dataVencimento: '2026-11-01' }, '2026-11-12'), 'Paga');
  assert.equal(situacaoDaCobranca({ status: 'Cancelada', dataVencimento: '2026-11-01' }, '2026-11-12'), 'Cancelada');
});

test('documentos: validação e máscara de CPF e CNPJ', () => {
  assert.equal(cpfValido('529.982.247-25'), true);
  assert.equal(cpfValido('529.982.247-26'), false);
  assert.equal(cpfValido('111.111.111-11'), false);
  assert.equal(cnpjValido('11.222.333/0001-81'), true);
  assert.equal(cnpjValido('11.222.333/0001-82'), false);
  assert.equal(documento('11222333000181'), '11.222.333/0001-81');
  assert.equal(documento('52998224725'), '529.982.247-25');
});

test('leitura de números digitados no padrão brasileiro', () => {
  assert.equal(lerNumero('1.234,56'), 1234.56);
  assert.equal(lerNumero('0,033'), 0.033);
  assert.equal(lerNumero('5000'), 5000);
  assert.equal(lerNumero('R$ 8.450,00'), 8450);
  assert.ok(Number.isNaN(lerNumero('')));
});

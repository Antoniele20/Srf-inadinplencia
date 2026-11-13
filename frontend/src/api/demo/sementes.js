// Massa de dados FICTÍCIA para demonstração.
// A mesma definição gera o script database/03_dados_demonstracao.sql, então o modo
// demonstração do front-end e o banco SQL Server começam com os mesmos clientes e valores.
//
// Os vencimentos são calculados em relação à data de hoje: o semáforo mostra sempre
// a mesma distribuição (verdes, amarelos e vermelhos), não importa o dia da apresentação.

import { diasEntre, montarData, partes, primeiroDiaDoMes, somarDias, somarMeses } from '../../lib/datas.js';
import { CONFIG_PADRAO, arredondar } from '../../regras/calculos.js';

/** Mude este número para descartar dados antigos salvos no navegador. */
export const VERSAO_BANCO_DEMO = 1;

/** Senha de todos os usuários de demonstração. Troque antes de usar em produção. */
export const SENHA_DEMO = 'Srf@2026';

export const USUARIOS_DEMO = [
  { id: 1, nome: 'Renata Siqueira', email: 'admin@srf.local', perfil: 'Admin', ativo: true },
  { id: 2, nome: 'Caio Brandão', email: 'financeiro@srf.local', perfil: 'Admin', ativo: true },
  { id: 3, nome: 'Bruna Teixeira', email: 'operacional@srf.local', perfil: 'Operacional', ativo: true },
  { id: 4, nome: 'Davi Monteiro', email: 'davi@srf.local', perfil: 'Operacional', ativo: true },
];

function digito(digitos, pesos) {
  const soma = digitos.reduce((total, d, i) => total + d * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Completa os 12 primeiros dígitos de um CNPJ com os dois dígitos verificadores. */
export function cnpjCom(base12) {
  const n = base12.split('').map(Number);
  const d1 = digito(n, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito([...n, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base12}${d1}${d2}`;
}

/** Completa os 9 primeiros dígitos de um CPF com os dois dígitos verificadores. */
export function cpfCom(base9) {
  const n = base9.split('').map(Number);
  const d1 = digito(n, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito([...n, d1], [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base9}${d1}${d2}`;
}

export const CLIENTES_DEMO = [
  { id: 1, nome: 'Empresa Alfa Ltda.', documento: cnpjCom('305124410001'), email: 'financeiro@alfa.example', telefone: '(41) 3555-0101', responsavel: 'Helena Prado', ativo: true },
  { id: 2, nome: 'Construtora Beta', documento: cnpjCom('418830270001'), email: 'financeiro@beta.example', telefone: '(41) 3555-0102', responsavel: 'Otávio Rangel', ativo: true },
  { id: 3, nome: 'Comércio Gama S.A.', documento: cnpjCom('127745630001'), email: 'contato@gama.example', telefone: '(41) 3555-0103', responsavel: 'Lívia Sampaio', ativo: true },
  { id: 4, nome: 'Indústria Delta Ltda.', documento: cnpjCom('562309180001'), email: 'financeiro@delta.example', telefone: '(41) 3555-0104', responsavel: 'Marcos Villar', ativo: true },
  { id: 5, nome: 'Serviços Épsilon', documento: cnpjCom('239916540001'), email: 'adm@epsilon.example', telefone: '(41) 3555-0105', responsavel: 'Paula Quintana', ativo: true },
  { id: 6, nome: 'Transportes Zeta', documento: cnpjCom('674481020001'), email: 'contato@zeta.example', telefone: '(41) 3555-0106', responsavel: 'Rogério Antunes', ativo: true },
  { id: 7, nome: 'Corporativo Eta S.A.', documento: cnpjCom('083357790001'), email: 'financeiro@eta.example', telefone: '(41) 3555-0107', responsavel: 'Simone Lacerda', ativo: true },
  { id: 8, nome: 'Clínica Teta', documento: cnpjCom('451062380001'), email: 'administrativo@teta.example', telefone: '(41) 3555-0108', responsavel: 'Dr. Ivan Moura', ativo: true },
  { id: 9, nome: 'Logística Iota Ltda.', documento: cnpjCom('196640850001'), email: 'contas@iota.example', telefone: '(41) 3555-0109', responsavel: 'Tatiane Rocha', ativo: true },
  { id: 10, nome: 'Agropecuária Kappa', documento: cnpjCom('728815460001'), email: 'escritorio@kappa.example', telefone: '(42) 3555-0110', responsavel: 'Valter Bittencourt', ativo: true },
  { id: 11, nome: 'Tecnologia Lambda S.A.', documento: cnpjCom('347790120001'), email: 'financeiro@lambda.example', telefone: '(41) 3555-0111', responsavel: 'Aline Furtado', ativo: true },
  { id: 12, nome: 'Editora Sigma', documento: cnpjCom('590024670001'), email: 'contato@sigma.example', telefone: '(41) 3555-0112', responsavel: 'Eduardo Paixão', ativo: true },
  { id: 13, nome: 'Marina Duarte Albuquerque', documento: cpfCom('418527360'), email: 'marina.albuquerque@pessoal.example', telefone: '(41) 95555-0113', responsavel: null, ativo: true },
  { id: 14, nome: 'Mercado Ômega Ltda.', documento: cnpjCom('816637290001'), email: 'contato@omega.example', telefone: '(41) 3555-0114', responsavel: 'Nádia Corrêa', ativo: false },
];

/**
 * Plano dos contratos de demonstração.
 * - atrasoUltimoVencimento: há quantos dias foi o vencimento mais recente
 * - meses: quantas parcelas mensais de histórico
 * - emAberto: quantas das parcelas mais recentes continuam sem pagamento
 */
export const PLANO_CONTRATOS = [
  { id: 1, clienteId: 1, descricao: 'Assessoria jurídica empresarial', valorMensal: 5000, atrasoUltimoVencimento: 8, meses: 9, emAberto: 0, ativo: true },
  { id: 2, clienteId: 2, descricao: 'Consultivo e contencioso cível', valorMensal: 8450, atrasoUltimoVencimento: 12, meses: 8, emAberto: 1, ativo: true },
  { id: 3, clienteId: 3, descricao: 'Assessoria trabalhista', valorMensal: 7800, atrasoUltimoVencimento: 8, meses: 9, emAberto: 2, ativo: true },
  { id: 4, clienteId: 4, descricao: 'Contencioso tributário', valorMensal: 12300, atrasoUltimoVencimento: 15, meses: 10, emAberto: 3, ativo: true },
  { id: 5, clienteId: 5, descricao: 'Assessoria contratual', valorMensal: 6120, atrasoUltimoVencimento: 9, meses: 7, emAberto: 1, ativo: true },
  { id: 6, clienteId: 6, descricao: 'Consultivo regulatório de transportes', valorMensal: 4950, atrasoUltimoVencimento: 20, meses: 8, emAberto: 0, ativo: true },
  { id: 7, clienteId: 7, descricao: 'Assessoria societária', valorMensal: 9600, atrasoUltimoVencimento: 15, meses: 9, emAberto: 2, ativo: true },
  { id: 8, clienteId: 8, descricao: 'Assessoria em direito médico', valorMensal: 3200, atrasoUltimoVencimento: 26, meses: 6, emAberto: 1, ativo: true },
  { id: 9, clienteId: 9, descricao: 'Contencioso cível e cobranças', valorMensal: 6700, atrasoUltimoVencimento: 3, meses: 8, emAberto: 0, ativo: true },
  { id: 10, clienteId: 10, descricao: 'Assessoria agrária e ambiental', valorMensal: 11000, atrasoUltimoVencimento: 28, meses: 10, emAberto: 0, ativo: true },
  { id: 11, clienteId: 11, descricao: 'Proteção de dados e contratos de tecnologia', valorMensal: 4200, atrasoUltimoVencimento: 5, meses: 7, emAberto: 1, ativo: true },
  { id: 12, clienteId: 11, descricao: 'Propriedade intelectual', valorMensal: 2800, atrasoUltimoVencimento: 18, meses: 6, emAberto: 0, ativo: true },
  { id: 13, clienteId: 12, descricao: 'Direitos autorais e contratos editoriais', valorMensal: 2500, atrasoUltimoVencimento: 2, meses: 8, emAberto: 0, ativo: true },
  { id: 14, clienteId: 13, descricao: 'Planejamento patrimonial e sucessório', valorMensal: 1800, atrasoUltimoVencimento: 10, meses: 6, emAberto: 0, ativo: true },
  { id: 15, clienteId: 14, descricao: 'Assessoria consumerista', valorMensal: 3900, atrasoUltimoVencimento: 70, meses: 6, emAberto: 0, ativo: false },
];

export const SOLICITACOES_DEMO = [
  { id: 1, clienteId: 1, usuarioId: 3, tipo: 'NovaSolicitacao', descricao: 'Revisão do contrato de fornecimento com a distribuidora regional.', diasAtras: 12, concluidaDiasAtras: 6 },
  { id: 2, clienteId: 6, usuarioId: 4, tipo: 'AberturaProcesso', descricao: 'Defesa em auto de infração da ANTT, prazo de 30 dias.', diasAtras: 9, concluidaDiasAtras: null },
  { id: 3, clienteId: 9, usuarioId: 3, tipo: 'NovaSolicitacao', descricao: 'Notificação extrajudicial de três devedores.', diasAtras: 5, concluidaDiasAtras: null },
  { id: 4, clienteId: 2, usuarioId: 4, tipo: 'NovaSolicitacao', descricao: 'Parecer sobre aditivo de obra com reajuste de prazo.', diasAtras: 3, concluidaDiasAtras: null },
  { id: 5, clienteId: 10, usuarioId: 3, tipo: 'AberturaProcesso', descricao: 'Ação de regularização fundiária da Fazenda Boa Vista.', diasAtras: 20, concluidaDiasAtras: 2 },
  { id: 6, clienteId: 13, usuarioId: 3, tipo: 'NovaSolicitacao', descricao: 'Minuta de doação com reserva de usufruto.', diasAtras: 1, concluidaDiasAtras: null },
];

/** Liberação temporária de exceção para um cliente em renegociação (requisito RF06). */
export const LIBERACAO_DEMO = {
  id: 1,
  clienteId: 7,
  usuarioId: 2,
  motivo: 'Renegociação em andamento: proposta de parcelamento em três vezes aguardando assinatura.',
  concedidaDiasAtras: 2,
  validaPorDias: 10,
};

/** Variação determinística, de -2 a +3 dias, entre o vencimento e o pagamento das parcelas quitadas. */
export function variacaoPagamento(contratoId, k) {
  return ((contratoId * 7 + k * 3) % 6) - 2;
}

/** Último vencimento de um contrato do plano: dia do mês limitado a 28. */
export function ultimoVencimento(plano, hoje) {
  const base = partes(somarDias(hoje, -plano.atrasoUltimoVencimento));
  return montarData(base.ano, base.mes, Math.min(base.dia, 28));
}

function instante(hoje, diasAtras, hora) {
  // Meio-dia de Brasília = 15h UTC. Só para ter um horário plausível no histórico.
  return `${somarDias(hoje, -diasAtras)}T${String(hora).padStart(2, '0')}:00:00Z`;
}

/** Constrói o estado inicial do modo demonstração para a data informada. */
export function montarBancoInicial(hoje) {
  const config = {
    ...CONFIG_PADRAO,
    atualizadoEm: instante(hoje, 120, 14),
    atualizadoPor: USUARIOS_DEMO[0].nome,
  };

  const usuarios = USUARIOS_DEMO.map((u) => ({
    ...u,
    senha: SENHA_DEMO,
    criadoEm: instante(hoje, 300, 13),
    ultimoAcesso: null,
  }));

  const clientes = CLIENTES_DEMO.map((c) => ({
    ...c,
    observacoes: null,
    status: 'Verde',
    statusDesde: instante(hoje, 300, 13),
    criadoEm: instante(hoje, 300, 13),
  }));

  const contratos = [];
  const parcelas = [];
  let proximaParcela = 1;

  for (const plano of PLANO_CONTRATOS) {
    const ultimo = ultimoVencimento(plano, hoje);
    const maisAntigo = somarMeses(ultimo, -(plano.meses - 1));
    contratos.push({
      id: plano.id,
      clienteId: plano.clienteId,
      descricao: plano.descricao,
      valorMensal: plano.valorMensal,
      diaVencimento: partes(ultimo).dia,
      dataInicio: somarDias(maisAntigo, -15),
      dataFim: plano.ativo ? null : ultimo,
      ativo: plano.ativo,
      criadoEm: `${somarDias(maisAntigo, -15)}T13:00:00Z`,
    });

    // Da parcela mais antiga para a mais recente, para os números saírem em ordem.
    for (let k = plano.meses - 1; k >= 0; k -= 1) {
      const dataVencimento = somarMeses(ultimo, -k);
      const emAberto = k < plano.emAberto;
      let dataPagamento = null;
      let valorPago = null;
      if (!emAberto) {
        const previsto = somarDias(dataVencimento, variacaoPagamento(plano.id, k));
        dataPagamento = previsto > hoje ? hoje : previsto;
        const diasDeMora = Math.max(0, diasEntre(dataVencimento, dataPagamento));
        valorPago = diasDeMora > 0 ? arredondar(plano.valorMensal * (1 + 0.02 + 0.00033 * diasDeMora)) : plano.valorMensal;
      }
      parcelas.push({
        id: proximaParcela,
        contratoId: plano.id,
        competencia: primeiroDiaDoMes(dataVencimento),
        dataVencimento,
        valorOriginal: plano.valorMensal,
        status: emAberto ? 'Aberta' : 'Paga',
        dataPagamento,
        valorPago,
        baixadaPorUsuarioId: emAberto ? null : 2,
        observacao: null,
        criadoEm: `${somarDias(dataVencimento, -10)}T04:00:00Z`,
      });
      proximaParcela += 1;
    }
  }

  const solicitacoes = SOLICITACOES_DEMO.map((s) => ({
    id: s.id,
    clienteId: s.clienteId,
    usuarioId: s.usuarioId,
    tipo: s.tipo,
    descricao: s.descricao,
    status: s.concluidaDiasAtras === null ? 'Aberta' : 'Concluida',
    criadoEm: instante(hoje, s.diasAtras, 14),
    concluidaEm: s.concluidaDiasAtras === null ? null : instante(hoje, s.concluidaDiasAtras, 19),
  }));

  const liberacoes = [
    {
      id: LIBERACAO_DEMO.id,
      clienteId: LIBERACAO_DEMO.clienteId,
      usuarioId: LIBERACAO_DEMO.usuarioId,
      motivo: LIBERACAO_DEMO.motivo,
      dataInicio: instante(hoje, LIBERACAO_DEMO.concedidaDiasAtras, 17),
      dataFim: somarDias(hoje, LIBERACAO_DEMO.validaPorDias - LIBERACAO_DEMO.concedidaDiasAtras),
      revogadaEm: null,
      revogadaPorUsuarioId: null,
    },
  ];

  return {
    versao: VERSAO_BANCO_DEMO,
    criadoEm: hoje,
    deslocamentoDias: 0,
    config,
    usuarios,
    clientes,
    contratos,
    parcelas,
    avisos: [],
    liberacoes,
    solicitacoes,
    logs: [],
    seq: {
      usuarios: usuarios.length,
      clientes: clientes.length,
      contratos: contratos.length,
      parcelas: parcelas.length,
      avisos: 0,
      liberacoes: liberacoes.length,
      solicitacoes: solicitacoes.length,
      logs: 0,
    },
  };
}

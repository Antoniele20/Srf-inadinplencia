// API de demonstração: implementa, no navegador e com dados fictícios, o mesmo contrato
// da API real (ver src/api/http.js). Serve para apresentar o sistema sem servidor.
// As regras de permissão por perfil também valem aqui, para a demonstração ser fiel.

import { ErroApi } from '../erro.js';
import { diasEntre, somarDias, somarMeses } from '../../lib/datas.js';
import { documentoValido, emailValido, somenteDigitos } from '../../lib/formatos.js';
import {
  FAIXAS,
  STATUS,
  arredondar,
  calcularEncargos,
  numeroDaCobranca,
  numeroDoContrato,
  situacaoDaCobranca,
} from '../../regras/calculos.js';
import { TIPOS_AVISO, modeloDeAviso } from '../../regras/avisos.js';
import { apagarBanco, carregarBanco, salvarBanco } from './armazenamento.js';
import {
  agoraDoBanco,
  contratosDoCliente,
  dataReal,
  gerarParcelasPendentes,
  hojeDoBanco,
  parcelasDoCliente,
  processarRotina,
  proximoId,
  recalcularCliente,
  registrarLog,
  situacaoDoCliente,
  sincronizarStatusInicial,
} from './motor.js';
import { VERSAO_BANCO_DEMO, montarBancoInicial } from './sementes.js';

const ORDEM_STATUS = { Vermelho: 0, Amarelo: 1, Verde: 2 };

/** Cria o banco de demonstração já com status, cobranças do mês e avisos gerados. */
export function criarBancoDemo(hoje = dataReal()) {
  const banco = montarBancoInicial(hoje);
  sincronizarStatusInicial(banco);
  processarRotina(banco, 'Carga inicial');
  return banco;
}

function clonar(valor) {
  return valor === undefined ? undefined : JSON.parse(JSON.stringify(valor));
}

function pausa() {
  return new Promise((resolver) => setTimeout(resolver, 70));
}

function texto(valor) {
  return String(valor ?? '').trim();
}

function recusar(erros) {
  if (Object.keys(erros).length > 0) {
    throw new ErroApi('Revise os campos destacados.', { codigo: 'VALIDACAO', status: 400, erros });
  }
}

function naoEncontrado(oQue) {
  return new ErroApi(`${oQue} não encontrado.`, { codigo: 'NAO_ENCONTRADO', status: 404 });
}

function regra(mensagem, codigo = 'REGRA_NEGOCIO') {
  return new ErroApi(mensagem, { codigo, status: 409 });
}

// ---------------------------------------------------------------------------
// Conversão dos registros internos para o formato devolvido pela API
// ---------------------------------------------------------------------------

function paraUsuario(u) {
  return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, ativo: u.ativo, criadoEm: u.criadoEm, ultimoAcesso: u.ultimoAcesso };
}

function nomeDoUsuario(banco, id) {
  const u = banco.usuarios.find((x) => x.id === id);
  return u ? u.nome : null;
}

function paraClienteResumo(banco, cliente) {
  const s = situacaoDoCliente(banco, cliente);
  const ativos = contratosDoCliente(banco, cliente.id).filter((c) => c.ativo);
  return {
    id: cliente.id,
    nome: cliente.nome,
    documento: cliente.documento,
    email: cliente.email,
    telefone: cliente.telefone,
    responsavel: cliente.responsavel,
    ativo: cliente.ativo,
    status: s.status,
    statusDesde: cliente.statusDesde,
    bloqueado: s.bloqueado,
    liberacaoAte: s.liberacaoAte,
    diasAtraso: s.diasAtraso,
    faixaAtraso: s.faixaAtraso,
    diasAteBloqueio: s.diasAteBloqueio,
    parcelasVencidas: s.parcelasVencidas,
    valorVencido: s.valorVencido,
    valorMulta: s.valorMulta,
    valorJuros: s.valorJuros,
    valorEncargos: s.valorEncargos,
    valorAtualizado: s.valorAtualizado,
    valorAVencer: s.valorAVencer,
    contratosAtivos: ativos.length,
    valorMensal: arredondar(ativos.reduce((t, c) => t + c.valorMensal, 0)),
  };
}

function paraContrato(banco, contrato) {
  const cliente = banco.clientes.find((c) => c.id === contrato.clienteId);
  const hoje = hojeDoBanco(banco);
  const vencidas = banco.parcelas.filter(
    (p) => p.contratoId === contrato.id && p.status === 'Aberta' && p.dataVencimento < hoje,
  );
  return {
    id: contrato.id,
    numero: numeroDoContrato(contrato),
    clienteId: contrato.clienteId,
    clienteNome: cliente ? cliente.nome : '',
    descricao: contrato.descricao,
    valorMensal: contrato.valorMensal,
    diaVencimento: contrato.diaVencimento,
    dataInicio: contrato.dataInicio,
    dataFim: contrato.dataFim,
    ativo: contrato.ativo,
    parcelasVencidas: vencidas.length,
    inadimplente: vencidas.length > 0,
  };
}

function paraCobranca(banco, parcela) {
  const contrato = banco.contratos.find((c) => c.id === parcela.contratoId);
  const cliente = contrato ? banco.clientes.find((c) => c.id === contrato.clienteId) : null;
  const hoje = hojeDoBanco(banco);
  const encargos =
    parcela.status === 'Aberta'
      ? calcularEncargos(parcela.valorOriginal, parcela.dataVencimento, hoje, banco.config)
      : { diasAtraso: 0, multa: 0, juros: 0, valorAtualizado: parcela.valorOriginal };
  return {
    id: parcela.id,
    numero: numeroDaCobranca(parcela),
    contratoId: parcela.contratoId,
    contratoNumero: contrato ? numeroDoContrato(contrato) : '',
    clienteId: cliente ? cliente.id : null,
    clienteNome: cliente ? cliente.nome : '',
    competencia: parcela.competencia,
    dataVencimento: parcela.dataVencimento,
    valorOriginal: parcela.valorOriginal,
    status: parcela.status,
    situacao: situacaoDaCobranca(parcela, hoje),
    diasAtraso: encargos.diasAtraso,
    multa: encargos.multa,
    juros: encargos.juros,
    valorAtualizado: encargos.valorAtualizado,
    dataPagamento: parcela.dataPagamento,
    valorPago: parcela.valorPago,
    observacao: parcela.observacao,
    baixadaPor: nomeDoUsuario(banco, parcela.baixadaPorUsuarioId),
  };
}

function paraAviso(banco, aviso) {
  const cliente = banco.clientes.find((c) => c.id === aviso.clienteId);
  const parcela = aviso.parcelaId ? banco.parcelas.find((p) => p.id === aviso.parcelaId) : null;
  return {
    id: aviso.id,
    clienteId: aviso.clienteId,
    clienteNome: cliente ? cliente.nome : '',
    cobrancaId: aviso.parcelaId,
    cobrancaNumero: parcela ? numeroDaCobranca(parcela) : null,
    tipo: aviso.tipo,
    canal: aviso.canal,
    assunto: aviso.assunto,
    mensagem: aviso.mensagem,
    enviado: aviso.enviado,
    criadoEm: aviso.criadoEm,
  };
}

function paraLiberacao(banco, liberacao) {
  const cliente = banco.clientes.find((c) => c.id === liberacao.clienteId);
  return {
    id: liberacao.id,
    clienteId: liberacao.clienteId,
    clienteNome: cliente ? cliente.nome : '',
    motivo: liberacao.motivo,
    dataInicio: liberacao.dataInicio,
    dataFim: liberacao.dataFim,
    revogadaEm: liberacao.revogadaEm,
    concedidaPor: nomeDoUsuario(banco, liberacao.usuarioId),
    ativa: !liberacao.revogadaEm && liberacao.dataFim >= hojeDoBanco(banco),
  };
}

function paraSolicitacao(banco, s) {
  const cliente = banco.clientes.find((c) => c.id === s.clienteId);
  return {
    id: s.id,
    clienteId: s.clienteId,
    clienteNome: cliente ? cliente.nome : '',
    tipo: s.tipo,
    descricao: s.descricao,
    status: s.status,
    criadoEm: s.criadoEm,
    criadoPor: nomeDoUsuario(banco, s.usuarioId),
    concluidaEm: s.concluidaEm,
  };
}

function paraConfiguracao(banco) {
  const c = banco.config;
  return {
    multaPercentual: c.multaPercentual,
    jurosDiarioPercentual: c.jurosDiarioPercentual,
    diasParaBloqueio: c.diasParaBloqueio,
    diasAvisoPreVencimento: c.diasAvisoPreVencimento,
    atualizadoEm: c.atualizadoEm,
    atualizadoPor: c.atualizadoPor,
  };
}

function porDataDesc(campo) {
  return (a, b) => (a[campo] < b[campo] ? 1 : a[campo] > b[campo] ? -1 : b.id - a.id);
}

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------

function montarPainel(banco) {
  const hoje = hojeDoBanco(banco);
  const ativos = banco.clientes.filter((c) => c.ativo).map((c) => paraClienteResumo(banco, c));

  const semaforo = { verde: 0, amarelo: 0, vermelho: 0, bloqueados: 0, liberadosTemporariamente: 0 };
  const valorPorStatus = { Verde: 0, Amarelo: 0, Vermelho: 0 };
  const faixas = FAIXAS.map((faixa) => ({ faixa, clientes: 0, valor: 0 }));
  let proximoBloqueio = null;

  for (const c of ativos) {
    if (c.status === STATUS.VERDE) semaforo.verde += 1;
    if (c.status === STATUS.AMARELO) semaforo.amarelo += 1;
    if (c.status === STATUS.VERMELHO) semaforo.vermelho += 1;
    if (c.bloqueado) semaforo.bloqueados += 1;
    if (c.liberacaoAte) semaforo.liberadosTemporariamente += 1;
    valorPorStatus[c.status] += c.valorAtualizado;
    const f = faixas.find((x) => x.faixa === c.faixaAtraso);
    f.clientes += 1;
    f.valor += c.valorAtualizado;
    if (c.diasAteBloqueio !== null && (proximoBloqueio === null || c.diasAteBloqueio < proximoBloqueio)) {
      proximoBloqueio = c.diasAteBloqueio;
    }
  }
  faixas.forEach((f) => {
    f.valor = arredondar(f.valor);
  });

  const validas = banco.parcelas.filter((p) => p.status !== 'Cancelada');
  const abertas = validas.filter((p) => p.status === 'Aberta');
  const limite30 = somarDias(hoje, 30);
  const mesAtual = hoje.slice(0, 7);

  const totais = {
    valorVencido: arredondar(ativos.reduce((t, c) => t + c.valorVencido, 0)),
    valorEncargos: arredondar(ativos.reduce((t, c) => t + c.valorEncargos, 0)),
    valorAtualizado: arredondar(ativos.reduce((t, c) => t + c.valorAtualizado, 0)),
    valorAVencer30: arredondar(
      abertas.filter((p) => p.dataVencimento >= hoje && p.dataVencimento <= limite30).reduce((t, p) => t + p.valorOriginal, 0),
    ),
    recebidoNoMes: arredondar(
      validas.filter((p) => p.status === 'Paga' && String(p.dataPagamento).slice(0, 7) === mesAtual).reduce((t, p) => t + (p.valorPago || 0), 0),
    ),
    cobrancasVencidas: abertas.filter((p) => p.dataVencimento < hoje).length,
    contratosAtivos: banco.contratos.filter((c) => c.ativo).length,
    clientesAtivos: ativos.length,
    valorVencidoAmarelo: arredondar(valorPorStatus.Amarelo),
    valorVencidoVermelho: arredondar(valorPorStatus.Vermelho),
    proximoBloqueioEmDias: proximoBloqueio,
  };

  // Honorários dos últimos seis meses, pelo mês de vencimento.
  const mensal = [];
  for (let i = 5; i >= 0; i -= 1) {
    const mes = somarMeses(`${mesAtual}-01`, -i).slice(0, 7);
    const doMes = validas.filter((p) => p.dataVencimento.slice(0, 7) === mes);
    const recebido = doMes.filter((p) => p.status === 'Paga').reduce((t, p) => t + p.valorOriginal, 0);
    const emAberto = doMes.filter((p) => p.status === 'Aberta').reduce((t, p) => t + p.valorOriginal, 0);
    mensal.push({ mes, recebido: arredondar(recebido), emAberto: arredondar(emAberto), previsto: arredondar(recebido + emAberto) });
  }

  const atencao = ativos
    .filter((c) => c.diasAtraso > 0)
    .sort((a, b) => b.diasAtraso - a.diasAtraso)
    .slice(0, 6);

  const limite7 = somarDias(hoje, 7);
  const proximosVencimentos = abertas
    .filter((p) => p.dataVencimento >= hoje && p.dataVencimento <= limite7)
    .sort((a, b) => (a.dataVencimento < b.dataVencimento ? -1 : 1))
    .slice(0, 6)
    .map((p) => paraCobranca(banco, p));

  const avisosRecentes = [...banco.avisos].sort(porDataDesc('criadoEm')).slice(0, 5).map((a) => paraAviso(banco, a));

  return { dataReferencia: hoje, semaforo, totais, faixas, mensal, atencao, proximosVencimentos, avisosRecentes };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export function criarApiDemo({ persistir = true } = {}) {
  let banco = null;
  let usuarioAtualId = null;

  function gravar() {
    if (persistir) salvarBanco(banco);
  }

  function abrir() {
    if (banco) return banco;
    const hoje = dataReal();
    const salvo = persistir ? carregarBanco() : null;
    const idade = salvo && salvo.criadoEm ? diasEntre(salvo.criadoEm, hoje) : -1;
    if (salvo && salvo.versao === VERSAO_BANCO_DEMO && idade >= 0 && idade <= 7) {
      banco = salvo;
      if (banco.ultimaRotinaEm !== hojeDoBanco(banco)) processarRotina(banco, 'Abertura do sistema');
    } else {
      banco = criarBancoDemo(hoje);
    }
    gravar();
    return banco;
  }

  function sessao(b) {
    const usuario = b.usuarios.find((u) => u.id === usuarioAtualId && u.ativo);
    if (!usuario) {
      throw new ErroApi('Sua sessão terminou. Entre novamente.', { codigo: 'NAO_AUTENTICADO', status: 401 });
    }
    return usuario;
  }

  function admin(b) {
    const usuario = sessao(b);
    if (usuario.perfil !== 'Admin') {
      throw new ErroApi('Esta ação é exclusiva do perfil Financeiro/Admin.', { codigo: 'SEM_PERMISSAO', status: 403 });
    }
    return usuario;
  }

  /** Envolve uma operação: simula a latência da rede, grava o banco e devolve uma cópia. */
  function operacao(fn, { escreve = false } = {}) {
    return async (...args) => {
      await pausa();
      const b = abrir();
      try {
        return clonar(fn(b, ...args));
      } finally {
        if (escreve) gravar();
      }
    };
  }

  function buscarCliente(b, id) {
    const cliente = b.clientes.find((c) => c.id === Number(id));
    if (!cliente) throw naoEncontrado('Cliente');
    return cliente;
  }

  function validarCliente(b, d, idAtual) {
    const erros = {};
    const nome = texto(d.nome);
    const documento = somenteDigitos(d.documento);
    const email = texto(d.email);
    if (nome.length < 3) erros.nome = 'Informe o nome ou a razão social.';
    if (!documentoValido(documento)) erros.documento = 'Informe um CPF ou CNPJ válido.';
    else if (b.clientes.some((c) => c.documento === documento && c.id !== idAtual)) erros.documento = 'Já existe um cliente com este documento.';
    if (!emailValido(email)) erros.email = 'Informe um e-mail válido.';
    recusar(erros);
    return {
      nome,
      documento,
      email,
      telefone: texto(d.telefone) || null,
      responsavel: texto(d.responsavel) || null,
      observacoes: texto(d.observacoes) || null,
    };
  }

  function validarContrato(d, { novo }) {
    const erros = {};
    const descricao = texto(d.descricao);
    const valorMensal = Number(d.valorMensal);
    const diaVencimento = Number(d.diaVencimento);
    if (descricao.length < 3) erros.descricao = 'Descreva o serviço contratado.';
    if (!(valorMensal > 0)) erros.valorMensal = 'Informe o valor do honorário mensal.';
    if (!Number.isInteger(diaVencimento) || diaVencimento < 1 || diaVencimento > 28) erros.diaVencimento = 'Escolha um dia entre 1 e 28.';
    if (novo && !/^\d{4}-\d{2}-\d{2}$/.test(texto(d.dataInicio))) erros.dataInicio = 'Informe a data de início.';
    recusar(erros);
    return { descricao, valorMensal: arredondar(valorMensal), diaVencimento };
  }

  function buscarParcela(b, id) {
    const parcela = b.parcelas.find((p) => p.id === Number(id));
    if (!parcela) throw naoEncontrado('Cobrança');
    return parcela;
  }

  function clienteDaParcela(b, parcela) {
    const contrato = b.contratos.find((c) => c.id === parcela.contratoId);
    return b.clientes.find((c) => c.id === contrato.clienteId);
  }

  /** Situação do cliente antes de mexer em uma cobrança, para a tela mostrar o que mudou. */
  function antesDeAlterar(b, parcela) {
    const cliente = clienteDaParcela(b, parcela);
    return { statusAnterior: cliente.status, bloqueadoAntes: situacaoDoCliente(b, cliente).bloqueado };
  }

  /** Recalcula o cliente após mexer em uma cobrança e devolve o resultado para a tela. */
  function aposAlterarCobranca(b, parcela, usuario, antes) {
    const cliente = clienteDaParcela(b, parcela);
    recalcularCliente(b, cliente, usuario.id);
    const resumo = paraClienteResumo(b, cliente);
    return {
      cobranca: paraCobranca(b, parcela),
      cliente: resumo,
      statusAnterior: antes.statusAnterior,
      statusAtual: resumo.status,
      liberado: antes.bloqueadoAntes && !resumo.bloqueado,
    };
  }

  function validarUsuario(b, d, idAtual) {
    const erros = {};
    const nome = texto(d.nome);
    const email = texto(d.email).toLowerCase();
    if (nome.length < 3) erros.nome = 'Informe o nome completo.';
    if (!emailValido(email)) erros.email = 'Informe um e-mail válido.';
    else if (b.usuarios.some((u) => u.email.toLowerCase() === email && u.id !== idAtual)) erros.email = 'Já existe um usuário com este e-mail.';
    if (!['Admin', 'Operacional'].includes(d.perfil)) erros.perfil = 'Escolha o perfil.';
    const senha = String(d.senha ?? '');
    if (!idAtual && senha.length < 8) erros.senha = 'A senha precisa ter pelo menos 8 caracteres.';
    if (idAtual && senha && senha.length < 8) erros.senha = 'A senha precisa ter pelo menos 8 caracteres.';
    recusar(erros);
    return { nome, email, perfil: d.perfil, senha };
  }

  return {
    modoDemo: true,

    definirToken(token) {
      const partesDoToken = String(token || '').split('.');
      usuarioAtualId = partesDoToken[0] === 'demo' ? Number(partesDoToken[1]) : null;
    },

    auth: {
      entrar: operacao(
        (b, email, senha) => {
          const usuario = b.usuarios.find((u) => u.email.toLowerCase() === texto(email).toLowerCase());
          if (!usuario || !usuario.ativo || usuario.senha !== String(senha ?? '')) {
            registrarLog(b, null, 'LoginInvalido', texto(email));
            throw new ErroApi('E-mail ou senha incorretos.', { codigo: 'CREDENCIAIS_INVALIDAS', status: 401 });
          }
          usuario.ultimoAcesso = agoraDoBanco(b);
          registrarLog(b, usuario.id, 'Login', null);
          return {
            token: `demo.${usuario.id}`,
            expiraEm: new Date(Date.now() + 8 * 3600000).toISOString(),
            usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
          };
        },
        { escreve: true },
      ),
      eu: operacao((b) => {
        const u = sessao(b);
        return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil };
      }),
    },

    painel: {
      obter: operacao((b) => {
        sessao(b);
        return montarPainel(b);
      }),
    },

    clientes: {
      listar: operacao((b, filtros = {}) => {
        sessao(b);
        const busca = texto(filtros.busca).toLowerCase();
        const digitos = somenteDigitos(busca);
        return b.clientes
          .filter((c) => filtros.incluirInativos || c.ativo)
          .map((c) => paraClienteResumo(b, c))
          .filter((c) => !filtros.status || c.status === filtros.status)
          .filter(
            (c) =>
              !busca ||
              c.nome.toLowerCase().includes(busca) ||
              c.email.toLowerCase().includes(busca) ||
              (digitos && c.documento.includes(digitos)),
          )
          .sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
      }),

      obter: operacao((b, id) => {
        sessao(b);
        const cliente = buscarCliente(b, id);
        return {
          ...paraClienteResumo(b, cliente),
          observacoes: cliente.observacoes,
          criadoEm: cliente.criadoEm,
          contratos: contratosDoCliente(b, cliente.id).map((c) => paraContrato(b, c)),
          cobrancas: parcelasDoCliente(b, cliente.id).sort(porDataDesc('dataVencimento')).slice(0, 36).map((p) => paraCobranca(b, p)),
          avisos: b.avisos.filter((a) => a.clienteId === cliente.id).sort(porDataDesc('criadoEm')).slice(0, 20).map((a) => paraAviso(b, a)),
          liberacoes: b.liberacoes.filter((l) => l.clienteId === cliente.id).sort(porDataDesc('dataInicio')).map((l) => paraLiberacao(b, l)),
          solicitacoes: b.solicitacoes.filter((s) => s.clienteId === cliente.id).sort(porDataDesc('criadoEm')).slice(0, 20).map((s) => paraSolicitacao(b, s)),
        };
      }),

      criar: operacao(
        (b, d) => {
          const usuario = admin(b);
          const dados = validarCliente(b, d, null);
          const agora = agoraDoBanco(b);
          const cliente = { id: proximoId(b, 'clientes'), ...dados, ativo: true, status: STATUS.VERDE, statusDesde: agora, criadoEm: agora };
          b.clientes.push(cliente);
          registrarLog(b, usuario.id, 'ClienteCriado', cliente.nome);
          return paraClienteResumo(b, cliente);
        },
        { escreve: true },
      ),

      atualizar: operacao(
        (b, id, d) => {
          const usuario = admin(b);
          const cliente = buscarCliente(b, id);
          Object.assign(cliente, validarCliente(b, d, cliente.id));
          registrarLog(b, usuario.id, 'ClienteAlterado', cliente.nome);
          return paraClienteResumo(b, cliente);
        },
        { escreve: true },
      ),

      alterarAtivo: operacao(
        (b, id, ativo) => {
          const usuario = admin(b);
          const cliente = buscarCliente(b, id);
          cliente.ativo = Boolean(ativo);
          registrarLog(b, usuario.id, cliente.ativo ? 'ClienteReativado' : 'ClienteInativado', cliente.nome);
          if (cliente.ativo) {
            gerarParcelasPendentes(b);
            recalcularCliente(b, cliente, usuario.id);
          }
          return paraClienteResumo(b, cliente);
        },
        { escreve: true },
      ),

      concederLiberacao: operacao(
        (b, id, d) => {
          const usuario = admin(b);
          const cliente = buscarCliente(b, id);
          const hoje = hojeDoBanco(b);
          const situacao = situacaoDoCliente(b, cliente);
          if (situacao.status !== STATUS.VERMELHO) {
            throw regra('A liberação temporária só se aplica a clientes com status Vermelho.');
          }
          const erros = {};
          const dataFim = texto(d.dataFim);
          const motivo = texto(d.motivo);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dataFim) || dataFim < hoje) erros.dataFim = 'Escolha uma data a partir de hoje.';
          else if (diasEntre(hoje, dataFim) > 60) erros.dataFim = 'A liberação temporária pode durar no máximo 60 dias.';
          if (motivo.length < 10) erros.motivo = 'Explique o motivo com pelo menos 10 caracteres.';
          recusar(erros);

          const liberacao = {
            id: proximoId(b, 'liberacoes'),
            clienteId: cliente.id,
            usuarioId: usuario.id,
            motivo,
            dataInicio: agoraDoBanco(b),
            dataFim,
            revogadaEm: null,
            revogadaPorUsuarioId: null,
          };
          b.liberacoes.push(liberacao);
          const modelo = modeloDeAviso(TIPOS_AVISO.LIBERACAO, { cliente: cliente.nome, dataFim });
          b.avisos.push({
            id: proximoId(b, 'avisos'),
            clienteId: cliente.id,
            parcelaId: null,
            tipo: TIPOS_AVISO.LIBERACAO,
            marco: null,
            canal: 'Sistema',
            assunto: modelo.assunto,
            mensagem: modelo.mensagem,
            enviado: false,
            criadoEm: agoraDoBanco(b),
          });
          registrarLog(b, usuario.id, 'LiberacaoConcedida', `${cliente.nome} até ${dataFim}: ${motivo}`);
          return paraLiberacao(b, liberacao);
        },
        { escreve: true },
      ),

      revogarLiberacao: operacao(
        (b, liberacaoId) => {
          const usuario = admin(b);
          const liberacao = b.liberacoes.find((l) => l.id === Number(liberacaoId));
          if (!liberacao) throw naoEncontrado('Liberação');
          if (liberacao.revogadaEm) throw regra('Esta liberação já foi revogada.');
          liberacao.revogadaEm = agoraDoBanco(b);
          liberacao.revogadaPorUsuarioId = usuario.id;
          const cliente = buscarCliente(b, liberacao.clienteId);
          registrarLog(b, usuario.id, 'LiberacaoRevogada', cliente.nome);
          return paraLiberacao(b, liberacao);
        },
        { escreve: true },
      ),
    },

    contratos: {
      listar: operacao((b) => {
        sessao(b);
        return b.contratos
          .map((c) => paraContrato(b, c))
          .sort((x, y) => Number(y.ativo) - Number(x.ativo) || x.clienteNome.localeCompare(y.clienteNome, 'pt-BR'));
      }),

      criar: operacao(
        (b, d) => {
          const usuario = admin(b);
          const cliente = b.clientes.find((c) => c.id === Number(d.clienteId));
          if (!cliente || !cliente.ativo) recusar({ clienteId: 'Escolha um cliente ativo.' });
          const dados = validarContrato(d, { novo: true });
          const contrato = {
            id: proximoId(b, 'contratos'),
            clienteId: cliente.id,
            ...dados,
            dataInicio: texto(d.dataInicio),
            dataFim: null,
            ativo: true,
            criadoEm: agoraDoBanco(b),
          };
          b.contratos.push(contrato);
          gerarParcelasPendentes(b);
          recalcularCliente(b, cliente, usuario.id);
          registrarLog(b, usuario.id, 'ContratoCriado', `${numeroDoContrato(contrato)} para ${cliente.nome}`);
          return paraContrato(b, contrato);
        },
        { escreve: true },
      ),

      atualizar: operacao(
        (b, id, d) => {
          const usuario = admin(b);
          const contrato = b.contratos.find((c) => c.id === Number(id));
          if (!contrato) throw naoEncontrado('Contrato');
          if (!contrato.ativo) throw regra('Contrato encerrado não pode ser alterado.');
          Object.assign(contrato, validarContrato(d, { novo: false }));
          registrarLog(b, usuario.id, 'ContratoAlterado', numeroDoContrato(contrato));
          return paraContrato(b, contrato);
        },
        { escreve: true },
      ),

      encerrar: operacao(
        (b, id) => {
          const usuario = admin(b);
          const contrato = b.contratos.find((c) => c.id === Number(id));
          if (!contrato) throw naoEncontrado('Contrato');
          if (!contrato.ativo) throw regra('Este contrato já está encerrado.');
          const hoje = hojeDoBanco(b);
          contrato.ativo = false;
          contrato.dataFim = hoje;
          // Cobranças que ainda não venceram deixam de ser devidas; as vencidas continuam em aberto.
          b.parcelas
            .filter((p) => p.contratoId === contrato.id && p.status === 'Aberta' && p.dataVencimento > hoje)
            .forEach((p) => {
              p.status = 'Cancelada';
              p.observacao = 'Cancelada no encerramento do contrato.';
            });
          registrarLog(b, usuario.id, 'ContratoEncerrado', numeroDoContrato(contrato));
          return paraContrato(b, contrato);
        },
        { escreve: true },
      ),
    },

    cobrancas: {
      listar: operacao((b, filtros = {}) => {
        sessao(b);
        const busca = texto(filtros.busca).toLowerCase();
        return b.parcelas
          .map((p) => paraCobranca(b, p))
          .filter((c) => !filtros.situacao || c.situacao === filtros.situacao)
          .filter((c) => !filtros.clienteId || c.clienteId === Number(filtros.clienteId))
          .filter((c) => !busca || c.clienteNome.toLowerCase().includes(busca) || c.numero.toLowerCase().includes(busca))
          .sort(porDataDesc('dataVencimento'));
      }),

      atualizar: operacao(
        (b, id, d) => {
          const usuario = admin(b);
          const parcela = buscarParcela(b, id);
          if (parcela.status !== 'Aberta') throw regra('Só é possível alterar cobranças em aberto.');
          const erros = {};
          const valor = Number(d.valorOriginal);
          const vencimento = texto(d.dataVencimento);
          if (!(valor > 0)) erros.valorOriginal = 'Informe um valor maior que zero.';
          if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) erros.dataVencimento = 'Informe o vencimento.';
          recusar(erros);
          const antes = antesDeAlterar(b, parcela);
          parcela.valorOriginal = arredondar(valor);
          parcela.dataVencimento = vencimento;
          parcela.observacao = texto(d.observacao) || null;
          registrarLog(b, usuario.id, 'CobrancaAlterada', `${numeroDaCobranca(parcela)}: valor ${parcela.valorOriginal}, vencimento ${vencimento}`);
          return aposAlterarCobranca(b, parcela, usuario, antes);
        },
        { escreve: true },
      ),

      baixar: operacao(
        (b, id, d) => {
          const usuario = admin(b);
          const parcela = buscarParcela(b, id);
          if (parcela.status !== 'Aberta') throw regra('Esta cobrança não está em aberto.');
          const hoje = hojeDoBanco(b);
          const erros = {};
          const dataPagamento = texto(d.dataPagamento);
          const valorPago = Number(d.valorPago);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPagamento)) erros.dataPagamento = 'Informe a data do pagamento.';
          else if (dataPagamento > hoje) erros.dataPagamento = 'A data do pagamento não pode ser futura.';
          if (!(valorPago > 0)) erros.valorPago = 'Informe o valor recebido.';
          recusar(erros);
          const antes = antesDeAlterar(b, parcela);
          parcela.status = 'Paga';
          parcela.dataPagamento = dataPagamento;
          parcela.valorPago = arredondar(valorPago);
          parcela.baixadaPorUsuarioId = usuario.id;
          parcela.observacao = texto(d.observacao) || parcela.observacao;
          registrarLog(b, usuario.id, 'PagamentoRegistrado', `${numeroDaCobranca(parcela)}: ${parcela.valorPago} em ${dataPagamento}`);
          return aposAlterarCobranca(b, parcela, usuario, antes);
        },
        { escreve: true },
      ),

      estornar: operacao(
        (b, id) => {
          const usuario = admin(b);
          const parcela = buscarParcela(b, id);
          if (parcela.status !== 'Paga') throw regra('Só é possível estornar cobranças pagas.');
          const antes = antesDeAlterar(b, parcela);
          parcela.status = 'Aberta';
          parcela.dataPagamento = null;
          parcela.valorPago = null;
          parcela.baixadaPorUsuarioId = null;
          registrarLog(b, usuario.id, 'PagamentoEstornado', numeroDaCobranca(parcela));
          return aposAlterarCobranca(b, parcela, usuario, antes);
        },
        { escreve: true },
      ),

      cancelar: operacao(
        (b, id, d = {}) => {
          const usuario = admin(b);
          const parcela = buscarParcela(b, id);
          if (parcela.status !== 'Aberta') throw regra('Só é possível cancelar cobranças em aberto.');
          const motivo = texto(d.motivo);
          if (motivo.length < 5) recusar({ motivo: 'Informe o motivo do cancelamento.' });
          const antes = antesDeAlterar(b, parcela);
          parcela.status = 'Cancelada';
          parcela.observacao = motivo;
          registrarLog(b, usuario.id, 'CobrancaCancelada', `${numeroDaCobranca(parcela)}: ${motivo}`);
          return aposAlterarCobranca(b, parcela, usuario, antes);
        },
        { escreve: true },
      ),
    },

    inadimplencia: {
      listar: operacao((b) => {
        sessao(b);
        return b.clientes
          .filter((c) => c.ativo)
          .map((c) => paraClienteResumo(b, c))
          .filter((c) => c.diasAtraso > 0)
          .sort((x, y) => ORDEM_STATUS[x.status] - ORDEM_STATUS[y.status] || y.diasAtraso - x.diasAtraso);
      }),

      processar: operacao(
        (b) => {
          const usuario = admin(b);
          return processarRotina(b, 'Execução manual', usuario.id);
        },
        { escreve: true },
      ),
    },

    solicitacoes: {
      listar: operacao((b) => {
        sessao(b);
        return [...b.solicitacoes].sort(porDataDesc('criadoEm')).map((s) => paraSolicitacao(b, s));
      }),

      criar: operacao(
        (b, d) => {
          const usuario = sessao(b);
          const erros = {};
          const cliente = b.clientes.find((c) => c.id === Number(d.clienteId));
          const descricao = texto(d.descricao);
          if (!cliente || !cliente.ativo) erros.clienteId = 'Escolha um cliente ativo.';
          if (!['NovaSolicitacao', 'AberturaProcesso'].includes(d.tipo)) erros.tipo = 'Escolha o tipo.';
          if (descricao.length < 5) erros.descricao = 'Descreva a demanda.';
          recusar(erros);

          // Bloqueio operacional: cliente em Vermelho sem liberação temporária não recebe novas demandas.
          const situacao = situacaoDoCliente(b, cliente);
          if (situacao.bloqueado) {
            registrarLog(b, usuario.id, 'SolicitacaoBloqueada', `${cliente.nome}: tentativa recusada, ${situacao.diasAtraso} dias de atraso`);
            throw new ErroApi(
              `${cliente.nome} está bloqueado por inadimplência (${situacao.diasAtraso} dias de atraso). ` +
                'Novas solicitações ficam suspensas até a regularização ou até uma liberação temporária do Financeiro.',
              { codigo: 'CLIENTE_BLOQUEADO', status: 409 },
            );
          }

          const solicitacao = {
            id: proximoId(b, 'solicitacoes'),
            clienteId: cliente.id,
            usuarioId: usuario.id,
            tipo: d.tipo,
            descricao,
            status: 'Aberta',
            criadoEm: agoraDoBanco(b),
            concluidaEm: null,
          };
          b.solicitacoes.push(solicitacao);
          registrarLog(b, usuario.id, 'SolicitacaoCriada', `${cliente.nome}: ${descricao.slice(0, 80)}`);
          return paraSolicitacao(b, solicitacao);
        },
        { escreve: true },
      ),

      concluir: operacao(
        (b, id) => {
          const usuario = sessao(b);
          const solicitacao = b.solicitacoes.find((s) => s.id === Number(id));
          if (!solicitacao) throw naoEncontrado('Solicitação');
          if (solicitacao.status === 'Concluida') throw regra('Esta solicitação já foi concluída.');
          solicitacao.status = 'Concluida';
          solicitacao.concluidaEm = agoraDoBanco(b);
          registrarLog(b, usuario.id, 'SolicitacaoConcluida', `#${solicitacao.id}`);
          return paraSolicitacao(b, solicitacao);
        },
        { escreve: true },
      ),
    },

    avisos: {
      listar: operacao((b) => {
        sessao(b);
        return [...b.avisos].sort(porDataDesc('criadoEm')).slice(0, 300).map((a) => paraAviso(b, a));
      }),
    },

    configuracoes: {
      obter: operacao((b) => {
        sessao(b);
        return paraConfiguracao(b);
      }),

      salvar: operacao(
        (b, d) => {
          const usuario = admin(b);
          const erros = {};
          const multa = Number(d.multaPercentual);
          const juros = Number(d.jurosDiarioPercentual);
          const dias = Number(d.diasParaBloqueio);
          const antecedencia = Number(d.diasAvisoPreVencimento);
          if (!(multa >= 0 && multa <= 20)) erros.multaPercentual = 'Informe um percentual entre 0 e 20.';
          if (!(juros >= 0 && juros <= 1)) erros.jurosDiarioPercentual = 'Informe um percentual entre 0 e 1 ao dia.';
          if (!Number.isInteger(dias) || dias < 1 || dias > 180) erros.diasParaBloqueio = 'Informe um prazo entre 1 e 180 dias.';
          if (!Number.isInteger(antecedencia) || antecedencia < 0 || antecedencia > 15) erros.diasAvisoPreVencimento = 'Informe de 0 a 15 dias.';
          recusar(erros);
          b.config = {
            multaPercentual: multa,
            jurosDiarioPercentual: juros,
            diasParaBloqueio: dias,
            diasAvisoPreVencimento: antecedencia,
            atualizadoEm: agoraDoBanco(b),
            atualizadoPor: usuario.nome,
          };
          registrarLog(b, usuario.id, 'ConfiguracaoAlterada', `multa ${multa}%, juros ${juros}% ao dia, bloqueio após ${dias} dias`);
          // O prazo de bloqueio pode ter mudado: o semáforo de todos é recalculado na hora.
          b.clientes.filter((c) => c.ativo).forEach((c) => recalcularCliente(b, c, usuario.id));
          return paraConfiguracao(b);
        },
        { escreve: true },
      ),
    },

    usuarios: {
      listar: operacao((b) => {
        admin(b);
        return b.usuarios.map(paraUsuario).sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
      }),

      criar: operacao(
        (b, d) => {
          const usuario = admin(b);
          const dados = validarUsuario(b, d, null);
          const novo = { id: proximoId(b, 'usuarios'), ...dados, ativo: true, criadoEm: agoraDoBanco(b), ultimoAcesso: null };
          b.usuarios.push(novo);
          registrarLog(b, usuario.id, 'UsuarioCriado', `${novo.nome} (${novo.perfil})`);
          return paraUsuario(novo);
        },
        { escreve: true },
      ),

      atualizar: operacao(
        (b, id, d) => {
          const usuario = admin(b);
          const alvo = b.usuarios.find((u) => u.id === Number(id));
          if (!alvo) throw naoEncontrado('Usuário');
          const dados = validarUsuario(b, d, alvo.id);
          const ativo = d.ativo === undefined ? alvo.ativo : Boolean(d.ativo);
          const deixaDeSerAdmin = alvo.perfil === 'Admin' && alvo.ativo && (dados.perfil !== 'Admin' || !ativo);
          if (deixaDeSerAdmin) {
            if (alvo.id === usuario.id) throw regra('Você não pode remover o seu próprio acesso de Financeiro/Admin.');
            const outros = b.usuarios.filter((u) => u.id !== alvo.id && u.perfil === 'Admin' && u.ativo).length;
            if (outros === 0) throw regra('O sistema precisa de pelo menos um usuário Financeiro/Admin ativo.');
          }
          alvo.nome = dados.nome;
          alvo.email = dados.email;
          alvo.perfil = dados.perfil;
          alvo.ativo = ativo;
          if (dados.senha) alvo.senha = dados.senha;
          registrarLog(b, usuario.id, 'UsuarioAlterado', `${alvo.nome} (${alvo.perfil}${alvo.ativo ? '' : ', inativo'})`);
          return paraUsuario(alvo);
        },
        { escreve: true },
      ),
    },

    registros: {
      listar: operacao((b) => {
        admin(b);
        return [...b.logs]
          .sort(porDataDesc('dataHora'))
          .slice(0, 300)
          .map((l) => ({ id: l.id, dataHora: l.dataHora, usuario: nomeDoUsuario(b, l.usuarioId) || 'Sistema', acao: l.acao, detalhes: l.detalhes, ip: l.ip }));
      }),
    },

    /** Recursos que só existem no modo demonstração. */
    demo: {
      info: operacao((b) => ({
        deslocamentoDias: b.deslocamentoDias || 0,
        dataReferencia: hojeDoBanco(b),
        dataReal: dataReal(),
      })),

      avancarDias: operacao(
        (b, dias) => {
          const usuario = sessao(b);
          const n = Math.max(1, Math.min(120, Math.round(Number(dias) || 0)));
          b.deslocamentoDias = (b.deslocamentoDias || 0) + n;
          return processarRotina(b, `Simulação de ${n} ${n === 1 ? 'dia' : 'dias'}`, usuario.id);
        },
        { escreve: true },
      ),

      restaurar: async () => {
        await pausa();
        apagarBanco();
        banco = null;
        abrir();
        return { dataReferencia: hojeDoBanco(banco) };
      },
    },
  };
}

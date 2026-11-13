// Cliente da API real (ASP.NET Core Web API).
// Cada função corresponde a um endpoint do back-end; o token JWT vai no cabeçalho Authorization.

import { ErroApi } from './erro.js';

export function criarApiHttp(urlBase = '') {
  let token = null;
  let aoPerderSessao = null;

  async function chamar(metodo, caminho, corpo) {
    const cabecalhos = { Accept: 'application/json' };
    if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
    if (token) cabecalhos.Authorization = `Bearer ${token}`;

    let resposta;
    try {
      resposta = await fetch(`${urlBase}${caminho}`, {
        method: metodo,
        headers: cabecalhos,
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
    } catch {
      throw new ErroApi('Não foi possível falar com o servidor. Confira se a API está no ar e tente de novo.', {
        codigo: 'SEM_CONEXAO',
        status: 0,
      });
    }

    if (resposta.status === 204) return null;

    let dados = null;
    try {
      dados = await resposta.json();
    } catch {
      dados = null;
    }

    if (!resposta.ok) {
      if (resposta.status === 401 && token && aoPerderSessao) aoPerderSessao();
      const mensagemPadrao =
        resposta.status === 401
          ? 'Sua sessão terminou. Entre novamente.'
          : resposta.status === 403
            ? 'Esta ação é exclusiva do perfil Financeiro/Admin.'
            : 'O servidor não conseguiu concluir a operação. Tente de novo em instantes.';
      throw new ErroApi((dados && dados.mensagem) || mensagemPadrao, {
        codigo: (dados && dados.codigo) || 'ERRO',
        status: resposta.status,
        erros: (dados && dados.erros) || null,
      });
    }
    return dados;
  }

  function consulta(filtros) {
    const parametros = new URLSearchParams();
    Object.entries(filtros || {}).forEach(([chave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '' && valor !== false) parametros.set(chave, String(valor));
    });
    const texto = parametros.toString();
    return texto ? `?${texto}` : '';
  }

  return {
    modoDemo: false,

    definirToken(novoToken) {
      token = novoToken || null;
    },

    /** Registra o que fazer quando a API responder 401 (token expirado). */
    aoPerderSessao(funcao) {
      aoPerderSessao = funcao;
    },

    auth: {
      entrar: (email, senha) => chamar('POST', '/api/auth/login', { email, senha }),
      eu: () => chamar('GET', '/api/auth/eu'),
    },

    painel: {
      obter: () => chamar('GET', '/api/painel'),
    },

    clientes: {
      listar: (filtros) => chamar('GET', `/api/clientes${consulta(filtros)}`),
      obter: (id) => chamar('GET', `/api/clientes/${id}`),
      criar: (dados) => chamar('POST', '/api/clientes', dados),
      atualizar: (id, dados) => chamar('PUT', `/api/clientes/${id}`, dados),
      alterarAtivo: (id, ativo) => chamar('PATCH', `/api/clientes/${id}/ativo`, { ativo }),
      concederLiberacao: (id, dados) => chamar('POST', `/api/clientes/${id}/liberacoes`, dados),
      revogarLiberacao: (liberacaoId) => chamar('POST', `/api/liberacoes/${liberacaoId}/revogar`),
    },

    contratos: {
      listar: () => chamar('GET', '/api/contratos'),
      criar: (dados) => chamar('POST', '/api/contratos', dados),
      atualizar: (id, dados) => chamar('PUT', `/api/contratos/${id}`, dados),
      encerrar: (id) => chamar('POST', `/api/contratos/${id}/encerrar`),
    },

    cobrancas: {
      listar: (filtros) => chamar('GET', `/api/cobrancas${consulta(filtros)}`),
      atualizar: (id, dados) => chamar('PUT', `/api/cobrancas/${id}`, dados),
      baixar: (id, dados) => chamar('POST', `/api/cobrancas/${id}/baixa`, dados),
      estornar: (id) => chamar('POST', `/api/cobrancas/${id}/estorno`),
      cancelar: (id, dados) => chamar('POST', `/api/cobrancas/${id}/cancelamento`, dados),
    },

    inadimplencia: {
      listar: () => chamar('GET', '/api/inadimplencia'),
      processar: () => chamar('POST', '/api/inadimplencia/processar'),
    },

    solicitacoes: {
      listar: () => chamar('GET', '/api/solicitacoes'),
      criar: (dados) => chamar('POST', '/api/solicitacoes', dados),
      concluir: (id) => chamar('POST', `/api/solicitacoes/${id}/concluir`),
    },

    avisos: {
      listar: () => chamar('GET', '/api/avisos'),
    },

    configuracoes: {
      obter: () => chamar('GET', '/api/configuracoes'),
      salvar: (dados) => chamar('PUT', '/api/configuracoes', dados),
    },

    usuarios: {
      listar: () => chamar('GET', '/api/usuarios'),
      criar: (dados) => chamar('POST', '/api/usuarios', dados),
      atualizar: (id, dados) => chamar('PUT', `/api/usuarios/${id}`, dados),
    },

    registros: {
      listar: () => chamar('GET', '/api/registros'),
    },

    // Simulação de datas só existe no modo demonstração.
    demo: null,
  };
}

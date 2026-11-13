// Ganchos compartilhados: carregamento de dados e navegação por âncora (#tela).
import { useCallback, useEffect, useState } from 'react';

/** Avisa quem cuida da sessão quando a API responde que o login expirou. */
export const sessaoExpirada = { ouvinte: null };

/**
 * Carrega dados da API e controla os estados de carregamento e erro.
 * Ao recarregar, mantém os dados anteriores na tela até os novos chegarem.
 */
export function useDados(buscar, dependencias = []) {
  const [estado, setEstado] = useState({ dados: null, carregando: true, erro: null });
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    setEstado((anterior) => ({ ...anterior, carregando: true, erro: null }));
    buscar()
      .then((dados) => {
        if (ativo) setEstado({ dados, carregando: false, erro: null });
      })
      .catch((erro) => {
        if (!ativo) return;
        if (erro && erro.status === 401 && sessaoExpirada.ouvinte) sessaoExpirada.ouvinte();
        setEstado({ dados: null, carregando: false, erro });
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencias, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { ...estado, recarregar };
}

function lerRota() {
  const nome = window.location.hash.replace(/^#/, '') || 'painel';
  return /^[a-z0-9-]+$/.test(nome) ? nome : 'painel';
}

/**
 * Rota atual. As telas usam âncoras simples (#clientes, #cliente-7, #cobrancas-vencidas):
 * dá para voltar com o botão do navegador e enviar o link de uma tela.
 */
export function useRota() {
  const [rota, setRota] = useState(lerRota);
  useEffect(() => {
    const aoMudar = () => setRota(lerRota());
    window.addEventListener('hashchange', aoMudar);
    return () => window.removeEventListener('hashchange', aoMudar);
  }, []);
  const [tela, ...resto] = rota.split('-');
  return { rota, tela, parametro: resto.join('-') || null };
}

export function navegar(rota) {
  window.location.hash = rota;
}

/** Verdadeiro quando a página está embutida em outra (ali, downloads e impressão não funcionam). */
export function estaEmbutido() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

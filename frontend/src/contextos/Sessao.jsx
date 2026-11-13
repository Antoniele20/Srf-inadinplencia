// Sessão do usuário: guarda o token JWT e o perfil, e expõe entrar/sair.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/index.js';
import { sessaoExpirada } from '../lib/hooks.js';

const CHAVE = 'srf-inadimplencia-sessao';
const ContextoSessao = createContext(null);

function lerSessaoSalva() {
  try {
    const salva = JSON.parse(window.localStorage.getItem(CHAVE) || 'null');
    if (salva && salva.token && salva.usuario) {
      if (salva.expiraEm && new Date(salva.expiraEm).getTime() < Date.now()) return null;
      return salva;
    }
  } catch {
    // Sem armazenamento disponível: a sessão vale só enquanto a página estiver aberta.
  }
  return null;
}

function salvarSessao(sessao) {
  try {
    if (sessao) window.localStorage.setItem(CHAVE, JSON.stringify(sessao));
    else window.localStorage.removeItem(CHAVE);
  } catch {
    // Ignorado: ver comentário acima.
  }
}

export function ProvedorSessao({ children }) {
  const [sessao, setSessao] = useState(() => {
    const salva = lerSessaoSalva();
    api.definirToken(salva ? salva.token : null);
    return salva;
  });

  const sair = useCallback(() => {
    api.definirToken(null);
    salvarSessao(null);
    setSessao(null);
  }, []);

  const entrar = useCallback(async (email, senha) => {
    const resposta = await api.auth.entrar(email, senha);
    api.definirToken(resposta.token);
    salvarSessao(resposta);
    setSessao(resposta);
    return resposta.usuario;
  }, []);

  useEffect(() => {
    sessaoExpirada.ouvinte = sair;
    if (api.aoPerderSessao) api.aoPerderSessao(sair);
    return () => {
      sessaoExpirada.ouvinte = null;
    };
  }, [sair]);

  const valor = useMemo(
    () => ({
      usuario: sessao ? sessao.usuario : null,
      ehAdmin: Boolean(sessao && sessao.usuario.perfil === 'Admin'),
      entrar,
      sair,
    }),
    [sessao, entrar, sair],
  );

  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>;
}

export function useSessao() {
  return useContext(ContextoSessao);
}

export const ROTULO_PERFIL = { Admin: 'Financeiro/Admin', Operacional: 'Operacional' };

// Moldura das telas: barra lateral com a navegação e a área de trabalho.
import { createContext, useContext, useEffect, useState } from 'react';
import { MODO_DEMO, api } from '../api/index.js';
import { ROTULO_PERFIL, useSessao } from '../contextos/Sessao.jsx';
import { hojeISO } from '../lib/datas.js';
import { data, plural } from '../lib/formatos.js';
import { useDados } from '../lib/hooks.js';
import { Icone } from './base.jsx';

const NAVEGACAO = [
  { tela: 'painel', texto: 'Painel', icone: 'painel' },
  { tela: 'clientes', texto: 'Clientes', icone: 'clientes', tambem: ['cliente'] },
  { tela: 'contratos', texto: 'Contratos', icone: 'contratos' },
  { tela: 'cobrancas', texto: 'Cobranças', icone: 'cobrancas' },
  { tela: 'inadimplencia', texto: 'Inadimplência', icone: 'inadimplencia', contador: true },
  { tela: 'solicitacoes', texto: 'Solicitações', icone: 'solicitacoes' },
  { tela: 'avisos', texto: 'Avisos', icone: 'avisos' },
  { grupo: 'Gestão' },
  { tela: 'relatorios', texto: 'Relatórios', icone: 'relatorios' },
  { tela: 'configuracoes', texto: 'Configurações', icone: 'configuracoes' },
  { tela: 'usuarios', texto: 'Usuários', icone: 'usuarios', soAdmin: true },
  { tela: 'registros', texto: 'Registro de acessos', icone: 'registros', soAdmin: true },
];

const ContextoHoje = createContext(null);

/** Data de referência do sistema (a data do servidor; no modo demonstração, a data simulada). */
export function useHoje() {
  return useContext(ContextoHoje) || hojeISO();
}

/** As telas chamam esta função depois de gravar algo, para o contador da barra lateral se atualizar. */
export function avisarMudanca() {
  window.dispatchEvent(new Event('srf-dados-alterados'));
}

export function Estrutura({ tela, children }) {
  const { usuario, ehAdmin, sair } = useSessao();
  const [menuAberto, setMenuAberto] = useState(false);
  const [versao, setVersao] = useState(0);
  const resumo = useDados(() => api.painel.obter(), [tela, versao]);

  useEffect(() => {
    const aoMudar = () => setVersao((v) => v + 1);
    window.addEventListener('srf-dados-alterados', aoMudar);
    return () => window.removeEventListener('srf-dados-alterados', aoMudar);
  }, []);

  useEffect(() => {
    setMenuAberto(false);
  }, [tela]);

  const bloqueados = resumo.dados ? resumo.dados.semaforo.bloqueados : 0;
  const demo = MODO_DEMO && api.demo ? <FaixaDemo versao={`${tela}-${versao}`} /> : null;

  return (
    <div className="app">
      <div className="barra-movel">
        <span className="marca-sigla">SRF</span>
        <button type="button" onClick={() => setMenuAberto((aberto) => !aberto)} aria-expanded={menuAberto}>
          <Icone nome="menu" /> Menu
        </button>
      </div>

      <aside className={`lateral ${menuAberto ? 'aberta' : ''}`}>
        <div className="marca">
          <div className="marca-sigla">SRF</div>
          <div className="marca-nome">Serviços de Advocacia</div>
        </div>
        <nav className="nav" aria-label="Telas do sistema">
          {NAVEGACAO.filter((item) => !item.soAdmin || ehAdmin).map((item) =>
            item.grupo ? (
              <div key={item.grupo} className="nav-grupo">
                {item.grupo}
              </div>
            ) : (
              <a key={item.tela} href={`#${item.tela}`} aria-current={tela === item.tela || (item.tambem || []).includes(tela) ? 'page' : undefined}>
                <Icone nome={item.icone} />
                {item.texto}
                {item.contador && bloqueados > 0 ? (
                  <span className="contador" title={`${plural(bloqueados, 'cliente bloqueado', 'clientes bloqueados')}`}>
                    {bloqueados}
                  </span>
                ) : null}
              </a>
            ),
          )}
        </nav>
        <div className="lateral-rodape">
          <div>
            <div className="usuario-nome">{usuario.nome}</div>
            <div className="usuario-perfil">Perfil {ROTULO_PERFIL[usuario.perfil]}</div>
          </div>
          <button type="button" className="botao-sair" onClick={sair}>
            <Icone nome="sair" /> Sair
          </button>
        </div>
      </aside>

      <main className="principal" onClick={() => menuAberto && setMenuAberto(false)}>
        {demo}
        <ContextoHoje.Provider value={resumo.dados ? resumo.dados.dataReferencia : null}>{children}</ContextoHoje.Provider>
      </main>
    </div>
  );
}

function FaixaDemo({ versao }) {
  const info = useDados(() => api.demo.info(), [versao]);
  if (!info.dados) return null;
  const { deslocamentoDias, dataReferencia } = info.dados;
  return (
    <div className="faixa-demo">
      <strong>Modo demonstração</strong>
      <span>Os dados são fictícios e ficam guardados só neste navegador.</span>
      <span>
        Data de referência: <strong className="num">{data(dataReferencia)}</strong>
        {deslocamentoDias > 0 ? ` (simulando ${plural(deslocamentoDias, 'dia', 'dias')} à frente)` : ''}
      </span>
    </div>
  );
}

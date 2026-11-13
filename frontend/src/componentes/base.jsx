// Componentes reutilizáveis de interface: ícones, botões, campos, tabela, modal e estados de tela.
import { useEffect, useId } from 'react';

const ICONES = {
  painel: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  clientes: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  contratos: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>',
  cobrancas: '<path d="M5 3v18l2.5-1.5L10 21l2-1.5 2 1.5 2.5-1.5L19 21V3z"/><path d="M9 8h6"/><path d="M9 12h6"/>',
  inadimplencia: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  solicitacoes: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
  avisos: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  relatorios: '<path d="M3 3v18h18"/><path d="M8 17v-5"/><path d="M13 17V8"/><path d="M18 17v-9"/>',
  configuracoes: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/>',
  usuarios: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  registros: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  mais: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  fechar: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  cadeado: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  cadeadoAberto: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  relogio: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  seta: '<path d="m9 18 6-6-6-6"/>',
  voltar: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  editar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  copiar: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  baixar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  atualizar: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
  imprimir: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
};

export function Icone({ nome, tamanho = 18 }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: ICONES[nome] || '' }}
    />
  );
}

export function Botao({ variante = '', pequeno = false, icone, children, type = 'button', ...resto }) {
  const classes = ['botao', variante, pequeno ? 'pequeno' : ''].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} {...resto}>
      {icone ? <Icone nome={icone} tamanho={pequeno ? 15 : 17} /> : null}
      {children}
    </button>
  );
}

/** Rótulo + controle + dica ou erro. O controle recebe o id pelo parâmetro da função filha. */
export function Campo({ rotulo, erro, dica, className = '', children }) {
  const id = useId();
  return (
    <div className={`campo ${className}`}>
      <label htmlFor={id}>{rotulo}</label>
      {children({ id, 'aria-invalid': erro ? 'true' : undefined, 'aria-describedby': erro || dica ? `${id}-ajuda` : undefined })}
      {erro ? (
        <span className="erro" id={`${id}-ajuda`}>
          {erro}
        </span>
      ) : dica ? (
        <span className="dica" id={`${id}-ajuda`}>
          {dica}
        </span>
      ) : null}
    </div>
  );
}

export function Etiqueta({ cor = '', children }) {
  return <span className={`etiqueta ${cor}`}>{children}</span>;
}

export function Nota({ tipo = 'info', icone = 'info', children, acao }) {
  return (
    <div className={`nota ${tipo}`} role={tipo === 'perigo' ? 'alert' : undefined}>
      <Icone nome={icone} />
      <div className="nota-corpo">{children}</div>
      {acao}
    </div>
  );
}

export function Pagina({ titulo, descricao, acoes, voltar, children }) {
  return (
    <div className="conteudo">
      {voltar ? (
        <a className="voltar" href={voltar.href}>
          <Icone nome="voltar" tamanho={15} />
          {voltar.texto}
        </a>
      ) : null}
      <header className="cabecalho">
        <div>
          <h1>{titulo}</h1>
          {descricao ? <p>{descricao}</p> : null}
        </div>
        {acoes ? <div className="cabecalho-acoes">{acoes}</div> : null}
      </header>
      <div className="pilha">{children}</div>
    </div>
  );
}

export function Painel({ titulo, descricao, acoes, children, className = '' }) {
  return (
    <section className={`painel ${className}`}>
      {titulo ? (
        <div className="painel-topo">
          <div>
            <h2>{titulo}</h2>
            {descricao ? <p>{descricao}</p> : null}
          </div>
          {acoes}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Mostra "carregando" ou o erro de uma consulta; devolve null quando há dados para exibir. */
export function EstadoDeCarga({ consulta }) {
  if (consulta.erro) {
    return (
      <Nota tipo="perigo" icone="inadimplencia" acao={<Botao pequeno onClick={consulta.recarregar}>Tentar de novo</Botao>}>
        <strong>Não foi possível carregar.</strong> {consulta.erro.message}
      </Nota>
    );
  }
  if (!consulta.dados) return <div className="carregando">Carregando…</div>;
  return null;
}

export function Vazio({ titulo, children }) {
  return (
    <div className="vazio">
      <strong>{titulo}</strong>
      {children}
    </div>
  );
}

/**
 * Tabela genérica.
 * colunas: [{ id, titulo, direita, largura, celula: (linha) => conteúdo }]
 */
export function Tabela({ colunas, linhas, aoClicar, vazio, rodape, legenda }) {
  if (!linhas || linhas.length === 0) return vazio || null;
  return (
    <div className="tabela-rolagem">
      <table className="tabela">
        {legenda ? <caption className="so-leitor">{legenda}</caption> : null}
        <thead>
          <tr>
            {colunas.map((coluna) => (
              <th key={coluna.id} scope="col" className={coluna.direita ? 'direita' : undefined} style={coluna.largura ? { width: coluna.largura } : undefined}>
                {coluna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr
              key={linha.id}
              className={aoClicar ? 'clicavel' : undefined}
              onClick={
                aoClicar
                  ? (evento) => {
                      // Cliques em botões e links dentro da linha não abrem a ficha.
                      if (evento.target.closest('button, a, input, select')) return;
                      aoClicar(linha);
                    }
                  : undefined
              }
            >
              {colunas.map((coluna) => (
                <td key={coluna.id} className={coluna.direita ? 'direita' : undefined}>
                  {coluna.celula(linha)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {rodape ? <tfoot>{rodape}</tfoot> : null}
      </table>
    </div>
  );
}

export function Modal({ titulo, aoFechar, children, rodape, largo = false, aoEnviar }) {
  const idTitulo = useId();

  useEffect(() => {
    const aoTeclar = (evento) => {
      if (evento.key === 'Escape') aoFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aoFechar]);

  const corpo = (
    <>
      <div className="modal-topo">
        <h2 id={idTitulo}>{titulo}</h2>
        <button type="button" className="botao fantasma pequeno" onClick={aoFechar} aria-label="Fechar">
          <Icone nome="fechar" />
        </button>
      </div>
      <div className="modal-corpo">{children}</div>
      <div className="modal-rodape">{rodape}</div>
    </>
  );

  return (
    <div
      className="modal-fundo"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      }}
    >
      {aoEnviar ? (
        <form
          className={`modal ${largo ? 'largo' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={idTitulo}
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            aoEnviar();
          }}
        >
          {corpo}
        </form>
      ) : (
        <div className={`modal ${largo ? 'largo' : ''}`} role="dialog" aria-modal="true" aria-labelledby={idTitulo}>
          {corpo}
        </div>
      )}
    </div>
  );
}

/** Controle segmentado: uma opção ativa por vez. opcoes: [{ valor, texto, qtd }] */
export function Segmentos({ opcoes, valor, aoMudar, rotulo }) {
  return (
    <div className="segmentos" role="group" aria-label={rotulo}>
      {opcoes.map((opcao) => (
        <button key={String(opcao.valor)} type="button" aria-pressed={valor === opcao.valor} onClick={() => aoMudar(opcao.valor)}>
          {opcao.marcador}
          {opcao.texto}
          {opcao.qtd !== undefined ? <span className="qtd num">{opcao.qtd}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function CampoBusca({ valor, aoMudar, rotulo }) {
  const id = useId();
  return (
    <div className="busca">
      <Icone nome="busca" />
      <label htmlFor={id} className="so-leitor">
        {rotulo}
      </label>
      <input id={id} className="entrada" type="search" placeholder={rotulo} value={valor} onChange={(evento) => aoMudar(evento.target.value)} />
    </div>
  );
}

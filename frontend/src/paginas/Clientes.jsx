import { useState } from 'react';
import { api } from '../api/index.js';
import { Botao, CampoBusca, EstadoDeCarga, Pagina, Painel, Segmentos, Tabela, Vazio } from '../componentes/base.jsx';
import { avisarMudanca } from '../componentes/Estrutura.jsx';
import { FormCliente } from '../componentes/formularios.jsx';
import { Semaforo, SeloStatus, textoDoAtraso } from '../componentes/Semaforo.jsx';
import { useMensagens } from '../contextos/Mensagens.jsx';
import { useSessao } from '../contextos/Sessao.jsx';
import { documento, moeda, somenteDigitos } from '../lib/formatos.js';
import { navegar, useDados } from '../lib/hooks.js';

const STATUS_DA_ROTA = { verde: 'Verde', amarelo: 'Amarelo', vermelho: 'Vermelho' };

export default function Clientes({ parametro }) {
  const { ehAdmin } = useSessao();
  const { avisar } = useMensagens();
  const [busca, setBusca] = useState('');
  const [inativos, setInativos] = useState(false);
  const [cadastrando, setCadastrando] = useState(false);
  const consulta = useDados(() => api.clientes.listar({ incluirInativos: inativos }), [inativos]);

  // O filtro de status vem do endereço (#clientes-vermelho), para o painel poder apontar direto para ele.
  const status = STATUS_DA_ROTA[parametro] || '';
  const todos = consulta.dados || [];
  const ativos = todos.filter((c) => c.ativo);
  const contar = (s) => ativos.filter((c) => c.status === s).length;

  const termo = busca.trim().toLowerCase();
  const digitos = somenteDigitos(termo);
  const visiveis = todos
    .filter((c) => !status || (c.ativo && c.status === status))
    .filter((c) => !termo || c.nome.toLowerCase().includes(termo) || c.email.toLowerCase().includes(termo) || (digitos && c.documento.includes(digitos)));

  return (
    <Pagina
      titulo="Clientes"
      descricao="Situação financeira de cada cliente. O semáforo muda sozinho conforme os vencimentos e os pagamentos registrados."
      acoes={
        ehAdmin ? (
          <Botao variante="primario" icone="mais" onClick={() => setCadastrando(true)}>
            Novo cliente
          </Botao>
        ) : null
      }
    >
      <Painel>
        <div className="filtros">
          <CampoBusca valor={busca} aoMudar={setBusca} rotulo="Buscar por nome, e-mail ou documento" />
          <Segmentos
            rotulo="Filtrar por status"
            valor={status}
            aoMudar={(valor) => navegar(valor ? `clientes-${valor.toLowerCase()}` : 'clientes')}
            opcoes={[
              { valor: '', texto: 'Todos', qtd: ativos.length },
              { valor: 'Vermelho', texto: 'Vermelho', qtd: contar('Vermelho'), marcador: <Semaforo status="Vermelho" /> },
              { valor: 'Amarelo', texto: 'Amarelo', qtd: contar('Amarelo'), marcador: <Semaforo status="Amarelo" /> },
              { valor: 'Verde', texto: 'Verde', qtd: contar('Verde'), marcador: <Semaforo status="Verde" /> },
            ]}
          />
          <label className="marcar">
            <input type="checkbox" checked={inativos} onChange={(evento) => setInativos(evento.target.checked)} />
            Mostrar inativos
          </label>
        </div>

        {consulta.dados ? (
          <Tabela
            legenda="Clientes e situação financeira"
            linhas={visiveis}
            aoClicar={(cliente) => navegar(`cliente-${cliente.id}`)}
            vazio={<Vazio titulo="Nenhum cliente encontrado">Confira a busca e o filtro de status.</Vazio>}
            colunas={[
              { id: 'status', titulo: 'Situação', celula: (c) => <SeloStatus cliente={c} /> },
              {
                id: 'cliente',
                titulo: 'Cliente',
                celula: (c) => (
                  <span className="celula-dupla">
                    <a className="link-linha" href={`#cliente-${c.id}`}>
                      {c.nome}
                    </a>
                    <small className="num">{documento(c.documento)}</small>
                  </span>
                ),
              },
              {
                id: 'contato',
                titulo: 'Contato',
                celula: (c) => (
                  <span className="celula-dupla">
                    <span>{c.email}</span>
                    <small>{c.telefone || ''}</small>
                  </span>
                ),
              },
              { id: 'atraso', titulo: 'Atraso', celula: (c) => (c.diasAtraso > 0 ? textoDoAtraso(c) : <span className="suave">Sem atraso</span>) },
              {
                id: 'vencido',
                titulo: 'Vencido atualizado',
                direita: true,
                celula: (c) => (c.valorAtualizado > 0 ? <span className="forte">{moeda(c.valorAtualizado)}</span> : <span className="suave">—</span>),
              },
              { id: 'mensal', titulo: 'Honorário mensal', direita: true, celula: (c) => (c.valorMensal > 0 ? moeda(c.valorMensal) : <span className="suave">—</span>) },
            ]}
          />
        ) : (
          <div className="painel-corpo">
            <EstadoDeCarga consulta={consulta} />
          </div>
        )}
      </Painel>

      {cadastrando ? (
        <FormCliente
          aoFechar={() => setCadastrando(false)}
          aoSalvar={(cliente) => {
            setCadastrando(false);
            avisar('Cliente cadastrado.');
            avisarMudanca();
            navegar(`cliente-${cliente.id}`);
          }}
        />
      ) : null}
    </Pagina>
  );
}

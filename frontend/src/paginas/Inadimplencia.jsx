import { useState } from 'react';
import { api } from '../api/index.js';
import { Botao, EstadoDeCarga, Nota, Pagina, Painel, Tabela, Vazio } from '../componentes/base.jsx';
import { avisarMudanca, useHoje } from '../componentes/Estrutura.jsx';
import { FormLiberacao } from '../componentes/formularios.jsx';
import { SeloStatus, textoDoAtraso } from '../componentes/Semaforo.jsx';
import { useMensagens } from '../contextos/Mensagens.jsx';
import { useSessao } from '../contextos/Sessao.jsx';
import { dataHora, moeda, numero, plural } from '../lib/formatos.js';
import { navegar, useDados } from '../lib/hooks.js';

export default function Inadimplencia() {
  const { ehAdmin } = useSessao();
  const { avisar, avisarErro } = useMensagens();
  const hoje = useHoje();
  const consulta = useDados(() => api.inadimplencia.listar(), []);
  const config = useDados(() => api.configuracoes.obter(), []);
  const [liberando, setLiberando] = useState(null);
  const [rotina, setRotina] = useState(null);
  const [executando, setExecutando] = useState(false);

  async function executarRotina() {
    setExecutando(true);
    try {
      const resultado = await api.inadimplencia.processar();
      setRotina(resultado);
      avisarMudanca();
      consulta.recarregar();
    } catch (erro) {
      avisarErro(erro);
    } finally {
      setExecutando(false);
    }
  }

  const clientes = consulta.dados || [];
  const soma = (campo) => clientes.reduce((total, c) => total + c[campo], 0);

  const colunas = [
    { id: 'status', titulo: 'Situação', celula: (c) => <SeloStatus cliente={c} /> },
    {
      id: 'cliente',
      titulo: 'Cliente',
      celula: (c) => (
        <a className="link-linha" href={`#cliente-${c.id}`}>
          {c.nome}
        </a>
      ),
    },
    { id: 'vencidas', titulo: 'Vencidas', direita: true, celula: (c) => c.parcelasVencidas },
    { id: 'atraso', titulo: 'Atraso da mais antiga', celula: (c) => textoDoAtraso(c) },
    { id: 'principal', titulo: 'Principal', direita: true, celula: (c) => moeda(c.valorVencido) },
    { id: 'multa', titulo: 'Multa', direita: true, celula: (c) => moeda(c.valorMulta) },
    { id: 'juros', titulo: 'Juros', direita: true, celula: (c) => moeda(c.valorJuros) },
    { id: 'total', titulo: 'Total atualizado', direita: true, celula: (c) => <span className="forte">{moeda(c.valorAtualizado)}</span> },
    ehAdmin && {
      id: 'acoes',
      titulo: <span className="so-leitor">Ações</span>,
      celula: (c) =>
        c.bloqueado ? (
          <div className="acoes-linha">
            <Botao
              pequeno
              icone="cadeadoAberto"
              title="Liberar temporariamente"
              aria-label={`Liberar temporariamente ${c.nome}`}
              onClick={() => setLiberando(c)}
            >
              Liberar
            </Botao>
          </div>
        ) : null,
    },
  ].filter(Boolean);

  return (
    <Pagina
      titulo="Inadimplência"
      descricao="Clientes com honorários vencidos, dos bloqueados para os que ainda estão dentro do prazo."
      acoes={
        ehAdmin ? (
          <Botao icone="atualizar" onClick={executarRotina} disabled={executando}>
            {executando ? 'Executando…' : 'Executar rotina agora'}
          </Botao>
        ) : null
      }
    >
      {rotina ? (
        <Nota tipo="sucesso" icone="check" acao={<Botao pequeno variante="fantasma" onClick={() => setRotina(null)}>Fechar</Botao>}>
          <strong>Rotina executada em {dataHora(rotina.executadaEm)}.</strong> {plural(rotina.parcelasGeradas, 'cobrança gerada', 'cobranças geradas')},{' '}
          {plural(rotina.clientesComStatusAlterado, 'mudança de semáforo', 'mudanças de semáforo')},{' '}
          {plural(rotina.avisosGerados, 'aviso emitido', 'avisos emitidos')} e {plural(rotina.bloqueados, 'cliente bloqueado', 'clientes bloqueados')} no momento.
        </Nota>
      ) : null}

      {config.dados ? (
        <Nota>
          <strong>Regra em vigor.</strong> Amarelo de 1 a {config.dados.diasParaBloqueio} dias de atraso; vermelho e bloqueio acima de{' '}
          {config.dados.diasParaBloqueio} dias. Multa de {numero(config.dados.multaPercentual)}% e juros de {numero(config.dados.jurosDiarioPercentual)}% ao
          dia sobre o principal. A verificação roda sozinha todos os dias, de madrugada.
        </Nota>
      ) : null}

      <Painel>
        {consulta.dados ? (
          <Tabela
            legenda="Clientes inadimplentes"
            colunas={colunas}
            linhas={clientes}
            aoClicar={(cliente) => navegar(`cliente-${cliente.id}`)}
            vazio={<Vazio titulo="Nenhum cliente inadimplente">Todos os honorários vencidos estão quitados.</Vazio>}
            rodape={
              <tr>
                <td colSpan={2}>{plural(clientes.length, 'cliente', 'clientes')}</td>
                <td className="direita">{soma('parcelasVencidas')}</td>
                <td />
                <td className="direita">{moeda(soma('valorVencido'))}</td>
                <td className="direita">{moeda(soma('valorMulta'))}</td>
                <td className="direita">{moeda(soma('valorJuros'))}</td>
                <td className="direita">{moeda(soma('valorAtualizado'))}</td>
                {ehAdmin ? <td /> : null}
              </tr>
            }
          />
        ) : (
          <div className="painel-corpo">
            <EstadoDeCarga consulta={consulta} />
          </div>
        )}
      </Painel>

      {liberando ? (
        <FormLiberacao
          cliente={liberando}
          hoje={hoje}
          aoFechar={() => setLiberando(null)}
          aoSalvar={() => {
            setLiberando(null);
            avisar('Liberação temporária concedida.');
            avisarMudanca();
            consulta.recarregar();
          }}
        />
      ) : null}
    </Pagina>
  );
}

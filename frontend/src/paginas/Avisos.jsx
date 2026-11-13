import { useState } from 'react';
import { MODO_DEMO, api } from '../api/index.js';
import { EstadoDeCarga, Etiqueta, Nota, Pagina, Painel, Segmentos, Tabela, Vazio } from '../componentes/base.jsx';
import { dataHora } from '../lib/formatos.js';
import { useDados } from '../lib/hooks.js';
import { COR_TIPO_AVISO } from '../lib/rotulos.js';
import { ROTULO_TIPO_AVISO } from '../regras/avisos.js';

export default function Avisos() {
  const consulta = useDados(() => api.avisos.listar(), []);
  const [tipo, setTipo] = useState('');

  const todos = consulta.dados || [];
  const contar = (t) => todos.filter((a) => a.tipo === t).length;
  const visiveis = todos.filter((a) => !tipo || a.tipo === tipo);

  return (
    <Pagina
      titulo="Avisos"
      descricao="Régua de cobrança: lembrete antes do vencimento, avisos de atraso em 1, 7, 15, 30, 45, 60 e 90 dias, aviso de bloqueio e de regularização."
    >
      <Nota>
        {MODO_DEMO
          ? 'No modo demonstração nenhum aviso é enviado: cada um fica registrado aqui com o texto que seria enviado ao cliente.'
          : 'Cada aviso fica registrado aqui. Quando o envio por e-mail está ligado na configuração do servidor, a coluna Envio mostra se a mensagem saiu.'}
      </Nota>

      <Painel>
        <div className="filtros">
          <Segmentos
            rotulo="Filtrar por tipo de aviso"
            valor={tipo}
            aoMudar={setTipo}
            opcoes={[
              { valor: '', texto: 'Todos', qtd: todos.length },
              { valor: 'Lembrete', texto: 'Lembretes', qtd: contar('Lembrete') },
              { valor: 'Atraso', texto: 'Atrasos', qtd: contar('Atraso') },
              { valor: 'Bloqueio', texto: 'Bloqueios', qtd: contar('Bloqueio') },
              { valor: 'Regularizacao', texto: 'Regularizações', qtd: contar('Regularizacao') },
              { valor: 'Liberacao', texto: 'Liberações', qtd: contar('Liberacao') },
            ]}
          />
        </div>
        {consulta.dados ? (
          <Tabela
            legenda="Avisos emitidos"
            linhas={visiveis}
            vazio={<Vazio titulo="Nenhum aviso nesta lista">Os avisos são gerados pela rotina diária, conforme os vencimentos.</Vazio>}
            colunas={[
              { id: 'quando', titulo: 'Emitido em', celula: (a) => <span className="num nowrap">{dataHora(a.criadoEm)}</span> },
              {
                id: 'cliente',
                titulo: 'Cliente',
                celula: (a) => (
                  <a className="link-linha" href={`#cliente-${a.clienteId}`}>
                    {a.clienteNome}
                  </a>
                ),
              },
              { id: 'tipo', titulo: 'Tipo', celula: (a) => <Etiqueta cor={COR_TIPO_AVISO[a.tipo]}>{ROTULO_TIPO_AVISO[a.tipo]}</Etiqueta> },
              {
                id: 'mensagem',
                titulo: 'Mensagem',
                celula: (a) => (
                  <div className="celula-dupla" style={{ maxWidth: '62ch' }}>
                    <span className="forte">{a.assunto}</span>
                    <small style={{ whiteSpace: 'normal' }}>{a.mensagem}</small>
                  </div>
                ),
              },
              {
                id: 'envio',
                titulo: 'Envio',
                celula: (a) => (a.enviado ? <Etiqueta cor="verde">E-mail enviado</Etiqueta> : <Etiqueta>Registrado no sistema</Etiqueta>),
              },
            ]}
          />
        ) : (
          <div className="painel-corpo">
            <EstadoDeCarga consulta={consulta} />
          </div>
        )}
      </Painel>
    </Pagina>
  );
}

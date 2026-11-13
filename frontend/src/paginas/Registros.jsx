import { useState } from 'react';
import { api } from '../api/index.js';
import { CampoBusca, EstadoDeCarga, Pagina, Painel, Tabela, Vazio } from '../componentes/base.jsx';
import { dataHora } from '../lib/formatos.js';
import { useDados } from '../lib/hooks.js';
import { ROTULO_ACAO } from '../lib/rotulos.js';

export default function Registros() {
  const consulta = useDados(() => api.registros.listar(), []);
  const [busca, setBusca] = useState('');

  const termo = busca.trim().toLowerCase();
  const visiveis = (consulta.dados || []).filter(
    (r) =>
      !termo ||
      (ROTULO_ACAO[r.acao] || r.acao).toLowerCase().includes(termo) ||
      (r.usuario || '').toLowerCase().includes(termo) ||
      (r.detalhes || '').toLowerCase().includes(termo),
  );

  return (
    <Pagina
      titulo="Registro de acessos"
      descricao="Quem entrou no sistema e o que foi alterado: pagamentos, liberações, mudanças de regra e mudanças automáticas de semáforo."
    >
      <Painel>
        <div className="filtros">
          <CampoBusca valor={busca} aoMudar={setBusca} rotulo="Buscar por usuário, ação ou detalhe" />
        </div>
        {consulta.dados ? (
          <Tabela
            legenda="Registro de acessos e alterações"
            linhas={visiveis}
            vazio={<Vazio titulo="Nenhum registro encontrado">Mude o termo da busca.</Vazio>}
            colunas={[
              { id: 'quando', titulo: 'Data e hora', celula: (r) => <span className="num nowrap">{dataHora(r.dataHora)}</span> },
              { id: 'usuario', titulo: 'Usuário', celula: (r) => (r.usuario === 'Sistema' ? <span className="suave">Sistema</span> : r.usuario) },
              { id: 'acao', titulo: 'Ação', celula: (r) => <span className="forte">{ROTULO_ACAO[r.acao] || r.acao}</span> },
              { id: 'detalhes', titulo: 'Detalhes', celula: (r) => <div className="texto-quebra" style={{ maxWidth: '70ch' }}>{r.detalhes || ''}</div> },
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

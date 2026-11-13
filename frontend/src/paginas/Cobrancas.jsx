import { useState } from 'react';
import { api } from '../api/index.js';
import { CampoBusca, EstadoDeCarga, Pagina, Painel, Segmentos } from '../componentes/base.jsx';
import { TabelaCobrancas } from '../componentes/TabelaCobrancas.jsx';
import { moeda, plural } from '../lib/formatos.js';
import { navegar, useDados } from '../lib/hooks.js';

const SITUACAO_DA_ROTA = { vencidas: 'Vencida', abertas: 'EmAberto', pagas: 'Paga', canceladas: 'Cancelada' };
const ROTA_DA_SITUACAO = { Vencida: 'vencidas', EmAberto: 'abertas', Paga: 'pagas', Cancelada: 'canceladas' };

export default function Cobrancas({ parametro }) {
  const consulta = useDados(() => api.cobrancas.listar(), []);
  const [busca, setBusca] = useState('');

  const situacao = SITUACAO_DA_ROTA[parametro] || '';
  const todas = consulta.dados || [];
  const contar = (s) => todas.filter((c) => c.situacao === s).length;
  const termo = busca.trim().toLowerCase();
  const visiveis = todas
    .filter((c) => !situacao || c.situacao === situacao)
    .filter((c) => !termo || c.clienteNome.toLowerCase().includes(termo) || c.numero.toLowerCase().includes(termo));

  const emAberto = visiveis.filter((c) => c.status === 'Aberta');
  const totalAtualizado = emAberto.reduce((soma, c) => soma + c.valorAtualizado, 0);

  return (
    <Pagina
      titulo="Cobranças"
      descricao="Honorários mensais de todos os contratos. Multa e juros são calculados só para mostrar o valor atualizado da pendência."
    >
      <Painel>
        <div className="filtros">
          <CampoBusca valor={busca} aoMudar={setBusca} rotulo="Buscar por cliente ou número" />
          <Segmentos
            rotulo="Filtrar por situação"
            valor={situacao}
            aoMudar={(valor) => navegar(valor ? `cobrancas-${ROTA_DA_SITUACAO[valor]}` : 'cobrancas')}
            opcoes={[
              { valor: '', texto: 'Todas', qtd: todas.length },
              { valor: 'Vencida', texto: 'Vencidas', qtd: contar('Vencida') },
              { valor: 'EmAberto', texto: 'Em aberto', qtd: contar('EmAberto') },
              { valor: 'Paga', texto: 'Pagas', qtd: contar('Paga') },
              { valor: 'Cancelada', texto: 'Canceladas', qtd: contar('Cancelada') },
            ]}
          />
        </div>
        {consulta.dados ? (
          <>
            <TabelaCobrancas cobrancas={visiveis} aoMudar={consulta.recarregar} />
            {visiveis.length > 0 ? (
              <div className="painel-corpo secundario" style={{ borderTop: '1px solid var(--linha)' }}>
                {plural(visiveis.length, 'cobrança', 'cobranças')} na lista.
                {emAberto.length > 0 ? ` ${plural(emAberto.length, 'pendente soma', 'pendentes somam')} ${moeda(totalAtualizado)} em valores atualizados.` : ''}
              </div>
            ) : null}
          </>
        ) : (
          <div className="painel-corpo">
            <EstadoDeCarga consulta={consulta} />
          </div>
        )}
      </Painel>
    </Pagina>
  );
}

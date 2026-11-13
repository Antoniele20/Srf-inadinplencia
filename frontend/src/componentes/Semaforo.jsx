// O semáforo de inadimplência: Verde (em dia), Amarelo (em atraso), Vermelho (bloqueado).
// A cor nunca aparece sozinha: sempre há um texto ao lado dizendo a situação.
import { dataCurta, plural } from '../lib/formatos.js';

const CLASSE = { Verde: 'verde', Amarelo: 'amarelo', Vermelho: 'vermelho' };

/** Semáforo compacto de três lâmpadas, usado nas linhas de tabela. */
export function Semaforo({ status }) {
  return (
    <span className="semaforo" role="img" aria-label={`Semáforo ${status ? status.toLowerCase() : 'apagado'}`}>
      <i className={`lampada vermelho ${status === 'Vermelho' ? 'acesa' : ''}`} />
      <i className={`lampada amarelo ${status === 'Amarelo' ? 'acesa' : ''}`} />
      <i className={`lampada verde ${status === 'Verde' ? 'acesa' : ''}`} />
    </span>
  );
}

/** Semáforo vertical grande. `acesos`: lista de status com a lâmpada ligada. */
export function Poste({ acesos }) {
  return (
    <span className="poste" role="img" aria-label={`Semáforo: ${acesos.join(', ').toLowerCase()}`}>
      <i className={`farol vermelho ${acesos.includes('Vermelho') ? 'aceso' : ''}`} />
      <i className={`farol amarelo ${acesos.includes('Amarelo') ? 'aceso' : ''}`} />
      <i className={`farol verde ${acesos.includes('Verde') ? 'aceso' : ''}`} />
    </span>
  );
}

/** Texto curto da situação operacional de um cliente. */
export function textoDaSituacao(cliente) {
  if (!cliente.ativo) return 'Inativo';
  if (cliente.status === 'Verde') return 'Em dia';
  if (cliente.status === 'Amarelo') return 'Em atraso';
  if (cliente.liberacaoAte) return `Liberado até ${dataCurta(cliente.liberacaoAte)}`;
  return 'Bloqueado';
}

/** Semáforo + situação por extenso. */
export function SeloStatus({ cliente }) {
  return (
    <span className="selo">
      <Semaforo status={cliente.ativo ? cliente.status : null} />
      <span className={`selo-texto ${cliente.ativo ? CLASSE[cliente.status] : 'suave'}`}>{textoDaSituacao(cliente)}</span>
    </span>
  );
}

/** Frase que explica o atraso: "12 dias, bloqueia em 19 dias". */
export function textoDoAtraso(cliente) {
  if (cliente.diasAtraso === 0) return 'Sem atraso';
  const base = plural(cliente.diasAtraso, 'dia', 'dias');
  if (cliente.status === 'Amarelo' && cliente.diasAteBloqueio !== null) {
    return `${base}, bloqueia em ${plural(cliente.diasAteBloqueio, 'dia', 'dias')}`;
  }
  return base;
}

// Utilitários de data.
// Datas "puras" (vencimento, competência, pagamento) trafegam como texto 'AAAA-MM-DD',
// igual ao DateOnly do back-end. Assim nenhum fuso horário desloca um vencimento.

const DIA_MS = 86400000;

function doisDigitos(n) {
  return String(n).padStart(2, '0');
}

/** Converte 'AAAA-MM-DD' em Date (meia-noite UTC). */
export function paraData(iso) {
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** Converte Date (UTC) em 'AAAA-MM-DD'. */
export function paraISO(data) {
  return data.toISOString().slice(0, 10);
}

/** Data de hoje no relógio do usuário, como 'AAAA-MM-DD'. */
export function hojeISO(agora = new Date()) {
  return `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`;
}

export function somarDias(iso, dias) {
  return paraISO(new Date(paraData(iso).getTime() + dias * DIA_MS));
}

/** Soma meses mantendo o dia; se o mês de destino for mais curto, usa o último dia dele. */
export function somarMeses(iso, meses) {
  const data = paraData(iso);
  const dia = data.getUTCDate();
  const alvo = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimoDia));
  return paraISO(alvo);
}

export function primeiroDiaDoMes(iso) {
  return `${String(iso).slice(0, 7)}-01`;
}

/** Quantidade de dias de `de` até `ate` (negativo se `ate` for anterior). */
export function diasEntre(de, ate) {
  return Math.round((paraData(ate).getTime() - paraData(de).getTime()) / DIA_MS);
}

export function montarData(ano, mes, dia) {
  return `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
}

export function partes(iso) {
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-').map(Number);
  return { ano, mes, dia };
}

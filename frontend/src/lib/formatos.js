// Formatação para exibição (pt-BR) e validação de CPF/CNPJ.
import { partes } from './datas.js';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatoNumero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

export function moeda(valor) {
  return formatoMoeda.format(Number(valor) || 0);
}

/** R$ 12,5 mil / R$ 1,2 mi: usado só em eixos de gráfico. */
export function moedaCompacta(valor) {
  const v = Number(valor) || 0;
  if (Math.abs(v) >= 1000000) return `R$ ${formatoNumero.format(Math.round(v / 100000) / 10)} mi`;
  if (Math.abs(v) >= 1000) return `R$ ${formatoNumero.format(Math.round(v / 100) / 10)} mil`;
  return `R$ ${formatoNumero.format(Math.round(v))}`;
}

export function numero(valor) {
  return formatoNumero.format(Number(valor) || 0);
}

/** 'AAAA-MM-DD' -> 'DD/MM/AAAA'. */
export function data(iso) {
  if (!iso) return '';
  const { ano, mes, dia } = partes(iso);
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

/** 'AAAA-MM-DD' -> 'DD/MM'. */
export function dataCurta(iso) {
  if (!iso) return '';
  const { mes, dia } = partes(iso);
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
}

/** 'AAAA-MM-01' -> 'nov/2026'. */
export function competencia(iso) {
  if (!iso) return '';
  const { ano, mes } = partes(iso);
  return `${MESES[mes - 1]}/${ano}`;
}

/** 'AAAA-MM' -> 'nov'. */
export function mesCurto(anoMes) {
  const mes = Number(String(anoMes).slice(5, 7));
  return MESES[mes - 1] || '';
}

/** Data e hora (ISO com fuso) -> 'DD/MM/AAAA HH:MM' no relógio do usuário. */
export function dataHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function plural(quantidade, singular, pluralTexto) {
  return `${quantidade} ${quantidade === 1 ? singular : pluralTexto}`;
}

export function somenteDigitos(texto) {
  return String(texto || '').replace(/\D/g, '');
}

/** Aplica a máscara de CPF (11 dígitos) ou CNPJ (14 dígitos). */
export function documento(texto) {
  const d = somenteDigitos(texto);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return String(texto || '');
}

function digitoVerificador(digitos, pesos) {
  const soma = digitos.reduce((total, d, i) => total + d * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cpfValido(texto) {
  const d = somenteDigitos(texto);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const n = d.split('').map(Number);
  const dv1 = digitoVerificador(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = digitoVerificador(n.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return dv1 === n[9] && dv2 === n[10];
}

export function cnpjValido(texto) {
  const d = somenteDigitos(texto);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const n = d.split('').map(Number);
  const dv1 = digitoVerificador(n.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = digitoVerificador(n.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return dv1 === n[12] && dv2 === n[13];
}

export function documentoValido(texto) {
  const d = somenteDigitos(texto);
  return d.length === 11 ? cpfValido(d) : d.length === 14 ? cnpjValido(d) : false;
}

export function emailValido(texto) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(texto || '').trim());
}

/** Converte texto digitado ('1.234,56' ou '1234.56') em número. */
export function lerNumero(texto) {
  if (typeof texto === 'number') return texto;
  const limpo = String(texto || '').trim().replace(/[R$\s]/g, '');
  if (!limpo) return NaN;
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  return Number(normalizado);
}

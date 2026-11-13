// Textos da régua de cobrança. Espelha Dominio/Regras/ModelosDeAviso.cs no back-end.
import { competencia as formatarCompetencia, data, moeda, plural } from '../lib/formatos.js';

export const TIPOS_AVISO = Object.freeze({
  LEMBRETE: 'Lembrete',
  ATRASO: 'Atraso',
  BLOQUEIO: 'Bloqueio',
  REGULARIZACAO: 'Regularizacao',
  LIBERACAO: 'Liberacao',
});

export const ROTULO_TIPO_AVISO = Object.freeze({
  Lembrete: 'Lembrete de vencimento',
  Atraso: 'Aviso de atraso',
  Bloqueio: 'Bloqueio operacional',
  Regularizacao: 'Regularização',
  Liberacao: 'Liberação temporária',
});

const ASSINATURA = 'SRF Serviços de Advocacia Ltda.';

/**
 * Monta assunto e mensagem de um aviso.
 * `d`: { cliente, numero, competencia, vencimento, valor, dias, valorAtualizado, diasParaBloqueio, dataFim, faltam }
 */
export function modeloDeAviso(tipo, d) {
  switch (tipo) {
    case TIPOS_AVISO.LEMBRETE: {
      const quando = d.faltam === 0 ? 'vence hoje' : `vence em ${plural(d.faltam, 'dia', 'dias')}, em ${data(d.vencimento)}`;
      return {
        assunto: `Lembrete de vencimento: honorários de ${formatarCompetencia(d.competencia)}`,
        mensagem:
          `Prezado(a) ${d.cliente}, a cobrança ${d.numero}, no valor de ${moeda(d.valor)}, ${quando}. ` +
          `Se o pagamento já foi feito, desconsidere este aviso. ${ASSINATURA}`,
      };
    }
    case TIPOS_AVISO.ATRASO:
      return {
        assunto: `Cobrança ${d.numero} em atraso há ${plural(d.dias, 'dia', 'dias')}`,
        mensagem:
          `Prezado(a) ${d.cliente}, a cobrança ${d.numero}, vencida em ${data(d.vencimento)}, continua em aberto. ` +
          `Valor atualizado com multa e juros: ${moeda(d.valorAtualizado)}. ` +
          `Acima de ${d.diasParaBloqueio} dias de atraso, novas solicitações ficam suspensas até a regularização. ${ASSINATURA}`,
      };
    case TIPOS_AVISO.BLOQUEIO:
      return {
        assunto: 'Atendimento suspenso por inadimplência',
        mensagem:
          `Prezado(a) ${d.cliente}, há débito vencido há mais de ${d.diasParaBloqueio} dias. ` +
          `Novas solicitações e aberturas de processo estão suspensas até a regularização. ` +
          `Valor atualizado: ${moeda(d.valorAtualizado)}. ${ASSINATURA}`,
      };
    case TIPOS_AVISO.REGULARIZACAO:
      return {
        assunto: 'Pagamento confirmado e atendimento liberado',
        mensagem:
          `Prezado(a) ${d.cliente}, confirmamos a regularização dos honorários em atraso. ` +
          `O atendimento segue normalmente. ${ASSINATURA}`,
      };
    case TIPOS_AVISO.LIBERACAO:
      return {
        assunto: `Liberação temporária até ${data(d.dataFim)}`,
        mensagem:
          `Prezado(a) ${d.cliente}, o atendimento foi liberado em caráter excepcional até ${data(d.dataFim)}, ` +
          `enquanto a renegociação é concluída. Os débitos em aberto permanecem devidos. ${ASSINATURA}`,
      };
    default:
      return { assunto: 'Aviso', mensagem: '' };
  }
}

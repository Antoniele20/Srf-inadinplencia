namespace SRF.Inadimplencia.Api.Dominio.Regras;

/// <summary>Régua de cobrança: quando emitir lembretes e avisos de atraso.</summary>
public static class ReguaDeCobranca
{
    /// <summary>Dias de atraso em que a régua emite um novo aviso.</summary>
    public static readonly int[] MarcosDeAtraso = { 1, 7, 15, 30, 45, 60, 90 };

    /// <summary>Maior marco já alcançado pelo atraso (nulo se ainda não há atraso).</summary>
    public static int? MarcoDeAtraso(int diasAtraso)
    {
        int? marco = null;
        foreach (var m in MarcosDeAtraso)
        {
            if (diasAtraso >= m) marco = m;
        }
        return marco;
    }

    /// <summary>O lembrete é emitido da antecedência configurada até o dia do vencimento.</summary>
    public static bool DeveLembrarVencimento(DateOnly vencimento, DateOnly hoje, int diasAvisoPreVencimento)
    {
        var faltam = vencimento.DayNumber - hoje.DayNumber;
        return faltam >= 0 && faltam <= diasAvisoPreVencimento;
    }
}

public readonly record struct VencimentoDevido(DateOnly Competencia, DateOnly DataVencimento);

public static class GeradorDeVencimentos
{
    /// <summary>A parcela de um mês é gerada quando faltam até 10 dias para o mês começar.</summary>
    public const int HorizonteDias = 10;

    /// <summary>
    /// Vencimentos que um contrato deve ter gerado até hoje (mais o horizonte).
    /// Uma parcela por mês de competência, no dia de vencimento do contrato,
    /// a partir do primeiro vencimento igual ou posterior ao início do contrato.
    /// </summary>
    public static List<VencimentoDevido> Devidos(
        bool contratoAtivo,
        DateOnly dataInicio,
        DateOnly? dataFim,
        int diaVencimento,
        DateOnly hoje,
        int horizonteDias = HorizonteDias)
    {
        var lista = new List<VencimentoDevido>();
        if (!contratoAtivo) return lista;

        var limite = hoje.AddDays(horizonteDias);
        var ultimoMes = new DateOnly(limite.Year, limite.Month, 1);
        var cursor = new DateOnly(dataInicio.Year, dataInicio.Month, 1);

        while (cursor <= ultimoMes)
        {
            var dia = Math.Min(diaVencimento, DateTime.DaysInMonth(cursor.Year, cursor.Month));
            var vencimento = new DateOnly(cursor.Year, cursor.Month, dia);
            var dentroDoContrato = vencimento >= dataInicio && (dataFim is null || vencimento <= dataFim);
            if (dentroDoContrato) lista.Add(new VencimentoDevido(cursor, vencimento));
            cursor = cursor.AddMonths(1);
        }
        return lista;
    }
}

public static class Numeracao
{
    public static string DaCobranca(DateOnly vencimento, int id) => $"COB-{vencimento.Year}-{id:D4}";

    public static string DoContrato(DateOnly inicio, int id) => $"CT-{inicio.Year}-{id:D3}";

    /// <summary>Situação de exibição de uma cobrança.</summary>
    public static SituacaoCobranca SituacaoDaCobranca(StatusParcela status, DateOnly vencimento, DateOnly hoje)
    {
        if (status == StatusParcela.Paga) return SituacaoCobranca.Paga;
        if (status == StatusParcela.Cancelada) return SituacaoCobranca.Cancelada;
        return vencimento < hoje ? SituacaoCobranca.Vencida : SituacaoCobranca.EmAberto;
    }
}

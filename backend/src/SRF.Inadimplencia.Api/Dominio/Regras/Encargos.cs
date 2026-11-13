namespace SRF.Inadimplencia.Api.Dominio.Regras;

/// <summary>Parâmetros das regras, editáveis em Configurações (perfil Financeiro/Admin).</summary>
public sealed record ConfigRegras(
    decimal MultaPercentual,
    decimal JurosDiarioPercentual,
    int DiasParaBloqueio,
    int DiasAvisoPreVencimento)
{
    /// <summary>Valores iniciais: multa 2%, juros 0,033% ao dia (cerca de 1% ao mês), bloqueio após 30 dias.</summary>
    public static readonly ConfigRegras Padrao = new(2m, 0.033m, 30, 3);
}

public readonly record struct ResultadoEncargos(int DiasAtraso, decimal Multa, decimal Juros, decimal ValorAtualizado);

/// <summary>
/// Cálculo de multa e juros de mora. Serve apenas para exibir o saldo devedor atualizado:
/// o sistema não gera boleto nem processa pagamento.
/// Espelho de frontend/src/regras/calculos.js (mesmos casos de teste nos dois lados).
/// </summary>
public static class CalculadoraDeEncargos
{
    /// <summary>Arredonda para centavos (0,5 centavo sobe).</summary>
    public static decimal Arredondar(decimal valor) => Math.Round(valor, 2, MidpointRounding.AwayFromZero);

    /// <summary>Dias corridos de atraso de um vencimento em relação à data-base (nunca negativo).</summary>
    public static int DiasDeAtraso(DateOnly vencimento, DateOnly dataBase) =>
        Math.Max(0, dataBase.DayNumber - vencimento.DayNumber);

    /// <summary>
    /// Multa: percentual único, a partir do 1º dia de atraso.
    /// Juros: percentual ao dia (juros simples) vezes os dias de atraso.
    /// </summary>
    public static ResultadoEncargos Calcular(decimal valorOriginal, DateOnly vencimento, DateOnly dataBase, ConfigRegras config)
    {
        var principal = Arredondar(valorOriginal);
        var dias = DiasDeAtraso(vencimento, dataBase);
        if (dias == 0) return new ResultadoEncargos(0, 0m, 0m, principal);

        var multa = Arredondar(principal * config.MultaPercentual / 100m);
        var juros = Arredondar(principal * config.JurosDiarioPercentual / 100m * dias);
        return new ResultadoEncargos(dias, multa, juros, Arredondar(principal + multa + juros));
    }
}

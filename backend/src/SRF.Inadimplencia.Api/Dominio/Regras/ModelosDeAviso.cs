using System.Globalization;

namespace SRF.Inadimplencia.Api.Dominio.Regras;

/// <summary>Dados que alimentam os textos da régua de cobrança.</summary>
public sealed record DadosDoAviso
{
    public string Cliente { get; init; } = "";
    public string Numero { get; init; } = "";
    public DateOnly Competencia { get; init; }
    public DateOnly Vencimento { get; init; }
    public decimal Valor { get; init; }
    public int Dias { get; init; }
    public decimal ValorAtualizado { get; init; }
    public int DiasParaBloqueio { get; init; }
    public DateOnly DataFim { get; init; }
    public int Faltam { get; init; }
}

public readonly record struct TextoDoAviso(string Assunto, string Mensagem);

/// <summary>Textos da régua de cobrança. Espelho de frontend/src/regras/avisos.js.</summary>
public static class ModelosDeAviso
{
    private const string Assinatura = "SRF Serviços de Advocacia Ltda.";
    private static readonly string[] Meses = { "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez" };

    /// <summary>R$ 5.000,00 (separador de milhar e decimal do Brasil, sem depender da cultura do servidor).</summary>
    public static string Moeda(decimal valor)
    {
        var texto = valor.ToString("N2", CultureInfo.InvariantCulture); // 5,000.00
        var brasileiro = texto.Replace(',', '#').Replace('.', ',').Replace('#', '.');
        return "R$ " + brasileiro;
    }

    public static string Data(DateOnly data) => data.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

    public static string Competencia(DateOnly data) => $"{Meses[data.Month - 1]}/{data.Year}";

    private static string Plural(int quantidade, string singular, string plural) =>
        $"{quantidade} {(quantidade == 1 ? singular : plural)}";

    public static TextoDoAviso Montar(TipoAviso tipo, DadosDoAviso d)
    {
        switch (tipo)
        {
            case TipoAviso.Lembrete:
            {
                var quando = d.Faltam == 0
                    ? "vence hoje"
                    : $"vence em {Plural(d.Faltam, "dia", "dias")}, em {Data(d.Vencimento)}";
                return new TextoDoAviso(
                    $"Lembrete de vencimento: honorários de {Competencia(d.Competencia)}",
                    $"Prezado(a) {d.Cliente}, a cobrança {d.Numero}, no valor de {Moeda(d.Valor)}, {quando}. " +
                    $"Se o pagamento já foi feito, desconsidere este aviso. {Assinatura}");
            }
            case TipoAviso.Atraso:
                return new TextoDoAviso(
                    $"Cobrança {d.Numero} em atraso há {Plural(d.Dias, "dia", "dias")}",
                    $"Prezado(a) {d.Cliente}, a cobrança {d.Numero}, vencida em {Data(d.Vencimento)}, continua em aberto. " +
                    $"Valor atualizado com multa e juros: {Moeda(d.ValorAtualizado)}. " +
                    $"Acima de {d.DiasParaBloqueio} dias de atraso, novas solicitações ficam suspensas até a regularização. {Assinatura}");
            case TipoAviso.Bloqueio:
                return new TextoDoAviso(
                    "Atendimento suspenso por inadimplência",
                    $"Prezado(a) {d.Cliente}, há débito vencido há mais de {d.DiasParaBloqueio} dias. " +
                    "Novas solicitações e aberturas de processo estão suspensas até a regularização. " +
                    $"Valor atualizado: {Moeda(d.ValorAtualizado)}. {Assinatura}");
            case TipoAviso.Regularizacao:
                return new TextoDoAviso(
                    "Pagamento confirmado e atendimento liberado",
                    $"Prezado(a) {d.Cliente}, confirmamos a regularização dos honorários em atraso. " +
                    $"O atendimento segue normalmente. {Assinatura}");
            case TipoAviso.Liberacao:
                return new TextoDoAviso(
                    $"Liberação temporária até {Data(d.DataFim)}",
                    $"Prezado(a) {d.Cliente}, o atendimento foi liberado em caráter excepcional até {Data(d.DataFim)}, " +
                    $"enquanto a renegociação é concluída. Os débitos em aberto permanecem devidos. {Assinatura}");
            default:
                return new TextoDoAviso("Aviso", "");
        }
    }
}

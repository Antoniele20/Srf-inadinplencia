namespace SRF.Inadimplencia.Api.Dominio.Regras;

public readonly record struct ParcelaEmAberto(decimal ValorOriginal, DateOnly DataVencimento);

public readonly record struct VigenciaLiberacao(DateOnly DataFim, bool Revogada);

/// <summary>Situação financeira de um cliente em uma data, derivada das parcelas em aberto e das liberações.</summary>
public sealed record SituacaoDoCliente(
    StatusCliente Status,
    int DiasAtraso,
    string FaixaAtraso,
    DateOnly? VencimentoMaisAntigo,
    int ParcelasVencidas,
    decimal ValorVencido,
    decimal ValorMulta,
    decimal ValorJuros,
    decimal ValorEncargos,
    decimal ValorAtualizado,
    decimal ValorAVencer,
    bool Bloqueado,
    DateOnly? LiberacaoAte,
    int? DiasAteBloqueio);

/// <summary>
/// Semáforo de inadimplência e bloqueio operacional.
/// Verde = em dia; Amarelo = atraso de 1 dia até o prazo de bloqueio; Vermelho = acima do prazo.
/// Bloqueado = Vermelho sem liberação temporária vigente.
/// Espelho de frontend/src/regras/calculos.js.
/// </summary>
public static class AvaliadorDeSituacao
{
    public static readonly string[] Faixas = { "Em dia", "1 a 30 dias", "31 a 60 dias", "Acima de 60 dias" };

    public static StatusCliente Classificar(int diasAtraso, int diasParaBloqueio)
    {
        if (diasAtraso <= 0) return StatusCliente.Verde;
        return diasAtraso > diasParaBloqueio ? StatusCliente.Vermelho : StatusCliente.Amarelo;
    }

    public static string FaixaDeAtraso(int diasAtraso)
    {
        if (diasAtraso <= 0) return Faixas[0];
        if (diasAtraso <= 30) return Faixas[1];
        if (diasAtraso <= 60) return Faixas[2];
        return Faixas[3];
    }

    /// <summary>Vale enquanto não for revogada e a data final não tiver passado.</summary>
    public static bool LiberacaoAtiva(VigenciaLiberacao liberacao, DateOnly hoje) =>
        !liberacao.Revogada && liberacao.DataFim >= hoje;

    public static SituacaoDoCliente Avaliar(
        IEnumerable<ParcelaEmAberto> parcelasAbertas,
        IEnumerable<VigenciaLiberacao> liberacoes,
        ConfigRegras config,
        DateOnly hoje)
    {
        var diasAtraso = 0;
        var parcelasVencidas = 0;
        var valorVencido = 0m;
        var valorMulta = 0m;
        var valorJuros = 0m;
        var valorAVencer = 0m;
        DateOnly? vencimentoMaisAntigo = null;

        foreach (var parcela in parcelasAbertas)
        {
            var encargos = CalculadoraDeEncargos.Calcular(parcela.ValorOriginal, parcela.DataVencimento, hoje, config);
            if (encargos.DiasAtraso > 0)
            {
                parcelasVencidas++;
                valorVencido += parcela.ValorOriginal;
                valorMulta += encargos.Multa;
                valorJuros += encargos.Juros;
                if (encargos.DiasAtraso > diasAtraso)
                {
                    diasAtraso = encargos.DiasAtraso;
                    vencimentoMaisAntigo = parcela.DataVencimento;
                }
            }
            else
            {
                valorAVencer += parcela.ValorOriginal;
            }
        }

        var status = Classificar(diasAtraso, config.DiasParaBloqueio);

        DateOnly? liberacaoAte = null;
        foreach (var liberacao in liberacoes)
        {
            if (LiberacaoAtiva(liberacao, hoje) && (liberacaoAte is null || liberacao.DataFim > liberacaoAte))
                liberacaoAte = liberacao.DataFim;
        }
        // Liberação só tem efeito para quem está em Vermelho.
        if (status != StatusCliente.Vermelho) liberacaoAte = null;

        var arredondar = CalculadoraDeEncargos.Arredondar;
        return new SituacaoDoCliente(
            Status: status,
            DiasAtraso: diasAtraso,
            FaixaAtraso: FaixaDeAtraso(diasAtraso),
            VencimentoMaisAntigo: vencimentoMaisAntigo,
            ParcelasVencidas: parcelasVencidas,
            ValorVencido: arredondar(valorVencido),
            ValorMulta: arredondar(valorMulta),
            ValorJuros: arredondar(valorJuros),
            ValorEncargos: arredondar(valorMulta + valorJuros),
            ValorAtualizado: arredondar(valorVencido + valorMulta + valorJuros),
            ValorAVencer: arredondar(valorAVencer),
            Bloqueado: status == StatusCliente.Vermelho && liberacaoAte is null,
            LiberacaoAte: liberacaoAte,
            DiasAteBloqueio: status == StatusCliente.Amarelo ? config.DiasParaBloqueio - diasAtraso + 1 : null);
    }
}

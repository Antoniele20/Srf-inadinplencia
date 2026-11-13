namespace SRF.Inadimplencia.Api.Infraestrutura;

/// <summary>
/// Fonte única de data e hora. As regras de vencimento usam a data de Brasília;
/// os instantes gravados no banco são UTC. Trocar a implementação permite testar com datas fixas.
/// </summary>
public interface IRelogio
{
    /// <summary>Instante atual em UTC, sem frações de segundo (o banco guarda datetime2(0)).</summary>
    DateTime AgoraUtc { get; }

    /// <summary>Data de hoje no horário de Brasília.</summary>
    DateOnly Hoje { get; }

    /// <summary>Data e hora atuais no horário de Brasília (usada para agendar a rotina diária).</summary>
    DateTime AgoraLocal { get; }

    /// <summary>Converte um instante UTC para a data de Brasília.</summary>
    DateOnly DataLocal(DateTime instanteUtc);
}

public sealed class RelogioBrasilia : IRelogio
{
    private static readonly TimeZoneInfo Fuso = ObterFuso();

    private static TimeZoneInfo ObterFuso()
    {
        foreach (var id in new[] { "America/Sao_Paulo", "E. South America Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }
        // Servidor sem banco de fusos: o Brasil não usa horário de verão desde 2019.
        return TimeZoneInfo.CreateCustomTimeZone("BRT", TimeSpan.FromHours(-3), "Brasília", "Brasília");
    }

    public DateTime AgoraUtc
    {
        get
        {
            var agora = DateTime.UtcNow;
            return new DateTime(agora.Ticks - agora.Ticks % TimeSpan.TicksPerSecond, DateTimeKind.Utc);
        }
    }

    public DateOnly Hoje => DataLocal(DateTime.UtcNow);

    public DateTime AgoraLocal => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Fuso);

    public DateOnly DataLocal(DateTime instanteUtc)
    {
        var utc = DateTime.SpecifyKind(instanteUtc, DateTimeKind.Utc);
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(utc, Fuso));
    }
}

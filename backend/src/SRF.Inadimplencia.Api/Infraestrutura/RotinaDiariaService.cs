using SRF.Inadimplencia.Api.Aplicacao.Servicos;

namespace SRF.Inadimplencia.Api.Infraestrutura;

/// <summary>
/// Executa a rotina de inadimplência todo dia em horário de baixo tráfego (RNF05, padrão 01:00 de Brasília).
/// Ao subir, confere se a rotina já rodou hoje; se a API ficou fora do ar na madrugada, ela recupera na hora.
/// Rode UMA instância da API: com várias, cada uma tentaria a rotina (os índices únicos do banco evitam
/// duplicidade, mas o trabalho seria repetido).
/// </summary>
public sealed class RotinaDiariaService : BackgroundService
{
    private readonly IServiceScopeFactory _escopos;
    private readonly IConfiguration _configuracao;
    private readonly IRelogio _relogio;
    private readonly ILogger<RotinaDiariaService> _log;

    public RotinaDiariaService(
        IServiceScopeFactory escopos, IConfiguration configuracao, IRelogio relogio, ILogger<RotinaDiariaService> log)
    {
        _escopos = escopos;
        _configuracao = configuracao;
        _relogio = relogio;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken parada)
    {
        if (!_configuracao.GetValue("Rotina:Habilitada", true))
        {
            _log.LogInformation("Rotina diária desabilitada por configuração (Rotina:Habilitada = false).");
            return;
        }

        var horario = TimeOnly.TryParse(_configuracao["Rotina:Horario"], out var h) ? h : new TimeOnly(1, 0);

        try
        {
            // Dá tempo da API terminar de subir antes de falar com o banco.
            await Task.Delay(TimeSpan.FromSeconds(5), parada);
            await ExecutarSeNecessarioAsync(parada);

            while (!parada.IsCancellationRequested)
            {
                var espera = TempoAteProximaExecucao(horario);
                _log.LogInformation("Próxima execução da rotina diária em {Espera:hh\\:mm\\:ss}.", espera);
                await Task.Delay(espera, parada);
                await ExecutarAsync("Agendada", parada);
            }
        }
        catch (OperationCanceledException)
        {
            // API encerrando.
        }
    }

    private TimeSpan TempoAteProximaExecucao(TimeOnly horario)
    {
        var agora = _relogio.AgoraLocal;
        var proxima = agora.Date + horario.ToTimeSpan();
        if (proxima <= agora) proxima = proxima.AddDays(1);
        var espera = proxima - agora;
        return espera < TimeSpan.FromMinutes(1) ? TimeSpan.FromMinutes(1) : espera;
    }

    private async Task ExecutarSeNecessarioAsync(CancellationToken parada)
    {
        try
        {
            using var escopo = _escopos.CreateScope();
            var rotina = escopo.ServiceProvider.GetRequiredService<ServicoRotina>();
            var ultima = await rotina.DataDaUltimaRotinaAsync(parada);
            if (ultima == _relogio.Hoje) return;
        }
        catch (Exception erro) when (erro is not OperationCanceledException)
        {
            _log.LogError(erro, "Não foi possível conferir a última execução da rotina diária.");
            return;
        }
        await ExecutarAsync("Ao iniciar a API", parada);
    }

    private async Task ExecutarAsync(string origem, CancellationToken parada)
    {
        try
        {
            using var escopo = _escopos.CreateScope();
            var rotina = escopo.ServiceProvider.GetRequiredService<ServicoRotina>();
            var r = await rotina.ProcessarAsync(origem, null, parada);
            _log.LogInformation(
                "Rotina diária ({Origem}): {Geradas} cobranças geradas, {Alterados} mudanças de status, {Avisos} avisos, {Bloqueados} bloqueados.",
                origem, r.ParcelasGeradas, r.ClientesComStatusAlterado, r.AvisosGerados, r.Bloqueados);
        }
        catch (Exception erro) when (erro is not OperationCanceledException)
        {
            // Uma falha não derruba a API nem cancela as próximas execuções.
            _log.LogError(erro, "Falha na rotina diária ({Origem}).", origem);
        }
    }
}

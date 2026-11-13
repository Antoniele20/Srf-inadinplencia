using SRF.Inadimplencia.Api.Dominio;

namespace SRF.Inadimplencia.Api.Infraestrutura;

/// <summary>
/// Converte exceções em respostas JSON no formato que o front-end espera:
/// { "codigo", "mensagem", "erros" }. Erros inesperados viram 500 sem expor detalhes internos.
/// </summary>
public sealed class TratadorDeErros
{
    private readonly RequestDelegate _proximo;
    private readonly ILogger<TratadorDeErros> _log;

    public TratadorDeErros(RequestDelegate proximo, ILogger<TratadorDeErros> log)
    {
        _proximo = proximo;
        _log = log;
    }

    public async Task InvokeAsync(HttpContext contexto)
    {
        try
        {
            await _proximo(contexto);
        }
        catch (ErroDeNegocio erro)
        {
            if (contexto.Response.HasStarted) throw;
            contexto.Response.StatusCode = erro.Status;
            await contexto.Response.WriteAsJsonAsync(new
            {
                codigo = erro.Codigo,
                mensagem = erro.Message,
                erros = erro.Erros
            });
        }
        catch (OperationCanceledException) when (contexto.RequestAborted.IsCancellationRequested)
        {
            // O navegador desistiu da requisição: nada a responder.
        }
        catch (Exception erro)
        {
            _log.LogError(erro, "Erro inesperado em {Metodo} {Caminho}", contexto.Request.Method, contexto.Request.Path);
            if (contexto.Response.HasStarted) throw;
            contexto.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await contexto.Response.WriteAsJsonAsync(new
            {
                codigo = "ERRO_INTERNO",
                mensagem = "O servidor não conseguiu concluir a operação. Tente de novo em instantes."
            });
        }
    }
}

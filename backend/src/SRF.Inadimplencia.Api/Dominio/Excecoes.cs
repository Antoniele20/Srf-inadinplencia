namespace SRF.Inadimplencia.Api.Dominio;

/// <summary>
/// Erro esperado, com mensagem pronta para o usuário. O middleware converte em JSON:
/// { "codigo": "...", "mensagem": "...", "erros": { "campo": "mensagem" } }.
/// </summary>
public class ErroDeNegocio : Exception
{
    public int Status { get; }
    public string Codigo { get; }
    public IReadOnlyDictionary<string, string>? Erros { get; }

    public ErroDeNegocio(string mensagem, string codigo = "REGRA_NEGOCIO", int status = 409,
        IReadOnlyDictionary<string, string>? erros = null)
        : base(mensagem)
    {
        Codigo = codigo;
        Status = status;
        Erros = erros;
    }
}

/// <summary>Fábricas dos erros mais comuns, com os mesmos códigos usados pelo front-end.</summary>
public static class Erros
{
    public static ErroDeNegocio Validacao(IReadOnlyDictionary<string, string> erros) =>
        new("Revise os campos destacados.", "VALIDACAO", 400, erros);

    public static ErroDeNegocio NaoEncontrado(string oQue) =>
        new($"{oQue} não encontrado.", "NAO_ENCONTRADO", 404);

    public static ErroDeNegocio Regra(string mensagem, string codigo = "REGRA_NEGOCIO") =>
        new(mensagem, codigo, 409);

    /// <summary>Lança o erro de validação se houver algum campo recusado.</summary>
    public static void ExigirSemErros(Dictionary<string, string> erros)
    {
        if (erros.Count > 0) throw Validacao(erros);
    }
}

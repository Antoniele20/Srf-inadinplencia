namespace SRF.Inadimplencia.Api.Dominio.Regras;

/// <summary>Validação de CPF e CNPJ (dígitos verificadores).</summary>
public static class Documento
{
    public static string SomenteDigitos(string? texto) =>
        new string((texto ?? "").Where(char.IsDigit).ToArray());

    public static bool Valido(string? texto)
    {
        var d = SomenteDigitos(texto);
        return d.Length switch
        {
            11 => CpfValido(d),
            14 => CnpjValido(d),
            _ => false
        };
    }

    public static bool CpfValido(string digitos)
    {
        if (digitos.Length != 11 || digitos.Distinct().Count() == 1) return false;
        var n = digitos.Select(c => c - '0').ToArray();
        var dv1 = DigitoVerificador(n.Take(9).ToArray(), new[] { 10, 9, 8, 7, 6, 5, 4, 3, 2 });
        var dv2 = DigitoVerificador(n.Take(10).ToArray(), new[] { 11, 10, 9, 8, 7, 6, 5, 4, 3, 2 });
        return dv1 == n[9] && dv2 == n[10];
    }

    public static bool CnpjValido(string digitos)
    {
        if (digitos.Length != 14 || digitos.Distinct().Count() == 1) return false;
        var n = digitos.Select(c => c - '0').ToArray();
        var dv1 = DigitoVerificador(n.Take(12).ToArray(), new[] { 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2 });
        var dv2 = DigitoVerificador(n.Take(13).ToArray(), new[] { 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2 });
        return dv1 == n[12] && dv2 == n[13];
    }

    private static int DigitoVerificador(int[] digitos, int[] pesos)
    {
        var soma = 0;
        for (var i = 0; i < digitos.Length; i++) soma += digitos[i] * pesos[i];
        var resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    }

    public static bool EmailValido(string? texto)
    {
        var t = (texto ?? "").Trim();
        if (t.Length == 0 || t.Length > 160 || t.Any(char.IsWhiteSpace)) return false;
        var arroba = t.IndexOf('@');
        if (arroba <= 0 || arroba != t.LastIndexOf('@')) return false;
        var dominio = t[(arroba + 1)..];
        var ponto = dominio.LastIndexOf('.');
        return ponto > 0 && ponto < dominio.Length - 1;
    }
}

using Microsoft.EntityFrameworkCore;

namespace SRF.Inadimplencia.Api.Dados;

/// <summary>
/// Os scripts SQL criam usuários SEM senha (SenhaHash nulo), porque o hash BCrypt só pode ser gerado
/// pela aplicação. Na subida, se Seed:SenhaInicial estiver definida, ela vira a senha de quem ainda não tem.
/// Quem já tem senha nunca é alterado. Em produção, defina a variável Seed__SenhaInicial só na primeira
/// subida, entre com o administrador, troque a senha em Usuários e remova a variável.
/// </summary>
public static class SemeadorDeSenhas
{
    private const int TamanhoMinimo = 8;

    public static async Task ExecutarAsync(IServiceProvider servicos, IConfiguration configuracao, ILogger log)
    {
        var senha = configuracao["Seed:SenhaInicial"];
        if (string.IsNullOrWhiteSpace(senha)) return;

        if (senha.Length < TamanhoMinimo)
        {
            log.LogWarning("Seed:SenhaInicial ignorada: precisa ter pelo menos {Minimo} caracteres.", TamanhoMinimo);
            return;
        }

        try
        {
            using var escopo = servicos.CreateScope();
            var db = escopo.ServiceProvider.GetRequiredService<AppDbContext>();
            var semSenha = await db.Usuarios.Where(u => u.SenhaHash == null).ToListAsync();
            if (semSenha.Count == 0) return;

            foreach (var usuario in semSenha)
            {
                usuario.SenhaHash = BCrypt.Net.BCrypt.HashPassword(senha, 11);
            }
            await db.SaveChangesAsync();
            log.LogInformation("Senha inicial gravada para {Quantidade} usuário(s) sem senha.", semSenha.Count);
        }
        catch (Exception erro)
        {
            // Banco fora do ar ou scripts ainda não executados: a API sobe mesmo assim e /saude mostra o problema.
            log.LogError(erro, "Não foi possível gravar a senha inicial. Confira a conexão e se os scripts SQL foram executados.");
        }
    }
}

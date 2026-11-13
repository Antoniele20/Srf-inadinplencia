using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using SRF.Inadimplencia.Api.Dominio;

namespace SRF.Inadimplencia.Api.Dados;

/// <summary>
/// Mapeamento Entity Framework Core para o banco criado por database/01_criar_banco.sql.
/// O banco é a fonte da estrutura (Database First): o EF não cria nem altera tabelas.
/// </summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Cliente> Clientes => Set<Cliente>();
    public DbSet<Contrato> Contratos => Set<Contrato>();
    public DbSet<Parcela> Parcelas => Set<Parcela>();
    public DbSet<Configuracao> Configuracoes => Set<Configuracao>();
    public DbSet<Aviso> Avisos => Set<Aviso>();
    public DbSet<Liberacao> Liberacoes => Set<Liberacao>();
    public DbSet<Solicitacao> Solicitacoes => Set<Solicitacao>();
    public DbSet<LogAcesso> LogsAcesso => Set<LogAcesso>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Usuario>(e =>
        {
            e.ToTable("Usuarios");
            e.Property(x => x.Nome).HasMaxLength(120).IsRequired();
            e.Property(x => x.Email).HasMaxLength(160).IsRequired();
            e.Property(x => x.SenhaHash).HasMaxLength(100);
            e.Property(x => x.Perfil).HasConversion<string>().HasMaxLength(20).IsUnicode(false);
            e.HasIndex(x => x.Email).IsUnique();
        });

        modelBuilder.Entity<Cliente>(e =>
        {
            e.ToTable("Clientes");
            e.Property(x => x.Nome).HasMaxLength(160).IsRequired();
            e.Property(x => x.Documento).HasMaxLength(14).IsUnicode(false).IsRequired();
            e.Property(x => x.Email).HasMaxLength(160).IsRequired();
            e.Property(x => x.Telefone).HasMaxLength(30);
            e.Property(x => x.Responsavel).HasMaxLength(120);
            e.Property(x => x.Observacoes).HasMaxLength(1000);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(10).IsUnicode(false);
            e.HasIndex(x => x.Documento).IsUnique();
        });

        modelBuilder.Entity<Contrato>(e =>
        {
            e.ToTable("Contratos");
            e.Property(x => x.Descricao).HasMaxLength(200).IsRequired();
            e.Property(x => x.ValorMensal).HasPrecision(12, 2);
            e.HasOne(x => x.Cliente).WithMany(x => x.Contratos).HasForeignKey(x => x.ClienteId);
        });

        modelBuilder.Entity<Parcela>(e =>
        {
            e.ToTable("Parcelas");
            e.Property(x => x.ValorOriginal).HasPrecision(12, 2);
            e.Property(x => x.ValorPago).HasPrecision(12, 2);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(10).IsUnicode(false);
            e.Property(x => x.Observacao).HasMaxLength(500);
            e.HasOne(x => x.Contrato).WithMany(x => x.Parcelas).HasForeignKey(x => x.ContratoId);
            e.HasOne(x => x.BaixadaPor).WithMany().HasForeignKey(x => x.BaixadaPorUsuarioId);
            e.HasIndex(x => new { x.ContratoId, x.Competencia }).IsUnique();
        });

        modelBuilder.Entity<Configuracao>(e =>
        {
            e.ToTable("Configuracoes");
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.MultaPercentual).HasPrecision(5, 2);
            e.Property(x => x.JurosDiarioPercentual).HasPrecision(6, 4);
            e.HasOne(x => x.AtualizadoPor).WithMany().HasForeignKey(x => x.AtualizadoPorUsuarioId);
        });

        modelBuilder.Entity<Aviso>(e =>
        {
            e.ToTable("Avisos");
            e.Property(x => x.Tipo).HasConversion<string>().HasMaxLength(15).IsUnicode(false);
            e.Property(x => x.Canal).HasMaxLength(10).IsUnicode(false);
            e.Property(x => x.Assunto).HasMaxLength(200).IsRequired();
            e.Property(x => x.Mensagem).HasMaxLength(1000).IsRequired();
            e.HasOne(x => x.Cliente).WithMany(x => x.Avisos).HasForeignKey(x => x.ClienteId);
            e.HasOne(x => x.Parcela).WithMany().HasForeignKey(x => x.ParcelaId);
        });

        modelBuilder.Entity<Liberacao>(e =>
        {
            e.ToTable("Liberacoes");
            e.Property(x => x.Motivo).HasMaxLength(500).IsRequired();
            e.HasOne(x => x.Cliente).WithMany(x => x.Liberacoes).HasForeignKey(x => x.ClienteId);
            e.HasOne(x => x.Usuario).WithMany().HasForeignKey(x => x.UsuarioId);
            e.HasOne(x => x.RevogadaPor).WithMany().HasForeignKey(x => x.RevogadaPorUsuarioId);
        });

        modelBuilder.Entity<Solicitacao>(e =>
        {
            e.ToTable("Solicitacoes");
            e.Property(x => x.Tipo).HasConversion<string>().HasMaxLength(20).IsUnicode(false);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(10).IsUnicode(false);
            e.Property(x => x.Descricao).HasMaxLength(1000).IsRequired();
            e.HasOne(x => x.Cliente).WithMany(x => x.Solicitacoes).HasForeignKey(x => x.ClienteId);
            e.HasOne(x => x.Usuario).WithMany().HasForeignKey(x => x.UsuarioId);
        });

        modelBuilder.Entity<LogAcesso>(e =>
        {
            e.ToTable("LogsAcesso");
            e.Property(x => x.Acao).HasMaxLength(40).IsUnicode(false).IsRequired();
            e.Property(x => x.Detalhes).HasMaxLength(500);
            e.Property(x => x.Ip).HasMaxLength(45).IsUnicode(false);
            e.HasOne(x => x.Usuario).WithMany().HasForeignKey(x => x.UsuarioId);
        });

        // Nenhum registro é apagado em cascata: o histórico financeiro é preservado.
        foreach (var fk in modelBuilder.Model.GetEntityTypes().SelectMany(t => t.GetForeignKeys()))
        {
            fk.DeleteBehavior = DeleteBehavior.Restrict;
        }

        // Instantes ficam no banco em UTC (datetime2(0)) e voltam marcados como UTC,
        // para o JSON sair com "Z" e o navegador converter para o horário local.
        var paraUtc = new ValueConverter<DateTime, DateTime>(
            v => v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : v,
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
        var paraUtcNulo = new ValueConverter<DateTime?, DateTime?>(
            v => v.HasValue && v.Value.Kind == DateTimeKind.Local ? v.Value.ToUniversalTime() : v,
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);

        foreach (var entidade in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var propriedade in entidade.GetProperties())
            {
                if (propriedade.ClrType == typeof(DateTime))
                {
                    propriedade.SetValueConverter(paraUtc);
                    propriedade.SetColumnType("datetime2(0)");
                }
                else if (propriedade.ClrType == typeof(DateTime?))
                {
                    propriedade.SetValueConverter(paraUtcNulo);
                    propriedade.SetColumnType("datetime2(0)");
                }
            }
        }
    }
}

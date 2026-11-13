using SRF.Inadimplencia.Api.Dominio;
using SRF.Inadimplencia.Api.Dominio.Regras;

namespace SRF.Inadimplencia.Tests;

/// <summary>
/// Regras de negócio puras. Os casos e os valores esperados são os mesmos de
/// frontend/testes/regras.test.js: se um lado mudar, o outro precisa mudar junto.
/// </summary>
public class RegrasTests
{
    private static readonly ConfigRegras Config = ConfigRegras.Padrao; // multa 2%, juros 0,033% ao dia, bloqueio após 30 dias

    private static DateOnly D(string iso) => DateOnly.Parse(iso);

    [Fact]
    public void Encargos_sem_atraso_nao_tem_multa_nem_juros()
    {
        var r = CalculadoraDeEncargos.Calcular(5000m, D("2026-10-01"), D("2026-10-01"), Config);
        Assert.Equal(new ResultadoEncargos(0, 0m, 0m, 5000m), r);

        var antes = CalculadoraDeEncargos.Calcular(5000m, D("2026-10-10"), D("2026-10-01"), Config);
        Assert.Equal(5000m, antes.ValorAtualizado);
    }

    [Theory]
    [InlineData(5000, "2026-10-01", "2026-10-02", 1, 100, 1.65, 5101.65)]
    [InlineData(5000, "2026-10-01", "2026-11-15", 45, 100, 74.25, 5174.25)]
    [InlineData(12300, "2026-08-28", "2026-11-12", 76, 246, 308.48, 12854.48)]
    public void Encargos_multa_unica_de_2_por_cento_e_juros_de_0033_ao_dia(
        double valor, string vencimento, string hoje, int dias, double multa, double juros, double atualizado)
    {
        var r = CalculadoraDeEncargos.Calcular((decimal)valor, D(vencimento), D(hoje), Config);
        Assert.Equal(dias, r.DiasAtraso);
        Assert.Equal((decimal)multa, r.Multa);
        Assert.Equal((decimal)juros, r.Juros);
        Assert.Equal((decimal)atualizado, r.ValorAtualizado);
    }

    [Fact]
    public void Encargos_usam_as_taxas_configuradas()
    {
        var outra = Config with { MultaPercentual = 10m, JurosDiarioPercentual = 0.1m };
        var r = CalculadoraDeEncargos.Calcular(1000m, D("2026-11-01"), D("2026-11-11"), outra);
        Assert.Equal(new ResultadoEncargos(10, 100m, 10m, 1110m), r);
    }

    [Theory]
    [InlineData(0, 30, StatusCliente.Verde)]
    [InlineData(1, 30, StatusCliente.Amarelo)]
    [InlineData(30, 30, StatusCliente.Amarelo)]
    [InlineData(31, 30, StatusCliente.Vermelho)]
    [InlineData(15, 15, StatusCliente.Amarelo)]
    [InlineData(16, 15, StatusCliente.Vermelho)]
    public void Semaforo_verde_amarelo_vermelho(int dias, int prazo, StatusCliente esperado) =>
        Assert.Equal(esperado, AvaliadorDeSituacao.Classificar(dias, prazo));

    [Theory]
    [InlineData(0, "Em dia")]
    [InlineData(1, "1 a 30 dias")]
    [InlineData(30, "1 a 30 dias")]
    [InlineData(31, "31 a 60 dias")]
    [InlineData(60, "31 a 60 dias")]
    [InlineData(61, "Acima de 60 dias")]
    public void Faixas_de_atraso(int dias, string esperado) =>
        Assert.Equal(esperado, AvaliadorDeSituacao.FaixaDeAtraso(dias));

    [Fact]
    public void Cliente_sem_cobrancas_em_aberto_fica_verde_e_liberado()
    {
        var s = AvaliadorDeSituacao.Avaliar(new List<ParcelaEmAberto>(), new List<VigenciaLiberacao>(), Config, D("2026-11-12"));
        Assert.Equal(StatusCliente.Verde, s.Status);
        Assert.False(s.Bloqueado);
        Assert.Equal(0m, s.ValorAtualizado);
        Assert.Null(s.DiasAteBloqueio);
    }

    [Fact]
    public void Gatilho_de_amarelo_para_vermelho_no_31o_dia()
    {
        var parcelas = new[] { new ParcelaEmAberto(3200m, D("2026-10-01")) };
        var nenhuma = new List<VigenciaLiberacao>();

        var dia30 = AvaliadorDeSituacao.Avaliar(parcelas, nenhuma, Config, D("2026-10-31"));
        Assert.Equal(30, dia30.DiasAtraso);
        Assert.Equal(StatusCliente.Amarelo, dia30.Status);
        Assert.False(dia30.Bloqueado);
        Assert.Equal(1, dia30.DiasAteBloqueio);

        var dia31 = AvaliadorDeSituacao.Avaliar(parcelas, nenhuma, Config, D("2026-11-01"));
        Assert.Equal(31, dia31.DiasAtraso);
        Assert.Equal(StatusCliente.Vermelho, dia31.Status);
        Assert.True(dia31.Bloqueado);
        Assert.Null(dia31.DiasAteBloqueio);
    }

    [Fact]
    public void Soma_principal_multa_e_juros_das_vencidas_e_separa_o_que_vai_vencer()
    {
        var parcelas = new[]
        {
            new ParcelaEmAberto(5000m, D("2026-10-01")), // 45 dias
            new ParcelaEmAberto(5000m, D("2026-11-01")), // 14 dias
            new ParcelaEmAberto(5000m, D("2026-12-01"))  // a vencer
        };
        var s = AvaliadorDeSituacao.Avaliar(parcelas, new List<VigenciaLiberacao>(), Config, D("2026-11-15"));
        Assert.Equal(2, s.ParcelasVencidas);
        Assert.Equal(45, s.DiasAtraso);
        Assert.Equal(D("2026-10-01"), s.VencimentoMaisAntigo);
        Assert.Equal(10000m, s.ValorVencido);
        Assert.Equal(200m, s.ValorMulta);
        Assert.Equal(97.35m, s.ValorJuros); // 74,25 + 23,10
        Assert.Equal(10297.35m, s.ValorAtualizado);
        Assert.Equal(5000m, s.ValorAVencer);
        Assert.Equal("31 a 60 dias", s.FaixaAtraso);
    }

    [Fact]
    public void Liberacao_temporaria_vigente_libera_vencida_ou_revogada_nao()
    {
        var parcelas = new[] { new ParcelaEmAberto(9600m, D("2026-09-28")) };
        var hoje = D("2026-11-12");

        var vigente = AvaliadorDeSituacao.Avaliar(
            parcelas, new[] { new VigenciaLiberacao(D("2026-11-20"), false) }, Config, hoje);
        Assert.Equal(StatusCliente.Vermelho, vigente.Status);
        Assert.False(vigente.Bloqueado);
        Assert.Equal(D("2026-11-20"), vigente.LiberacaoAte);

        var ultimoDia = AvaliadorDeSituacao.Avaliar(
            parcelas, new[] { new VigenciaLiberacao(hoje, false) }, Config, hoje);
        Assert.False(ultimoDia.Bloqueado);

        var vencida = AvaliadorDeSituacao.Avaliar(
            parcelas, new[] { new VigenciaLiberacao(D("2026-11-11"), false) }, Config, hoje);
        Assert.True(vencida.Bloqueado);
        Assert.Null(vencida.LiberacaoAte);

        var revogada = AvaliadorDeSituacao.Avaliar(
            parcelas, new[] { new VigenciaLiberacao(D("2026-11-20"), true) }, Config, hoje);
        Assert.True(revogada.Bloqueado);
    }

    [Theory]
    [InlineData(0, null)]
    [InlineData(1, 1)]
    [InlineData(6, 1)]
    [InlineData(7, 7)]
    [InlineData(29, 15)]
    [InlineData(30, 30)]
    [InlineData(100, 90)]
    public void Regua_maior_marco_de_atraso_alcancado(int dias, int? esperado) =>
        Assert.Equal(esperado, ReguaDeCobranca.MarcoDeAtraso(dias));

    [Theory]
    [InlineData("2026-11-15", "2026-11-11", false)]
    [InlineData("2026-11-15", "2026-11-12", true)]
    [InlineData("2026-11-15", "2026-11-15", true)]
    [InlineData("2026-11-15", "2026-11-16", false)]
    public void Regua_lembrete_da_antecedencia_ate_o_vencimento(string vencimento, string hoje, bool esperado) =>
        Assert.Equal(esperado, ReguaDeCobranca.DeveLembrarVencimento(D(vencimento), D(hoje), 3));

    [Fact]
    public void Geracao_de_cobrancas_uma_por_mes_a_partir_do_primeiro_vencimento()
    {
        var inicio = D("2026-08-20");

        var devidos = GeradorDeVencimentos.Devidos(true, inicio, null, 10, D("2026-11-12"));
        Assert.Equal(
            new[]
            {
                new VencimentoDevido(D("2026-09-01"), D("2026-09-10")),
                new VencimentoDevido(D("2026-10-01"), D("2026-10-10")),
                new VencimentoDevido(D("2026-11-01"), D("2026-11-10"))
            },
            devidos);

        // A dez dias ou menos da virada do mês, a cobrança do mês seguinte já é gerada.
        var comDezembro = GeradorDeVencimentos.Devidos(true, inicio, null, 10, D("2026-11-25"));
        Assert.Equal(4, comDezembro.Count);
        Assert.Equal(new VencimentoDevido(D("2026-12-01"), D("2026-12-10")), comDezembro[3]);

        Assert.Empty(GeradorDeVencimentos.Devidos(false, inicio, null, 10, D("2026-11-12")));
        Assert.Equal(2, GeradorDeVencimentos.Devidos(true, inicio, D("2026-10-15"), 10, D("2026-11-12")).Count);
    }

    [Fact]
    public void Situacao_de_exibicao_da_cobranca()
    {
        var hoje = D("2026-11-12");
        Assert.Equal(SituacaoCobranca.EmAberto, Numeracao.SituacaoDaCobranca(StatusParcela.Aberta, D("2026-11-12"), hoje));
        Assert.Equal(SituacaoCobranca.Vencida, Numeracao.SituacaoDaCobranca(StatusParcela.Aberta, D("2026-11-11"), hoje));
        Assert.Equal(SituacaoCobranca.Paga, Numeracao.SituacaoDaCobranca(StatusParcela.Paga, D("2026-11-01"), hoje));
        Assert.Equal(SituacaoCobranca.Cancelada, Numeracao.SituacaoDaCobranca(StatusParcela.Cancelada, D("2026-11-01"), hoje));
    }

    [Fact]
    public void Numeracao_de_cobrancas_e_contratos()
    {
        Assert.Equal("COB-2026-0042", Numeracao.DaCobranca(D("2026-11-10"), 42));
        Assert.Equal("CT-2026-007", Numeracao.DoContrato(D("2026-01-15"), 7));
    }

    [Fact]
    public void Documentos_validacao_de_cpf_e_cnpj()
    {
        Assert.True(Documento.Valido("529.982.247-25"));
        Assert.False(Documento.Valido("529.982.247-26"));
        Assert.False(Documento.Valido("111.111.111-11"));
        Assert.True(Documento.Valido("11.222.333/0001-81"));
        Assert.False(Documento.Valido("11.222.333/0001-82"));
        Assert.False(Documento.Valido("123"));
    }

    [Fact]
    public void Textos_dos_avisos_usam_formato_brasileiro()
    {
        Assert.Equal("R$ 5.000,00", ModelosDeAviso.Moeda(5000m));
        Assert.Equal("R$ 12.854,48", ModelosDeAviso.Moeda(12854.48m));
        Assert.Equal("12/11/2026", ModelosDeAviso.Data(D("2026-11-12")));
        Assert.Equal("nov/2026", ModelosDeAviso.Competencia(D("2026-11-01")));

        var atraso = ModelosDeAviso.Montar(TipoAviso.Atraso, new DadosDoAviso
        {
            Cliente = "Construtora Beta",
            Numero = "COB-2026-0007",
            Vencimento = D("2026-10-31"),
            Dias = 12,
            ValorAtualizado = 8800.5m,
            DiasParaBloqueio = 30
        });
        Assert.Equal("Cobrança COB-2026-0007 em atraso há 12 dias", atraso.Assunto);
        Assert.Contains("Construtora Beta", atraso.Mensagem);
        Assert.Contains("31/10/2026", atraso.Mensagem);
        Assert.Contains("30 dias de atraso", atraso.Mensagem);
    }
}

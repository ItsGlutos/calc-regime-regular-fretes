package br.gov.serpro.rtc.domain.service.frete;

import java.time.DayOfWeek;
import java.time.YearMonth;

import org.springframework.stereotype.Service;

import br.gov.serpro.rtc.domain.model.enumeration.PeriodicidadeFrete;

/**
 * Conta dias úteis (segunda a sexta) para dimensionar o frete diário, quinzenal
 * ou mensal.
 *
 * <p>Feriados não são considerados, conforme premissa do simulador: o que importa
 * é a quantidade de dias úteis da semana, não a posição deles no calendário. O
 * número de dias úteis de um mesmo mês muda de ano para ano e, por isso, o valor
 * do período também muda.</p>
 */
@Service
public class DiasUteisService {

    /**
     * Dias úteis (segunda a sexta) do mês.
     */
    public int diasUteisDoMes(int ano, int mes) {
        final YearMonth referencia = YearMonth.of(ano, mes);
        int dias = 0;

        for (int dia = 1; dia <= referencia.lengthOfMonth(); dia++) {
            final DayOfWeek diaDaSemana = referencia.atDay(dia).getDayOfWeek();
            if (diaDaSemana != DayOfWeek.SATURDAY && diaDaSemana != DayOfWeek.SUNDAY) {
                dias++;
            }
        }
        return dias;
    }

    /**
     * Dias úteis que compõem o período faturado em um mês.
     *
     * <ul>
     *   <li>diário: 1 dia útil;</li>
     *   <li>quinzenal: metade dos dias úteis do mês (arredondada para cima);</li>
     *   <li>mensal: todos os dias úteis do mês.</li>
     * </ul>
     */
    public int diasUteisDoPeriodo(int ano, int mes, PeriodicidadeFrete periodicidade) {
        return switch (periodicidade) {
            case DIARIO -> 1;
            case QUINZENAL -> (diasUteisDoMes(ano, mes) + 1) / 2;
            case MENSAL -> diasUteisDoMes(ano, mes);
        };
    }

    /**
     * Dias úteis do ano, usados apenas como informação de contexto.
     */
    public int diasUteisDoAno(int ano) {
        int dias = 0;
        for (int mes = 1; mes <= 12; mes++) {
            dias += diasUteisDoMes(ano, mes);
        }
        return dias;
    }

}

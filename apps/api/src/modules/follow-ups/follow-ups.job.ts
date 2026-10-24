import type { FastifyBaseLogger } from 'fastify';
import cron from 'node-cron';
import type { AcaoNova, FollowUpsService } from './follow-ups.service';

interface OpcoesJob {
  servico: FollowUpsService;
  log: FastifyBaseLogger;
  expressao: string;
  webhookUrl?: string;
  /** Atraso da primeira execução após o boot. */
  atrasoInicialMs?: number;
}

/**
 * Recálculo periódico dos follow-ups: uma vez logo após o boot e depois pela expressão cron.
 * Roda dentro do processo da API (volume do case não justifica um worker separado).
 */
export function iniciarJobFollowUps({ servico, log, expressao, webhookUrl, atrasoInicialMs = 2000 }: OpcoesJob) {
  if (!cron.validate(expressao)) throw new Error(`FOLLOWUP_CRON inválida: "${expressao}"`);
  let emExecucao = false;

  async function executar(origem: 'boot' | 'cron') {
    if (emExecucao) {
      log.warn({ origem }, 'job de follow-up ainda em execução; disparo ignorado');
      return;
    }
    emExecucao = true;
    try {
      const { novas, ...resumo } = await servico.recalcularTodos();
      log.info({ origem, ...resumo }, 'job de follow-up: recálculo concluído');
      if (webhookUrl && resumo.criados + resumo.substituidos > 0) notificar(webhookUrl, { ...resumo, novas }, log);
    } catch (erro) {
      // Falha do job nunca derruba a API: fica no log e a próxima execução tenta de novo.
      log.error({ err: erro, origem }, 'job de follow-up falhou');
    } finally {
      emExecucao = false;
    }
  }

  const timer = setTimeout(() => void executar('boot'), atrasoInicialMs);
  const tarefa = cron.schedule(expressao, () => void executar('cron'));
  log.info({ expressao }, 'job de follow-up agendado');

  return {
    executar,
    parar() {
      clearTimeout(timer);
      void tarefa.stop();
    },
  };
}

/** Envia o resumo para um webhook (Slack, Teams, n8n...). Fire-and-forget com timeout de 5s. */
function notificar(
  url: string,
  r: { hoje: string; criados: number; substituidos: number; resolvidos: number; novas: AcaoNova[] },
  log: FastifyBaseLogger,
) {
  const corpo = {
    hoje: r.hoje,
    resumo: { criados: r.criados, substituidos: r.substituidos, resolvidos: r.resolvidos },
    acoes: r.novas,
  };
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(5000),
  })
    .then((res) => log.info({ status: res.status }, 'webhook de follow-up enviado'))
    .catch((erro: unknown) => log.warn({ err: erro }, 'webhook de follow-up falhou'));
}

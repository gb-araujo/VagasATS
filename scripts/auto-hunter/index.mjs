/**
 * Robô de candidaturas do vagasATS
 *
 * 1. Busca vagas reais (Gupy, Nerdin, comunidades do GitHub) com o mesmo motor do app
 * 2. Descarta vagas já vistas e filtra pelo perfil (senioridade, modalidade, match local)
 * 3. Avalia as melhores com o Gemini (score + motivo + riscos + email de candidatura)
 * 4. Vagas que pedem currículo por email: gera currículo/carta sob medida e envia pelo Gmail
 * 5. Demais vagas aprovadas: entram na fila "Prontas para aplicar" e vão no relatório por email
 */
import fs from 'node:fs';
import path from 'node:path';
import './runtime.mjs';
import { loadConfig, loadProfile, loadEnv } from './config.mjs';
import { loadState, saveState, jobKey } from './state.mjs';
import { evaluateJobWithAI, QuotaExceededError } from './ai.mjs';
import { validateApplyEmail, sendApplicationEmail, sendRunReport } from './mailer.mjs';
import {
  fetchRealJobs,
  calculateMatch,
  generateTailoredResumeWithLLM,
  generateCoverLetterWithLLM
} from '../../src/services/aiEngine.js';
import { buildResumePDF, getResumeFileName } from '../../src/services/pdfService.js';
import { INITIAL_JOBS } from '../../src/data/mockJobs.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...args) => console.log('[auto-hunter]', ...args);

async function fetchAllJobs(search) {
  const mockIds = new Set(INITIAL_JOBS.map(j => j.id));
  const byId = new Map();
  const errors = [];

  for (const searchTerm of search.searchTerms?.length ? search.searchTerms : ['']) {
    const { jobs, errors: errs } = await fetchRealJobs({
      searchTerm,
      platforms: [...search.platforms],
      workTypeFilter: search.workTypeFilter,
      region: search.region,
      techArea: search.techArea,
      forceRefresh: true
    });
    errors.push(...errs);
    // fetchRealJobs devolve vagas de demonstração quando nenhuma fonte responde: nunca aplicar nelas
    jobs.filter(j => !mockIds.has(j.id)).forEach(j => byId.set(j.id, j));
  }
  return { jobs: [...byId.values()], errors };
}

function filterJobs(jobs, profile, config, state) {
  const { filters, search } = config;
  const appliedKeys = new Set(state.applications.map(a => a.key));
  const seenKeys = new Set(Object.values(state.seen).map(s => s.key));
  const seniorities = (profile.seniorities?.length ? profile.seniorities : [profile.seniority]).filter(Boolean);
  const workPrefs = (profile.workPreferences?.length ? profile.workPreferences : String(profile.workPreference || '').split(','))
    .map(s => s.trim())
    .filter(Boolean);
  const blockedKeywords = (filters.blockedKeywords || []).map(k => k.toLowerCase());
  const blockedCompanies = (filters.blockedCompanies || []).map(c => c.toLowerCase());

  return jobs
    .filter(j => !state.seen[j.id] && !seenKeys.has(jobKey(j)) && !appliedKeys.has(jobKey(j)))
    .filter(j => (j.postedHoursAgo ?? 0) <= search.maxJobAgeHours)
    .filter(j => !filters.onlyProfileSeniorities || !seniorities.length || seniorities.includes(j.level))
    .filter(j => !filters.onlyProfileWorkPreferences || !workPrefs.length || workPrefs.includes(j.workType))
    .filter(j => !blockedKeywords.some(k => (j.title || '').toLowerCase().includes(k)))
    .filter(j => !blockedCompanies.some(c => (j.company || '').toLowerCase().includes(c)))
    .map(j => ({ job: j, localScore: calculateMatch(profile, j).score }))
    .filter(({ localScore }) => localScore >= filters.minLocalScore)
    .sort((a, b) => b.localScore - a.localScore);
}

async function prepareAndSendEmail(env, config, profile, job, evaluation, applyEmail) {
  const tailored = await generateTailoredResumeWithLLM(profile, job, env.geminiKey, 'balanced', 'gemini');
  await sleep(config.ai.delayBetweenCallsMs);
  const letter = await generateCoverLetterWithLLM(profile, job, env.geminiKey);

  if (config.autoSend.requireRealAI && (!tailored.isRealAI || !letter.isRealAI)) {
    throw new Error('IA indisponível para gerar currículo/carta sob medida (requireRealAI ativo)');
  }

  const pdfBuffer = Buffer.from(buildResumePDF(tailored).output('arraybuffer'));
  const subject = evaluation.emailSubject || `Candidatura - ${job.title} - ${profile.fullName}`;

  if (env.dryRun) {
    // Na simulação, salva o PDF e a carta localmente para conferir a qualidade antes de ligar o envio
    const previewDir = path.join(env.stateDir, 'preview');
    fs.mkdirSync(previewDir, { recursive: true });
    fs.writeFileSync(path.join(previewDir, getResumeFileName(tailored)), pdfBuffer);
    fs.writeFileSync(path.join(previewDir, `${getResumeFileName(tailored).replace(/\.pdf$/, '')}_carta.txt`), `Para: ${applyEmail}\nAssunto: ${subject}\n\n${letter.text}`);
    log(`(simulação) enviaria para ${applyEmail}: "${subject}" — prévia em ${previewDir}`);
    return;
  }
  await sendApplicationEmail(env, {
    to: applyEmail,
    subject,
    body: letter.text,
    profile,
    pdfBuffer,
    pdfName: getResumeFileName(tailored),
    bccMyself: config.autoSend.bccMyself
  });
}

async function main() {
  const config = loadConfig();
  const env = loadEnv();
  const profile = loadProfile();
  const state = loadState(env.stateDir);
  const canEmail = Boolean(env.gmailUser && env.gmailAppPassword);

  if (!env.geminiKey) throw new Error('GEMINI_API_KEY não configurada.');
  if (!canEmail) log('GMAIL_USER/GMAIL_APP_PASSWORD ausentes: envio e relatório por email desativados.');
  if (env.dryRun) log('Modo simulação (DRY_RUN): nenhum email de candidatura será enviado.');

  const { jobs, errors } = await fetchAllJobs(config.search);
  const candidates = filterJobs(jobs, profile, config, state);
  log(`${jobs.length} vagas encontradas, ${candidates.length} novas compatíveis.`);

  const sent = [];
  const queued = [];
  const failures = errors.map(e => `Fonte com erro: ${e}`);
  let evaluated = 0;

  for (const { job, localScore } of candidates.slice(0, config.ai.maxEvaluationsPerRun)) {
    let evaluation;
    try {
      evaluation = await evaluateJobWithAI(profile, job, env.geminiKey);
      evaluated++;
    } catch (err) {
      failures.push(`${job.title} (${job.company}): ${err.message}`);
      if (err instanceof QuotaExceededError) break;
      continue;
    }
    await sleep(config.ai.delayBetweenCallsMs);

    const now = new Date().toISOString();
    const approved = evaluation.apply && evaluation.score >= config.ai.minAiScore;
    log(`${approved ? '✔' : '✖'} [${evaluation.score}] ${job.title} — ${job.company}: ${evaluation.reason}`);

    const item = {
      id: job.id,
      key: jobKey(job),
      title: job.title,
      company: job.company,
      source: job.source,
      url: job.url,
      workType: job.workType,
      level: job.level,
      localScore,
      aiScore: evaluation.score,
      reason: evaluation.reason,
      risks: evaluation.risks,
      at: now
    };

    if (!approved) {
      state.seen[job.id] = { key: item.key, decision: 'rejected', score: evaluation.score, at: now };
      continue;
    }

    const applyEmail = validateApplyEmail(evaluation.applyEmail, job);
    const shouldSend = config.autoSend.enabled && (canEmail || env.dryRun) && applyEmail && evaluation.canApplyByEmail
      && sent.length < config.autoSend.maxEmailsPerRun;

    if (shouldSend) {
      try {
        await prepareAndSendEmail(env, config, profile, job, evaluation, applyEmail);
        sent.push({ ...item, applyEmail });
        if (!env.dryRun) {
          state.applications.push({ ...item, status: 'sent', applyEmail });
          state.seen[job.id] = { key: item.key, decision: 'sent', score: evaluation.score, at: now };
        }
      } catch (err) {
        // Não marca como vista: tenta de novo na próxima execução
        failures.push(`Falha ao enviar para ${applyEmail} (${job.title}): ${err.message}`);
        if (err instanceof QuotaExceededError) break;
      }
      await sleep(config.ai.delayBetweenCallsMs);
      continue;
    }

    queued.push(item);
    if (!env.dryRun) {
      state.applications.push({ ...item, status: 'queued' });
      state.seen[job.id] = { key: item.key, decision: 'queued', score: evaluation.score, at: now };
    }
  }

  if (!env.dryRun) saveState(env.stateDir, state);

  const stats = { fetched: jobs.length, newAfterFilters: candidates.length, evaluated };
  log(`Resumo: ${sent.length} enviada(s), ${queued.length} na fila, ${failures.length} aviso(s).`);
  failures.forEach(f => log('⚠', f));

  const hasNews = sent.length > 0 || queued.length > 0;
  if (canEmail && config.notify.enabled && (hasNews || !config.notify.onlyWhenNews)) {
    await sendRunReport(env, { sent, queued, failures, stats, dryRun: env.dryRun });
    log(`Relatório enviado para ${env.notifyEmail}.`);
  }
}

main().catch(err => {
  console.error('[auto-hunter] Erro fatal:', err.message);
  process.exit(1);
});

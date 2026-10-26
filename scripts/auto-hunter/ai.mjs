import { getAvailableGeminiModels } from '../../src/services/aiEngine.js';
import { recordAiRequest } from '../../src/services/quotaTracker.js';

const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.0-flash'];

let modelCandidates = null;
let workingModel = null;

export class QuotaExceededError extends Error {}

async function getModels(apiKey) {
  if (!modelCandidates) {
    const discovered = await getAvailableGeminiModels(apiKey).catch(() => []);
    modelCandidates = [...new Set([...discovered, ...FALLBACK_MODELS])].filter(m => !m.includes('pro'));
  }
  return workingModel ? [workingModel, ...modelCandidates.filter(m => m !== workingModel)] : modelCandidates;
}

function buildEvaluationPrompt(profile, job) {
  const experiences = (profile.experiences || [])
    .map(e => `- ${e.role || e.title || ''} @ ${e.company || ''} (${e.period || e.startDate || ''}): ${(e.description || '').slice(0, 300)}`)
    .join('\n');

  return `Você é um recrutador técnico sênior fazendo a triagem de vagas para um candidato.
Decida se vale a pena o candidato se candidatar a esta vaga. Seja honesto e criterioso: candidatura sem aderência real prejudica o candidato.

## PERFIL DO CANDIDATO
Nome: ${profile.fullName}
Cargo alvo: ${profile.targetRole}
Senioridade(s) desejada(s): ${(profile.seniorities || [profile.seniority]).filter(Boolean).join(', ')}
Modalidade(s) aceita(s): ${(profile.workPreferences || [profile.workPreference]).filter(Boolean).join(', ')}
Localização: ${profile.location || 'não informada'}
Skills: ${(profile.skills || []).join(', ')}
Idiomas: ${(profile.languages || []).map(l => `${l.name} (${l.level})`).join(', ')}
Resumo: ${profile.bio || ''}
Contexto de carreira: ${(profile.careerContext || '').slice(0, 1500)}
Experiências:
${experiences || '- (nenhuma informada)'}

## VAGA
Título: ${job.title}
Empresa: ${job.company}
Fonte: ${job.source}
Modalidade: ${job.workType} | Local: ${job.location}
Nível inferido: ${job.level}
Salário: ${job.salary}
Descrição:
${(job.description || '').slice(0, 6000)}

## REGRAS
- Reprove se a senioridade/anos de experiência exigidos forem claramente acima do perfil.
- Reprove se a modalidade/local for incompatível (ex.: presencial em outra cidade).
- Reprove se exigir idioma em nível que o candidato não tem.
- Reprove vagas fora de tecnologia, golpes, ou que cobrem taxa do candidato.
- "email_candidatura": só preencha se a descrição pedir EXPLICITAMENTE envio de currículo para um email. Caso contrário null.
- "pode_enviar_por_email": true somente se enviar currículo + carta para esse email for suficiente para se candidatar (sem formulário, teste ou cadastro obrigatório).
- "assunto_email": use o assunto exigido pela vaga se houver; senão sugira um assunto profissional curto.

Responda SOMENTE com JSON válido neste formato:
{"score": 0-100, "aplicar": true|false, "motivo": "1-2 frases", "riscos": ["..."], "email_candidatura": "email ou null", "pode_enviar_por_email": true|false, "assunto_email": "..."}`;
}

function extractJson(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Resposta da IA sem JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * Avalia a aderência perfil x vaga com o Gemini. Lança QuotaExceededError se a cota acabar.
 */
export async function evaluateJobWithAI(profile, job, apiKey) {
  const prompt = buildEvaluationPrompt(profile, job);
  let lastError = null;

  for (const model of await getModels(apiKey)) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
        }),
        signal: AbortSignal.timeout(45000)
      });

      if (res.status === 429) throw new QuotaExceededError(`Cota do Gemini esgotada (${model})`);
      if (!res.ok) {
        lastError = new Error(`${model} respondeu ${res.status}`);
        continue;
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = extractJson(text);
      workingModel = model;
      recordAiRequest('gemini', 1500);

      return {
        score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
        apply: Boolean(parsed.aplicar),
        reason: String(parsed.motivo || ''),
        risks: Array.isArray(parsed.riscos) ? parsed.riscos.map(String) : [],
        applyEmail: typeof parsed.email_candidatura === 'string' && parsed.email_candidatura.includes('@') ? parsed.email_candidatura.trim() : null,
        canApplyByEmail: Boolean(parsed.pode_enviar_por_email),
        emailSubject: String(parsed.assunto_email || ''),
        model
      };
    } catch (err) {
      if (err instanceof QuotaExceededError) throw err;
      lastError = err;
    }
  }

  throw lastError || new Error('Nenhum modelo Gemini disponível');
}

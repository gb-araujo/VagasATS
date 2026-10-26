import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './runtime.mjs';
import { processImportedProfilePayload } from '../../src/services/storageService.js';
import { INITIAL_USER_PROFILE } from '../../src/data/mockJobs.js';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function loadConfig() {
  return readJson(path.join(ROOT, 'automation', 'config.json'));
}

/**
 * Perfil exportado pelo app (aba Perfil > Exportar JSON).
 * Prioridade: secret PROFILE_JSON (GitHub Actions) > automation/profile.json (uso local, ignorado pelo git).
 */
export function loadProfile() {
  let raw = null;
  if (process.env.PROFILE_JSON && process.env.PROFILE_JSON.trim()) {
    raw = JSON.parse(process.env.PROFILE_JSON);
  } else {
    const file = path.join(ROOT, 'automation', 'profile.json');
    if (!fs.existsSync(file)) {
      throw new Error('Perfil não encontrado. Defina o secret PROFILE_JSON ou crie automation/profile.json (exportado pelo app).');
    }
    raw = readJson(file);
  }

  const { profile } = processImportedProfilePayload(raw);
  const merged = { ...INITIAL_USER_PROFILE, ...profile };
  if (!merged.fullName || !merged.email) {
    throw new Error('Perfil incompleto: preencha pelo menos nome completo e email no app antes de exportar.');
  }
  return merged;
}

export function loadEnv() {
  const env = process.env;
  return {
    geminiKey: (env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '').trim(),
    gmailUser: (env.GMAIL_USER || '').trim(),
    gmailAppPassword: (env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, ''),
    notifyEmail: (env.NOTIFY_EMAIL || env.GMAIL_USER || '').trim(),
    dryRun: /^(1|true|yes)$/i.test(env.DRY_RUN || ''),
    stateDir: path.resolve(ROOT, env.STATE_DIR || 'automation/state')
  };
}

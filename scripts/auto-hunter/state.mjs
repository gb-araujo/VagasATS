import fs from 'node:fs';
import path from 'node:path';

const RETENTION_DAYS = 60;

/**
 * Estado persistente do robô:
 * - seen-jobs.json: vagas já avaliadas pela IA (evita reavaliar e se candidatar 2x)
 * - applications.json: histórico de candidaturas enviadas e vagas na fila para aplicar manualmente
 */
export function loadState(stateDir) {
  fs.mkdirSync(stateDir, { recursive: true });
  const read = (name, fallback) => {
    const file = path.join(stateDir, name);
    try {
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    seen: read('seen-jobs.json', {}),
    applications: read('applications.json', [])
  };
}

export function saveState(stateDir, state) {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 36e5;
  const seen = Object.fromEntries(
    Object.entries(state.seen).filter(([, v]) => new Date(v.at).getTime() >= cutoff)
  );
  fs.writeFileSync(path.join(stateDir, 'seen-jobs.json'), JSON.stringify(seen, null, 2));
  fs.writeFileSync(path.join(stateDir, 'applications.json'), JSON.stringify(state.applications, null, 2));
}

export function jobKey(job) {
  return `${(job.title || '').toLowerCase().trim()}|${(job.company || '').toLowerCase().trim()}`;
}

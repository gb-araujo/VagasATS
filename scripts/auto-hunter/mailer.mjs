import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter(env) {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: env.gmailUser, pass: env.gmailAppPassword }
    });
  }
  return transporter;
}

const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const IGNORED_EMAIL = /(noreply|no-reply|example\.|exemplo\.|users\.noreply\.github\.com|sentry|@email\.com$)/i;

/**
 * Confirma que o email sugerido pela IA realmente aparece na descrição da vaga (evita email alucinado)
 */
export function validateApplyEmail(candidate, job) {
  if (!candidate) return null;
  const found = (job.description || '').match(EMAIL_REGEX) || [];
  const normalized = candidate.toLowerCase();
  const match = found.find(e => e.toLowerCase() === normalized);
  return match && !IGNORED_EMAIL.test(match) ? match : null;
}

export async function sendApplicationEmail(env, { to, subject, body, profile, pdfBuffer, pdfName, bccMyself }) {
  const signature = [profile.fullName, profile.phone, profile.email, profile.linkedin, profile.github]
    .filter(Boolean)
    .join('\n');
  const text = body.includes(profile.fullName) ? body : `${body}\n\n${signature}`;

  return getTransporter(env).sendMail({
    from: `"${profile.fullName}" <${env.gmailUser}>`,
    to,
    replyTo: profile.email,
    bcc: bccMyself ? env.notifyEmail || env.gmailUser : undefined,
    subject,
    text,
    attachments: [{ filename: pdfName, content: pdfBuffer, contentType: 'application/pdf' }]
  });
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function row(item) {
  const risks = item.risks?.length ? `<br><small style="color:#b45309">⚠ ${escapeHtml(item.risks.join(' · '))}</small>` : '';
  return `<tr>
    <td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:${item.aiScore >= 85 ? '#15803d' : '#1d4ed8'}">${item.aiScore}</td>
    <td style="padding:8px;border-bottom:1px solid #eee">
      <a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a> — ${escapeHtml(item.company)}
      <br><small>${escapeHtml(item.source)} · ${escapeHtml(item.workType || '')} · ${escapeHtml(item.level || '')}</small>
      <br><small>${escapeHtml(item.reason)}</small>${risks}
    </td>
  </tr>`;
}

function table(title, items) {
  if (!items.length) return '';
  return `<h3 style="margin:24px 0 8px">${title} (${items.length})</h3>
  <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px">${items.map(row).join('')}</table>`;
}

export async function sendRunReport(env, { sent, queued, failures, stats, dryRun }) {
  const html = `<div style="font-family:Arial,sans-serif;max-width:720px">
    <h2 style="margin:0">🤖 vagasATS — Robô de candidaturas${dryRun ? ' (simulação)' : ''}</h2>
    <p style="color:#555">${stats.fetched} vagas encontradas · ${stats.newAfterFilters} novas compatíveis · ${stats.evaluated} avaliadas pela IA</p>
    ${table(dryRun ? '✉️ Seriam enviadas por email' : '✅ Candidaturas enviadas por email', sent)}
    ${table('👉 Prontas para você aplicar (abra o link e use a extensão)', queued)}
    ${failures.length ? `<h3>⚠ Avisos</h3><ul>${failures.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>` : ''}
  </div>`;

  const total = sent.length + queued.length;
  return getTransporter(env).sendMail({
    from: `"vagasATS Robô" <${env.gmailUser}>`,
    to: env.notifyEmail,
    subject: `🤖 vagasATS: ${sent.length} enviada(s), ${queued.length} para aplicar${total === 0 ? ' — avisos' : ''}`,
    html
  });
}

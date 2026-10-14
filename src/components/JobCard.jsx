import React from 'react';
import { Clock, MapPin, Building, DollarSign, FileText, ExternalLink, Bookmark, CheckCircle2, Link, Eye } from 'lucide-react';
import { calculateMatch, getJobDirectUrl, formatPostedAgo, getJobTechArea } from '../services/aiEngine';
import TechAreaIcon from './TechAreaIcon';

function JobCard({ 
  job, 
  userProfile, 
  onSelectJob, 
  onGenerateResume, 
  onApplyJob, 
  isApplied, 
  isSaved, 
  onToggleSave 
}) {
  const matchResult = calculateMatch(userProfile, job);
  const score = matchResult.score;
  const jobArea = getJobTechArea(job);

  // Determine solid badge color based on match score
  let badgeBg = 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400';
  let badgeText = 'Médio';
  if (score >= 85) {
    badgeBg = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400';
    badgeText = 'Match Ideal';
  } else if (score >= 70) {
    badgeBg = 'bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400';
    badgeText = 'Alto Match';
  }

  const areaColorMap = {
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
    cyan: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400',
    teal: 'bg-teal-500/10 border-teal-500/20 text-teal-600 dark:text-teal-400',
    rose: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
  };

  return (
    <div className="glass-card rounded-2xl p-5 transition-all relative flex flex-col justify-between group border border-[var(--border-subtle)] hover:border-blue-500/40">
      
      {/* Top row: Company info, 24h badge & Save button */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          
          <div className="flex items-center gap-3">
            <img 
              src={job.companyLogo} 
              alt={job.company}
              className="w-11 h-11 rounded-xl object-cover border border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
              loading="lazy"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80";
              }}
            />
            <div>
              <h3 
                onClick={() => onSelectJob(job)}
                className="text-sm sm:text-base font-bold text-[var(--text-main)] hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-1 cursor-pointer"
                title="Visualizar detalhes da vaga"
              >
                {job.title}
              </h3>
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5">
                <span className="font-semibold flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-[var(--text-faint)]" />
                  {job.company}
                </span>
                <span>•</span>
                {(getJobDirectUrl(job) || job.url) ? (
                  <a
                    href={getJobDirectUrl(job) || job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded text-[11px] font-semibold border border-[var(--border-subtle)] transition-all flex items-center gap-1"
                    title={`Abrir anúncio no ${job.source}`}
                  >
                    <Link className="w-3 h-3 text-blue-500" />
                    <span>{job.source || 'Vaga Oficial'}</span>
                  </a>
                ) : (
                  <span className="bg-[var(--bg-subtle)] text-[var(--text-muted)] px-2 py-0.5 rounded text-[11px] font-semibold border border-[var(--border-subtle)]">
                    {job.source || 'Vaga Oficial'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bookmark Button */}
          <button
            onClick={() => onToggleSave(job.id)}
            className={`p-2 rounded-xl border transition-all ${
              isSaved
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
            title={isSaved ? "Remover das salvas" : "Salvar vaga"}
            aria-label="Salvar vaga"
          >
            <Bookmark className="w-4 h-4 fill-current" />
          </button>
        </div>

        {/* Badges: Tech Area, Time (< 24h) & Match Score */}
        <div className="flex flex-wrap items-center gap-2 mb-3.5">
          {/* Tech Area Badge */}
          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-lg border ${areaColorMap[jobArea.color] || areaColorMap.blue}`}>
            <TechAreaIcon areaId={jobArea.id} className="w-3.5 h-3.5" />
            <span>{jobArea.shortLabel}</span>
          </span>

          {/* Time Badge */}
          {job.postedHoursAgo <= 24 ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              Recente ({formatPostedAgo(job.postedHoursAgo)})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
              <Clock className="w-3.5 h-3.5 text-[var(--text-faint)]" />
              {formatPostedAgo(job.postedHoursAgo)}
            </span>
          )}

          {/* Match Score Badge */}
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-lg border ${badgeBg}`}>
            <span>{score}% Match</span>
            <span className="text-[10px] opacity-75">({badgeText})</span>
          </span>

          {/* Work format */}
          <span className="text-xs px-2 py-0.5 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
            {job.workType}
          </span>
        </div>

        {/* Job details (Location & Salary) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[var(--text-muted)] mb-3.5 bg-[var(--bg-subtle)] p-2.5 rounded-xl border border-[var(--border-subtle)]">
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 text-[var(--text-faint)] flex-shrink-0" />
            <span className="truncate">{job.location}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="truncate font-semibold text-[var(--text-main)]">{job.salary || "A combinar"}</span>
          </div>
        </div>

        {/* Required Skills list */}
        <div className="mb-4">
          <p className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider mb-2">
            Requisitos &amp; Stacks:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(job.requirements || []).map((req, i) => {
              const isMatched = matchResult.matchedSkills.some(m => m.toLowerCase() === req.toLowerCase());
              return (
                <span
                  key={i}
                  className={`text-xs px-2 py-0.5 rounded-md border flex items-center gap-1 font-medium ${
                    isMatched
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/20'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border-subtle)]'
                  }`}
                >
                  {isMatched && <CheckCircle2 className="w-3 h-3 text-blue-500" />}
                  {req}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-[var(--border-subtle)] grid grid-cols-2 sm:grid-cols-4 gap-2">
        <a
          href={getJobDirectUrl(job) || job.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] text-blue-600 dark:text-blue-400 text-xs font-bold border border-[var(--border-subtle)] transition-all"
          title="Abrir o anúncio real da vaga"
        >
          <Link className="w-3.5 h-3.5 text-blue-500" />
          <span className="truncate">Link Oficial</span>
        </a>

        <button
          onClick={() => onSelectJob(job)}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] text-[var(--text-main)] text-xs font-bold border border-[var(--border-subtle)] transition-all"
          title="Ver descrição completa da vaga"
        >
          <Eye className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span className="truncate">Ver Vaga</span>
        </button>

        <button
          onClick={() => onGenerateResume(job)}
          className="w-full flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-bold transition-all"
          title="Gerar currículo personalizado em PDF"
        >
          <FileText className="w-3.5 h-3.5 text-blue-500" />
          <span className="truncate">Gerar PDF</span>
        </button>

        <button
          onClick={() => onApplyJob(job)}
          className={`w-full flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
            isApplied
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isApplied ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="truncate">Aplicado</span>
            </>
          ) : (
            <>
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="truncate">Candidatar</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
}

export default React.memo(JobCard);

import React, { useState, useEffect } from 'react';
import { X, Sparkles, CheckCircle, AlertTriangle, FileText, ExternalLink, Building, MapPin, DollarSign, Clock, Award, ChevronRight, Link } from 'lucide-react';
import { calculateMatch, getJobDirectUrl, formatPostedAgo, getJobTechArea } from '../services/aiEngine';
import TechAreaIcon from './TechAreaIcon';

export default function JobDetailsModal({ job, userProfile, onClose, onGenerateResume, onApply }) {
  if (!job) return null;

  // ESC key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const matchResult = calculateMatch(userProfile, job);
  const score = matchResult.score;
  const jobArea = getJobTechArea(job);

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
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-panel w-full max-w-3xl rounded-2xl border border-[var(--border-strong)] shadow-xl overflow-hidden my-8 max-h-[90vh] flex flex-col bg-[var(--bg-card)]">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-[var(--border-subtle)] flex items-start justify-between bg-[var(--bg-card)] relative">
          <div className="flex items-start gap-4">
            <img 
              src={job.companyLogo} 
              alt={job.company} 
              className="w-14 h-14 rounded-xl object-cover border border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${areaColorMap[jobArea.color] || areaColorMap.blue}`}>
                  <TechAreaIcon areaId={jobArea.id} className="w-3.5 h-3.5" />
                  <span>{jobArea.label}</span>
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Publicada {formatPostedAgo(job.postedHoursAgo)}
                </span>
                <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded-md border border-[var(--border-subtle)]">
                  {job.source}
                </span>
              </div>
              <h2 className="text-xl font-bold text-[var(--text-main)] mt-1">{job.title}</h2>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 mt-0.5">
                <Building className="w-4 h-4 text-[var(--text-muted)]" />
                {job.company} • <span className="text-[var(--text-muted)] font-normal">{job.location}</span>
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-[var(--bg-subtle)] text-[var(--text-faint)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* AI Match Gauge Card */}
          <div className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-5 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              
              {/* Score Circular Metric */}
              <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-[var(--border-subtle)]"
                    fill="transparent"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    stroke="currentColor"
                    strokeWidth="6"
                    className="text-blue-600 transition-all duration-1000"
                    strokeDasharray={213}
                    strokeDashoffset={213 - (213 * score) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-xl font-bold text-[var(--text-main)]">{score}%</span>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Diagnóstico de Compatibilidade da IA
                </h4>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md">
                  {matchResult.recommendation}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                onGenerateResume(job);
              }}
              className="gradient-btn px-4 py-2.5 rounded-xl font-bold text-xs text-white flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Gerar Currículo PDF</span>
            </button>
          </div>

          {/* AI Analysis Grid: Strengths & Skill Gaps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Strengths */}
            <div className="bg-[var(--bg-subtle)] border border-emerald-500/20 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <CheckCircle className="w-4 h-4" />
                Pontos de Forte Match ({matchResult.matchedSkills.length})
              </h4>
              <ul className="space-y-2 text-xs text-[var(--text-muted)]">
                {matchResult.strengths.map((str, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Skill Gaps */}
            <div className="bg-[var(--bg-subtle)] border border-amber-500/20 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <AlertTriangle className="w-4 h-4" />
                Diferenciais a Destacar ({matchResult.missingSkills.length})
              </h4>
              {matchResult.missingSkills.length > 0 ? (
                <ul className="space-y-2 text-xs text-[var(--text-muted)]">
                  {matchResult.missingSkills.map((sk, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0"></span>
                      <span>A vaga solicita <strong>{sk}</strong>. Nossa IA otimizará seu currículo para enfatizar seu aprendizado rápido.</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Você atende 100% dos requisitos técnicos da vaga!</p>
              )}
            </div>

          </div>

          {/* Full Job Description */}
          <div className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-5 rounded-xl space-y-3">
            <h4 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider">
              Descrição Completa da Oportunidade
            </h4>
            <div className="text-xs text-[var(--text-muted)] leading-relaxed whitespace-pre-line font-sans">
              {job.description}
            </div>
          </div>

          {/* Benefits */}
          {job.benefits && job.benefits.length > 0 && (
            <div className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-5 rounded-xl">
              <h4 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider mb-3">
                Benefícios Oferecidos
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {job.benefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[var(--text-muted)] bg-[var(--bg-card)] p-2 rounded-lg border border-[var(--border-subtle)]">
                    <Award className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[var(--bg-subtle)] text-[var(--text-muted)] text-xs font-semibold hover:text-[var(--text-main)] transition-all border border-[var(--border-subtle)] cursor-pointer"
          >
            Fechar
          </button>

          <div className="flex items-center gap-2.5 flex-wrap">
            {(getJobDirectUrl(job) || job.url) && (
              <a
                href={getJobDirectUrl(job) || job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-[var(--bg-subtle)] text-blue-600 dark:text-blue-400 border border-[var(--border-subtle)] text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                title="Abrir o anúncio real da vaga"
              >
                <Link className="w-4 h-4 text-blue-500" />
                <span>Link da Vaga</span>
              </a>
            )}

            <button
              onClick={() => {
                onClose();
                onGenerateResume(job);
              }}
              className="px-4 py-2.5 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 hover:bg-blue-600/20 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-blue-500" />
              <span>Personalizar Currículo</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onApply(job);
              }}
              className="gradient-btn px-5 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Aplicar na Vaga Oficial</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

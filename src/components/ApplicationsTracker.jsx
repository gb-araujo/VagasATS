import React, { useState } from 'react';
import { Send, Clock, ExternalLink, FileText, CheckCircle2, AlertCircle, Sparkles, Building, Trash2 } from 'lucide-react';
import { calculateMatch, getJobDirectUrl, formatPostedAgo } from '../services/aiEngine';

export default function ApplicationsTracker({ 
  applications, 
  userProfile, 
  onUpdateStatus, 
  onRemoveApplication, 
  onGenerateResume 
}) {
  const [filterStatus, setFilterStatus] = useState('all');

  const statusOptions = [
    { value: 'all', label: 'Todas' },
    { value: 'Aplicado', label: 'Aplicadas' },
    { value: 'Entrevista', label: 'Em Entrevista' },
    { value: 'Proposta', label: 'Proposta Aceita' },
  ];

  const filteredApps = filterStatus === 'all' 
    ? applications 
    : applications.filter(app => app.status === filterStatus);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      
      {/* Header & Metric Cards */}
      <div className="glass-panel p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-500" />
              Gestão de Candidaturas
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Acompanhe aqui o status das vagas que você já aplicou ou gerou currículo sob medida.
            </p>
          </div>

          {/* Filter Status */}
          <div className="flex bg-[var(--bg-subtle)] p-1 rounded-xl border border-[var(--border-subtle)]">
            {statusOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilterStatus(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  filterStatus === opt.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-4 rounded-xl">
            <span className="text-xs font-medium text-[var(--text-muted)] block">Total de Candidaturas</span>
            <span className="text-2xl font-extrabold text-[var(--text-main)] mt-1 block">{applications.length}</span>
          </div>

          <div className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-4 rounded-xl">
            <span className="text-xs font-medium text-[var(--text-muted)] block">Publicadas nas últimas 24h</span>
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">
              {applications.filter(a => (a.job.postedHoursAgo || 24) <= 24).length}
            </span>
          </div>

          <div className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-4 rounded-xl">
            <span className="text-xs font-medium text-[var(--text-muted)] block">Match Médio das Vagas</span>
            <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1 block">
              {applications.length > 0
                ? Math.round(applications.reduce((acc, a) => acc + calculateMatch(userProfile, a.job).score, 0) / applications.length)
                : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Applications List */}
      {filteredApps.length === 0 ? (
        <div className="glass-card p-12 rounded-2xl border border-[var(--border-subtle)] text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--bg-subtle)] text-[var(--text-faint)] flex items-center justify-center mx-auto border border-[var(--border-subtle)]">
            <Send className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[var(--text-main)]">Nenhuma candidatura encontrada</h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            Quando você clicar em "Candidatar" ou "Gerar PDF" em qualquer vaga, ela aparecerá automaticamente aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApps.map((app) => {
            const matchResult = calculateMatch(userProfile, app.job);
            return (
              <div 
                key={app.id}
                className="glass-card p-5 rounded-2xl border border-[var(--border-subtle)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group hover:border-blue-500/40 transition-all"
              >
                
                <div className="flex items-start gap-4">
                  <img 
                    src={app.job.companyLogo} 
                    alt={app.job.company} 
                    className="w-12 h-12 rounded-xl object-cover border border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                        {matchResult.score}% Match
                      </span>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                        <Clock className="w-3 h-3" />
                        Publicada {formatPostedAgo(app.job.postedHoursAgo)}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-[var(--text-main)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mt-1">
                      {app.job.title}
                    </h3>

                    <p className="text-xs text-[var(--text-muted)] flex items-center gap-2 mt-0.5">
                      <span className="font-semibold text-[var(--text-main)]">{app.job.company}</span>
                      <span>•</span>
                      <span>{app.job.location}</span>
                      <span>•</span>
                      <span className="text-[var(--text-faint)]">Aplicado em: {new Date(app.appliedAt).toLocaleDateString('pt-BR')}</span>
                    </p>
                  </div>
                </div>

                {/* Actions & Status Selector */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-[var(--border-subtle)]">
                  
                  {/* Status Dropdown */}
                  <select
                    value={app.status || 'Aplicado'}
                    onChange={(e) => onUpdateStatus(app.id, e.target.value)}
                    className="glass-input text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-xl px-3 py-2 cursor-pointer"
                  >
                    <option value="Aplicado">Aplicado</option>
                    <option value="Entrevista">Em Entrevista</option>
                    <option value="Proposta">Proposta Recebida</option>
                  </select>

                  <button
                    onClick={() => onGenerateResume(app.job)}
                    className="p-2 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] text-blue-600 dark:text-blue-400 border border-[var(--border-subtle)] transition-all cursor-pointer"
                    title="Ver/Rebaixar Currículo PDF"
                  >
                    <FileText className="w-4 h-4" />
                  </button>

                  {(getJobDirectUrl(app.job) || app.job?.url) && (
                    <a
                      href={getJobDirectUrl(app.job) || app.job?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm cursor-pointer"
                      title="Ir para o anúncio real da vaga"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  <button
                    onClick={() => onRemoveApplication(app.id)}
                    className="p-2 rounded-xl bg-[var(--bg-subtle)] hover:bg-red-500/10 text-[var(--text-faint)] hover:text-red-500 border border-[var(--border-subtle)] transition-all cursor-pointer"
                    title="Remover histórico"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

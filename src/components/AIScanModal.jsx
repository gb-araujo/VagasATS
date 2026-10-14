import React, { useState, useEffect } from 'react';
import { Bot, Sparkles, CheckCircle2, RefreshCw, Zap, ShieldCheck, ArrowRight } from 'lucide-react';
import { fetchRealJobs } from '../services/aiEngine';

export default function AIScanModal({ userProfile, onClose, onAddJobs }) {
  const [step, setStep] = useState(1);
  const [foundJobs, setFoundJobs] = useState([]);
  const [scanError, setScanError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timer1 = setTimeout(() => setStep(2), 1200);
    const timer2 = setTimeout(() => setStep(3), 2500);
    const timer3 = setTimeout(() => {
      fetchRealJobs({ seniorities: userProfile.seniorities || [] })
        .then(({ jobs }) => {
          if (cancelled) return;
          setFoundJobs(jobs);
          setStep(4);
        })
        .catch(err => {
          if (cancelled) return;
          setScanError(err.message || 'Falha ao buscar vagas reais.');
          setFoundJobs([]);
          setStep(4);
        });
    }, 3800);

    return () => {
      cancelled = true;
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [userProfile]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleFinish = () => {
    if (foundJobs.length > 0) onAddJobs(foundJobs);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-[var(--border-strong)] shadow-xl p-6 text-center space-y-6 bg-[var(--bg-card)]">
        
        {/* Clean Solid Icon */}
        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto shadow-md">
          <Bot className="w-7 h-7 text-white" />
        </div>

        <div>
          <h3 className="text-lg font-bold text-[var(--text-main)]">
            Scanner de Vagas Recentes por IA
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Rastreando fontes oficiais em busca de publicações das últimas 24 horas...
          </p>
        </div>

        {/* Step Progression List */}
        <div className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-4 rounded-xl space-y-3 text-left">
          
          {/* Step 1 */}
          <div className="flex items-center gap-3 text-xs">
            {step > 1 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
            )}
            <span className={step >= 1 ? 'text-[var(--text-main)] font-medium' : 'text-[var(--text-faint)]'}>
              Conectando às APIs e plataformas brasileiras (Gupy, GitHub Vagas BR, Comunidades Tech)...
            </span>
          </div>

          {/* Step 2 */}
          <div className="flex items-center gap-3 text-xs">
            {step > 2 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            ) : step === 2 ? (
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-[var(--border-subtle)] flex-shrink-0"></div>
            )}
            <span className={step >= 2 ? 'text-[var(--text-main)] font-medium' : 'text-[var(--text-faint)]'}>
              Filtrando exclusivamente publicações recentes (&lt; 24h)...
            </span>
          </div>

          {/* Step 3 */}
          <div className="flex items-center gap-3 text-xs">
            {step > 3 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            ) : step === 3 ? (
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-[var(--border-subtle)] flex-shrink-0"></div>
            )}
            <span className={step >= 3 ? 'text-[var(--text-main)] font-medium' : 'text-[var(--text-faint)]'}>
              Calculando Match Score (%) contra seu perfil de {userProfile.targetRole}...
            </span>
          </div>

        </div>

        {/* Step 4 Completed State */}
        {step === 4 && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl text-center space-y-2 animate-fade-in">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
              <Zap className="w-4 h-4" />
              {scanError ? 'Não foi possível buscar novas vagas no momento' : `${foundJobs.length} Vagas Reais Encontradas!`}
            </span>
            <p className="text-[11px] text-[var(--text-muted)]">
              Vagas adicionadas instantaneamente ao seu feed com currículo pronto para gerar em PDF.
            </p>
          </div>
        )}

        {/* Action Button */}
        {step === 4 ? (
          <button
            onClick={handleFinish}
            className="w-full gradient-btn py-3 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Ver Novas Vagas no Feed</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <p className="text-[11px] text-[var(--text-faint)] italic">Por favor, aguarde alguns instantes...</p>
        )}

      </div>
    </div>
  );
}

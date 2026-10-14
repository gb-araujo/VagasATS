import React, { useState } from 'react';
import { 
  Link, Sparkles, FileText, CheckCircle2, AlertCircle, RefreshCw, 
  ArrowRight, Globe, Building, MapPin, Briefcase, Zap, ShieldCheck, 
  ExternalLink, Layers, Copy, Check, ChevronRight, HelpCircle, Info,
  Code2, Terminal, Share2, Search, Building2
} from 'lucide-react';
import { analyzeJobFromUrlOrText, calculateMatch } from '../services/aiEngine';

function PlatformIcon({ id, className = "w-4 h-4" }) {
  switch (id) {
    case 'gupy': return <Sparkles className={`${className} text-purple-400`} />;
    case 'vagas': return <Briefcase className={`${className} text-rose-400`} />;
    case 'greenhouse': return <Globe className={`${className} text-teal-400`} />;
    case 'catho': return <Building2 className={`${className} text-indigo-400`} />;
    case 'programathor': return <Code2 className={`${className} text-amber-400`} />;
    case 'nerdin': return <Terminal className={`${className} text-emerald-400`} />;
    default: return <Briefcase className={`${className} text-blue-400`} />;
  }
}

export const SUPPORTED_POPULAR_PLATFORMS = [
  { 
    id: 'gupy', 
    name: 'Gupy', 
    domains: ['gupy.io'], 
    badge: '100% Automático', 
    badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    desc: 'Leitura instantânea de requisitos e ATS' 
  },
  { 
    id: 'vagas', 
    name: 'Vagas.com', 
    domains: ['vagas.com.br', 'vagas.com'], 
    badge: '100% Automático', 
    badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    desc: 'Extração completa de competências' 
  },
  { 
    id: 'greenhouse', 
    name: 'Greenhouse & Lever', 
    domains: ['greenhouse.io', 'lever.co'], 
    badge: '100% Automático', 
    badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    desc: 'Portais de carreiras tech globais' 
  },
  { 
    id: 'catho', 
    name: 'Catho & InfoJobs', 
    domains: ['catho.com.br', 'infojobs.com.br'], 
    badge: '100% Automático', 
    badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    desc: 'Grandes portais de contratação do Brasil' 
  },
  { 
    id: 'programathor', 
    name: 'Programathor', 
    domains: ['programathor.com.br'], 
    badge: '100% Automático', 
    badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    desc: 'Vagas exclusivas de tecnologia' 
  },
  {
    id: 'nerdin',
    name: 'Nerdin',
    domains: ['nerdin.com.br'],
    badge: '100% Automático',
    badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    desc: 'Portal de vagas em TI e Tech'
  }
];

export default function JobLinkAnalyzer({ 
  userProfile, 
  onGenerateResume, 
  onAddJobToFeed 
}) {
  const [activeMode, setActiveMode] = useState('url'); // 'url' | 'text'
  const [selectedPlatform, setSelectedPlatform] = useState('gupy');
  const [jobUrl, setJobUrl] = useState('');
  
  // Manual / fallback fields
  const [manualTitle, setManualTitle] = useState('');
  const [manualCompany, setManualCompany] = useState('');
  const [manualText, setManualText] = useState('');

  // Special guided notice when anti-bot requires text paste (Glassdoor, LinkedIn)
  const [guidedNotice, setGuidedNotice] = useState(null);

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  
  // Result
  const [analyzedJob, setAnalyzedJob] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Check if a URL belongs to supported platforms
  const checkUrlSupport = (url) => {
    if (!url || !url.startsWith('http')) return { isSupported: true, platform: null };
    const lower = url.toLowerCase();
    for (const plat of SUPPORTED_POPULAR_PLATFORMS) {
      if (plat.domains.some(d => lower.includes(d))) {
        return { isSupported: true, platform: plat };
      }
    }
    return { isSupported: false, platform: null };
  };

  const currentSupport = checkUrlSupport(jobUrl);

  // Auto-detect platform when pasting URL
  const handleUrlChange = (value) => {
    setJobUrl(value);
    setAnalysisError('');
    setGuidedNotice(null);

    const lower = value.toLowerCase();
    for (const plat of SUPPORTED_POPULAR_PLATFORMS) {
      if (plat.domains.some(d => lower.includes(d))) {
        setSelectedPlatform(plat.id);
        break;
      }
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleUrlChange(text);
      }
    } catch (e) {
      console.warn('Clipboard read error:', e);
    }
  };

  // Quick tests
  const handleApplyQuickTest = (type) => {
    setAnalysisError('');
    setGuidedNotice(null);
    setAnalyzedJob(null);
    if (type === 'gupy') {
      setSelectedPlatform('gupy');
      setJobUrl('https://itau.gupy.io/jobs/7182910-desenvolvedor-software-react-e-node');
      setActiveMode('url');
    } else if (type === 'vagas') {
      setSelectedPlatform('vagas');
      setJobUrl('https://www.vagas.com.br/vagas/v2541999/desenvolvedor-front-end-react');
      setActiveMode('url');
    }
  };

  const handleRunAnalysis = async () => {
    setAnalysisError('');
    setAnalyzedJob(null);
    setSavedSuccess(false);

    if (activeMode === 'url' && !jobUrl.trim()) {
      setAnalysisError('Por favor, cole o link da vaga.');
      return;
    }

    if (activeMode === 'url') {
      const support = checkUrlSupport(jobUrl.trim());
      if (!support.isSupported) {
        setAnalysisError(
          'Este site não está na lista de plataformas populares suportadas (Gupy, Vagas.com, Greenhouse, Lever, Catho, InfoJobs, Programathor ou Nerdin). Clique na aba "Colar Texto / Descrição Manual" para analisar qualquer vaga!'
        );
        return;
      }
    }

    if (activeMode === 'text' && !manualText.trim()) {
      setAnalysisError('Por favor, cole o texto ou descrição da vaga no campo abaixo.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStep(1);
    setAnalysisMessage('Acessando página e extraindo dados estruturados da vaga...');

    const timer1 = setTimeout(() => {
      setAnalysisStep(2);
      setAnalysisMessage('Mapeando requisitos técnicos, competências e palavras-chave ATS...');
    }, 400);

    const timer2 = setTimeout(() => {
      setAnalysisStep(3);
      setAnalysisMessage('Cruzando requisitos com seu perfil e calculando Match ATS...');
    }, 850);

    try {
      const platformObj = SUPPORTED_POPULAR_PLATFORMS.find(p => p.id === selectedPlatform);
      const result = await analyzeJobFromUrlOrText({
        url: activeMode === 'url' ? jobUrl : '',
        platform: platformObj ? platformObj.name : 'Web',
        rawText: activeMode === 'text' ? manualText : '',
        customTitle: manualTitle,
        customCompany: manualCompany
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      // Se a plataforma retornou dados sugeridos pelo link mas requer texto
      if (result && result.requiresManualText) {
        setIsAnalyzing(false);
        if (result.suggestedTitle) setManualTitle(result.suggestedTitle);
        if (result.suggestedCompany) setManualCompany(result.suggestedCompany);
        setGuidedNotice({
          platform: result.platform || 'Portal de Vagas',
          title: result.suggestedTitle,
          company: result.suggestedCompany,
          message: result.message
        });
        setActiveMode('text');
        return;
      }

      setAnalysisStep(4);
      setAnalysisMessage('Otimização concluída! Vaga pronta para gerar currículo ATS.');

      setTimeout(() => {
        setIsAnalyzing(false);
        setAnalyzedJob(result);
      }, 350);
    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setIsAnalyzing(false);
      setAnalysisError(err.message || 'Falha ao processar a vaga.');
    }
  };

  const handleSaveToFeed = () => {
    if (!analyzedJob) return;
    if (onAddJobToFeed) {
      onAddJobToFeed([analyzedJob]);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  const handleOpenResume = () => {
    if (!analyzedJob) return;
    if (onGenerateResume) {
      onGenerateResume(analyzedJob);
    }
  };

  const matchResult = analyzedJob ? calculateMatch(userProfile, analyzedJob) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      
      {/* Top Banner Card */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-[var(--border-subtle)] space-y-5">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>Análise Inteligente de Vagas</span>
            </div>

            {/* Quick Test Chips */}
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-[var(--text-muted)] hidden sm:inline">Exemplos:</span>
              <button
                type="button"
                onClick={() => handleApplyQuickTest('gupy')}
                className="px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] text-[var(--text-main)] border border-[var(--border-subtle)] font-semibold cursor-pointer transition-all"
              >
                Testar Gupy
              </button>
              <button
                type="button"
                onClick={() => handleApplyQuickTest('vagas')}
                className="px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] text-[var(--text-main)] border border-[var(--border-subtle)] font-semibold cursor-pointer transition-all"
              >
                Testar Vagas.com
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)] tracking-tight">
              Analisar Vaga por Link &amp; Gerar Currículo ATS
            </h2>
            <p className="text-sm text-[var(--text-muted)] max-w-2xl mt-1.5 leading-relaxed">
              Otimizado para os principais portais de vagas tech: Gupy, Vagas.com, Greenhouse &amp; Lever, Catho, Programathor e Nerdin.
            </p>
          </div>

          {/* Platform Selector Grid - Curated Popular Sites */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Plataformas Suportadas:</span>
              </label>
              <span className="text-[11px] text-[var(--text-muted)]">
                {SUPPORTED_POPULAR_PLATFORMS.length} plataformas verificadas
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {SUPPORTED_POPULAR_PLATFORMS.map((plat) => {
                const isSelected = selectedPlatform === plat.id;
                return (
                  <button
                    key={plat.id}
                    onClick={() => {
                      setSelectedPlatform(plat.id);
                      setAnalysisError('');
                    }}
                    type="button"
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between group ${
                      isSelected
                        ? 'bg-blue-600/10 border-blue-600 text-[var(--text-main)] ring-1 ring-blue-600'
                        : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div className="w-7 h-7 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-center">
                        <PlatformIcon id={plat.id} />
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-muted)]">
                        {plat.badge}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-bold truncate block text-[var(--text-main)]">
                        {plat.name}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] block truncate mt-0.5">
                        {plat.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center gap-3">
            <button
              onClick={() => {
                setActiveMode('url');
                setAnalysisError('');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeMode === 'url'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <Link className="w-3.5 h-3.5" />
              <span>Colar Link da Vaga</span>
            </button>
            <button
              onClick={() => {
                setActiveMode('text');
                setAnalysisError('');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeMode === 'text'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Colar Texto / Descrição Manual</span>
            </button>
          </div>

          {/* Mode 1: URL Input */}
          {activeMode === 'url' && (
            <div className="space-y-3 pt-1">
              <div className="relative">
                <Link className="w-4 h-4 text-[var(--text-faint)] absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  value={jobUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="Cole o link da vaga (Ex: gupy.io, vagas.com.br ou greenhouse.io)"
                  className="glass-input w-full pl-11 pr-24 py-3 rounded-xl text-xs sm:text-sm text-[var(--text-main)]"
                />
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--border-subtle)] text-blue-600 dark:text-blue-400 text-xs font-bold transition-all border border-[var(--border-subtle)] cursor-pointer"
                >
                  Colar
                </button>
              </div>

              {/* URL Feedback helper */}
              {jobUrl && (
                <div className="animate-fade-in text-xs">
                  {currentSupport.isSupported && currentSupport.platform ? (
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        Plataforma reconhecida: <strong>{currentSupport.platform.name}</strong> ({currentSupport.platform.badge})
                      </span>
                    </div>
                  ) : !currentSupport.isSupported ? (
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>
                        Site não suportado para extração por link. Mude para a aba <strong>"Colar Texto"</strong> para analisar esta vaga!
                      </span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Manual Text Input */}
          {activeMode === 'text' && (
            <div className="space-y-4 pt-1 animate-fade-in">
              {/* Guided Notice from Glassdoor/LinkedIn slug detection */}
              {guidedNotice && (
                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-[var(--text-main)] text-xs space-y-2 animate-fade-in shadow-sm">
                  <div className="flex items-center gap-2 font-bold text-blue-600 dark:text-blue-400 text-sm">
                    <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
                    <span>{guidedNotice.platform} Detectado com Sucesso!</span>
                  </div>
                  <p className="text-xs text-[var(--text-main)] leading-relaxed">
                    Identificamos automaticamente: {guidedNotice.title ? <>Cargo: <strong className="text-blue-600 dark:text-blue-400 font-bold">{guidedNotice.title}</strong> </> : null}
                    {guidedNotice.company ? <>| Empresa: <strong className="text-blue-600 dark:text-blue-400 font-bold">{guidedNotice.company}</strong></> : null}.
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] font-medium flex items-start gap-1.5 leading-relaxed">
                    <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <span>
                      Cole o texto da descrição ou requisitos da vaga no campo abaixo (Ctrl+V) e clique em <strong>&quot;Analisar Vaga &amp; Gerar Currículo ATS&quot;</strong> para a IA mapear suas competências.
                    </span>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    Título do Cargo:
                  </label>
                  <input
                    type="text"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="Ex: Desenvolvedor(a) de Software Back-End"
                    className="glass-input w-full px-4 py-2.5 rounded-xl text-xs text-[var(--text-main)] placeholder:text-[var(--text-faint)]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                    Nome da Empresa:
                  </label>
                  <input
                    type="text"
                    value={manualCompany}
                    onChange={(e) => setManualCompany(e.target.value)}
                    placeholder="Ex: BTG Pactual / Nubank / Totvs"
                    className="glass-input w-full px-4 py-2.5 rounded-xl text-xs text-[var(--text-main)] placeholder:text-[var(--text-faint)]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                  Descrição e Requisitos da Vaga (&quot;Sobre a vaga&quot;):
                </label>
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  rows={8}
                  placeholder="Cole aqui o texto de 'Sobre a vaga' (atribuições, tecnologias como React, Node, Java, SQL, diferenciais, etc.)..."
                  className="glass-input w-full p-4 rounded-2xl text-xs text-[var(--text-main)] placeholder:text-[var(--text-faint)] focus:ring-2 focus:ring-blue-500/40 resize-y leading-relaxed font-sans"
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {analysisError && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">{analysisError}</p>
                <p className="text-[11px] text-amber-400/80">
                  Dica: Se a vaga exigir login ou pertencer a um site não suportado por link, mude para a aba <strong>"Colar Texto / Descrição Manual"</strong> para analisar com 100% de precisão.
                </p>
              </div>
            </div>
          )}

          {/* Action Trigger Button */}
          <div className="pt-2">
            <button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className="w-full gradient-btn py-3.5 px-6 rounded-2xl font-extrabold text-sm text-white flex items-center justify-center gap-2.5 shadow-xl shadow-blue-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>{analysisMessage}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" />
                  <span>Analisar Vaga & Gerar Currículo ATS</span>
                  <ArrowRight className="w-4 h-4 text-white ml-1" />
                </>
              )}
            </button>
          </div>

          {/* Progress Steps when analyzing */}
          {isAnalyzing && (
            <div className="p-4 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-2.5 animate-fade-in">
              {[
                { step: 1, label: 'Lendo página e extraindo dados estruturados...' },
                { step: 2, label: 'Mapeando requisitos técnicos e palavras-chave ATS...' },
                { step: 3, label: 'Calculando alinhamento com seu perfil...' },
                { step: 4, label: 'Construindo currículo sob medida para os filtros...' }
              ].map((s) => (
                <div key={s.step} className="flex items-center gap-2.5 text-xs">
                  {analysisStep > s.step ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  ) : analysisStep === s.step ? (
                    <RefreshCw className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-[var(--border-subtle)] flex-shrink-0" />
                  )}
                  <span className={analysisStep >= s.step ? 'text-[var(--text-main)] font-semibold' : 'text-[var(--text-faint)]'}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Analysis Result Card */}
      {analyzedJob && (
        <div className="p-6 sm:p-8 rounded-3xl border border-[var(--border-subtle)] shadow-xl space-y-6 animate-fade-in bg-[var(--bg-card)]">
          
          {/* Header of parsed job */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Vaga Analisada com Sucesso ({analyzedJob.source || 'Plataforma'})</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-[var(--text-main)]">
                {analyzedJob.title}
              </h3>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1 font-semibold text-[var(--text-main)]">
                  <Building className="w-3.5 h-3.5 text-blue-500" />
                  {analyzedJob.company}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  {analyzedJob.location}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  {analyzedJob.workType} ({analyzedJob.level})
                </span>
              </div>
            </div>

            {/* Match Score Badge */}
            {matchResult && (
              <div className="flex flex-col items-end justify-center bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-3 rounded-xl min-w-[130px] text-right">
                <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
                  Match Score
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                    {matchResult.score}%
                  </span>
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">ATS</span>
                </div>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                  {matchResult.score >= 80 ? 'Alta Aderência' : 'Alinhamento Forte'}
                </span>
              </div>
            )}
          </div>

          {/* ATS Keywords Identified */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-blue-500" />
              Requisitos Técnicos &amp; Palavras-Chave ATS:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(analyzedJob.requirements || []).length > 0 ? (
                analyzedJob.requirements.map((tech) => (
                  <span
                    key={tech}
                    className="px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-main)] border border-[var(--border-subtle)] text-xs font-semibold"
                  >
                    {tech}
                  </span>
                ))
              ) : (
                <span className="text-xs text-[var(--text-faint)] italic">
                  Competências gerais identificadas no corpo da descrição.
                </span>
              )}
            </div>
          </div>

          {/* Description Snippet Preview */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">
              Resumo da Descrição da Vaga:
            </label>
            <div className="bg-[var(--bg-subtle)] p-4 rounded-xl border border-[var(--border-subtle)] text-xs text-[var(--text-main)] leading-relaxed max-h-40 overflow-y-auto font-sans">
              {analyzedJob.description || 'Descrição completa registrada.'}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={handleOpenResume}
              className="w-full sm:flex-1 gradient-btn py-3 px-6 rounded-xl font-bold text-xs sm:text-sm text-white flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Gerar Currículo ATS (PDF)</span>
              <ChevronRight className="w-4 h-4 text-white" />
            </button>

            <button
              onClick={handleSaveToFeed}
              disabled={savedSuccess}
              className={`w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs sm:text-sm border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                savedSuccess
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] border-[var(--border-subtle)] text-[var(--text-main)]'
              }`}
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>Salvo na Lista!</span>
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4 text-[var(--text-muted)]" />
                  <span>Salvar na Lista de Vagas</span>
                </>
              )}
            </button>

            {analyzedJob.url && (
              <a
                href={analyzedJob.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-4 py-3 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Ver Anúncio</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

        </div>
      )}

    </div>
  );
}

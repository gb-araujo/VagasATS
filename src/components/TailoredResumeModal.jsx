import React, { useState, useEffect } from 'react';
import {
  X, Download, Copy, Check, FileText, Mail, Sparkles, ShieldCheck,
  CheckCircle2, Link, ExternalLink, Key, RefreshCw, Edit3, Eye,
  AlertCircle, ChevronDown, ChevronUp, Bot, Award, Zap, Wifi, WifiOff,
  Plus, Trash2, RotateCcw, Scale, Code2, TrendingUp, Languages,
  Globe
} from 'lucide-react';
import {
  generateTailoredResume,
  generateTailoredResumeWithLLM,
  generateCoverLetter,
  generateCoverLetterWithLLM,
  testGeminiConnection,
  detectJobLanguage
} from '../services/aiEngine';
import { exportResumeToPDF, cleanResumeTitle, cleanCompanyName } from '../services/pdfService';
import { loadAiSettings, saveAiSettings } from '../services/storageService';

export default function TailoredResumeModal({ job, userProfile, onClose }) {
  // ESC key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const [activeTab, setActiveTab] = useState('resume'); // 'resume' | 'cover' | 'job_desc'
  const [copied, setCopied] = useState(false);
  const [templateStyle, setTemplateStyle] = useState('modern');
  const [tone, setTone] = useState('balanced');

  // Language auto-detection and manual toggle ('auto' | 'pt' | 'en')
  const [targetLanguage, setTargetLanguage] = useState(() => detectJobLanguage(job));



  // Gemini API Key management (BYOK synced with storageService)
  const [apiKey, setApiKey] = useState(() => loadAiSettings().apiKey || '');
  const [showKeyDrawer, setShowKeyDrawer] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [keySavedToast, setKeySavedToast] = useState(false);

  // Connection testing state
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null); // null | 'connected' | 'disconnected'
  const [connectionFeedback, setConnectionFeedback] = useState('');

  // Resume state & AI Generation Progress (Instant pre-render with local semantic engine, 0ms wait)
  const [resumeData, setResumeData] = useState(() => generateTailoredResume(userProfile, job, tone, detectJobLanguage(job)));
  const [initialAiResume, setInitialAiResume] = useState(() => generateTailoredResume(userProfile, job, tone, detectJobLanguage(job)));
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [generationMessage, setGenerationMessage] = useState('');

  // Inline edit mode & feedback
  const [isEditing, setIsEditing] = useState(false);
  const [editToast, setEditToast] = useState('');
  const [lastAiError, setLastAiError] = useState('');

  // Cover Letter state (editable & AI-generated)
  const [coverLetterText, setCoverLetterText] = useState(() => job ? generateCoverLetter(userProfile, job, detectJobLanguage(job)) : '');
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const [coverLetterIsAI, setCoverLetterIsAI] = useState(false);
  const [coverLetterModel, setCoverLetterModel] = useState('');

  // Testa conexão com o Google Gemini
  const handleTestConnection = async (keyToTest = apiKey) => {
    setIsTestingConnection(true);
    setConnectionFeedback('Enviando ping de teste para a API do Google Gemini...');
    try {
      const res = await testGeminiConnection(keyToTest);
      if (res.success) {
        setConnectionStatus('connected');
        setConnectionFeedback(`Conectado! ${res.model} operacional (${res.latencyMs}ms).`);
        setLastAiError('');
      } else {
        setConnectionStatus('disconnected');
        setConnectionFeedback(res.message);
        setLastAiError(res.message);
      }
    } catch (e) {
      setConnectionStatus('disconnected');
      setConnectionFeedback(`Falha: ${e.message}`);
      setLastAiError(`Falha: ${e.message}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleGenerateWithAI = async (selectedTone = tone, keyToUse = apiKey, langToUse = targetLanguage) => {
    if (!job) return;
    setIsGenerating(true);
    setIsGeneratingCoverLetter(true);
    setGenerationStep(1);
    setGenerationMessage(langToUse === 'en'
      ? `Analyzing requirements for ${cleanResumeTitle(job.title)} at ${cleanCompanyName(job.company)}...`
      : `Analisando requisitos e desafios da vaga (${cleanResumeTitle(job.title)} na ${cleanCompanyName(job.company)})...`
    );

    const timer1 = setTimeout(() => {
      setGenerationStep(2);
      setGenerationMessage(langToUse === 'en'
        ? `Structuring STAR experience bullet points in professional English...`
        : `Mapeando histórico e ferramentas de ${userProfile.fullName || 'seu perfil'}...`
      );
    }, 250);

    const timer2 = setTimeout(() => {
      setGenerationStep(3);
      setGenerationMessage(langToUse === 'en'
        ? 'Drafting ATS-tailored resume & cover letter in English...'
        : 'Redigindo currículo e carta de apresentação sob medida para ATS...'
      );
    }, 550);

    try {
      // 1. Gera com prioridade máxima o currículo sob medida (rápido e sem concorrência de tokens)
      const result = await generateTailoredResumeWithLLM(userProfile, job, keyToUse, selectedTone, 'auto', langToUse);

      clearTimeout(timer1);
      clearTimeout(timer2);

      setResumeData(result);
      setInitialAiResume(result);
      if (result.isRealAI) {
        setConnectionStatus('connected');
        setLastAiError('');
        setEditToast(`Currículo gerado com sucesso pelo modelo ${result.aiModel || 'Gemini Flash'}!`);
        setTimeout(() => setEditToast(''), 4500);

        // Gera a carta de apresentação em segundo plano logo após para não saturar a cota por minuto (15 RPM)
        generateCoverLetterWithLLM(userProfile, job, keyToUse, langToUse, selectedTone)
          .then(coverRes => {
            if (coverRes && coverRes.text) {
              setCoverLetterText(coverRes.text);
              setCoverLetterIsAI(coverRes.isRealAI);
              setCoverLetterModel(coverRes.model || 'Gemini Flash');
            }
          })
          .catch(() => {})
          .finally(() => setIsGeneratingCoverLetter(false));
      } else {
        setConnectionStatus('disconnected');
        const errMsg = result.aiError || 'Falha ao contatar a API de IA. Exibindo versão base estruturada.';
        setLastAiError(errMsg);
        setEditToast(`Aviso: ${errMsg}`);
        setTimeout(() => setEditToast(''), 8000);
        setIsGeneratingCoverLetter(false);
      }
    } catch (err) {
      console.error("Erro na geração com IA:", err);
      const fallback = generateTailoredResume(userProfile, job, selectedTone, langToUse);
      setResumeData(fallback);
      setInitialAiResume(fallback);
    } finally {
      setIsGenerating(false);
      setIsGeneratingCoverLetter(false);
      setGenerationStep(0);
    }
  };

  const handleRegenerateCoverLetter = async () => {
    if (!job) return;
    setIsGeneratingCoverLetter(true);
    try {
      const effectiveKey = (apiKey || loadAiSettings()?.apiKey || '').trim();
      const res = await generateCoverLetterWithLLM(userProfile, job, effectiveKey, targetLanguage, tone);
      if (res && res.text) {
        setCoverLetterText(res.text);
        setCoverLetterIsAI(res.isRealAI);
        setCoverLetterModel(res.model || 'Gemini Flash');
        setEditToast(res.isRealAI ? 'Carta gerada com IA com sucesso!' : 'Carta gerada pelo motor ATS local.');
        setTimeout(() => setEditToast(''), 3000);
      }
    } catch (e) {
      console.error('Falha ao gerar carta:', e);
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  };

  const handleLanguageChange = (newLang) => {
    setTargetLanguage(newLang);
    const updated = generateTailoredResume(userProfile, job, tone, newLang);
    setResumeData(updated);
    setInitialAiResume(updated);
    setCoverLetterText(generateCoverLetter(userProfile, job, newLang));
    const effectiveKey = (apiKey || loadAiSettings()?.apiKey || '').trim();
    if (effectiveKey) {
      handleGenerateWithAI(tone, effectiveKey, newLang);
    }
  };

  // Sempre que a vaga ou o perfil mudarem, inicializa instantaneamente e refina com IA em segundo plano
  useEffect(() => {
    if (!job) return;
    const detectedLang = detectJobLanguage(job);
    setTargetLanguage(detectedLang);
    const base = generateTailoredResume(userProfile, job, tone, detectedLang);
    setResumeData(base);
    setInitialAiResume(base);
    setCoverLetterText(generateCoverLetter(userProfile, job, detectedLang));

    const effectiveKey = (apiKey || loadAiSettings()?.apiKey || '').trim();
    if (effectiveKey) {
      if (!apiKey) setApiKey(effectiveKey);
      handleGenerateWithAI(tone, effectiveKey, detectedLang);
    }
  }, [job?.id, userProfile]);

  const handleSaveApiKey = async () => {
    const trimmed = tempApiKey.trim();
    setApiKey(trimmed);
    saveAiSettings({ apiKey: trimmed });
    setKeySavedToast(true);
    setTimeout(() => setKeySavedToast(false), 3500);

    // Testa a nova chave salva imediatamente
    await handleTestConnection(trimmed);

    // E já reanalisa o currículo com a nova chave
    handleGenerateWithAI(tone, trimmed, targetLanguage);
  };

  if (!job) return null;

  const handleToneChange = (newTone) => {
    setTone(newTone);
    const effectiveKey = (apiKey || loadAiSettings()?.apiKey || '').trim();
    if (effectiveKey) {
      handleGenerateWithAI(newTone, effectiveKey, targetLanguage);
    }
  };

  const handleDownloadPDF = () => {
    exportResumeToPDF(resumeData, templateStyle);
  };

  const handleCopyCoverLetter = () => {
    navigator.clipboard.writeText(coverLetterText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Inline editing handlers
  const handleUpdateHeader = (field, val) => {
    setResumeData(prev => ({ ...prev, [field]: val }));
  };

  const handleUpdateSummary = (val) => {
    setResumeData(prev => ({ ...prev, tailoredSummary: val }));
  };

  const handleUpdateSkills = (val) => {
    const list = val.split(',').map(s => s.trim()).filter(Boolean);
    setResumeData(prev => ({ ...prev, skills: list }));
  };

  const handleUpdateExpField = (expIndex, field, val) => {
    setResumeData(prev => {
      const newExps = [...(prev.experiences || [])];
      newExps[expIndex] = { ...newExps[expIndex], [field]: val };
      return { ...prev, experiences: newExps };
    });
  };

  const handleUpdateBullet = (expIndex, bulletIndex, val) => {
    setResumeData(prev => {
      const newExps = [...(prev.experiences || [])];
      const targetExp = { ...newExps[expIndex] };
      const newBullets = [...(targetExp.bullets || [])];
      newBullets[bulletIndex] = val;
      targetExp.bullets = newBullets;
      targetExp.description = newBullets.map(b => `• ${b}`).join('\n');
      newExps[expIndex] = targetExp;
      return { ...prev, experiences: newExps };
    });
  };

  const handleAddBullet = (expIndex) => {
    setResumeData(prev => {
      const newExps = [...(prev.experiences || [])];
      const targetExp = { ...newExps[expIndex] };
      const bullets = [...(targetExp.bullets || [])];
      bullets.push("Desenvolvimento e entrega de solução técnica gerando melhoria de processos e performance.");
      targetExp.bullets = bullets;
      targetExp.description = bullets.map(b => `• ${b}`).join('\n');
      newExps[expIndex] = targetExp;
      return { ...prev, experiences: newExps };
    });
  };

  const handleRemoveBullet = (expIndex, bulletIndex) => {
    setResumeData(prev => {
      const newExps = [...(prev.experiences || [])];
      const targetExp = { ...newExps[expIndex] };
      const bullets = (targetExp.bullets || []).filter((_, i) => i !== bulletIndex);
      targetExp.bullets = bullets;
      targetExp.description = bullets.map(b => `• ${b}`).join('\n');
      newExps[expIndex] = targetExp;
      return { ...prev, experiences: newExps };
    });
  };

  const handleAddExperience = () => {
    setResumeData(prev => ({
      ...prev,
      experiences: [
        {
          id: `exp-${Date.now()}`,
          role: "Desenvolvedor de Software",
          company: "Empresa Contratante",
          period: "2024 - Atual",
          bullets: [
            "Arquitetura e desenvolvimento de aplicações web modernas com foco em boas práticas e performance."
          ],
          description: "• Arquitetura e desenvolvimento de aplicações web modernas."
        },
        ...(prev.experiences || [])
      ]
    }));
  };

  const handleRemoveExperience = (expIndex) => {
    setResumeData(prev => ({
      ...prev,
      experiences: (prev.experiences || []).filter((_, i) => i !== expIndex)
    }));
  };

  const handleUpdateEduField = (eduIndex, field, val) => {
    setResumeData(prev => {
      const newEdu = [...(prev.education || [])];
      newEdu[eduIndex] = { ...newEdu[eduIndex], [field]: val };
      return { ...prev, education: newEdu };
    });
  };

  const handleAddEducation = () => {
    setResumeData(prev => ({
      ...prev,
      education: [
        ...(prev.education || []),
        {
          degree: "Graduação / Curso Superior",
          institution: "Instituição de Ensino",
          year: new Date().getFullYear().toString()
        }
      ]
    }));
  };

  const handleRemoveEducation = (eduIndex) => {
    setResumeData(prev => ({
      ...prev,
      education: (prev.education || []).filter((_, i) => i !== eduIndex)
    }));
  };

  const handleUpdateLanguageField = (langIndex, field, val) => {
    setResumeData(prev => {
      const newLangs = [...(prev.languages || [])].map((item, i) => {
        if (i !== langIndex) return item;
        const currentObj = typeof item === 'string' ? { name: item, level: 'Intermediário (B2)' } : item;
        return { ...currentObj, [field]: val };
      });
      return { ...prev, languages: newLangs };
    });
  };

  const handleAddLanguageInModal = () => {
    setResumeData(prev => ({
      ...prev,
      languages: [
        ...(prev.languages || []),
        { id: `lang-${Date.now()}`, name: "Novo Idioma", level: "Intermediário (B2)" }
      ]
    }));
  };

  const handleRemoveLanguageInModal = (langIndex) => {
    setResumeData(prev => ({
      ...prev,
      languages: (prev.languages || []).filter((_, i) => i !== langIndex)
    }));
  };

  const handleRestoreOriginal = () => {
    if (initialAiResume) {
      setResumeData(JSON.parse(JSON.stringify(initialAiResume)));
      setEditToast('Currículo restaurado para a versão original gerada pela IA!');
      setTimeout(() => setEditToast(''), 3500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-panel w-full max-w-4xl rounded-2xl border border-[var(--border-strong)] shadow-xl overflow-hidden my-6 max-h-[92vh] flex flex-col bg-[var(--bg-card)]">

        {/* Header */}
        <div className="p-6 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Currículo Personalizado sob Medida
              </span>

              {/* Status de Conexão com a IA */}
              {connectionStatus === 'connected' ? (
                <span className="text-xs text-emerald-600 dark:text-emerald-300 font-bold flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full shadow-sm animate-fade-in">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                  IA Conectada ({resumeData.aiModel || 'Gemini Flash'})
                </span>
              ) : connectionStatus === 'disconnected' ? (
                <button
                  type="button"
                  onClick={() => setShowKeyDrawer(true)}
                  className="text-xs text-rose-600 dark:text-rose-300 font-bold flex items-center gap-1.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 px-2.5 py-0.5 rounded-full cursor-pointer transition-all"
                  title="IA Desconectada. Clique aqui para abrir a configuração da chave e diagnosticar."
                >
                  <WifiOff className="w-3.5 h-3.5 text-rose-500" />
                  <span>IA Desconectada (Clique para Conectar)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowKeyDrawer(true)}
                  className="text-xs text-blue-600 dark:text-blue-300 font-semibold flex items-center gap-1 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 rounded-full cursor-pointer transition-all"
                  title="Motor semântico ativo. Clique para conectar Google Gemini."
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Motor Semântico Ativo</span>
                </button>
              )}



              {/* Tag de Idioma Ativo */}
              <span className="text-xs font-bold flex items-center gap-1 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full">
                <Globe className="w-3.5 h-3.5 text-indigo-500" />
                <span>{resumeData.language === 'en' ? 'Inglês (ATS Global)' : 'Português (BR)'}</span>
              </span>

              {/* Tag de Trajetória / Contexto Enriquecido */}
              {userProfile?.careerContext?.trim() && (
                <span className="text-xs font-bold flex items-center gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full" title="Currículo enriquecido e adensado com dados da Janela de Contexto do seu perfil">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Trajetória Enriquecida</span>
                </span>
              )}
            </div>

            <h2 className="text-lg font-bold text-[var(--text-main)] mt-1">
              Currículo para: {cleanResumeTitle(job.title)} ({cleanCompanyName(job.company)})
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Tabs */}
            <div className="flex bg-[var(--bg-subtle)] p-1 rounded-xl border border-[var(--border-subtle)]">
              <button
                onClick={() => setActiveTab('resume')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'resume'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Currículo PDF
              </button>
              <button
                onClick={() => setActiveTab('job_desc')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'job_desc'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Descrição da Vaga
              </button>
              <button
                onClick={() => setActiveTab('cover')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'cover'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
              >
                <Mail className="w-3.5 h-3.5" />
                Carta
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-[var(--bg-subtle)] text-[var(--text-faint)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>



        {/* Key Drawer / API Key configuration banner */}
        {showKeyDrawer && (
          <div className="bg-[var(--bg-card)] border-b border-[var(--border-subtle)] p-4 animate-fade-in text-xs space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-bold text-amber-600 dark:text-amber-300 flex items-center gap-1.5 text-sm">
                  <Key className="w-4 h-4" /> Conectar Chave do Google Gemini (Gratuito &amp; Oficial)
                </h4>
                <p className="text-[var(--text-muted)] mt-1">
                  Insira sua chave do Google Gemini para raciocínio profundo e geração 100% personalizada em tempo real. A chave fica gravada no seu navegador.
                </p>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-cyan-400 hover:underline flex items-center gap-1 mt-1 font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Gerar chave grátis no Google AI Studio (aistudio.google.com)
                </a>
              </div>
              <button
                onClick={() => setShowKeyDrawer(false)}
                className="text-[var(--text-faint)] hover:text-[var(--text-main)] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="Cole sua API Key aqui (ex: AIzaSy...)"
                className="glass-input rounded-xl px-3 py-2 text-xs text-[var(--text-main)] flex-1 min-w-[260px]"
              />
              <button
                onClick={() => handleTestConnection(tempApiKey)}
                disabled={isTestingConnection}
                className="px-3.5 py-2 bg-[var(--bg-subtle)] hover:bg-[var(--bg-card)] text-cyan-600 dark:text-cyan-300 border border-cyan-500/40 font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Wifi className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-pulse' : ''}`} />
                <span>{isTestingConnection ? 'Testando...' : 'Testar Chave'}</span>
              </button>
              <button
                onClick={handleSaveApiKey}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl transition-all shadow cursor-pointer"
              >
                Salvar &amp; Conectar
              </button>
            </div>

            {connectionFeedback && (
              <div className={`p-2.5 rounded-xl border font-medium text-xs flex items-center gap-2 ${connectionStatus === 'connected'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40'
                }`}>
                {connectionStatus === 'connected' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                )}
                <span>{connectionFeedback}</span>
              </div>
            )}
          </div>
        )}

        {keySavedToast && (
          <div className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-b border-emerald-500/40 p-2 text-center text-xs font-bold animate-fade-in flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Chave do Gemini configurada com sucesso!
          </div>
        )}

        {editToast && (
          <div className="bg-blue-500/15 text-blue-800 dark:text-blue-200 border-b border-blue-500/40 p-2 text-center text-xs font-bold animate-fade-in flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
            {editToast}
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {activeTab === 'resume' ? (
            <>
              {/* Alerta de Diagnóstico quando IA não estiver conectada */}
              {(!resumeData.isRealAI || connectionStatus === 'disconnected') && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl text-xs space-y-1.5 animate-fade-in">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-300">
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Exibindo versão base estruturada (Motor ATS Local)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowKeyDrawer(true)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-lg transition-all shadow cursor-pointer text-xs"
                    >
                      {apiKey ? 'Testar / Trocar Chave IA' : 'Inserir Chave do Google Gemini'}
                    </button>
                  </div>
                  <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
                    <strong>Diagnóstico da IA:</strong> {lastAiError || resumeData.aiError || (apiKey ? 'O motor ATS local gerou o currículo base. Clique em Reanalisar com IA para gerar via Google Gemini.' : 'Nenhuma chave de API configurada neste navegador. Para personalização profunda e única via Google Gemini, conecte sua chave gratuita.')}
                  </p>
                </div>
              )}

              {/* AI Controls Toolbar */}
              <div className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3">

                  {/* Regeneration, Language & Tone Controls */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        const effectiveKey = (apiKey || loadAiSettings()?.apiKey || '').trim();
                        if (!effectiveKey) {
                          setShowKeyDrawer(true);
                          setEditToast('Configure sua API Key do Google Gemini para reanalisar com IA.');
                          setTimeout(() => setEditToast(''), 4500);
                        } else {
                          handleGenerateWithAI(tone, effectiveKey, targetLanguage);
                        }
                      }}
                      disabled={isGenerating}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                      <span>{isGenerating ? 'Refinando...' : 'Reanalisar com IA'}</span>
                    </button>

                    {/* Language Switcher */}
                    <div className="flex bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-subtle)] gap-1">
                      <button
                        onClick={() => handleLanguageChange('pt')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${targetLanguage === 'pt' ? 'bg-blue-600 text-white shadow' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                          }`}
                        title="Gerar currículo estruturado em Português"
                      >
                        <Globe className="w-3 h-3 text-cyan-500" />
                        <span>Português</span>
                      </button>
                      <button
                        onClick={() => handleLanguageChange('en')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${targetLanguage === 'en' ? 'bg-blue-600 text-white shadow' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                          }`}
                        title="Gerar currículo 100% em Inglês para vagas internacionais/remotas"
                      >
                        <Globe className="w-3 h-3 text-emerald-500" />
                        <span>English {detectJobLanguage(job) === 'en' && '(Detectado)'}</span>
                      </button>
                    </div>

                    {/* Botão de Testar Conexão IA */}
                    <button
                      onClick={() => handleTestConnection()}
                      disabled={isTestingConnection}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-sm cursor-pointer ${connectionStatus === 'connected'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                          : connectionStatus === 'disconnected'
                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 hover:bg-rose-500/25'
                            : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] border-[var(--border-subtle)]'
                        }`}
                      title="Testa a comunicação em tempo real com o modelo do Google Gemini"
                    >
                      <Wifi className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin' : ''}`} />
                      <span>
                        {isTestingConnection
                          ? 'Testando...'
                          : connectionStatus === 'connected'
                            ? <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> IA Conectada</span>
                            : connectionStatus === 'disconnected'
                              ? <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Testar Conexão IA</span>
                              : 'Testar Conexão IA'}
                      </span>
                    </button>

                    <div className="flex bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-subtle)] gap-1">
                      <button
                        onClick={() => handleToneChange('balanced')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${tone === 'balanced' ? 'bg-blue-600 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                          }`}
                        title="Tom fluido equilibrando técnica e impacto"
                      >
                        <Scale className="w-3 h-3 text-blue-400" />
                        <span>Equilibrado</span>
                      </button>
                      <button
                        onClick={() => handleToneChange('tech')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${tone === 'tech' ? 'bg-blue-600 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                          }`}
                        title="Foco em ferramentas, linguagens e arquitetura"
                      >
                        <Code2 className="w-3 h-3 text-cyan-400" />
                        <span>Stack Técnica</span>
                      </button>
                      <button
                        onClick={() => handleToneChange('impact')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${tone === 'impact' ? 'bg-blue-600 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                          }`}
                        title="Foco em resultados de negócio e otimizações"
                      >
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                        <span>Resultados</span>
                      </button>
                    </div>
                  </div>

                  {/* Edit Toggle & Key Settings */}
                  <div className="flex items-center gap-2">

                    {/* Botão de Edição de Destaque */}
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 border shadow-md cursor-pointer ${isEditing
                          ? 'bg-amber-500 text-slate-950 border-amber-400 ring-2 ring-amber-400/50 shadow-amber-500/25'
                          : 'bg-[var(--bg-subtle)] hover:bg-[var(--bg-card)] text-amber-700 dark:text-amber-300 border-amber-500/40'
                        }`}
                      title="Editar textos, habilidades e experiências antes de baixar o PDF"
                    >
                      {isEditing ? (
                        <>
                          <Check className="w-4 h-4 text-slate-950" />
                          <span>Concluir Edição</span>
                        </>
                      ) : (
                        <>
                          <Edit3 className="w-4 h-4 text-amber-500" />
                          <span>Editar Currículo</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setShowKeyDrawer(!showKeyDrawer)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 border cursor-pointer ${apiKey
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                          : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-main)]'
                        }`}
                      title={apiKey ? "Chave configurada. Clique para gerenciar." : "Configurar chave do Gemini"}
                    >
                      <Key className="w-3.5 h-3.5 text-amber-500" />
                      <span>{apiKey ? 'Chave IA (Ativa)' : 'Configurar Chave'}</span>
                    </button>

                    <select
                      value={templateStyle}
                      onChange={(e) => setTemplateStyle(e.target.value)}
                      className="bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] text-xs rounded-xl px-2.5 py-1.5 font-medium focus:outline-none cursor-pointer"
                    >
                      <option value="modern">Tema Tech Modern (Azul)</option>
                      <option value="executive">Tema Executive (Marinho)</option>
                    </select>
                  </div>
                </div>

                {/* Real-time generation progress overlay */}
                {isGenerating && (
                  <div className="bg-[var(--bg-card)] border border-blue-500/40 p-3 rounded-xl animate-pulse space-y-2">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-cyan-400 text-xs font-bold">
                      <Bot className="w-4 h-4 animate-bounce" />
                      <span>{generationMessage}</span>
                    </div>
                    <div className="w-full bg-[var(--border-subtle)] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full transition-all duration-500"
                        style={{ width: `${(generationStep / 3) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Feedback se houver erro na IA generativa */}
                {resumeData.aiError && !isGenerating && (
                  <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl text-xs text-amber-700 dark:text-amber-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span>Aviso da IA: {resumeData.aiError}. O currículo foi gerado com o motor semântico local.</span>
                    </div>
                    <button
                      onClick={() => setShowKeyDrawer(true)}
                      className="underline text-amber-600 dark:text-amber-300 font-bold hover:text-amber-500 cursor-pointer"
                    >
                      Verificar Chave
                    </button>
                  </div>
                )}

                {/* ATS Compliance & Keywords matched bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)] text-[11px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[var(--text-muted)] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      Palavras-chave ATS incorporadas:
                    </span>
                    {(resumeData.atsKeywords || []).slice(0, 8).map((kw, i) => (
                      <span key={i} className="bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded-md font-semibold">
                        ✓ {kw}
                      </span>
                    ))}
                  </div>

                  <div className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                    {resumeData.matchScore || 90}% Match ATS
                  </div>
                </div>
              </div>

              {/* Banner de Edição Ativo */}
              {isEditing && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between flex-wrap gap-3 text-xs animate-fade-in">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      <Edit3 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-700 dark:text-amber-300 text-sm">Modo de Edição Ativo</h4>
                      <p className="text-[var(--text-muted)] text-[11px] mt-0.5">
                        Altere os campos diretamente no documento abaixo. Suas alterações serão salvas e incluídas no PDF final!
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRestoreOriginal}
                      className="px-3 py-1.5 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                      title="Restaura os textos originais criados pela IA"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Restaurar Versão da IA</span>
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer transition-all"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Concluir & Ver Prévia</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Raio-X da Vaga & Estratégia de Alinhamento IA */}
              <div className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="text-xs font-bold text-[var(--text-main)]">
                        Raio-X da Vaga Analisada: {cleanResumeTitle(job.title)} na {cleanCompanyName(job.company)}
                      </h3>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {job.workType} • {job.location || 'Brasil'} • Palavras-chave extraídas da descrição oficial
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {resumeData.isRealAI ? (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Zap className="w-3 h-3 text-emerald-500" />
                        Gerado com Google Gemini ({resumeData.aiModel})
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-300 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-blue-500" />
                        Motor Semântico Local Otimizado
                      </span>
                    )}
                  </div>
                </div>

                {/* Highlights do Alinhamento */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-[11px]">
                  <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] p-2.5 rounded-xl space-y-1">
                    <span className="text-blue-600 dark:text-blue-400 font-bold block">1. Formação & Identidade</span>
                    <p className="text-[var(--text-muted)]">
                      Análise e Desenvolvimento de Sistemas (SENAC) e stacks reais em formato conciso.
                    </p>
                  </div>
                  <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] p-2.5 rounded-xl space-y-1">
                    <span className="text-blue-600 dark:text-blue-400 font-bold block">2. Experiências Reais</span>
                    <p className="text-[var(--text-muted)]">
                      Ihm it solutions (n8n, Typebot, React, Next.js, SQL) e histórico comprovado.
                    </p>
                  </div>
                  <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] p-2.5 rounded-xl space-y-1">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold block">3. Requisitos da Empresa</span>
                    <p className="text-[var(--text-muted)]">
                      Integração de Clean Code, APIs e palavras-chave ATS da vaga sob medida.
                    </p>
                  </div>
                </div>
              </div>

              {/* Document Paper Preview Container */}
              <div className="relative max-w-3xl mx-auto">
                {/* Floating Loading Overlay when AI is generating */}
                {isGenerating && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 animate-fade-in pointer-events-none">
                    <div className="glass-panel p-6 rounded-2xl border border-blue-500/40 shadow-2xl max-w-md w-full text-center space-y-4 bg-[var(--bg-card)]/95 backdrop-blur-md pointer-events-auto">
                      <div className="w-14 h-14 rounded-2xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
                        <Sparkles className="w-7 h-7 animate-pulse text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-[var(--text-main)] flex items-center justify-center gap-2">
                          <span>A IA está gerando seu currículo sob medida</span>
                        </h4>
                        <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">
                          {generationMessage || "Alinhando competências, palavras-chave ATS e método STAR..."}
                        </p>
                      </div>

                      {/* Animated Progress Bar */}
                      <div className="w-full bg-[var(--bg-subtle)] rounded-full h-2 overflow-hidden border border-[var(--border-subtle)]">
                        <div
                          className="bg-gradient-to-r from-blue-600 to-cyan-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(25, (generationStep / 3) * 100)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-medium pt-1">
                        <span className={generationStep >= 1 ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}>1. Vaga</span>
                        <span className={generationStep >= 2 ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}>2. Experiências</span>
                        <span className={generationStep >= 3 ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}>3. ATS &amp; Carta</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Document Paper Preview with Blur during generation */}
                <div
                  id="print-resume-sheet"
                  className={`bg-white text-gray-900 p-8 rounded-2xl shadow-2xl border border-gray-300 font-sans transition-all duration-300 ${isGenerating ? 'filter blur-[6px] opacity-40 select-none pointer-events-none scale-[0.99]' : ''
                    }`}
                >

                  {/* Header (Nome e Contatos) */}
                  {isEditing ? (
                    <div className="border-b border-amber-300 pb-4 mb-4 bg-amber-50/50 p-4 rounded-xl border border-dashed space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                          Editar Dados Pessoais & Cabeçalho
                        </span>
                        <span className="text-[10px] text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded font-bold">Editável</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[10px] text-gray-600 font-bold block mb-1">Nome Completo:</label>
                          <input
                            type="text"
                            value={resumeData.fullName || ''}
                            onChange={(e) => handleUpdateHeader('fullName', e.target.value)}
                            className="w-full text-xs font-bold text-gray-900 bg-white border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                            placeholder="Seu nome completo"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-600 font-bold block mb-1">Cargo Alvo / Título do Currículo:</label>
                          <input
                            type="text"
                            value={resumeData.targetJobTitle || ''}
                            onChange={(e) => handleUpdateHeader('targetJobTitle', e.target.value)}
                            className="w-full text-xs font-bold text-gray-900 bg-white border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: Desenvolvedor Full Stack"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-600 font-semibold block mb-0.5">E-mail:</label>
                          <input
                            type="email"
                            value={resumeData.email || ''}
                            onChange={(e) => handleUpdateHeader('email', e.target.value)}
                            className="w-full text-[11px] text-gray-900 bg-white border border-gray-300 rounded p-1.5"
                            placeholder="email@exemplo.com"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-600 font-semibold block mb-0.5">Telefone:</label>
                          <input
                            type="text"
                            value={resumeData.phone || ''}
                            onChange={(e) => handleUpdateHeader('phone', e.target.value)}
                            className="w-full text-[11px] text-gray-900 bg-white border border-gray-300 rounded p-1.5"
                            placeholder="(11) 99999-9999"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-600 font-semibold block mb-0.5">Localização:</label>
                          <input
                            type="text"
                            value={resumeData.location || ''}
                            onChange={(e) => handleUpdateHeader('location', e.target.value)}
                            className="w-full text-[11px] text-gray-900 bg-white border border-gray-300 rounded p-1.5"
                            placeholder="São Paulo, SP"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-600 font-semibold block mb-0.5">LinkedIn / GitHub:</label>
                          <input
                            type="text"
                            value={resumeData.linkedin || ''}
                            onChange={(e) => handleUpdateHeader('linkedin', e.target.value)}
                            className="w-full text-[11px] text-gray-900 bg-white border border-gray-300 rounded p-1.5"
                            placeholder="linkedin.com/in/perfil"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border-b border-gray-300 pb-4 mb-4">
                      <h1 className="text-2xl font-bold text-blue-700 uppercase tracking-tight">
                        {resumeData.fullName || "Lucas Silva Pessoa"}
                      </h1>
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mt-0.5 break-words">
                        {cleanResumeTitle(resumeData.targetJobTitle)}
                      </p>
                      <p className="text-[11px] text-gray-600 mt-2 break-words leading-relaxed">
                        {[resumeData.email, resumeData.phone, resumeData.location, resumeData.linkedin].filter(Boolean).join('  |  ') || "Preencha seus contatos na aba 'Meu Perfil'"}
                      </p>
                    </div>
                  )}

                  {/* Summary Section */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between border-b border-blue-200 pb-1 mb-2">
                      <h2 className="text-xs font-bold text-blue-700 uppercase">
                        {resumeData.language === 'en' ? 'Professional Summary' : 'Resumo Profissional'}
                      </h2>
                      {isEditing && (
                        <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                          <Edit3 className="w-3 h-3" /> Editando Resumo
                        </span>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-1.5">
                        <textarea
                          value={resumeData.tailoredSummary || ''}
                          onChange={(e) => handleUpdateSummary(e.target.value)}
                          rows={7}
                          className="w-full text-xs text-gray-900 bg-amber-50/50 border border-amber-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed font-sans"
                          placeholder="Edite o resumo profissional gerado pela IA..."
                        />
                        <p className="text-[10px] text-gray-500">
                          Dica ATS: 1 ou 2 parágrafos curtos com sua formação, principais tecnologias e impacto prático.
                        </p>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-800 leading-relaxed whitespace-pre-line space-y-3 font-sans">
                        {resumeData.tailoredSummary}
                      </div>
                    )}
                  </div>

                  {/* Technical Skills Section */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between border-b border-blue-200 pb-1 mb-2">
                      <h2 className="text-xs font-bold text-blue-700 uppercase">
                        {resumeData.language === 'en' ? 'Technical Skills' : 'Habilidades Técnicas'}
                      </h2>
                      {isEditing && (
                        <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-bold">
                          Separe por vírgulas
                        </span>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={(resumeData.skills || []).join(', ')}
                          onChange={(e) => handleUpdateSkills(e.target.value)}
                          className="w-full text-xs text-gray-900 bg-amber-50/50 border border-amber-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
                          placeholder="Ex: React, Next.js, Node.js, Python, SQL, REST APIs, Git, Docker"
                        />
                        <div className="flex flex-wrap gap-1">
                          {(resumeData.skills || []).map((sk, sIdx) => (
                            <span key={sIdx} className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
                              {sk}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-800 font-medium leading-relaxed">
                        {(resumeData.skills || []).join('  |  ')}
                      </p>
                    )}
                  </div>

                  {/* Experience Section */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between border-b border-blue-200 pb-1 mb-2">
                      <h2 className="text-xs font-bold text-blue-700 uppercase">
                        {resumeData.language === 'en' ? 'Professional Experience' : 'Experiência Profissional'}
                      </h2>
                      {isEditing && (
                        <button
                          type="button"
                          onClick={handleAddExperience}
                          className="text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Adicionar Nova Empresa</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      {(resumeData.experiences || []).map((exp, idx) => {
                        const cleanPeriod = (exp.period || "").replace(/^\((.*)\)$/, "$1");
                        const bulletList = exp.bullets && exp.bullets.length > 0
                          ? exp.bullets
                          : (exp.description || "").split('\n').filter(Boolean);

                        return (
                          <div key={idx} className={isEditing ? 'p-3 bg-amber-50/40 rounded-xl border border-amber-200 space-y-2' : ''}>

                            {isEditing ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-bold text-amber-800">Experiência #{idx + 1}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveExperience(idx)}
                                    className="text-[10px] text-red-600 hover:text-red-800 flex items-center gap-1 font-semibold cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Remover Empresa</span>
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-[10px] text-gray-600 font-bold block mb-0.5">Cargo:</label>
                                    <input
                                      type="text"
                                      value={exp.role || ''}
                                      onChange={(e) => handleUpdateExpField(idx, 'role', e.target.value)}
                                      className="w-full text-xs font-bold text-gray-900 bg-white border border-gray-300 rounded p-1.5"
                                      placeholder="Ex: Desenvolvedor Full Stack"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-gray-600 font-bold block mb-0.5">Empresa:</label>
                                    <input
                                      type="text"
                                      value={exp.company || ''}
                                      onChange={(e) => handleUpdateExpField(idx, 'company', e.target.value)}
                                      className="w-full text-xs text-gray-900 bg-white border border-gray-300 rounded p-1.5"
                                      placeholder="Ex: Tech Solutions"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-gray-600 font-bold block mb-0.5">Período:</label>
                                    <input
                                      type="text"
                                      value={exp.period || ''}
                                      onChange={(e) => handleUpdateExpField(idx, 'period', e.target.value)}
                                      className="w-full text-xs text-gray-900 bg-white border border-gray-300 rounded p-1.5"
                                      placeholder="Ex: 2023 - Atual"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1.5 pt-1">
                                  <label className="text-[10px] text-gray-600 font-bold block">
                                    Tópicos de Realização & Entregas (Método STAR):
                                  </label>
                                  {bulletList.map((bullet, bIdx) => (
                                    <div key={bIdx} className="flex items-start gap-1.5">
                                      <textarea
                                        value={bullet.replace(/^[•\-\s]+/, '')}
                                        onChange={(e) => handleUpdateBullet(idx, bIdx, e.target.value)}
                                        rows={2}
                                        className="w-full text-xs text-gray-900 bg-white border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed font-sans"
                                        placeholder="Ação + Tecnologia + Resultado concreto..."
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveBullet(idx, bIdx)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                        title="Remover este tópico"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}

                                  <button
                                    type="button"
                                    onClick={() => handleAddBullet(idx)}
                                    className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 pt-1 cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>+ Adicionar Tópico nesta Experiência</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="flex justify-between items-baseline">
                                  <h3 className="text-xs font-bold text-gray-900">{exp.role}</h3>
                                  <span className="text-[11px] text-gray-500 font-semibold">
                                    {cleanCompanyName(exp.company)} {cleanPeriod ? `• ${cleanPeriod}` : ''}
                                  </span>
                                </div>

                                <ul className="list-disc list-inside space-y-1.5 text-xs text-gray-700 mt-1.5 pl-1">
                                  {Array.from(new Set(bulletList.map(b => b.replace(/^[•\-\s]+/, '').trim()))).filter(Boolean).map((cleanBullet, bIdx) => (
                                    <li key={bIdx} className="leading-relaxed">
                                      {cleanBullet}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Education Section */}
                  <div>
                    <div className="flex items-center justify-between border-b border-blue-200 pb-1 mb-2">
                      <h2 className="text-xs font-bold text-blue-700 uppercase">
                        {resumeData.language === 'en' ? 'Education' : 'Formação Acadêmica'}
                      </h2>
                      {isEditing && (
                        <button
                          type="button"
                          onClick={handleAddEducation}
                          className="text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Adicionar Formação</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {(resumeData.education || []).map((edu, idx) => (
                        <div key={idx}>
                          {isEditing ? (
                            <div className="flex items-center gap-2 p-2 bg-amber-50/40 rounded-lg border border-amber-200">
                              <input
                                type="text"
                                value={edu.degree || ''}
                                onChange={(e) => handleUpdateEduField(idx, 'degree', e.target.value)}
                                className="flex-1 text-xs font-bold text-gray-900 bg-white border border-gray-300 rounded p-1.5"
                                placeholder="Curso / Graduação"
                              />
                              <input
                                type="text"
                                value={edu.institution || ''}
                                onChange={(e) => handleUpdateEduField(idx, 'institution', e.target.value)}
                                className="flex-1 text-xs text-gray-900 bg-white border border-gray-300 rounded p-1.5"
                                placeholder="Instituição (ex: SENAC)"
                              />
                              <input
                                type="text"
                                value={edu.year || ''}
                                onChange={(e) => handleUpdateEduField(idx, 'year', e.target.value)}
                                className="w-24 text-xs text-gray-900 bg-white border border-gray-300 rounded p-1.5"
                                placeholder="Ano / Status"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveEducation(idx)}
                                className="p-1 text-gray-400 hover:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-between text-xs text-gray-800">
                              <span className="font-bold">{edu.degree}</span>
                              <span className="text-gray-600">{edu.institution} {edu.year ? `(${edu.year})` : ''}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Languages Section in Document */}
                  {((resumeData.languages && resumeData.languages.length > 0) || isEditing) && (
                    <div>
                      <div className="flex items-center justify-between border-b border-blue-200 pb-1 mb-2">
                        <h2 className="text-xs font-bold text-blue-700 uppercase flex items-center gap-1.5">
                          <Languages className="w-3.5 h-3.5" />
                          {resumeData.language === 'en' ? 'Languages & Proficiency' : 'Idiomas & Fluência'}
                        </h2>
                        {isEditing && (
                          <button
                            type="button"
                            onClick={handleAddLanguageInModal}
                            className="text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Adicionar Idioma</span>
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          {(resumeData.languages || []).map((lang, lIdx) => {
                            const lObj = typeof lang === 'string' ? { name: lang, level: 'Intermediário (B2)' } : lang;
                            return (
                              <div key={lIdx} className="flex items-center gap-2 p-2 bg-amber-50/40 rounded-lg border border-amber-200">
                                <input
                                  type="text"
                                  value={lObj.name || ''}
                                  onChange={(e) => handleUpdateLanguageField(lIdx, 'name', e.target.value)}
                                  className="flex-1 text-xs font-bold text-gray-900 bg-white border border-gray-300 rounded p-1.5"
                                  placeholder="Ex: Inglês"
                                />
                                <select
                                  value={lObj.level || 'Intermediário (B2)'}
                                  onChange={(e) => handleUpdateLanguageField(lIdx, 'level', e.target.value)}
                                  className="w-48 text-xs font-medium text-gray-900 bg-white border border-gray-300 rounded p-1.5"
                                >
                                  <option value="Nativo">Nativo</option>
                                  <option value="Fluente (C2)">Fluente (C2)</option>
                                  <option value="Avançado (C1)">Avançado (C1)</option>
                                  <option value="Intermediário (B2)">Intermediário (B2)</option>
                                  <option value="Básico (A2)">Básico (A2)</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLanguageInModal(lIdx)}
                                  className="p-1 text-gray-400 hover:text-red-600 cursor-pointer"
                                  title="Remover idioma"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-800">
                          {(resumeData.languages || []).map((lang, lIdx) => {
                            const lObj = typeof lang === 'string' ? { name: lang, level: '' } : lang;
                            return (
                              <span key={lIdx} className="inline-flex items-center gap-1.5">
                                <span className="font-bold text-gray-900">{lObj.name}</span>
                                {lObj.level && <span className="text-gray-600 font-medium text-[11px]">({lObj.level})</span>}
                                {lIdx < (resumeData.languages.length - 1) && <span className="text-gray-300 ml-2 font-normal">|</span>}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </>
          ) : activeTab === 'job_desc' ? (
            /* Job Description Tab */
            <div className="space-y-4 animate-fade-in">
              {/* Job Header & Meta */}
              <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-start gap-4">
                  <img
                    src={job.companyLogo}
                    alt={job.company}
                    className="w-12 h-12 rounded-xl object-cover border border-[var(--border-subtle)] bg-[var(--bg-subtle)]"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100&auto=format&fit=crop&q=80";
                    }}
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        {job.workType}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                        {job.source}
                      </span>
                      {job.level && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded font-medium">
                          {job.level}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-[var(--text-main)]">{job.title}</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      <strong className="text-blue-600 dark:text-blue-400">{job.company}</strong> • {job.location} • {job.salary || "Salário a combinar"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('resume')}
                    className="gradient-btn px-4 py-2 rounded-xl text-xs font-bold text-white shadow-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Ver Currículo Adaptado</span>
                  </button>
                </div>
              </div>

              {/* Requirements tags */}
              {job.requirements && job.requirements.length > 0 && (
                <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 rounded-2xl space-y-2 shadow-sm">
                  <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    Requisitos & Tecnologias Solicitadas
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {job.requirements.map((req, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-main)] border border-[var(--border-subtle)] font-medium">
                        {req}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Job Description */}
              <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 rounded-2xl space-y-3 shadow-sm">
                <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Descrição Completa da Vaga
                </h4>
                <div className="text-xs text-[var(--text-main)] leading-relaxed font-sans whitespace-pre-line bg-[var(--bg-subtle)] p-4 rounded-xl border border-[var(--border-subtle)]">
                  {job.description || "Nenhuma descrição textual adicional foi disponibilizada pela plataforma anunciante."}
                </div>
              </div>
            </div>
          ) : (
            /* Cover Letter Tab (Editable & AI generated) */
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between flex-wrap gap-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 rounded-2xl shadow-sm">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Carta de Apresentação Otimizada
                    </h3>
                    {coverLetterIsAI ? (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-emerald-500" />
                        Gerada por IA ({coverLetterModel || 'Gemini'})
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-full">
                        Modelo ATS Estruturado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Personalizada pela inteligência artificial com base no seu perfil e nas exigências da vaga. Você pode editar livremente.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleRegenerateCoverLetter}
                    disabled={isGeneratingCoverLetter}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white shadow-sm cursor-pointer disabled:opacity-50"
                    title="Gerar uma nova versão da carta de apresentação utilizando Inteligência Artificial"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isGeneratingCoverLetter ? 'animate-spin' : ''}`} />
                    <span>{isGeneratingCoverLetter ? 'Escrevendo com IA...' : 'Regenerar Carta com IA'}</span>
                  </button>

                  <button
                    onClick={handleCopyCoverLetter}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${copied
                        ? 'bg-emerald-600/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/40'
                        : 'bg-[var(--bg-subtle)] hover:bg-[var(--bg-card)] text-[var(--text-main)] border-[var(--border-subtle)]'
                      }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-500" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-[var(--text-muted)]" />
                        <span>Copiar Texto</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {isGeneratingCoverLetter && (
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2.5 animate-pulse">
                  <Sparkles className="w-4 h-4 animate-spin text-blue-500" />
                  <span>A IA está redigindo uma carta de apresentação convincente com foco na vaga de {job.title}...</span>
                </div>
              )}

              <textarea
                value={coverLetterText}
                onChange={(e) => setCoverLetterText(e.target.value)}
                rows={14}
                className="w-full p-5 rounded-2xl text-xs leading-relaxed font-sans resize-y bg-[var(--bg-subtle)] text-[var(--text-main)] border border-[var(--border-subtle)] focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                placeholder="Edite sua carta de apresentação..."
              />
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[var(--bg-subtle)] text-[var(--text-muted)] text-xs font-semibold hover:text-[var(--text-main)] transition-all border border-[var(--border-subtle)] cursor-pointer"
          >
            Fechar
          </button>

          <div className="flex items-center gap-2.5 flex-wrap">
            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-subtle)] text-blue-600 dark:text-blue-400 border border-[var(--border-subtle)] text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                title="Abrir anúncio oficial da vaga"
              >
                <Link className="w-4 h-4 text-blue-500" />
                <span>Link da Vaga</span>
              </a>
            )}

            <button
              onClick={() => {
                const subject = encodeURIComponent(`Candidatura para Vaga ${cleanResumeTitle(job.title)} - ${resumeData.fullName || userProfile.fullName}`);
                const body = encodeURIComponent(`Prezada equipe da ${cleanCompanyName(job.company)},\n\nSegue em anexo meu currículo otimizado para a vaga de ${cleanResumeTitle(job.title)}.\n\nAtenciosamente,\n${resumeData.fullName || userProfile.fullName}\nE-mail de contato: ${resumeData.email || userProfile.email}`);
                window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
              }}
              className="px-4 py-2.5 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 hover:bg-blue-600/20 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
            >
              <Mail className="w-4 h-4 text-blue-500" />
              <span>Enviar via E-mail</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              className="gradient-btn px-6 py-2.5 rounded-xl font-bold text-xs text-white flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Currículo PDF (ATS)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

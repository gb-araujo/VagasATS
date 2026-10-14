import React, { useState, useEffect, useMemo } from 'react';
import { 
  Save, Plus, Trash2, User, Briefcase, GraduationCap, Code, Sparkles, Check, 
  FileUp, UploadCloud, X, Download, FileJson, Eye, EyeOff, Key, ShieldCheck, 
  AlertTriangle, ExternalLink, RefreshCw, CheckCircle2, AlertCircle, Cpu, Lock,
  Languages, Gauge, Clock, Award, Target, FileText, ChevronRight
} from 'lucide-react';
import { parseResumeText, testAiConnection } from '../services/aiEngine';
import { 
  loadAiSettings, 
  saveAiSettings, 
  clearAiSettings, 
  buildProfileExportPayload, 
  processImportedProfilePayload 
} from '../services/storageService';

export function normalizeLanguages(langs) {
  if (!Array.isArray(langs) || langs.length === 0) {
    return [
      { id: 'lang-pt', name: 'Português', level: 'Nativo' },
      { id: 'lang-en', name: 'Inglês', level: 'Intermediário (B2)' }
    ];
  }
  return langs.map((l, i) => {
    if (typeof l === 'string') {
      const match = l.match(/^(.*?)\s*\((.*?)\)$/);
      if (match) return { id: `lang-${i}-${Date.now()}`, name: match[1].trim(), level: match[2].trim() };
      return { id: `lang-${i}-${Date.now()}`, name: l.trim(), level: l.toLowerCase().includes('portugu') ? 'Nativo' : 'Intermediário (B2)' };
    }
    return {
      id: l.id || `lang-${i}-${Date.now()}`,
      name: l.name || '',
      level: l.level || 'Intermediário (B2)'
    };
  });
}

export default function ProfileTab({ userProfile, onSaveProfile }) {
  // ESC key listener to close modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowExportModal(false);
        setShowImportModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [profile, setProfile] = useState(() => ({
    ...userProfile,
    languages: normalizeLanguages(userProfile?.languages)
  }));
  const [newSkill, setNewSkill] = useState('');
  const [newLangName, setNewLangName] = useState('');
  const [newLangLevel, setNewLangLevel] = useState('Intermediário (B2)');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Perfil Salvo!');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [rawText, setRawText] = useState('');

  // AI Settings (BYOK - Bring Your Own Key) Local State
  const [aiSettings, setAiSettings] = useState(() => loadAiSettings());
  const [apiKeyInput, setApiKeyInput] = useState(() => loadAiSettings().apiKey || '');
  const [selectedProvider, setSelectedProvider] = useState(() => {
    const loaded = loadAiSettings();
    const key = (loaded.apiKey || '').trim();
    return loaded.provider || (key.startsWith('sk-') ? 'openai' : 'gemini');
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestFeedback, setKeyTestFeedback] = useState(null);

  const handleChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const notifySuccess = (msg = 'Perfil Salvo!') => {
    setStatusMessage(msg);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  const triggerDownload = (includeApiKey = false) => {
    try {
      const payload = buildProfileExportPayload(profile, { includeApiKey });
      const dataStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const cleanName = profile.fullName
        ? profile.fullName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_')
        : 'usuario';
      const suffix = includeApiKey ? 'backup_completo_com_chave' : 'perfil_seguro';
      link.href = url;
      link.download = `${cleanName}_${suffix}_ia_vagas.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setShowExportModal(false);
      notifySuccess(includeApiKey ? 'Backup Completo Exportado (.json)!' : 'Perfil Seguro Exportado (.json)!');
    } catch (e) {
      console.error("Erro ao exportar perfil:", e);
    }
  };

  const applyImportedData = (data) => {
    if (typeof data !== 'object' || data === null) return false;

    const { profile: processedProfile, hasRestoredApiKey } = processImportedProfilePayload(data);
    const targetData = processedProfile || data;

    const merged = {
      ...profile,
      ...targetData,
      fullName: targetData.fullName ?? profile.fullName ?? '',
      email: targetData.email ?? profile.email ?? '',
      phone: targetData.phone ?? profile.phone ?? '',
      linkedin: targetData.linkedin ?? profile.linkedin ?? '',
      github: targetData.github ?? profile.github ?? '',
      location: targetData.location ?? profile.location ?? '',
      targetRole: targetData.targetRole ?? profile.targetRole ?? '',
      seniority: targetData.seniority ?? profile.seniority ?? 'Júnior',
      seniorities: Array.isArray(targetData.seniorities) ? targetData.seniorities : (targetData.seniority ? [targetData.seniority] : (profile.seniorities || ['Júnior'])),
      workPreference: targetData.workPreference ?? profile.workPreference ?? 'Remoto',
      workPreferences: Array.isArray(targetData.workPreferences) ? targetData.workPreferences : (profile.workPreferences || ['Remoto']),
      bio: targetData.bio ?? profile.bio ?? '',
      careerContext: targetData.careerContext ?? profile.careerContext ?? '',
      skills: Array.isArray(targetData.skills) ? targetData.skills : (profile.skills || []),
      experiences: Array.isArray(targetData.experiences) ? targetData.experiences : (profile.experiences || []),
      education: Array.isArray(targetData.education) ? targetData.education : (profile.education || []),
      languages: normalizeLanguages(targetData.languages || profile.languages)
    };
    setProfile(merged);
    onSaveProfile(merged);

    if (hasRestoredApiKey) {
      const refreshed = loadAiSettings();
      setAiSettings(refreshed);
      setApiKeyInput(refreshed.apiKey || '');
      setKeyTestFeedback({
        success: true,
        message: 'Chave de API do Google Gemini restaurada com sucesso deste arquivo de backup!'
      });
      notifySuccess('Perfil e Chave de IA Restaurados!');
    } else {
      notifySuccess('Perfil Carregado com Sucesso!');
    }
    return true;
  };

  const handleImportResume = () => {
    if (!rawText.trim()) return;

    // Check if pasted content is JSON format profile export
    const trimmed = rawText.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (applyImportedData(parsed)) {
          setShowImportModal(false);
          setRawText('');
          return;
        }
      } catch (err) {
        console.warn("Conteúdo colado não é JSON válido, executando extração de texto via IA...");
      }
    }

    // Heuristic / Text extraction via parseResumeText
    const extracted = parseResumeText(rawText);
    if (extracted) {
      const merged = {
        ...profile,
        fullName: extracted.fullName || profile.fullName,
        email: extracted.email || profile.email,
        phone: extracted.phone || profile.phone,
        linkedin: extracted.linkedin || profile.linkedin,
        github: extracted.github || profile.github,
        bio: extracted.bio || profile.bio,
        skills: [...new Set([...(profile.skills || []), ...(extracted.skills || [])])],
      };
      setProfile(merged);
      onSaveProfile(merged);
      setShowImportModal(false);
      setRawText('');
      notifySuccess('Dados Extraídos do Texto!');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      setRawText(content);

      // If it's a JSON file, import directly
      if (file.name.endsWith('.json') || content.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(content);
          if (applyImportedData(parsed)) {
            setShowImportModal(false);
            setRawText('');
          }
        } catch (err) {
          console.error("Erro ao ler JSON de perfil:", err);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleSaveAiKey = () => {
    const trimmed = apiKeyInput.trim();
    const effProvider = trimmed.startsWith('sk-') ? 'openai' : selectedProvider;
    setSelectedProvider(effProvider);
    const updated = saveAiSettings({ provider: effProvider, apiKey: trimmed });
    setAiSettings(updated);
    notifySuccess(trimmed ? 'Chave de IA Salva no Navegador!' : 'Chave Removida!');
    if (trimmed) {
      handleTestAiKey(trimmed, effProvider);
    } else {
      setKeyTestFeedback(null);
    }
  };

  const handleTestAiKey = async (keyToTest = apiKeyInput, providerToTest = selectedProvider) => {
    const clean = keyToTest.trim();
    if (!clean) {
      setKeyTestFeedback({ success: false, message: 'Insira uma chave antes de testar a conexão.' });
      return;
    }
    const effProvider = clean.startsWith('sk-') ? 'openai' : providerToTest;
    setSelectedProvider(effProvider);
    setIsTestingKey(true);
    setKeyTestFeedback({ 
      testing: true, 
      message: `Enviando teste de conexão para a API da ${effProvider === 'openai' ? 'OpenAI (ChatGPT)' : 'Google Gemini'}...` 
    });
    try {
      const res = await testAiConnection({ provider: effProvider, apiKey: clean });
      setKeyTestFeedback(res);
      if (res.success) {
        saveAiSettings({ provider: effProvider, apiKey: clean, model: res.model });
        setAiSettings(loadAiSettings());
      }
    } catch (e) {
      setKeyTestFeedback({ success: false, message: `Falha na requisição: ${e.message}` });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleRemoveAiKey = () => {
    clearAiSettings();
    setAiSettings(loadAiSettings());
    setApiKeyInput('');
    setKeyTestFeedback(null);
    notifySuccess('Chave de API removida do navegador.');
  };

  const handleAddSkill = (e) => {
    e.preventDefault();
    if (!newSkill.trim()) return;
    if (!profile.skills.includes(newSkill.trim())) {
      setProfile(prev => ({ ...prev, skills: [...prev.skills, newSkill.trim()] }));
    }
    setNewSkill('');
  };

  const handleRemoveSkill = (skillToRemove) => {
    setProfile(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skillToRemove) }));
  };

  const handleAddExperience = () => {
    const newExp = {
      id: `exp-${Date.now()}`,
      role: "Novo Cargo",
      company: "Nome da Empresa",
      period: "2023 - Atual",
      description: "Descrição das principais atividades e tecnologias utilizadas."
    };
    setProfile(prev => ({ ...prev, experiences: [...prev.experiences, newExp] }));
  };

  const handleUpdateExperience = (id, field, value) => {
    setProfile(prev => ({
      ...prev,
      experiences: prev.experiences.map(exp => exp.id === id ? { ...exp, [field]: value } : exp)
    }));
  };

  const handleRemoveExperience = (id) => {
    setProfile(prev => ({
      ...prev,
      experiences: prev.experiences.filter(exp => exp.id !== id)
    }));
  };

  const handleAddEducation = () => {
    const newEdu = {
      id: `edu-${Date.now()}`,
      degree: "Nome do Curso / Faculdade",
      institution: "Nome da Universidade / Escola",
      year: "2021 - 2024"
    };
    setProfile(prev => ({ ...prev, education: [...(prev.education || []), newEdu] }));
  };

  const handleUpdateEducation = (id, field, value) => {
    setProfile(prev => ({
      ...prev,
      education: (prev.education || []).map(edu => edu.id === id ? { ...edu, [field]: value } : edu)
    }));
  };

  const handleRemoveEducation = (id) => {
    setProfile(prev => ({
      ...prev,
      education: (prev.education || []).filter(edu => edu.id !== id)
    }));
  };

  const handleAddLanguage = (e) => {
    if (e) e.preventDefault();
    const trimmed = newLangName.trim();
    if (!trimmed) return;
    const newLang = {
      id: `lang-${Date.now()}`,
      name: trimmed,
      level: newLangLevel
    };
    setProfile(prev => ({
      ...prev,
      languages: [...(prev.languages || []), newLang]
    }));
    setNewLangName('');
    notifySuccess(`Idioma "${trimmed}" Adicionado!`);
  };

  const handleQuickAddLanguage = (name, defaultLevel = 'Intermediário (B2)') => {
    const current = profile.languages || [];
    const exists = current.some(l => (typeof l === 'string' ? l : l.name).toLowerCase() === name.toLowerCase());
    if (exists) {
      notifySuccess(`"${name}" já está na sua lista!`);
      return;
    }
    const newLang = {
      id: `lang-${Date.now()}`,
      name,
      level: name.toLowerCase().includes('portugu') ? 'Nativo' : defaultLevel
    };
    setProfile(prev => ({
      ...prev,
      languages: [...current, newLang]
    }));
    notifySuccess(`Idioma "${name}" Adicionado!`);
  };

  const handleUpdateLanguage = (id, field, value) => {
    setProfile(prev => ({
      ...prev,
      languages: (prev.languages || []).map(l => l.id === id ? { ...l, [field]: value } : l)
    }));
  };

  const handleRemoveLanguage = (id) => {
    setProfile(prev => ({
      ...prev,
      languages: (prev.languages || []).filter(l => l.id !== id)
    }));
  };

  const handleResetProfile = () => {
    const emptyProfile = {
      fullName: "",
      email: "",
      phone: "",
      linkedin: "",
      github: "",
      location: "",
      targetRole: "Desenvolvedor de Software",
      seniority: "Júnior",
      seniorities: ["Júnior"],
      workPreference: "Remoto",
      workPreferences: ["Remoto"],
      bio: "",
      careerContext: "",
      skills: [],
      experiences: [],
      education: [],
      languages: [
        { id: "lang-pt", name: "Português", level: "Nativo" }
      ]
    };
    setProfile(emptyProfile);
    onSaveProfile(emptyProfile);
    notifySuccess('Campos Limpos!');
  };

  const handleSave = () => {
    onSaveProfile(profile);
    notifySuccess('Perfil Salvo!');
  };

  // Keyboard Shortcut: Ctrl+S / Cmd+S to Save Profile
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSaveProfile(profile);
        notifySuccess('Perfil Salvo via Atalho (Ctrl+S)!');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [profile, onSaveProfile]);

  // Profile Completeness Calculation
  const profileScore = useMemo(() => {
    let score = 0;
    const tips = [];

    if (profile.fullName?.trim()) score += 10;
    else tips.push('Preencha seu Nome Completo');

    if (profile.email?.trim()) score += 10;
    else tips.push('Adicione seu E-mail Profissional');

    if (profile.phone?.trim() && profile.location?.trim()) score += 10;
    else if (!profile.location?.trim()) tips.push('Informe sua Cidade e Estado');

    if (profile.linkedin?.trim() || profile.github?.trim()) score += 10;
    else tips.push('Inclua link do LinkedIn ou GitHub');

    if (profile.targetRole?.trim()) score += 10;
    else tips.push('Defina seu Cargo Alvo');

    if (profile.bio?.trim() && profile.bio.length >= 35) score += 10;
    else tips.push('Complete o Resumo Profissional (bio)');

    if (profile.careerContext?.trim() && profile.careerContext.trim().length >= 40) score += 15;
    else tips.push('Alimente a Janela de Trajetória / Contexto (+15%)');

    if (Array.isArray(profile.skills) && profile.skills.length >= 3) score += 10;
    else tips.push('Cadastre ao menos 3 Habilidades');

    if (Array.isArray(profile.experiences) && profile.experiences.length >= 1) score += 10;
    else tips.push('Adicione ao menos 1 Experiência');

    if (Array.isArray(profile.languages) && profile.languages.length >= 1) score += 5;

    return {
      score: Math.min(score, 100),
      tips: tips.slice(0, 3)
    };
  }, [profile]);

  const scrollToSection = (sectionId) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Seu Perfil &amp; Currículo Base
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            As informações abaixo serão usadas pela IA para avaliar matches e adaptar seu currículo em PDF para cada vaga.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleResetProfile}
            className="px-3 py-2 rounded-xl bg-[var(--bg-subtle)] hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 border border-[var(--border-subtle)] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Limpar todos os campos do perfil"
          >
            <Trash2 className="w-4 h-4 text-[var(--text-faint)] hover:text-red-500" />
            <span>Limpar Dados</span>
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            className="px-3.5 py-2 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--bg-card-hover)] text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
            title="Exportar perfil em arquivo .json (com opção segura ou backup completo com chave)"
          >
            <Download className="w-4 h-4 text-emerald-500" />
            <span>Exportar Perfil (.json)</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--bg-card-hover)] text-blue-600 dark:text-blue-400 border border-[var(--border-subtle)] text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
          >
            <FileUp className="w-4 h-4 text-blue-500" />
            <span>Importar Currículo / Backup</span>
          </button>

          <button
            onClick={handleSave}
            className="gradient-btn px-5 py-2 rounded-xl font-bold text-xs text-white flex items-center gap-2 cursor-pointer"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>{statusMessage}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Salvar Perfil Base</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Export Modal with Secure / Full Backup Options */}
      {showExportModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowExportModal(false);
          }}
        >
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-[var(--border-strong)] p-6 space-y-5 bg-[var(--bg-card)]">
            <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                <Download className="w-5 h-5 text-emerald-500" />
                Exportar Perfil & Backup (.json)
              </h3>
              <button onClick={() => setShowExportModal(false)} className="text-[var(--text-faint)] hover:text-[var(--text-main)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              Como o VagasIA Pro não utiliza banco de dados centralizado, seus dados ficam no seu navegador. Escolha o modo de exportação:
            </p>

            <div className="space-y-3">
              {/* Option 1: Secure Profile (Recommended) */}
              <div 
                onClick={() => triggerDownload(false)}
                className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Exportar Perfil Profissional (Recomendado)</span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                    100% Seguro
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed pl-6">
                  Exporta apenas suas informações de currículo (experiências, habilidades, formação e contatos). <strong>Não inclui sua chave de API</strong>, sendo ideal para compartilhar ou guardar seu currículo com segurança.
                </p>
                <div className="pl-6 pt-1">
                  <button
                    type="button"
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar Perfil Seguro (.json)</span>
                  </button>
                </div>
              </div>

              {/* Option 2: Full Backup (Includes API Key) */}
              <div 
                onClick={() => triggerDownload(true)}
                className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                    <Key className="w-4 h-4 text-amber-500" />
                    <span>Backup Completo com Chave de IA</span>
                  </div>
                  <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                    Uso Pessoal
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed pl-6">
                  Inclui sua chave de API do Gemini e configurações locais para você migrar de navegador ou computador com 1 clique.
                </p>
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-[11px] text-amber-700 dark:text-amber-300 ml-6">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span><strong>Aviso de Segurança:</strong> Contém sua chave de API pessoal. Guarde em local privado e não compartilhe este arquivo com outras pessoas.</span>
                </div>
                <div className="pl-6 pt-1">
                  <button
                    type="button"
                    className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar Backup Completo (.json)</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs font-semibold cursor-pointer border border-[var(--border-subtle)]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowImportModal(false);
          }}
        >
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-[var(--border-strong)] p-6 space-y-4 bg-[var(--bg-card)]">
            <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-blue-500" />
                Importar Perfil (.json) ou Currículo (.txt)
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-[var(--text-faint)] hover:text-[var(--text-main)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[var(--bg-subtle)] p-3.5 rounded-2xl border border-[var(--border-subtle)] space-y-2 text-xs">
              <div className="flex items-start gap-2.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                <FileJson className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Backup em arquivo .json:</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] pl-6 leading-relaxed">
                Faça o upload do seu arquivo <strong>perfil_...json</strong> exportado anteriormente. Se o arquivo contiver uma chave de API, ela será restaurada automaticamente no seu navegador!
              </p>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              Cole o texto do seu currículo atual ou faça o upload de um arquivo de texto (.txt / .json) para a IA extrair seus dados automaticamente:
            </p>

            <div className="space-y-3">
              <input
                type="file"
                accept=".txt,.json,.md"
                onChange={handleFileUpload}
                className="text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
              />

              <textarea
                rows={6}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Cole o JSON de backup do perfil ou o texto do seu currículo aqui..."
                className="glass-input w-full p-3 rounded-xl text-xs leading-relaxed font-mono"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setShowExportModal(true);
                }}
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1.5 font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar backup atual</span>
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs font-semibold cursor-pointer border border-[var(--border-subtle)]"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportResume}
                  className="gradient-btn px-5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Processar &amp; Restaurar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Completeness & ATS Readiness Meter */}
      <div className="glass-card p-5 rounded-2xl border border-[var(--border-subtle)] space-y-3.5 bg-gradient-to-r from-blue-600/5 via-indigo-600/5 to-transparent">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Award className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-[var(--text-main)]">
                  Completude do Perfil ATS
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  profileScore.score >= 85 
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                    : profileScore.score >= 60 
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' 
                    : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                }`}>
                  {profileScore.score >= 85 ? 'Pronto para ATS' : profileScore.score >= 60 ? 'Bom Nível' : 'Preenchendo'}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Quanto mais completo seu perfil base, mais precisas serão as adaptações de currículo pela IA. (Dica: use <kbd className="font-mono bg-[var(--bg-subtle)] px-1 rounded text-[10px]">Ctrl+S</kbd> para salvar)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
              {profileScore.score}%
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[var(--bg-subtle)] rounded-full h-2 overflow-hidden border border-[var(--border-subtle)]">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-500 rounded-full"
            style={{ width: `${profileScore.score}%` }}
          />
        </div>

        {/* Tips / Optimization checklist */}
        {profileScore.tips.length > 0 ? (
          <div className="flex items-center gap-2 flex-wrap text-[11px] text-[var(--text-muted)] pt-1">
            <span className="font-bold text-[var(--text-main)] flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" /> Dicas para 100%:
            </span>
            {profileScore.tips.map((tip, idx) => (
              <span key={idx} className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] px-2.5 py-0.5 rounded-lg text-[10px] font-medium text-[var(--text-muted)]">
                + {tip}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold pt-0.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Excelente! Seu perfil possui todas as informações necessárias para geração perfeita de currículos.</span>
          </div>
        )}
      </div>

      {/* Sticky Quick-Jump Navigation Pills */}
      <div className="sticky top-16 z-20 py-2 bg-[var(--bg-main)]/90 backdrop-blur-md -mx-2 px-2 border-y border-[var(--border-subtle)] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] shrink-0 px-1">
          Ir para:
        </span>
        {[
          { id: 'section-ai', label: 'Motor IA & Cotas', icon: Cpu },
          { id: 'section-personal', label: 'Dados de Contato', icon: User },
          { id: 'section-target', label: 'Cargo & Nível', icon: Target },
          { id: 'section-context', label: 'Contexto & Trajetória', icon: Sparkles },
          { id: 'section-skills', label: 'Habilidades', icon: Code },
          { id: 'section-experience', label: 'Experiências', icon: Briefcase },
          { id: 'section-education', label: 'Formação', icon: GraduationCap },
          { id: 'section-languages', label: 'Idiomas', icon: Languages },
        ].map((sec) => {
          const SecIcon = sec.icon;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => scrollToSection(sec.id)}
              className="px-2.5 py-1.5 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-blue-500 border border-[var(--border-subtle)] hover:border-blue-500/40 text-[11px] font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
            >
              <SecIcon className="w-3.5 h-3.5 text-blue-500/80" />
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>

      {/* AI Engine & API Key Card (BYOK - Bring Your Own Key) */}
      <div id="section-ai" className="glass-card p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-[var(--border-subtle)] pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600">
              <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--text-main)]">
                  Motor de IA & Chave de API (Bring Your Own Key)
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  100% Local / Sem Banco
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Sua chave fica salva apenas no seu navegador (<code className="text-blue-600 dark:text-blue-400">localStorage</code>). Sem custos de servidor ou intermediários.
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div>
            {aiSettings.enabled ? (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs px-3 py-1.5 rounded-xl font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>{aiSettings.provider === 'openai' ? 'OpenAI GPT Ativo' : 'Google Gemini Ativo'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs px-3 py-1.5 rounded-xl font-medium">
                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                <span>Modo Local Offline</span>
              </div>
            )}
          </div>
        </div>

        {/* Provider Switcher Tabs */}
        <div className="flex items-center gap-2 p-1 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-subtle)] w-fit">
          <button
            type="button"
            onClick={() => {
              setSelectedProvider('gemini');
              setKeyTestFeedback(null);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedProvider === 'gemini'
                ? 'bg-blue-600 text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Google Gemini</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${selectedProvider === 'gemini' ? 'bg-white/20' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>
              100% Grátis
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedProvider('openai');
              setKeyTestFeedback(null);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedProvider === 'openai'
                ? 'bg-emerald-600 text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>OpenAI (ChatGPT)</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${selectedProvider === 'openai' ? 'bg-white/20' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'}`}>
              GPT-4o-mini
            </span>
          </button>
        </div>

        {/* Key Input & Actions */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                <Key className="w-4 h-4" />
              </div>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setApiKeyInput(val);
                  const trimmed = val.trim();
                  if (trimmed.startsWith('sk-')) {
                    setSelectedProvider('openai');
                  } else if (trimmed.startsWith('AIza')) {
                    setSelectedProvider('gemini');
                  }
                }}
                placeholder={selectedProvider === 'openai' ? "Cole sua chave da OpenAI (sk-proj-...)" : "Cole sua chave do Google Gemini (AIzaSy...)"}
                className="glass-input w-full pl-9 pr-10 py-2.5 rounded-xl text-xs font-mono tracking-wide"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-200"
                title={showApiKey ? "Ocultar chave" : "Mostrar chave"}
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTestAiKey(apiKeyInput, selectedProvider)}
                disabled={isTestingKey || !apiKeyInput.trim()}
                className="px-3.5 py-2.5 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--bg-card)] disabled:opacity-50 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
              >
                {isTestingKey ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Testando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Testar Conexão</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSaveAiKey}
                className="gradient-btn px-4 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-md shadow-blue-500/20"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Chave</span>
              </button>

              {aiSettings.apiKey && (
                <button
                  type="button"
                  onClick={handleRemoveAiKey}
                  className="px-3 py-2.5 rounded-xl bg-[var(--bg-subtle)] hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 border border-[var(--border-subtle)] text-xs font-semibold transition-all cursor-pointer"
                  title="Remover chave do navegador"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Test Feedback banner */}
          {keyTestFeedback && (
            <div className={`p-3 rounded-xl text-xs flex items-start gap-2.5 border transition-all ${
              keyTestFeedback.testing
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                : keyTestFeedback.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              {keyTestFeedback.testing ? (
                <RefreshCw className="w-4 h-4 text-blue-400 animate-spin shrink-0 mt-0.5" />
              ) : keyTestFeedback.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed">
                {keyTestFeedback.message}
                {keyTestFeedback.latencyMs && (
                  <span className="block text-[11px] text-emerald-400/80 font-mono mt-0.5">
                    Tempo de resposta: {keyTestFeedback.latencyMs}ms | Modelo: {keyTestFeedback.model || (selectedProvider === 'openai' ? 'gpt-4o-mini' : 'Gemini 1.5 Flash')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Footer Instructions & Link */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-gray-400">
            {selectedProvider === 'openai' ? (
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 font-semibold underline decoration-emerald-500/40 underline-offset-2"
              >
                <span>Gerenciar chaves na OpenAI Platform</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 font-semibold underline decoration-cyan-500/40 underline-offset-2"
              >
                <span>Obter chave 100% gratuita no Google AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            <div className="flex items-center gap-1.5 text-gray-400">
              <Lock className="w-3 h-3 text-cyan-400" />
              <span>Segurança BYOK: Chave armazenada estritamente no seu localStorage</span>
            </div>
          </div>

          {/* Informações Oficiais de Cotas, Tokens e Reinício */}
          <div className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-3 pt-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-blue-600 dark:text-cyan-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Gauge className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                Cotas, Limites de Tokens &amp; Reinício da IA
              </h4>
              <span className="text-[10px] bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold">
                100% Gratuito
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] p-2.5 rounded-xl space-y-1">
                <span className="text-[var(--text-muted)] text-[11px] font-semibold block">Capacidade Diária (RPD)</span>
                <span className="text-sm font-extrabold text-[var(--text-main)]">1.500 requisições / dia</span>
                <p className="text-[10px] text-[var(--text-faint)]">Google Gemini Free Tier permite até 1.500 gerações diárias.</p>
              </div>

              <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] p-2.5 rounded-xl space-y-1">
                <span className="text-[var(--text-muted)] text-[11px] font-semibold block">Velocidade por Minuto (RPM)</span>
                <span className="text-sm font-extrabold text-[var(--text-main)]">15 requisições / min</span>
                <p className="text-[10px] text-[var(--text-faint)]">Janela rolante de 60 segundos. Se pausar 1 minuto, a velocidade é restaurada.</p>
              </div>

              <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] p-2.5 rounded-xl space-y-1">
                <span className="text-[var(--text-muted)] text-[11px] font-semibold block">Limite de Tokens (TPM)</span>
                <span className="text-sm font-extrabold text-[var(--text-main)]">1.000.000 tokens / min</span>
                <p className="text-[10px] text-[var(--text-faint)]">Cada currículo gasta ~1.100 tokens (menos de 0,15% da capacidade).</p>
              </div>

              <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] p-2.5 rounded-xl space-y-1">
                <span className="text-[var(--text-muted)] text-[11px] font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" /> Horário de Reinício
                </span>
                <span className="text-sm font-extrabold text-amber-600 dark:text-amber-300">04:00 (Horário de Brasília)</span>
                <p className="text-[10px] text-[var(--text-faint)]">A cota diária reinicia à meia-noite do Pacífico (04:00 BRT).</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[var(--text-muted)] text-[11px] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span><strong>Como saber se acabou?</strong> O sistema detecta o erro HTTP 429 e avisa você na hora. Quando isso acontece, o motor local ATS continua gerando currículos perfeitamente adaptados e formatados sem travar!</span>
            </div>
          </div>
        </div>
      </div>


      {/* Personal Info Grid */}
      <div id="section-personal" className="glass-card p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4">
        <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider border-b border-[var(--border-subtle)] pb-2">
          Informações Pessoais & Contato
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Nome Completo</label>
            <input
              type="text"
              value={profile.fullName || ''}
              onChange={(e) => handleChange('fullName', e.target.value)}
              className="glass-input w-full p-2.5 rounded-xl text-xs"
              placeholder="Seu nome completo"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">E-mail Profissional</label>
            <input
              type="email"
              value={profile.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              className="glass-input w-full p-2.5 rounded-xl text-xs"
              placeholder="seu.email@exemplo.com"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Telefone / WhatsApp</label>
            <input
              type="text"
              value={profile.phone || ''}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="glass-input w-full p-2.5 rounded-xl text-xs"
              placeholder="(11) 99999-9999"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Localização (Cidade/Estado)</label>
            <input
              type="text"
              value={profile.location || ''}
              onChange={(e) => handleChange('location', e.target.value)}
              className="glass-input w-full p-2.5 rounded-xl text-xs"
              placeholder="São Paulo, SP - Brasil"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Perfil do LinkedIn</label>
            <input
              type="text"
              value={profile.linkedin || ''}
              onChange={(e) => handleChange('linkedin', e.target.value)}
              className="glass-input w-full p-2.5 rounded-xl text-xs"
              placeholder="linkedin.com/in/seu-perfil"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">GitHub / Portfólio</label>
            <input
              type="text"
              value={profile.github || ''}
              onChange={(e) => handleChange('github', e.target.value)}
              className="glass-input w-full p-2.5 rounded-xl text-xs"
              placeholder="github.com/seu-usuario"
            />
          </div>
        </div>
      </div>

      {/* Target Role & Preferences */}
      <div id="section-target" className="glass-card p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4">
        <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider border-b border-[var(--border-subtle)] pb-2">
          Objetivo Profissional & Preferências
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Cargo Alvo */}
          <div className="md:col-span-4">
            <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">Cargo Alvo Principal</label>
            <input
              type="text"
              value={profile.targetRole || ''}
              onChange={(e) => handleChange('targetRole', e.target.value)}
              className="glass-input w-full p-2.5 rounded-xl text-xs"
              placeholder="Ex: Desenvolvedor Full Stack, Analista de Suporte TI, DevOps..."
            />
            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {[
                { label: 'Dev', role: 'Desenvolvedor Full Stack / Software' },
                { label: 'DevOps', role: 'Engenheiro DevOps & Cloud (AWS / SRE)' },
                { label: 'Suporte & TI', role: 'Analista de Suporte de TI / Help Desk' },
                { label: 'Infra', role: 'Analista de Infraestrutura & Redes / SysAdmin' },
                { label: 'Dados', role: 'Analista de Dados / BI & SQL' },
                { label: 'QA', role: 'Analista de QA & Testes Automatizados' },
              ].map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleChange('targetRole', preset.role)}
                  className="text-[10px] px-2 py-0.5 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-subtle)] transition-all cursor-pointer font-medium"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Modalidades Preferenciais (Multi-Select) */}
          <div className="md:col-span-4">
            <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">
              Modalidades Desejadas (Selecione 1 ou mais)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'Remoto', label: '100% Remoto' },
                { id: 'Híbrido', label: 'Híbrido' },
                { id: 'Presencial', label: 'Presencial' }
              ].map(opt => {
                const currentPrefs = Array.isArray(profile.workPreferences)
                  ? profile.workPreferences
                  : (profile.workPreference ? profile.workPreference.split(',').map(s => s.trim()) : ["Remoto", "Híbrido"]);
                const isSelected = currentPrefs.includes(opt.id);

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      let updated;
                      if (isSelected) {
                        if (currentPrefs.length > 1) {
                          updated = currentPrefs.filter(m => m !== opt.id);
                        } else {
                          updated = currentPrefs;
                        }
                      } else {
                        updated = [...currentPrefs, opt.id];
                      }
                      setProfile(prev => ({
                        ...prev,
                        workPreferences: updated,
                        workPreference: updated.join(', ')
                      }));
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-main)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nível de Senioridade (Multi-Select) */}
          <div className="md:col-span-4">
            <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">
              Senioridade Desejada (Selecione 1 ou mais)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {["Júnior", "Pleno", "Sênior", "Especialista"].map(level => {
                const currentSeniorities = Array.isArray(profile.seniorities)
                  ? profile.seniorities
                  : (profile.seniority ? [profile.seniority] : ["Júnior", "Pleno"]);
                const isSelected = currentSeniorities.includes(level);

                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => {
                      let updated;
                      if (isSelected) {
                        if (currentSeniorities.length > 1) {
                          updated = currentSeniorities.filter(s => s !== level);
                        } else {
                          updated = currentSeniorities;
                        }
                      } else {
                        updated = [...currentSeniorities, level];
                      }
                      setProfile(prev => ({
                        ...prev,
                        seniorities: updated,
                        seniority: updated[0] || level
                      }));
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-main)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    <span>{level}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Resumo Profissional Base</label>
          <textarea
            rows={4}
            value={profile.bio || ''}
            onChange={(e) => handleChange('bio', e.target.value)}
            className="glass-input w-full p-3 rounded-xl text-xs leading-relaxed"
            placeholder="Descreva brevemente seus principais destaques, anos de experiência e diferenciais..."
          />
        </div>
      </div>

      {/* Janela de Contexto & Trajetória Técnica (Super-Alimento ATS) */}
      <div id="section-context" className="glass-card p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4 bg-gradient-to-br from-blue-600/5 via-transparent to-indigo-600/5">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[var(--border-subtle)] pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Sparkles className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider">
                  Janela de Contexto &amp; Trajetória Técnica
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                  Super-Alimento ATS
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Espaço livre para enriquecer o currículo com projetos, bastidores e métodos reais sem mentir.
              </p>
            </div>
          </div>

          <span className="text-xs text-[var(--text-muted)] font-mono">
            {(profile.careerContext || '').length} caracteres
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-[var(--text-main)] leading-relaxed space-y-1.5">
          <p className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Como isso deixa seu currículo mais recheado sem mentir?</span>
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            Se seu perfil tem poucas experiências formais ou descrições breves, a IA usará este contexto para extrair valor legítimo da sua bagagem: ela conectará as ferramentas que você domina, rotinas práticas e projetos reais às palavras-chave exigidas pela vaga, gerando de <strong>3 a 5 bullet points densos no método STAR</strong> para cada cargo.
          </p>
        </div>

        {/* Suggestion / Inspiration chips */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-[var(--text-muted)] flex items-center gap-1 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            Inspirações Rápidas (clique para adicionar ao seu contexto):
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              {
                label: 'Automações & APIs',
                text: '• Automações & APIs: Criação de fluxos com n8n, Typebot e rotinas em Python/Node.js para conectar APIs RESTful e eliminar tarefas manuais operacionais.'
              },
              {
                label: 'Projetos da Faculdade / ADS',
                text: '• Projetos Acadêmicos: Na faculdade/estudos, desenvolvi aplicações completas aplicando Clean Code, modelagem relacional de banco de dados em SQL e versionamento no GitHub.'
              },
              {
                label: 'Aplicações Web & Front/Back',
                text: '• Aplicações Web: Construção de interfaces responsivas e modulares em React / Next.js / TypeScript consumindo endpoints RESTful e integrando com bancos de dados.'
              },
              {
                label: 'Boas Práticas & Git Flow',
                text: '• Engenharia & Processos: Prática contínua com Git Flow (branches e pull requests), documentação técnica, tratamento preventivo de exceções e metodologia ágil.'
              }
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => {
                  const current = (profile.careerContext || '').trim();
                  const addition = chip.text;
                  if (current.includes(addition)) {
                    notifySuccess('Texto já adicionado!');
                    return;
                  }
                  const updated = current ? `${current}\n\n${addition}` : addition;
                  handleChange('careerContext', updated);
                  notifySuccess(`Inspiração "${chip.label}" adicionada!`);
                }}
                className="text-[11px] px-2.5 py-1 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-blue-600 dark:hover:text-blue-400 border border-[var(--border-subtle)] hover:border-blue-500/40 transition-all cursor-pointer font-medium"
              >
                + {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">
            Sua Trajetória, Projetos Reais, Ferramentas &amp; Bastidores
          </label>
          <textarea
            rows={5}
            value={profile.careerContext || ''}
            onChange={(e) => handleChange('careerContext', e.target.value)}
            className="glass-input w-full p-3 rounded-xl text-xs leading-relaxed"
            placeholder="Conte os detalhes da sua caminhada técnica: quais projetos práticos você desenvolveu, automações criadas, desafios de integração de APIs, consultas SQL que você fez, bibliotecas que você usou na faculdade/freelances, etc. A IA vai ler tudo isso para montar um currículo encorpado e com muito mais autoridade..."
          />
        </div>
      </div>

      {/* Technical Skills Manager */}
      <div id="section-skills" className="glass-card p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4">
        <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider border-b border-[var(--border-subtle)] pb-2 flex items-center justify-between">
          <span>Habilidades & Tecnologias</span>
          <span className="text-xs font-normal text-[var(--text-muted)]">Total: {profile.skills ? profile.skills.length : 0}</span>
        </h3>

        <form onSubmit={handleAddSkill} className="flex gap-2">
          <input
            type="text"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            placeholder="Adicionar habilidade (ex: Docker, GraphQL, PySpark...)"
            className="glass-input flex-1 p-2.5 rounded-xl text-xs"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </form>

        <div className="flex flex-wrap gap-2 pt-2">
          {(profile.skills || []).map((skill, index) => (
            <span
              key={index}
              className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)] text-xs font-semibold px-3 py-1 rounded-lg flex items-center gap-2 group"
            >
              {skill}
              <button
                type="button"
                onClick={() => handleRemoveSkill(skill)}
                className="text-[var(--text-faint)] hover:text-red-500 transition-colors cursor-pointer"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Work Experiences */}
      <div id="section-experience" className="glass-card p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
          <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider">
            Experiências Profissionais
          </h3>
          <button
            onClick={handleAddExperience}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Adicionar Experiência
          </button>
        </div>

        <div className="space-y-4">
          {(profile.experiences || []).map((exp) => (
            <div key={exp.id} className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-4 rounded-xl space-y-3 relative group">
              <button
                onClick={() => handleRemoveExperience(exp.id)}
                className="absolute top-4 right-4 text-[var(--text-faint)] hover:text-red-500 transition-colors cursor-pointer"
                title="Remover experiência"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pr-8">
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">Cargo</label>
                  <input
                    type="text"
                    value={exp.role}
                    onChange={(e) => handleUpdateExperience(exp.id, 'role', e.target.value)}
                    className="glass-input w-full p-2 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">Empresa</label>
                  <input
                    type="text"
                    value={exp.company}
                    onChange={(e) => handleUpdateExperience(exp.id, 'company', e.target.value)}
                    className="glass-input w-full p-2 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">Período</label>
                  <input
                    type="text"
                    value={exp.period}
                    onChange={(e) => handleUpdateExperience(exp.id, 'period', e.target.value)}
                    className="glass-input w-full p-2 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">Atividades & Conquistas</label>
                <textarea
                  rows={3}
                  value={exp.description}
                  onChange={(e) => handleUpdateExperience(exp.id, 'description', e.target.value)}
                  className="glass-input w-full p-2.5 rounded-lg text-xs leading-relaxed"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Education */}
      <div id="section-education" className="glass-card p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
          <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Formação Acadêmica
          </h3>
          <button
            onClick={handleAddEducation}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Adicionar Formação
          </button>
        </div>

        <div className="space-y-4">
          {(profile.education || []).map((edu) => (
            <div key={edu.id} className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-4 rounded-xl space-y-3 relative group">
              <button
                onClick={() => handleRemoveEducation(edu.id)}
                className="absolute top-4 right-4 text-[var(--text-faint)] hover:text-red-500 transition-colors cursor-pointer"
                title="Remover formação"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pr-8">
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">Curso / Grau</label>
                  <input
                    type="text"
                    value={edu.degree || ''}
                    onChange={(e) => handleUpdateEducation(edu.id, 'degree', e.target.value)}
                    className="glass-input w-full p-2 rounded-lg text-xs"
                    placeholder="Ex: Ciência da Computação"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">Instituição / Universidade</label>
                  <input
                    type="text"
                    value={edu.institution || ''}
                    onChange={(e) => handleUpdateEducation(edu.id, 'institution', e.target.value)}
                    className="glass-input w-full p-2 rounded-lg text-xs"
                    placeholder="Ex: USP, Unicamp, etc."
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">Período / Ano</label>
                  <input
                    type="text"
                    value={edu.year || ''}
                    onChange={(e) => handleUpdateEducation(edu.id, 'year', e.target.value)}
                    className="glass-input w-full p-2 rounded-lg text-xs"
                    placeholder="Ex: 2020 - 2024"
                  />
                </div>
              </div>
            </div>
          ))}

          {(!profile.education || profile.education.length === 0) && (
            <p className="text-xs text-[var(--text-faint)] italic text-center py-2">
              Nenhuma formação adicionada. Clique acima em "+ Adicionar Formação" se desejar incluir seu histórico acadêmico.
            </p>
          )}
        </div>
      </div>

      {/* Languages & Proficiency Section */}
      <div id="section-languages" className="glass-card p-6 rounded-2xl border border-[var(--border-subtle)] space-y-5">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
              <Languages className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Idiomas &amp; Nível de Fluência
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Informe os idiomas que você fala e sua proficiência. Esses dados são priorizados por filtros ATS e incluídos no currículo adaptado.
            </p>
          </div>
        </div>

        {/* Quick Language Add Pills */}
        <div>
          <span className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1.5">
            Sugestões rápidas para adicionar:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { name: 'Português', level: 'Nativo' },
              { name: 'Inglês', level: 'Avançado (C1)' },
              { name: 'Espanhol', level: 'Intermediário (B2)' },
              { name: 'Francês', level: 'Básico (A2)' },
              { name: 'Alemão', level: 'Básico (A2)' },
              { name: 'Italiano', level: 'Básico (A2)' },
              { name: 'Japonês', level: 'Básico (A2)' }
            ].map(item => {
              const alreadyHas = (profile.languages || []).some(l => 
                (typeof l === 'string' ? l : l.name).toLowerCase() === item.name.toLowerCase()
              );
              return (
                <button
                  key={item.name}
                  type="button"
                  disabled={alreadyHas}
                  onClick={() => handleQuickAddLanguage(item.name, item.level)}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all flex items-center gap-1 cursor-pointer ${
                    alreadyHas
                      ? 'bg-[var(--bg-subtle)] text-[var(--text-faint)] border-[var(--border-subtle)] opacity-50 cursor-default'
                      : 'bg-[var(--bg-card)] hover:bg-[var(--bg-subtle)] text-[var(--text-main)] border-[var(--border-subtle)] hover:border-blue-500/50'
                  }`}
                >
                  <Plus className="w-3 h-3 text-blue-500" />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Add Language Form */}
        <form onSubmit={handleAddLanguage} className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-4 rounded-xl flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">
              Idioma
            </label>
            <input
              type="text"
              value={newLangName}
              onChange={(e) => setNewLangName(e.target.value)}
              placeholder="Ex: Inglês, Espanhol, Mandarim..."
              className="glass-input w-full p-2 rounded-lg text-xs"
            />
          </div>

          <div className="w-full sm:w-56">
            <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">
              Nível de Fluência
            </label>
            <select
              value={newLangLevel}
              onChange={(e) => setNewLangLevel(e.target.value)}
              className="glass-input w-full p-2 rounded-lg text-xs font-semibold cursor-pointer"
            >
              <option value="Nativo">Nativo (Língua materna)</option>
              <option value="Fluente (C2)">Fluente (C2 - Bilíngue)</option>
              <option value="Avançado (C1)">Avançado (C1 - Fluido)</option>
              <option value="Intermediário (B2)">Intermediário (B2/B1 - Conversação)</option>
              <option value="Básico (A2)">Básico (A2/A1 - Leitura)</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar</span>
          </button>
        </form>

        {/* Existing Languages List */}
        <div className="space-y-2.5">
          {(profile.languages || []).map((lang) => {
            const lObj = typeof lang === 'string' ? { id: lang, name: lang, level: 'Intermediário (B2)' } : lang;
            
            let levelBadgeStyle = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
            if (lObj.level?.includes('Nativo') || lObj.level?.includes('Fluente')) {
              levelBadgeStyle = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
            } else if (lObj.level?.includes('Avançado')) {
              levelBadgeStyle = 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
            } else if (lObj.level?.includes('Básico')) {
              levelBadgeStyle = 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
            }

            return (
              <div 
                key={lObj.id} 
                className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-3 rounded-xl flex items-center justify-between gap-3 group hover:border-[var(--border-strong)] transition-all"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 shrink-0">
                    <Languages className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={lObj.name}
                      onChange={(e) => handleUpdateLanguage(lObj.id, 'name', e.target.value)}
                      className="glass-input font-bold text-xs text-[var(--text-main)] w-full max-w-xs px-2 py-1 rounded"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={lObj.level || 'Intermediário (B2)'}
                    onChange={(e) => handleUpdateLanguage(lObj.id, 'level', e.target.value)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer ${levelBadgeStyle}`}
                  >
                    <option value="Nativo">Nativo</option>
                    <option value="Fluente (C2)">Fluente (C2)</option>
                    <option value="Avançado (C1)">Avançado (C1)</option>
                    <option value="Intermediário (B2)">Intermediário (B2)</option>
                    <option value="Básico (A2)">Básico (A2)</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleRemoveLanguage(lObj.id)}
                    className="p-1.5 text-[var(--text-faint)] hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Remover idioma"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {(!profile.languages || profile.languages.length === 0) && (
            <p className="text-xs text-[var(--text-faint)] italic text-center py-4 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-subtle)]">
              Nenhum idioma adicionado ainda. Adicione seus idiomas acima para incluir no seu currículo ATS!
            </p>
          )}
        </div>
      </div>

    </div>
  );
}

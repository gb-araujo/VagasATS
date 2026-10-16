import { INITIAL_USER_PROFILE, INITIAL_JOBS } from '../data/mockJobs';

const STORAGE_KEYS = {
  PROFILE: 'ia_vagas_user_profile',
  APPLICATIONS: 'ia_vagas_applications',
  SAVED_JOBS: 'ia_vagas_saved_jobs',
  CUSTOM_JOBS: 'ia_vagas_custom_jobs',
  AI_SETTINGS: 'ia_vagas_ai_settings',
  THEME: 'ia_vagas_theme'
};

export function loadUserProfile() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (saved) {
      const parsed = JSON.parse(saved);
      // If user has the old mock profile (Lucas Silva Pessoa / FIAP), reset it
      if (parsed.fullName === "Lucas Silva Pessoa" || parsed.email === "lucas.pessoa@email.com" || (parsed.education && parsed.education[0]?.institution === "FIAP")) {
        localStorage.removeItem(STORAGE_KEYS.PROFILE);
        return INITIAL_USER_PROFILE;
      }
      return {
        ...INITIAL_USER_PROFILE,
        ...parsed,
        careerContext: parsed.careerContext || ''
      };
    }
  } catch (e) {
    console.error("Error loading profile from localStorage:", e);
  }
  return INITIAL_USER_PROFILE;
}

export function saveUserProfile(profile) {
  try {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  } catch (e) {
    console.error("Error saving profile to localStorage:", e);
  }
}

export function loadApplications() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.APPLICATIONS);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Error loading applications from localStorage:", e);
  }
  return [];
}

export function saveApplications(apps) {
  try {
    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));
  } catch (e) {
    console.error("Error saving applications to localStorage:", e);
  }
}

export function loadSavedJobs() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SAVED_JOBS);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Error loading saved jobs from localStorage:", e);
  }
  return [];
}

export function saveSavedJobs(savedJobIds) {
  try {
    localStorage.setItem(STORAGE_KEYS.SAVED_JOBS, JSON.stringify(savedJobIds));
  } catch (e) {
    console.error("Error saving jobs to localStorage:", e);
  }
}

export function loadCustomJobs() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_JOBS);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Error loading custom jobs from localStorage:", e);
  }
  return [];
}

export function saveCustomJobs(jobs) {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_JOBS, JSON.stringify(jobs));
  } catch (e) {
    console.error("Error saving custom jobs to localStorage:", e);
  }
}

export function loadCachedRealJobs() {
  try {
    const saved = localStorage.getItem('ia_vagas_cached_real_jobs');
    if (saved) {
      const parsed = JSON.parse(saved);
      let rawList = [];
      let savedAt = 0;

      if (Array.isArray(parsed)) {
        rawList = parsed;
      } else if (parsed && Array.isArray(parsed.jobs)) {
        rawList = parsed.jobs;
        savedAt = parsed.timestamp || 0;
      }

      // Se o cache tiver mais de 2 horas, não reutiliza cache antigo
      if (savedAt && (Date.now() - savedAt > 2 * 60 * 60 * 1000)) {
        return [];
      }

      // Recalcula dinamicamente o postedHoursAgo em relação ao momento ATUAL
      return rawList
        .filter(j => j && j.isReal)
        .map(j => {
          if (j.publishedDate) {
            const t = new Date(j.publishedDate).getTime();
            if (!Number.isNaN(t)) {
              const currentHours = Math.max(0, Math.round((Date.now() - t) / 36e5));
              return { ...j, postedHoursAgo: currentHours };
            }
          }
          return j;
        });
    }
  } catch (e) {
    console.error("Error loading cached real jobs:", e);
  }
  return [];
}

export function saveCachedRealJobs(jobs) {
  try {
    const realOnly = (jobs || []).filter(j => j && j.isReal);
    if (realOnly.length > 0) {
      localStorage.setItem('ia_vagas_cached_real_jobs', JSON.stringify({
        timestamp: Date.now(),
        jobs: realOnly.slice(0, 400)
      }));
    }
  } catch (e) {
    console.error("Error saving cached real jobs:", e);
  }
}

export function clearCachedRealJobs() {
  try {
    localStorage.removeItem('ia_vagas_cached_real_jobs');
  } catch (e) { }
}

/**
 * AI Settings (BYOK - Bring Your Own Key) Management
 * Stores credentials purely client-side in localStorage (Zero Backend)
 */
export function loadAiSettings() {
  try {
    // Purge deprecated or slow models (Gemma, exp) from cache
    try {
      const working = localStorage.getItem('working_gemini_model');
      if (working && (!working.startsWith('gemini') || working.includes('gemma') || working.includes('-exp'))) {
        localStorage.removeItem('working_gemini_model');
        localStorage.removeItem('working_gemini_api_ver');
      }
    } catch (_) { }

    const saved = localStorage.getItem(STORAGE_KEYS.AI_SETTINGS);
    let legacyKey = '';
    try {
      legacyKey = localStorage.getItem('gemini_api_key') || '';
    } catch (_) { }

    // Suporte a variáveis de ambiente configuradas na Vercel (.env ou Vercel Dashboard)
    let envGeminiKey = '';
    let envOpenAiKey = '';
    try {
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        envGeminiKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
        envOpenAiKey = (import.meta.env.VITE_OPENAI_API_KEY || '').trim();
      }
    } catch (_) { }

    try {
      if (typeof process !== 'undefined' && process.env) {
        if (!envGeminiKey) envGeminiKey = (process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
        if (!envOpenAiKey) envOpenAiKey = (process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim();
      }
    } catch (_) { }

    const defaultEnvKey = envGeminiKey || envOpenAiKey;
    const defaultEnvProvider = envOpenAiKey && !envGeminiKey ? 'openai' : 'gemini';

    if (saved) {
      const parsed = JSON.parse(saved);
      const effectiveKey = (parsed.apiKey || legacyKey || defaultEnvKey || '').trim();
      const detectedProvider = parsed.provider || (effectiveKey.startsWith('sk-') ? 'openai' : defaultEnvProvider);
      let model = parsed.model || (detectedProvider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash');
      if (model && model.includes('-exp')) {
        model = 'gemini-2.0-flash';
      }
      return {
        provider: detectedProvider,
        apiKey: effectiveKey,
        model,
        enabled: Boolean(effectiveKey)
      };
    }

    const legacyTrimmed = (legacyKey || defaultEnvKey || '').trim();
    const isLegacyOpenAi = legacyTrimmed.startsWith('sk-') || defaultEnvProvider === 'openai';
    return {
      provider: isLegacyOpenAi ? 'openai' : 'gemini',
      apiKey: legacyTrimmed,
      model: isLegacyOpenAi ? 'gpt-4o-mini' : 'gemini-2.0-flash',
      enabled: Boolean(legacyTrimmed)
    };
  } catch (e) {
    console.error("Error loading AI settings:", e);
    return {
      provider: 'gemini',
      apiKey: '',
      model: 'gemini-2.0-flash',
      enabled: false
    };
  }
}

export function saveAiSettings(settings) {
  try {
    const current = loadAiSettings();
    const newApiKey = (settings.apiKey !== undefined ? settings.apiKey : current.apiKey || '').trim();
    const explicitProvider = settings.provider || current.provider || (newApiKey.startsWith('sk-') ? 'openai' : 'gemini');
    const autoDetectedProvider = newApiKey.startsWith('sk-') ? 'openai' : explicitProvider;

    const updated = {
      ...current,
      ...settings,
      provider: autoDetectedProvider,
      apiKey: newApiKey,
      model: settings.model || (autoDetectedProvider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash')
    };
    updated.enabled = Boolean(updated.apiKey);

    localStorage.setItem(STORAGE_KEYS.AI_SETTINGS, JSON.stringify(updated));
    // Sincroniza retrocompatibilidade se for chave Gemini
    if (autoDetectedProvider === 'gemini') {
      localStorage.setItem('gemini_api_key', updated.apiKey);
    }
    return updated;
  } catch (e) {
    console.error("Error saving AI settings:", e);
    return null;
  }
}

export function clearAiSettings() {
  try {
    localStorage.removeItem(STORAGE_KEYS.AI_SETTINGS);
    localStorage.removeItem('gemini_api_key');
    localStorage.removeItem('working_gemini_model');
  } catch (e) {
    console.error("Error clearing AI settings:", e);
  }
}

/**
 * Monta o payload para exportação em JSON
 * Se includeApiKey for falso, os dados sensíveis são totalmente omitidos
 */
export function buildProfileExportPayload(profile, { includeApiKey = false } = {}) {
  const exportPayload = {
    ...profile,
    _exportMeta: {
      app: 'VagasIA Pro',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      containsApiKey: Boolean(includeApiKey)
    }
  };

  if (includeApiKey) {
    const aiSettings = loadAiSettings();
    if (aiSettings.apiKey) {
      exportPayload.aiSettings = {
        provider: aiSettings.provider || 'gemini',
        apiKey: aiSettings.apiKey,
        model: aiSettings.model || 'gemini-1.5-flash'
      };
    }
  } else {
    // Garante que chaves residuais não vão no arquivo limpo
    delete exportPayload.apiKey;
    delete exportPayload.aiSettings;
  }

  return exportPayload;
}

/**
 * Processa um payload JSON importado
 * Identifica se contém credenciais de IA e as restaura no localStorage
 */
export function processImportedProfilePayload(rawData) {
  if (!rawData || typeof rawData !== 'object') return { profile: null, hasRestoredApiKey: false };

  let restoredApiKey = false;
  const importedKey = (rawData.aiSettings?.apiKey || rawData.apiKey || '').trim();

  if (importedKey) {
    saveAiSettings({
      provider: rawData.aiSettings?.provider || 'gemini',
      apiKey: importedKey,
      model: rawData.aiSettings?.model || 'gemini-1.5-flash'
    });
    restoredApiKey = true;
  }

  // Cria cópia limpa do perfil para não poluir o estado de currículo com credenciais
  const cleanProfile = { ...rawData };
  delete cleanProfile._exportMeta;
  delete cleanProfile.aiSettings;
  delete cleanProfile.apiKey;

  return {
    profile: cleanProfile,
    hasRestoredApiKey: restoredApiKey
  };
}

/**
 * Theme Management (Dark / Light)
 */
export function loadTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch (e) { }
  return 'dark'; // Dark mode por padrão
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch (e) { }
}


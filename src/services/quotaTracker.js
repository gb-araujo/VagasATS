/**
 * Quota and Rate Limit Tracker for AI Providers (Google Gemini & OpenAI)
 */

const STORAGE_KEY = 'ai_quota_usage_v1';

export function getTodayDateKey() {
  const now = new Date();
  return now.toISOString().split('T')[0]; // "YYYY-MM-DD"
}

export function getNextResetTime() {
  // Google Gemini resets daily at Midnight Pacific Time (PST/PDT)
  // Pacific is UTC-8 (or UTC-7). In Brasília (UTC-3), midnight PT is 04:00 AM (or 05:00 AM).
  const now = new Date();
  const reset = new Date();
  
  // Set to 04:00 BRT (07:00 UTC) tomorrow or today if earlier
  reset.setUTCHours(7, 0, 0, 0);
  if (now.getTime() >= reset.getTime()) {
    reset.setDate(reset.getDate() + 1);
  }

  const diffMs = Math.max(0, reset.getTime() - now.getTime());
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return {
    hoursLeft: hours,
    minutesLeft: minutes,
    formattedResetTime: '04:00 (Horário de Brasília)',
    countdownText: `${hours}h ${minutes}min restantes`
  };
}

export function loadQuotaUsage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: getTodayDateKey(), requestsToday: 0, totalTokensToday: 0 };
    const parsed = JSON.parse(raw);
    if (parsed.date !== getTodayDateKey()) {
      return { date: getTodayDateKey(), requestsToday: 0, totalTokensToday: 0 };
    }
    return parsed;
  } catch (e) {
    return { date: getTodayDateKey(), requestsToday: 0, totalTokensToday: 0 };
  }
}

export function recordAiRequest(provider = 'gemini', estimatedTokens = 1200) {
  try {
    const current = loadQuotaUsage();
    const updated = {
      date: getTodayDateKey(),
      requestsToday: (current.requestsToday || 0) + 1,
      totalTokensToday: (current.totalTokensToday || 0) + estimatedTokens,
      lastRequestTime: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    return { date: getTodayDateKey(), requestsToday: 1, totalTokensToday: estimatedTokens };
  }
}

export function getAiQuotaStats(provider = 'gemini') {
  const usage = loadQuotaUsage();
  const resetInfo = getNextResetTime();

  if (provider === 'openai') {
    return {
      providerName: 'OpenAI (ChatGPT)',
      requestsToday: usage.requestsToday,
      rpmLimit: '3 a 500 RPM (conforme seu Tier de créditos)',
      rpdLimit: 'Baseado no seu saldo em dólares ($)',
      tpmLimit: '200.000 a 2.000.000 TPM',
      resetInfo: 'Minuto a minuto para RPM; saldo renovado conforme recarga',
      tokensUsedToday: usage.totalTokensToday,
      isUnlimitedFree: false
    };
  }

  // Google Gemini Free Tier official specifications
  return {
    providerName: 'Google Gemini (Free Tier Oficial)',
    requestsToday: usage.requestsToday,
    dailyLimit: 1500,
    rpmLimit: 15, // 15 requests per minute
    tpmLimit: 1000000, // 1,000,000 tokens per minute
    contextWindow: '1.000.000 tokens por chamada',
    resetInfo: resetInfo.formattedResetTime,
    countdownText: resetInfo.countdownText,
    tokensUsedToday: usage.totalTokensToday,
    remainingToday: Math.max(0, 1500 - usage.requestsToday),
    isUnlimitedFree: true
  };
}

export function isRateLimitError(errMessage = '') {
  const msg = String(errMessage || '').toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests')
  );
}

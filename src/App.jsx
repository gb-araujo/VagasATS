import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Clock, Sparkles, Link2, Zap, Search, Bookmark } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import JobCard from './components/JobCard';
import JobDetailsModal from './components/JobDetailsModal';
import TailoredResumeModal from './components/TailoredResumeModal';
import ProfileTab from './components/ProfileTab';
import ApplicationsTracker from './components/ApplicationsTracker';
import SearchFilters from './components/SearchFilters';
import AIScanModal from './components/AIScanModal';
import JobLinkAnalyzer from './components/JobLinkAnalyzer';

import UserGuideTab from './components/UserGuideTab';
import { INITIAL_JOBS } from './data/mockJobs';

import { calculateMatch, getJobDirectUrl, fetchRealJobs, toSearchQuery, matchesRegion, getJobTechArea, isTechDevJob } from './services/aiEngine';
import {
  loadUserProfile,
  saveUserProfile,
  loadApplications,
  saveApplications,
  loadSavedJobs,
  saveSavedJobs,
  loadCachedRealJobs,
  saveCachedRealJobs,
  clearCachedRealJobs,
  loadTheme,
  saveTheme
} from './services/storageService';

export default function App() {
  const [userProfile, setUserProfile] = useState(() => loadUserProfile());
  const [jobs, setJobs] = useState(() => {
    const cached = loadCachedRealJobs();
    if (cached && cached.length > 0) {
      const filtered = cached.filter(isTechDevJob);
      if (filtered.length > 0) {
        const seen = new Set();
        return filtered.filter(j => {
          if (!j || !j.id) return false;
          const idKey = String(j.id);
          const normKey = `${(j.title || '').trim().toLowerCase()}|${(j.company || '').trim().toLowerCase()}`;
          if (seen.has(idKey) || seen.has(normKey)) return false;
          seen.add(idKey);
          seen.add(normKey);
          return true;
        });
      }
    }
    return INITIAL_JOBS.filter(isTechDevJob);
  });
  const [realJobsStatus, setRealJobsStatus] = useState('loading'); // 'loading' | 'ok' | 'error'
  const [realJobsCount, setRealJobsCount] = useState(0);
  const [realJobsError, setRealJobsError] = useState('');
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'match'
  const [applications, setApplications] = useState(() => loadApplications());
  const [savedJobIds, setSavedJobIds] = useState(() => loadSavedJobs());
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const jobsPerPage = 24;
  const [theme, setTheme] = useState(() => loadTheme());

  // Sidebar Layout State (Persisted in localStorage)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('vagas_ats_sidebar_collapsed') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Sincroniza a classe do tema no elemento HTML raiz
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      document.body.classList.add('light');
      document.body.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.body.classList.add('dark');
      document.body.classList.remove('light');
    }
    saveTheme(theme);
  }, [theme]);

  // UI Navigation & Modals
  const [activeTab, setActiveTab] = useState('jobs'); // 'jobs' | 'tracker' | 'profile' | 'aiscan'
  const [selectedJob, setSelectedJob] = useState(null);
  const [resumeModalJob, setResumeModalJob] = useState(null);
  const [showAIScanModal, setShowAIScanModal] = useState(false);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [techAreaFilter, setTechAreaFilter] = useState('all'); // 'all' | 'dev' | 'devops' | 'support' | 'infra' | 'data' | 'qa' | 'security'
  const [workTypeFilter, setWorkTypeFilter] = useState('Todos');
  const [regionFilter, setRegionFilter] = useState('Todas'); // Padrão Brasil Todo para máxima variedade
  const [includeRemoteInRegion, setIncludeRemoteInRegion] = useState(true);
  const [selectedSeniorities, setSelectedSeniorities] = useState(["Júnior", "Pleno", "Sênior", "Especialista"]);
  const [dateRangeFilter, setDateRangeFilter] = useState(0); // 0 = Qualquer data (exibe todas)
  const [minMatchScore, setMinMatchScore] = useState(20); // 20% match por padrão
  const [selectedPlatforms, setSelectedPlatforms] = useState(["Gupy", "Nerdin", "FrontendBR", "BackendBR", "Comunidades BR"]);

  // Load REAL job postings (with real links), driven by the current filters
  const searchRequestId = useRef(0);
  const loadRealJobs = (force = false) => {
    const requestId = ++searchRequestId.current;
    setRealJobsStatus('loading');
    setRealJobsError('');
    if (force) {
      clearCachedRealJobs();
    }
    const allLevels = selectedSeniorities.length >= 4;
    fetchRealJobs({
      searchTerm,
      seniorities: allLevels ? [] : selectedSeniorities,
      platforms: selectedPlatforms,
      workTypeFilter,
      region: regionFilter,
      techArea: techAreaFilter,
      forceRefresh: force
    })
      .then(({ jobs: realJobs, errors }) => {
        if (requestId !== searchRequestId.current) return;
        const strictlyReal = (realJobs || []).filter(j => j && j.isReal && isTechDevJob(j));
        if (strictlyReal.length > 0) {
          const seen = new Set();
          const unique = strictlyReal.filter(j => {
            if (!j || !j.id) return false;
            const idKey = String(j.id);
            const normKey = `${(j.title || '').trim().toLowerCase()}|${(j.company || '').trim().toLowerCase()}`;
            if (seen.has(idKey) || seen.has(normKey)) return false;
            seen.add(idKey);
            seen.add(normKey);
            return true;
          });
          setJobs(unique);
          saveCachedRealJobs(unique);
          setRealJobsCount(unique.length);
        } else {
          setJobs(INITIAL_JOBS.filter(isTechDevJob));
          setRealJobsCount(INITIAL_JOBS.length);
        }
        setRealJobsError(errors ? errors.filter(Boolean).join(' | ') : '');
        setRealJobsStatus('ok');
      })
      .catch(err => {
        if (requestId !== searchRequestId.current) return;
        console.warn('Utilizando base de vagas integrada:', err);
        setJobs(prev => (prev && prev.length > 0 ? prev : INITIAL_JOBS.filter(isTechDevJob)));
        setRealJobsCount(INITIAL_JOBS.length);
        setRealJobsError('');
        setRealJobsStatus('ok');
      });
  };

  // Automatic search: runs on load and ~0.6s after the term or seniority filters change
  useEffect(() => {
    const timer = setTimeout(loadRealJobs, 600);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedSeniorities, selectedPlatforms, workTypeFilter, regionFilter, techAreaFilter]);

  // Persist changes
  const handleSaveProfile = (newProfile) => {
    setUserProfile(newProfile);
    saveUserProfile(newProfile);
  };

  const handleToggleSaveJob = (jobId) => {
    const newSaved = savedJobIds.includes(jobId)
      ? savedJobIds.filter(id => id !== jobId)
      : [...savedJobIds, jobId];
    setSavedJobIds(newSaved);
    saveSavedJobs(newSaved);
  };

  const handleApplyJob = (job) => {
    // Record application if not already recorded
    const existingIndex = applications.findIndex(a => a.job.id === job.id);
    let updatedApps = [];
    if (existingIndex === -1) {
      const newApp = {
        id: `app-${Date.now()}`,
        job,
        status: 'Aplicado',
        appliedAt: new Date().toISOString()
      };
      updatedApps = [newApp, ...applications];
    } else {
      updatedApps = [...applications];
    }
    setApplications(updatedApps);
    saveApplications(updatedApps);

    // Fire celebration confetti
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      });
    } catch (e) { }

    // Open target job URL in new tab
    const targetUrl = getJobDirectUrl(job);
    if (targetUrl) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleUpdateAppStatus = (appId, newStatus) => {
    const updated = applications.map(a => a.id === appId ? { ...a, status: newStatus } : a);
    setApplications(updated);
    saveApplications(updated);
  };

  const handleRemoveApplication = (appId) => {
    const updated = applications.filter(a => a.id !== appId);
    setApplications(updated);
    saveApplications(updated);
  };

  const handleAddAIJobs = (newJobs) => {
    const strictlyReal = (newJobs || []).filter(j => j && j.isReal && isTechDevJob(j));
    setJobs(prev => {
      const seen = new Set();
      // Novas vagas recebem prioridade no topo do feed, eliminando quaisquer duplicatas
      const combined = [...strictlyReal, ...(prev || [])];
      const deduplicated = [];

      for (const job of combined) {
        if (!job || !job.id) continue;
        const idKey = String(job.id);
        const normKey = `${(job.title || '').trim().toLowerCase()}|${(job.company || '').trim().toLowerCase()}`;
        if (!seen.has(idKey) && !seen.has(normKey)) {
          seen.add(idKey);
          seen.add(normKey);
          deduplicated.push(job);
        }
      }

      saveCachedRealJobs(deduplicated);
      setRealJobsCount(deduplicated.length);
      return deduplicated;
    });
    setRealJobsStatus('ok');
  };

  // Contagem dinâmica de vagas por área tech (exclusivamente Tech/Dev)
  const areaCounts = useMemo(() => {
    const counts = { all: 0 };
    for (const j of (jobs || [])) {
      if (!j || !isTechDevJob(j)) continue;
      counts.all++;
      const area = getJobTechArea(j).id;
      if (area !== 'non_tech') {
        counts[area] = (counts[area] || 0) + 1;
      }
    }
    return counts;
  }, [jobs]);

  // Filtered Jobs Computation - 100% Vagas Reais de Tecnologia e com pré-cálculo O(N)
  const filteredJobs = useMemo(() => {
    // 1. Filtragem inicial: estritamente vagas REAIS e da área de TECNOLOGIA/DEV (sem duplicatas)
    const seen = new Set();
    const result = jobs.filter(job => {
      if (!job || !job.isReal || !isTechDevJob(job)) return false;

      // Saved Jobs Only filter
      if (showSavedOnly && !savedJobIds.includes(job.id)) {
        return false;
      }

      // Date / Hours filter constraint (with 12h grace margin to preserve postings from Friday over the weekend)
      if (dateRangeFilter > 0) {
        const threshold = dateRangeFilter === 72 ? 84 : dateRangeFilter === 24 ? 30 : dateRangeFilter;
        if ((job.postedHoursAgo || 0) > threshold) {
          return false;
        }
      }

      // Tech Area filter (Dev, DevOps, Suporte & TI, Infra, Dados, QA, Segurança)
      if (techAreaFilter !== 'all') {
        const area = getJobTechArea(job).id;
        if (area !== techAreaFilter) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const haystack = [job.title, job.company, job.location, (job.requirements || []).join(' '), job.description]
          .join(' ')
          .toLowerCase();
        if (job.isReal) {
          const shortTokens = ['ti', 'qa', 'go', 'ui', 'c#', 'ai', 'ia', 'bi', 'db', 'os'];
          const tokens = [...new Set([...term.split(/\s+/), ...toSearchQuery(term).split(' ')])]
            .filter(t => t.length > 2 || shortTokens.includes(t));
          if (tokens.length > 0 && !tokens.some(t => haystack.includes(t))) return false;
        } else if (!haystack.includes(term)) {
          return false;
        }
      }

      // Work Type filter
      if (workTypeFilter !== 'Todos' && job.workType !== workTypeFilter) return false;

      // Region / State filter (com foco prioritário em SP)
      if (regionFilter !== 'Todas') {
        if (!matchesRegion(job, regionFilter, includeRemoteInRegion)) return false;
      }

      // Multi-Seniority filter
      if (selectedSeniorities.length > 0) {
        const jobLvl = (job.level || '').toLowerCase();
        const jobTitle = (job.title || '').toLowerCase();
        const isMatchedLvl = selectedSeniorities.some(lvl => {
          const targetLvl = lvl.toLowerCase();
          if (targetLvl.includes('júnior') || targetLvl.includes('junior')) {
            if (jobLvl.includes('júnior') || jobLvl.includes('junior') || jobLvl.includes('estágio') || jobLvl.includes('trainee')) return true;
            if (/(j[uú]nior|\bjr\b|est[aá]gio|estagi[aá]ri[oa]|trainee|intern|iniciante|aprendiz|assistente|\bi\b)/i.test(jobTitle)) return true;
          }
          if (targetLvl.includes('sênior') || targetLvl.includes('senior')) {
            if (jobLvl.includes('sênior') || jobLvl.includes('senior') || /(s[eê]nior|\bsr\b|lead|\biii\b)/i.test(jobTitle)) return true;
          }
          if (targetLvl.includes('especialista')) {
            if (jobLvl.includes('especialista') || /(especialista|architect|head)/i.test(jobTitle)) return true;
          }
          if (targetLvl.includes('pleno')) {
            if (jobLvl.includes('pleno') || /(pleno|\bii\b)/i.test(jobTitle)) return true;
          }
          return jobLvl.includes(targetLvl) || targetLvl.includes(jobLvl);
        });
        if (!isMatchedLvl) return false;
      }

      // Min Match Score filter
      const match = calculateMatch(userProfile, job);
      if (match.score < minMatchScore) return false;

      // Desduplicação estrita: NUNCA exibe a mesma vaga repetida no feed
      const idKey = String(job.id || '');
      const titleCompanyKey = `${(job.title || '').trim().toLowerCase()}|${(job.company || '').trim().toLowerCase()}`;
      if (idKey && seen.has(idKey)) return false;
      if (titleCompanyKey && seen.has(titleCompanyKey)) return false;
      if (idKey) seen.add(idKey);
      if (titleCompanyKey) seen.add(titleCompanyKey);

      return true;
    });

    // 2. Pré-computa scores e flags de região em O(N) antes do sort
    const scoreMap = new Map();
    const regionMap = new Map();
    for (let i = 0; i < result.length; i++) {
      const j = result[i];
      scoreMap.set(j.id, calculateMatch(userProfile, j).score);
      if (regionFilter !== 'Todas') {
        regionMap.set(j.id, matchesRegion(j, regionFilter, false) ? 1 : 0);
      }
    }

    // 3. Ordenação ultrarrápida O(N log N) comparando números já em cache
    result.sort((a, b) => {
      if (regionFilter !== 'Todas') {
        const aLocal = regionMap.get(a.id) || 0;
        const bLocal = regionMap.get(b.id) || 0;
        if (bLocal !== aLocal) return bLocal - aLocal;
      }

      if (sortBy === 'recent') {
        const timeDiff = (a.postedHoursAgo || 0) - (b.postedHoursAgo || 0);
        if (timeDiff !== 0) return timeDiff;
        return (scoreMap.get(b.id) || 0) - (scoreMap.get(a.id) || 0);
      } else {
        const scoreDiff = (scoreMap.get(b.id) || 0) - (scoreMap.get(a.id) || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return (a.postedHoursAgo || 0) - (b.postedHoursAgo || 0);
      }
    });

    return result;
  }, [
    jobs,
    sortBy,
    dateRangeFilter,
    techAreaFilter,
    searchTerm,
    workTypeFilter,
    regionFilter,
    includeRemoteInRegion,
    selectedSeniorities,
    userProfile,
    minMatchScore,
    showSavedOnly,
    savedJobIds
  ]);

  // Reset pagination to page 1 whenever any filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSeniorities, selectedPlatforms, workTypeFilter, regionFilter, techAreaFilter, dateRangeFilter, minMatchScore, sortBy, showSavedOnly]);

  // Paginação ultrarrápida: renderiza apenas 24 cards por vez (elimina lag e travamentos no tema!)
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / jobsPerPage));
  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * jobsPerPage;
    return filteredJobs.slice(start, start + jobsPerPage);
  }, [filteredJobs, currentPage, jobsPerPage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      const target = document.getElementById('job-results-section');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // How many real jobs of each seniority are currently loaded (shown in the status banner)
  const levelCounts = useMemo(() => {
    return jobs.reduce((acc, j) => {
      if (j && j.isReal && isTechDevJob(j)) acc[j.level] = (acc[j.level] || 0) + 1;
      return acc;
    }, { Júnior: 0, Pleno: 0, Sênior: 0, Especialista: 0 });
  }, [jobs]);


  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-150 selection:bg-blue-600 selection:text-white flex relative overflow-x-hidden">

      {/* Ripple Background Animation */}
      <div className="ripple-background" aria-hidden="true">
        <div className="ripple-origin">
          <div className="circle xxlarge shade1"></div>
          <div className="circle xlarge shade2"></div>
          <div className="circle large shade3"></div>
          <div className="circle medium mediun shade4"></div>
          <div className="circle small shade5"></div>
        </div>
      </div>

      {/* Left Sidebar (Collapsible with Toggle & Full Profile Widget) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={(val) => {
          setIsSidebarCollapsed(val);
          try { localStorage.setItem('vagas_ats_sidebar_collapsed', val ? 'true' : 'false'); } catch (e) {}
        }}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
        userProfile={userProfile}
        appliedCount={applications.length}
        totalJobsCount={jobs.length}
        savedJobsCount={savedJobIds.length}
        showSavedOnly={showSavedOnly}
        setShowSavedOnly={setShowSavedOnly}
        theme={theme}
        onToggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
        onOpenAiScan={() => setShowAIScanModal(true)}
      />

      {/* Main Workspace Area (pushes with sidebar transition) */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
        isSidebarCollapsed ? 'lg:pl-[76px]' : 'lg:pl-64'
      }`}>

        {/* Top App Header */}
        <Header
          userProfile={userProfile}
          onOpenProfile={() => setActiveTab('profile')}
          onOpenAiSettings={() => {
            setActiveTab('profile');
            setTimeout(() => {
              document.getElementById('ai-settings-card')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }}
          appliedCount={applications.length}
          totalJobsCount={jobs.length}
          theme={theme}
          onToggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
          activeTab={activeTab}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebarCollapse={() => {
            const next = !isSidebarCollapsed;
            setIsSidebarCollapsed(next);
            try { localStorage.setItem('vagas_ats_sidebar_collapsed', next ? 'true' : 'false'); } catch (e) {}
          }}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        {/* Main Content Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">

        {/* Tab 1: Vagas de Hoje (< 24h) */}
        {activeTab === 'jobs' && (
          <div className="space-y-6">

            {/* Quick Job Link Analyzer Banner (Solid clean styling) */}
            <div className="bg-[var(--bg-surface)] p-4 sm:p-5 rounded-2xl border border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3.5 w-full sm:w-auto">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-400">
                  <Link2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-[var(--text-main)]">
                      Tem o link de uma vaga específica?
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
                      Gupy, LinkedIn, Vagas & Mais
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Cole o link de qualquer portal para extrair os requisitos e montar seu currículo 100% nas normas ATS.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('analyze')}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold whitespace-nowrap shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Analisar Link de Vaga</span>
                <span>→</span>
              </button>
            </div>

            {/* Filters */}
            <SearchFilters
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              techAreaFilter={techAreaFilter}
              setTechAreaFilter={setTechAreaFilter}
              areaCounts={areaCounts}
              workTypeFilter={workTypeFilter}
              setWorkTypeFilter={setWorkTypeFilter}
              regionFilter={regionFilter}
              setRegionFilter={setRegionFilter}
              includeRemoteInRegion={includeRemoteInRegion}
              setIncludeRemoteInRegion={setIncludeRemoteInRegion}
              selectedSeniorities={selectedSeniorities}
              setSelectedSeniorities={setSelectedSeniorities}
              selectedPlatforms={selectedPlatforms}
              setSelectedPlatforms={setSelectedPlatforms}
              dateRangeFilter={dateRangeFilter}
              setDateRangeFilter={setDateRangeFilter}
              minMatchScore={minMatchScore}
              setMinMatchScore={setMinMatchScore}
              onRunAIScan={() => setShowAIScanModal(true)}
              isScanning={false}
            />

            {/* Real jobs status */}
            <div className="flex items-center justify-between flex-wrap gap-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl px-4 py-3 text-xs shadow-xs">
              <div className="space-y-0.5">
                {realJobsStatus === 'loading' && (
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    {regionFilter !== 'Todas'
                      ? `Buscando vagas reais em ${regionFilter === 'SP' ? 'São Paulo (SP)' : regionFilter} (Gupy, GitHub Vagas BR)...`
                      : 'Buscando vagas reais no Brasil (Gupy, FrontendBR, BackendBR, Nerdin, Comunidades)...'}
                  </span>
                )}
                {realJobsStatus === 'ok' && (
                  <span className="text-[var(--text-main)] font-medium">
                    <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{realJobsCount} vagas reais</strong> com links verdadeiros (
                    {['Júnior', 'Pleno', 'Sênior', 'Especialista']
                      .filter(l => levelCounts[l])
                      .map(l => `${l}: ${levelCounts[l]}`)
                      .join(' · ')}
                    ). A busca atualiza sozinha ao mudar o termo ou a senioridade.
                  </span>
                )}
                {realJobsStatus === 'error' && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    Falha ao sincronizar algumas plataformas. Exibindo vagas reais carregadas com sucesso.
                  </span>
                )}
                {realJobsError && (
                  <p className="text-[11px] text-[var(--text-faint)]">Detalhe: {realJobsError}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadRealJobs(true)}
                  disabled={realJobsStatus === 'loading'}
                  className="px-3.5 py-1.5 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--bg-card-hover)] text-blue-700 dark:text-blue-400 border border-[var(--border-subtle)] font-bold disabled:opacity-50 text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Clock className={`w-3.5 h-3.5 ${realJobsStatus === 'loading' ? 'animate-spin' : ''}`} />
                  <span>Atualizar vagas reais</span>
                </button>
              </div>
            </div>

            {/* Results Title Bar with Tabs (Todas vs Salvas) & Sort Selector */}
            <div id="job-results-section" className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Tab Switcher: Todas as Vagas vs Vagas Salvas */}
                <div className="flex items-center gap-1 bg-[var(--bg-subtle)] p-1 rounded-2xl border border-[var(--border-subtle)] text-xs">
                  <button
                    type="button"
                    onClick={() => setShowSavedOnly(false)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      !showSavedOnly
                        ? 'bg-blue-700 dark:bg-blue-600 text-white shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    <span>Todas as Vagas</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${!showSavedOnly ? 'bg-white/20 text-white' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-subtle)]'}`}>
                      {filteredJobs.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSavedOnly(true)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      showSavedOnly
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5 fill-current" />
                    <span>Vagas Salvas</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${showSavedOnly ? 'bg-white/20 text-white' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'}`}>
                      {savedJobIds.length}
                    </span>
                  </button>
                </div>

                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium hidden sm:inline-flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> Sincronizado ao vivo ({dateRangeFilter > 0 ? `< ${dateRangeFilter}h` : 'Todas as datas'})
                </span>
              </div>

              {/* Sort Selector: Mais Recentes vs Maior Match */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Ordenar:</span>
                <div className="flex items-center gap-1 bg-[var(--bg-subtle)] p-1 rounded-2xl border border-[var(--border-subtle)] text-xs">
                  <button
                    type="button"
                    onClick={() => setSortBy('recent')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      sortBy === 'recent'
                        ? 'bg-blue-700 dark:bg-blue-600 text-white shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Mais Recentes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy('match')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      sortBy === 'match'
                        ? 'bg-blue-700 dark:bg-blue-600 text-white shadow-xs'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Maior Match ATS</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Job Grid & Empty State */}
            {filteredJobs.length === 0 ? (
              <div className="glass-card p-12 rounded-3xl text-center space-y-4 border border-[var(--border-subtle)]">
                <div className="w-14 h-14 rounded-2xl bg-[var(--bg-subtle)] text-[var(--text-muted)] flex items-center justify-center mx-auto border border-[var(--border-subtle)]">
                  {showSavedOnly ? <Bookmark className="w-6 h-6 text-amber-500" /> : <Search className="w-6 h-6 text-[var(--text-muted)]" />}
                </div>
                <h3 className="text-base font-bold text-[var(--text-main)]">
                  {showSavedOnly ? "Nenhuma vaga salva encontrada" : "Nenhuma vaga atende aos filtros atuais"}
                </h3>
                <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
                  {showSavedOnly
                    ? "Você ainda não marcou nenhuma vaga como favorita. Clique no ícone de marcador (bookmark) em qualquer card de vaga para salvá-la aqui e acompanhar facilmente."
                    : "Tente alterar o período de publicação, a região ou a senioridade para ver mais vagas publicadas."}
                </p>
                {showSavedOnly ? (
                  <button
                    onClick={() => setShowSavedOnly(false)}
                    className="px-4 py-2 rounded-xl bg-blue-700 dark:bg-blue-600 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    Ver Todas as Vagas
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setWorkTypeFilter('Todos');
                      setRegionFilter('Todas');
                      setIncludeRemoteInRegion(true);
                      setSelectedSeniorities(["Júnior", "Pleno", "Sênior", "Especialista"]);
                      setSelectedPlatforms(["Gupy", "Nerdin", "FrontendBR", "BackendBR", "Comunidades BR"]);
                      setDateRangeFilter(0);
                      setMinMatchScore(20);
                      setTechAreaFilter('all');
                    }}
                    className="px-4 py-2 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--bg-card-hover)] text-blue-700 dark:text-blue-400 border border-[var(--border-subtle)] text-xs font-bold transition-all cursor-pointer"
                  >
                    Resetar Filtros
                  </button>
                )}
              </div>

            ) : (
              <div className="space-y-6">
                {/* 24 Cards Rendered per Page for Silky Smooth 60/120fps Rendering */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {paginatedJobs.map((job, idx) => (
                    <JobCard
                      key={`${job.id}-${idx}`}
                      job={job}
                      userProfile={userProfile}
                      onSelectJob={(j) => setSelectedJob(j)}
                      onGenerateResume={(j) => setResumeModalJob(j)}
                      onApplyJob={(j) => handleApplyJob(j)}
                      isApplied={applications.some(a => a.job.id === job.id)}
                      isSaved={savedJobIds.includes(job.id)}
                      onToggleSave={(id) => handleToggleSaveJob(id)}
                    />
                  ))}
                </div>

                {/* Professional Pagination Bar */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 pb-12 border-t border-[var(--border-subtle)]">
                    <div className="text-xs text-[var(--text-muted)] font-medium">
                      Mostrando <strong className="text-[var(--text-main)]">{(currentPage - 1) * jobsPerPage + 1}–{Math.min(currentPage * jobsPerPage, filteredJobs.length)}</strong> de <strong className="text-[var(--text-main)]">{filteredJobs.length}</strong> vagas
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-center">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold transition-all cursor-pointer"
                      >
                        ‹ Anterior
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2)
                        .reduce((acc, page, idx, arr) => {
                          if (idx > 0 && page - arr[idx - 1] > 1) {
                            acc.push('ellipsis-' + page);
                          }
                          acc.push(page);
                          return acc;
                        }, [])
                        .map((item) => {
                          if (typeof item === 'string') {
                            return <span key={item} className="px-1 text-[var(--text-faint)] text-xs">...</span>;
                          }
                          const isCur = item === currentPage;
                          return (
                            <button
                              key={item}
                              onClick={() => handlePageChange(item)}
                              className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                                isCur
                                  ? 'bg-blue-700 dark:bg-blue-600 text-white shadow-xs'
                                  : 'bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)]'
                              }`}
                            >
                              {item}
                            </button>
                          );
                        })}

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold transition-all cursor-pointer"
                      >
                        Próxima ›
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* Tab 2: Analisar Link de Vaga com IA ATS */}
        {activeTab === 'analyze' && (
          <JobLinkAnalyzer
            userProfile={userProfile}
            onGenerateResume={(j) => setResumeModalJob(j)}
            onAddJobToFeed={handleAddAIJobs}
          />
        )}

        {/* Tab 3: Minhas Candidaturas */}
        {activeTab === 'tracker' && (
          <ApplicationsTracker
            applications={applications}
            userProfile={userProfile}
            onUpdateStatus={handleUpdateAppStatus}
            onRemoveApplication={handleRemoveApplication}
            onGenerateResume={(j) => setResumeModalJob(j)}
          />
        )}

        {/* Tab 4: Perfil & Currículo Base */}
        {activeTab === 'profile' && (
          <ProfileTab
            userProfile={userProfile}
            onSaveProfile={handleSaveProfile}
          />
        )}

        {/* Tab 5: Orientações de Uso & Guia */}
        {activeTab === 'guide' && (
          <UserGuideTab
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

      </main>

      </div>

      {/* Modals */}
      {selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          userProfile={userProfile}
          onClose={() => setSelectedJob(null)}
          onGenerateResume={(j) => setResumeModalJob(j)}
          onApply={(j) => handleApplyJob(j)}
        />
      )}

      {resumeModalJob && (
        <TailoredResumeModal
          job={resumeModalJob}
          userProfile={userProfile}
          onClose={() => setResumeModalJob(null)}
        />
      )}

      {showAIScanModal && (
        <AIScanModal
          userProfile={userProfile}
          onClose={() => setShowAIScanModal(false)}
          onAddJobs={handleAddAIJobs}
          existingJobs={jobs}
        />
      )}

    </div>
  );
}

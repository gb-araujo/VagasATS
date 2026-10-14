import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Menu, X, Search, Sparkles, Send, 
  UserCheck, Bot, BookOpen, Sun, Moon, Briefcase, FileCheck, 
  Key, ShieldCheck, Settings, Edit3, User, Zap, ExternalLink, Bookmark
} from 'lucide-react';
import { loadAiSettings } from '../services/storageService';

export default function Sidebar({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
  userProfile,
  appliedCount,
  totalJobsCount,
  savedJobsCount = 0,
  showSavedOnly = false,
  setShowSavedOnly,
  theme,
  onToggleTheme,
  onOpenAiScan
}) {
  const [aiSettings, setAiSettings] = useState(() => loadAiSettings());

  useEffect(() => {
    const update = () => {
      setAiSettings(loadAiSettings());
    };
    window.addEventListener('storage', update);
    const interval = setInterval(update, 3000);
    return () => {
      window.removeEventListener('storage', update);
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    { 
      id: 'jobs', 
      label: 'Vagas & Radar ATS', 
      shortLabel: 'Vagas',
      icon: Search, 
      badge: totalJobsCount > 0 ? `${totalJobsCount}` : null,
      badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20'
    },
    { 
      id: 'saved', 
      label: 'Vagas Salvas', 
      shortLabel: 'Salvas',
      icon: Bookmark, 
      badge: savedJobsCount > 0 ? `${savedJobsCount}` : null,
      badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
    },
    { 
      id: 'analyze', 
      label: 'Analisar Link de Vaga', 
      shortLabel: 'Analisar',
      icon: Sparkles, 
      badge: 'ATS IA',
      badgeColor: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
    },
    { 
      id: 'tracker', 
      label: 'Minhas Candidaturas', 
      shortLabel: 'Candidaturas',
      icon: Send, 
      badge: appliedCount > 0 ? `${appliedCount}` : null,
      badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
    },
    { 
      id: 'profile', 
      label: 'Meu Perfil & Currículo', 
      shortLabel: 'Perfil',
      icon: UserCheck, 
      badge: 'Base',
      badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
    },
    { 
      id: 'aiscan', 
      label: 'Scanner Rápido com IA', 
      shortLabel: 'Scanner',
      icon: Bot, 
      badge: null 
    },
    { 
      id: 'guide', 
      label: 'Orientações de Uso', 
      shortLabel: 'Guia',
      icon: BookOpen, 
      badge: null 
    },
  ];

  const handleNavClick = (tabId) => {
    if (tabId === 'aiscan') {
      if (onOpenAiScan) onOpenAiScan();
    } else if (tabId === 'saved') {
      setActiveTab('jobs');
      if (setShowSavedOnly) setShowSavedOnly(true);
    } else if (tabId === 'jobs') {
      setActiveTab('jobs');
      if (setShowSavedOnly) setShowSavedOnly(false);
    } else {
      setActiveTab(tabId);
    }
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  const candidateName = userProfile?.fullName || 'Meu Perfil';
  const candidateRole = userProfile?.targetRole || 'Desenvolvedor Tech';
  const candidateSeniority = userProfile?.seniority || 'Júnior';
  const userInitial = candidateName.trim().charAt(0).toUpperCase() || 'U';

  // No mobile, a gaveta lateral DEVE SEMPRE exibir todos os textos e detalhes
  const isEffectiveCollapsed = isCollapsed && !isMobileOpen;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div 
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity animate-fade-in"
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] shadow-2xl transition-all duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          isEffectiveCollapsed ? 'lg:w-[76px]' : 'lg:w-64'
        } w-72 sm:w-80 max-w-[85vw]`}
      >
        {/* Sidebar Header & Brand Logo */}
        <div className={`border-b border-[var(--border-subtle)] relative min-h-[72px] flex items-center ${
          isEffectiveCollapsed ? 'justify-center p-3' : 'justify-between p-4'
        }`}>
          <div 
            onClick={() => handleNavClick('jobs')}
            className={`flex items-center gap-3 cursor-pointer group transition-transform ${isEffectiveCollapsed ? 'justify-center' : ''}`}
            title="vagasATS - Início"
          >
            <div className="relative flex items-center justify-center rounded-xl bg-[var(--bg-subtle)] p-1.5 border border-[var(--border-subtle)] shadow-sm group-hover:border-blue-500/50 transition-all shrink-0">
              <img 
                src="/logo.png" 
                alt="vagasATS" 
                className="h-8 w-8 object-contain"
              />
            </div>

            {!isEffectiveCollapsed && (
              <div className="flex flex-col min-w-0 transition-opacity duration-200">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-black tracking-tight text-[var(--text-main)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    vagas<span className="text-blue-600 dark:text-blue-400 font-extrabold">ATS</span>
                  </span>
                  <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.2 rounded bg-blue-600/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                    PRO
                  </span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] truncate font-medium">
                  IA &amp; Currículos Sob Medida
                </span>
              </div>
            )}
          </div>

          {/* Desktop Toggle Button in Expanded Mode */}
          {!isEffectiveCollapsed && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="hidden lg:flex p-1.5 rounded-xl bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] transition-all cursor-pointer"
              title="Recolher menu lateral"
              aria-label="Recolher menu lateral"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {/* Desktop Floating Toggle Button in Collapsed Mode (Clean edge button, zero logo overlap) */}
          {isEffectiveCollapsed && (
            <button
              onClick={() => setIsCollapsed(false)}
              className="hidden lg:flex absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-md items-center justify-center text-[var(--text-muted)] hover:text-blue-600 hover:border-blue-500 cursor-pointer transition-all z-50 hover:scale-110"
              title="Expandir menu lateral"
              aria-label="Expandir menu lateral"
            >
              <ChevronRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </button>
          )}

          {/* Mobile Close Button */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-subtle)] cursor-pointer"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 custom-scrollbar">
          {!isEffectiveCollapsed && (
            <div className="px-3 pb-2 text-[10px] uppercase font-bold tracking-wider text-[var(--text-faint)]">
              Navegação Principal
            </div>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === 'saved'
              ? (activeTab === 'jobs' && showSavedOnly)
              : item.id === 'jobs'
              ? (activeTab === 'jobs' && !showSavedOnly)
              : activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group relative cursor-pointer ${
                  isActive
                    ? 'bg-blue-700 dark:bg-blue-600 text-white shadow-sm font-bold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)]'
                } ${isEffectiveCollapsed ? 'lg:justify-center lg:px-2' : ''}`}
                title={isEffectiveCollapsed ? item.label : undefined}
              >
                <div className="relative shrink-0 flex items-center justify-center">
                  <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-blue-600/80 dark:text-blue-400/80 group-hover:text-blue-600'}`} />
                </div>

                {!isEffectiveCollapsed && (
                  <span className="flex-1 text-left truncate text-xs">
                    {item.label}
                  </span>
                )}

                {!isEffectiveCollapsed && item.badge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}

                {/* Collapsed Active Indicator Dot */}
                {isEffectiveCollapsed && isActive && (
                  <span className="absolute right-1 w-1.5 h-1.5 rounded-full bg-white lg:block hidden" />
                )}
              </button>
            );
          })}


        </div>

        {/* Sidebar Footer & User Profile Card */}
        <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-card)]/50 space-y-2">
          
          {/* Theme & Settings Quick Switcher */}
          {!isEffectiveCollapsed ? (
            <div className="flex items-center justify-between px-2 py-1 text-xs">
              <span className="text-[11px] font-medium text-[var(--text-muted)]">Tema do Aplicativo</span>
              <button
                onClick={onToggleTheme}
                className="p-1.5 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)] transition-all flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
                title={theme === 'dark' ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px]">Claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-slate-700" />
                    <span className="text-[11px]">Escuro</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={onToggleTheme}
                className="p-2 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)] transition-all cursor-pointer"
                title={theme === 'dark' ? "Modo Claro" : "Modo Escuro"}
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-700" />
                )}
              </button>
            </div>
          )}

          {/* Interactive User Profile Card */}
          <div
            onClick={() => handleNavClick('profile')}
            className={`rounded-xl border transition-all cursor-pointer group ${
              activeTab === 'profile'
                ? 'bg-blue-600/10 border-blue-500/50 shadow-sm shadow-blue-500/10'
                : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] hover:border-blue-500/40 hover:bg-[var(--bg-card)]'
            } ${isEffectiveCollapsed ? 'p-2 flex justify-center' : 'p-3'}`}
            title="Abrir Meu Perfil & Currículo Base para editar informações"
          >
            {isEffectiveCollapsed ? (
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-extrabold text-sm text-white shadow-md shadow-blue-500/30 group-hover:scale-105 transition-transform">
                  {userInitial}
                </div>
                <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[var(--bg-surface)]" />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-extrabold text-sm text-white shadow-md shadow-blue-500/30 group-hover:scale-105 transition-transform">
                    {userInitial}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[var(--bg-surface)]" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[var(--text-main)] truncate group-hover:text-blue-500 transition-colors">
                      {candidateName}
                    </h4>
                    <Edit3 className="w-3 h-3 text-[var(--text-faint)] group-hover:text-blue-500 transition-colors shrink-0" />
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] truncate font-medium">
                    {candidateRole}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {candidateSeniority}
                    </span>
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Editar Perfil
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </aside>
    </>
  );
}

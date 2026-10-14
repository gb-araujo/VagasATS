import React, { useState, useEffect } from 'react';
import { 
  Briefcase, FileCheck, Key, User, Sun, Moon, Sparkles, Menu, 
  ChevronRight, Send, UserCheck, BookOpen, Bot
} from 'lucide-react';
import { loadAiSettings } from '../services/storageService';

export default function Header({ 
  userProfile, 
  onOpenProfile, 
  onOpenAiSettings, 
  appliedCount, 
  totalJobsCount,
  theme = 'dark',
  onToggleTheme,
  activeTab = 'jobs',
  isSidebarCollapsed = false,
  onToggleSidebarCollapse,
  onOpenMobileSidebar
}) {
  const [aiSettings, setAiSettings] = useState(() => loadAiSettings());

  useEffect(() => {
    const update = () => {
      setAiSettings(loadAiSettings());
    };
    window.addEventListener('storage', update);
    const interval = setInterval(update, 2500);
    return () => {
      window.removeEventListener('storage', update);
      clearInterval(interval);
    };
  }, []);

  const tabTitles = {
    jobs: { title: 'Radar de Vagas & Triagem ATS', icon: Briefcase, desc: 'Vagas recentes de tecnologia e match semântico' },
    analyze: { title: 'Analisador de Link de Vaga com IA', icon: Sparkles, desc: 'Cole o link de vagas suportadas (Gupy, Vagas.com, Nerdin, etc.)' },
    tracker: { title: 'Minhas Candidaturas & Funil', icon: Send, desc: 'Acompanhe vagas aplicadas e entrevistas' },
    profile: { title: 'Meu Perfil & Currículo Base', icon: UserCheck, desc: 'Informações pessoais, experiências e competências' },
    guide: { title: 'Orientações & Guia de Uso', icon: BookOpen, desc: 'Dicas para otimização ATS e boas práticas' },
  };

  const currentTabInfo = tabTitles[activeTab] || tabTitles.jobs;
  const TabIcon = currentTabInfo.icon;

  return (
    <header className="sticky top-0 z-30 glass-panel border-b border-[var(--border-subtle)] px-4 lg:px-6 py-2.5 transition-colors">
      <div className="flex items-center justify-between gap-3">
        
        {/* Left: Mobile Hamburger & Desktop Toggle + Active Tab Title */}
        <div className="flex items-center gap-3 min-w-0">
          
          {/* Mobile Menu Trigger Button */}
          <button
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)] transition-all cursor-pointer shrink-0"
            aria-label="Abrir menu de navegação"
          >
            <Menu className="w-5 h-5 text-blue-500" />
          </button>

          {/* Desktop Toggle Button when Collapsed */}
          {isSidebarCollapsed && (
            <button
              onClick={onToggleSidebarCollapse}
              className="hidden lg:flex p-1.5 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)] transition-all cursor-pointer items-center gap-1 shrink-0"
              title="Expandir barra lateral"
            >
              <ChevronRight className="w-4 h-4 text-blue-500" />
            </button>
          )}

          {/* Mobile Logo Brand */}
          <div className="lg:hidden flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] p-1 flex items-center justify-center">
              <img src="/logo.png" alt="vagasATS" className="w-full h-full object-contain" />
            </div>
            <span className="text-sm font-black text-[var(--text-main)]">
              vagas<span className="text-blue-500">ATS</span>
            </span>
          </div>

          {/* Desktop Breadcrumb & Tab Header */}
          <div className="hidden sm:flex flex-col min-w-0 pl-1">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <TabIcon className="w-3.5 h-3.5" />
              </span>
              <h1 className="text-sm font-extrabold text-[var(--text-main)] truncate tracking-tight">
                {currentTabInfo.title}
              </h1>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] truncate hidden md:block">
              {currentTabInfo.desc}
            </p>
          </div>

        </div>

        {/* Right: Stats, AI Status, Quotas & Theme */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          
          {/* Total Jobs Counter */}
          <div className="hidden xl:flex items-center gap-2 text-xs font-semibold bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5">
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <Briefcase className="w-3.5 h-3.5" />
              <span>{totalJobsCount} vagas</span>
            </div>
            <div className="h-3 w-px bg-[var(--border-strong)]"></div>
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <FileCheck className="w-3.5 h-3.5" />
              <span>{appliedCount} aplicadas</span>
            </div>
          </div>

          {/* AI Status Chip */}
          <button
            onClick={onOpenAiSettings || onOpenProfile}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
              aiSettings.enabled
                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] text-[var(--text-muted)] border-[var(--border-subtle)]'
            }`}
            title={aiSettings.enabled ? `IA Ativa (${aiSettings.provider === 'openai' ? 'OpenAI' : 'Google Gemini Flash'})` : "Conectar Chave de IA Oficial"}
          >
            {aiSettings.enabled ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[11px] font-bold">{aiSettings.provider === 'openai' ? 'GPT-4o Ativo' : 'Gemini Flash Ativo'}</span>
              </>
            ) : (
              <>
                <Key className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-[11px]">Conectar IA</span>
              </>
            )}
          </button>

          {/* Theme Toggle (Light / Dark) */}
          <button
            onClick={onToggleTheme}
            className="w-8 h-8 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)] flex items-center justify-center transition-all cursor-pointer shrink-0"
            title={theme === 'dark' ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* User Profile Avatar Quick Button */}
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-2 bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] text-[var(--text-main)] text-xs font-semibold p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl transition-all cursor-pointer shrink-0"
            title="Abrir Meu Perfil & Currículo"
          >
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-extrabold text-xs text-white">
              {userProfile.fullName ? userProfile.fullName.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
            </div>
            <span className="hidden lg:inline-block max-w-[100px] truncate text-xs font-bold">
              {userProfile.fullName ? userProfile.fullName.split(' ')[0] : "Meu Perfil"}
            </span>
          </button>

        </div>

      </div>
    </header>
  );
}

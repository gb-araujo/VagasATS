import React from 'react';
import { Search, UserCheck, Send, Bot, Sparkles, BookOpen } from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab, appliedCount }) {
  const navItems = [
    { id: 'jobs', label: 'Vagas de Hoje', icon: Search, badge: null },
    { id: 'analyze', label: 'Analisar Link de Vaga', icon: Sparkles, badge: 'ATS' },
    { id: 'tracker', label: 'Minhas Candidaturas', icon: Send, badge: appliedCount > 0 ? appliedCount : null },
    { id: 'profile', label: 'Meu Perfil & Currículo', icon: UserCheck, badge: null },
    { id: 'aiscan', label: 'Scanner Rápido', icon: Bot, badge: null },
    { id: 'guide', label: 'Orientações de Uso', icon: BookOpen, badge: null },
  ];

  return (
    <>
      {/* Desktop Navigation */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 lg:px-8 mt-5">
        <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] p-1.5 rounded-2xl border border-[var(--border-subtle)] shadow-sm">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-semibold text-xs transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-[var(--text-muted)]'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] px-2 py-2 shadow-lg">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all relative ${
                  isActive ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <div className="relative">
                  <Icon className="w-4 h-4 mb-0.5" />
                  {item.badge && (
                    <span className="absolute -top-1 -right-2 bg-blue-600 text-white text-[8px] font-bold px-1 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] tracking-tight truncate max-w-[60px]">{item.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

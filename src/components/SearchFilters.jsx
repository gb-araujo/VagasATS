import React from 'react';
import { Search, Sparkles, RefreshCw, Zap, Calendar, Check, MapPin, Briefcase } from 'lucide-react';
import { BRAZIL_REGIONS, TECH_AREAS } from '../services/aiEngine';
import TechAreaIcon from './TechAreaIcon';

export default function SearchFilters({
  searchTerm,
  setSearchTerm,
  workTypeFilter,
  setWorkTypeFilter,
  regionFilter,
  setRegionFilter,
  includeRemoteInRegion,
  setIncludeRemoteInRegion,
  selectedSeniorities,
  setSelectedSeniorities,
  selectedPlatforms,
  setSelectedPlatforms,
  dateRangeFilter,
  setDateRangeFilter,
  minMatchScore,
  setMinMatchScore,
  techAreaFilter = 'all',
  setTechAreaFilter,
  areaCounts = {},
  onRunAIScan,
  isScanning
}) {
  const seniorityOptions = ["Júnior", "Pleno", "Sênior", "Especialista"];
  const dateOptions = [
    { value: 24, label: "Últimas 24h (Hoje)" },
    { value: 72, label: "Últimos 3 dias" },
    { value: 168, label: "Últimos 7 dias (1 semana)" },
    { value: 360, label: "Últimos 15 dias" },
    { value: 720, label: "Últimos 30 dias" },
    { value: 0, label: "Todas as datas recentes" },
  ];
  const platformOptions = ["Gupy", "Nerdin", "FrontendBR", "BackendBR", "Comunidades BR"];

  const toggleSeniority = (level) => {
    if (selectedSeniorities.includes(level)) {
      if (selectedSeniorities.length > 1) {
        setSelectedSeniorities(selectedSeniorities.filter(s => s !== level));
      }
    } else {
      setSelectedSeniorities([...selectedSeniorities, level]);
    }
  };

  const togglePlatform = (platform) => {
    if (selectedPlatforms.includes(platform)) {
      if (selectedPlatforms.length > 1) {
        setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
      }
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  return (
    <div className="glass-panel p-5 rounded-2xl border border-[var(--border-subtle)] space-y-4 mb-6 shadow-sm">

      {/* Top Search Bar & AI Trigger */}
      <div className="flex flex-col sm:flex-row items-center gap-3">

        {/* Search Bar Input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[var(--text-faint)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar cargo (Dev, Suporte TI, DevOps, SRE, Infra...), tecnologia ou empresa..."
            className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-main)] text-xs font-bold"
            >
              Limpar
            </button>
          )}
        </div>

        {/* AI Scan Trigger Button */}
        <button
          onClick={onRunAIScan}
          disabled={isScanning}
          className="w-full sm:w-auto gradient-btn px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
        >
          {isScanning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Escaneando Vagas...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Rastrear Vagas com IA</span>
            </>
          )}
        </button>

      </div>

      {/* Tech & IT Specialties / Areas Filter Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[var(--text-main)] flex items-center gap-1.5 uppercase tracking-wide">
            <Briefcase className="w-3.5 h-3.5 text-blue-500" />
            Áreas &amp; Especialidades Tech:
          </span>
          {techAreaFilter !== 'all' && (
            <button
              onClick={() => setTechAreaFilter('all')}
              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Ver Todas as Áreas
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {TECH_AREAS.map((area) => {
            const isSelected = techAreaFilter === area.id;
            const count = areaCounts?.[area.id] ?? 0;

            const colorStyles = {
              blue: isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20' : 'hover:border-blue-500/40',
              amber: isSelected ? 'bg-amber-600 text-white border-amber-600 shadow-sm shadow-amber-500/20' : 'hover:border-amber-500/40',
              emerald: isSelected ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-500/20' : 'hover:border-emerald-500/40',
              cyan: isSelected ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm shadow-cyan-500/20' : 'hover:border-cyan-500/40',
              purple: isSelected ? 'bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-500/20' : 'hover:border-purple-500/40',
              teal: isSelected ? 'bg-teal-600 text-white border-teal-600 shadow-sm shadow-teal-500/20' : 'hover:border-teal-500/40',
              rose: isSelected ? 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-500/20' : 'hover:border-rose-500/40',
            };

            return (
              <button
                key={area.id}
                onClick={() => setTechAreaFilter(area.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
                  isSelected
                    ? colorStyles[area.color] || 'bg-blue-600 text-white border-blue-600'
                    : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-main)]'
                }`}
              >
                <TechAreaIcon areaId={area.id} className="w-3.5 h-3.5" />
                <span>{area.shortLabel}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Region / State Selector */}
      <div className="bg-[var(--bg-subtle)] p-3 rounded-xl border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-[var(--text-main)] flex items-center gap-1.5 uppercase tracking-wide">
            <MapPin className="w-3.5 h-3.5 text-rose-500" />
            Região:
          </span>
          {[
            { key: 'Todas', label: 'Brasil Todo' },
            { key: 'SP', label: 'São Paulo' },
            { key: 'RJ', label: 'Rio de Janeiro' },
            { key: 'MG', label: 'Minas Gerais' },
            { key: 'PR', label: 'Paraná' },
            { key: 'SC', label: 'Santa Catarina' },
            { key: 'RS', label: 'Rio Grande do Sul' },
          ].map((r) => {
            const isSelected = (regionFilter || 'Todas') === r.key;
            return (
              <button
                key={r.key}
                onClick={() => setRegionFilter(r.key)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-main)] hover:border-[var(--border-strong)]'
                }`}
              >
                {isSelected && <Check className="w-3 h-3 text-white" />}
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>

        {/* State Dropdown & Remote Checkbox */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={regionFilter || 'Todas'}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="glass-input text-xs py-1.5 px-3 rounded-lg cursor-pointer w-full sm:w-auto font-medium"
          >
            {BRAZIL_REGIONS.map((reg) => (
              <option key={reg.value} value={reg.value}>
                {reg.label}
              </option>
            ))}
          </select>

          {regionFilter !== 'Todas' && (
            <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={includeRemoteInRegion}
                onChange={(e) => setIncludeRemoteInRegion(e.target.checked)}
                className="rounded accent-blue-600 cursor-pointer"
              />
              <span>+ Vagas Remotas</span>
            </label>
          )}
        </div>
      </div>

      {/* Filter Controls Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[var(--border-subtle)]">

        {/* Multi-Select Seniority Pills */}
        <div>
          <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1.5">
            Senioridade
          </label>
          <div className="flex flex-wrap gap-1.5">
            {seniorityOptions.map((level) => {
              const isSelected = selectedSeniorities.includes(level);
              return (
                <button
                  key={level}
                  onClick={() => toggleSeniority(level)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-main)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                  <span>{level}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Multi-Select Platforms Pills */}
        <div>
          <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1.5">
            Plataformas
          </label>
          <div className="flex flex-wrap gap-1.5">
            {platformOptions.map((platform) => {
              const isSelected = selectedPlatforms?.includes(platform);
              return (
                <button
                  key={platform}
                  onClick={() => togglePlatform(platform)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-main)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                  <span>{platform}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date / Publication Recency Dropdown */}
        <div>
          <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1.5">
            Período de Publicação
          </label>
          <select
            value={dateRangeFilter}
            onChange={(e) => setDateRangeFilter(Number(e.target.value))}
            className="glass-input w-full p-2 rounded-lg text-xs font-medium cursor-pointer"
          >
            {dateOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Work Format & Minimum Match Slider */}
        <div className="grid grid-cols-2 gap-3 md:col-span-3">
          <div>
            <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1.5">Formato de Trabalho</label>
            <select
              value={workTypeFilter}
              onChange={(e) => setWorkTypeFilter(e.target.value)}
              className="glass-input w-full p-2 rounded-lg text-xs font-medium cursor-pointer"
            >
              <option value="Todos">Todos os Formatos</option>
              <option value="Remoto">100% Remoto</option>
              <option value="Híbrido">Híbrido</option>
              <option value="Presencial">Presencial</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-semibold text-[var(--text-muted)] block">Nota Mínima de Match</label>
              <span className="text-xs font-bold text-blue-600">{minMatchScore}%+</span>
            </div>
            <input
              type="range"
              min="20"
              max="85"
              step="5"
              value={minMatchScore}
              onChange={(e) => setMinMatchScore(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer h-1.5 bg-[var(--border-subtle)] rounded-lg mt-2"
            />
          </div>
        </div>

      </div>

    </div>
  );
}

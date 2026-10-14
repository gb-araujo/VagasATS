import React, { useState } from 'react';
import { 
  BookOpen, Sparkles, Key, ShieldCheck, CheckCircle2, 
  ExternalLink, Download, FileText, Search, Zap, Layers, 
  HelpCircle, ArrowRight, Bot, Cpu, Lock, Check, ChevronDown, ChevronUp
} from 'lucide-react';

export default function UserGuideTab({ onNavigateTab }) {
  const [activeFaq, setActiveFaq] = useState(null);

  const toggleFaq = (idx) => {
    setActiveFaq(activeFaq === idx ? null : idx);
  };

  const faqs = [
    {
      q: "Preciso pagar alguma coisa para usar a IA do aplicativo?",
      a: "Não! Se você utilizar o Google Gemini (recomendado), a API oferece uma cota gratuita oficial de 15 requisições por minuto através do Google AI Studio, sem necessidade de cartão de crédito. Caso prefira usar a OpenAI (ChatGPT), você precisará de créditos pré-pagos ($5) na sua conta da OpenAI."
    },
    {
      q: "O aplicativo salva meus dados em algum servidor ou banco de dados?",
      a: "Não. O aplicativo adota arquitetura 100% Local-First. Todos os seus dados cadastrados (experiências, formação, candidaturas e chaves de API) ficam armazenados exclusivamente no localStorage do seu navegador. Nada é enviado para servidores de terceiros além das requisições diretas à IA que você escolher."
    },
    {
      q: "O que é o 'Match Score' das vagas?",
      a: "É um cálculo algorítmico inteligente que compara seus requisitos técnicos (skills declaradas, cargo alvo, senioridade e modelo de trabalho preferido) com as exigências da descrição oficial da vaga. Vagas com mais de 70% de match têm altíssima probabilidade de resposta."
    },
    {
      q: "A IA inventa informações ou tecnologias no meu currículo?",
      a: "Não. O motor de geração foi programado com diretrizes estritas de tolerância zero para alucinações. Ele utiliza estritamente o seu histórico profissional verdadeiro, apenas reescrevendo suas atividades com linguagem técnica orientada a resultados (método STAR) e destacando palavras-chave solicitadas pelo sistema ATS da vaga."
    },
    {
      q: "Qual a diferença entre 'Perfil Seguro' e 'Backup Completo' na exportação?",
      a: "O Perfil Seguro (.json) exporta apenas seus dados profissionais (currículo, experiências, skills e contato), sem nenhuma credencial de IA, sendo 100% seguro para compartilhar ou enviar. Já o Backup Completo inclui sua chave de API para facilitar a migração rápida de computador ou navegador."
    }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-fade-in">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-[var(--border-subtle)] space-y-3">
        <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
          <BookOpen className="w-4 h-4" />
          <span>Manual Oficial do Usuário</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)] tracking-tight">
          Orientações &amp; Guia de Uso
        </h1>
        <p className="text-sm text-[var(--text-muted)] max-w-3xl leading-relaxed">
          Aprenda como encontrar vagas recentes das principais plataformas brasileiras, conectar sua chave de inteligência artificial de forma gratuita e gerar currículos sob medida formatados para superar filtros ATS.
        </p>

        <div className="flex flex-wrap gap-2.5 pt-2">
          <button
            onClick={() => onNavigateTab?.('jobs')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Buscar Vagas de Hoje</span>
          </button>
          <button
            onClick={() => onNavigateTab?.('profile')}
            className="px-4 py-2 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--border-subtle)] text-[var(--text-main)] border border-[var(--border-subtle)] text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Key className="w-3.5 h-3.5 text-blue-500" />
            <span>Configurar Chave de IA</span>
          </button>
        </div>
      </div>

      {/* Grid de Seções Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Card 1: Como Funciona a Busca */}
        <div className="glass-card p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-main)]">
              1. Encontrando Vagas Recentes (&lt; 24h)
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
              Candidatar-se nas primeiras horas aumenta drasticamente as chances de seu currículo ser lido antes dos outros candidatos.
            </p>
          </div>
          <ul className="text-xs text-[var(--text-muted)] space-y-2 leading-relaxed">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>Fontes Oficiais:</strong> O sistema rastreia vagas reais de plataformas consolidadas no Brasil (Gupy, repositórios abertos de vagas tech e comunidades).</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>Filtros por Estado / SP:</strong> Você pode focar em São Paulo, outras capitais ou vagas 100% remotas.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>Senioridade Múltipla:</strong> Filtre de Júnior a Especialista com base nos seus objetivos.</span>
            </li>
          </ul>
        </div>

        {/* Card 2: Currículo sob Medida & ATS */}
        <div className="glass-card p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-main)]">
              2. Currículos Sob Medida para ATS
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
              Sistemas como Gupy e Workday usam filtros automáticos de palavras-chave. Um currículo genérico costuma ser descartado na triagem inicial.
            </p>
          </div>
          <ul className="text-xs text-[var(--text-muted)] space-y-2 leading-relaxed">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>Resumo Profissional Conciso:</strong> Redige de 1 a 2 parágrafos objetivos (~4 a 5 linhas) destacando sua aderência imediata ao cargo.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>Método STAR nas Experiências:</strong> Organiza suas tarefas em Ação + Tecnologia + Resultado prático real.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>Janela de Contexto &amp; Trajetória:</strong> Tem pouca experiência formal ou descrições breves? Alimente a Janela de Contexto no seu Perfil: a IA utiliza seus projetos práticos, rotinas e ferramentas reais para desdobrar cada experiência em 3 a 5 bullet points densos no método STAR, sem mentir.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>Exportação em PDF Limpo:</strong> Gera um PDF com formatação estruturada de uma coluna, sem tabelas complexas que travam robôs de RH.</span>
            </li>
          </ul>
        </div>

        {/* Card 3: Como Conectar a IA */}
        <div className="glass-card p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-main)]">
              3. Conectando sua Chave de IA (BYOK)
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
              O modelo Bring Your Own Key dá a você controle total, sem intermediários e com custo zero.
            </p>
          </div>
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1.5">
              <div className="font-bold text-[var(--text-main)] flex items-center justify-between">
                <span>Google Gemini (Recomendado)</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold">100% Gratuito</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                1. Entre em <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-500 underline font-semibold">Google AI Studio</a> com sua conta Google.<br/>
                2. Clique em <strong>"Create API key"</strong> e copie a chave.<br/>
                3. Cole no aplicativo na aba Perfil e clique em <strong>Salvar Chave</strong>.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1.5">
              <div className="font-bold text-[var(--text-main)] flex items-center justify-between">
                <span>OpenAI (ChatGPT / GPT-4o-mini)</span>
                <span className="text-[10px] bg-slate-500/10 text-[var(--text-muted)] px-2 py-0.5 rounded-full font-bold">Créditos Pré-pagos</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                1. Entre em <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-blue-500 underline font-semibold">OpenAI Platform</a>.<br/>
                2. Adicione saldo no menu Billing (mínimo $5).<br/>
                3. Gere uma chave secreta (<code className="font-mono text-[10px]">sk-proj-...</code>) e cole no aplicativo.
              </p>
            </div>
          </div>
        </div>

        {/* Card 4: Analisador de Links de Vagas */}
        <div className="glass-card p-6 rounded-2xl border border-[var(--border-subtle)] space-y-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-main)]">
              4. Analisando Vagas Externas
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
              Encontrou uma vaga no Gupy, Vagas.com ou site de carreiras da empresa? Você pode trazê-la para o vagasATS com 1 clique.
            </p>
          </div>
          <ul className="text-xs text-[var(--text-muted)] space-y-2 leading-relaxed">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>Acesse a aba <strong>Analisar Link de Vaga</strong> na barra de navegação.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>Cole a URL completa do anúncio ou cole o texto da descrição.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>O sistema mapeia instantaneamente os requisitos técnicos, nível de senioridade e modelo de trabalho.</span>
            </li>
          </ul>
        </div>

      </div>

      {/* Seção: Privacidade & Dados Locais */}
      <div className="glass-card p-6 sm:p-8 rounded-2xl border border-[var(--border-subtle)] space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-main)]">
              Privacidade Absoluta: Arquitetura 100% Local (Sem Banco de Dados)
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Seus dados pertencem unicamente a você.
            </p>
          </div>
        </div>

        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Diferente de plataformas convencionais que guardam seus dados em bancos centrais, o VagasIA Pro opera no conceito <strong>Local-First</strong>. Suas informações são persistidas no <code className="font-mono bg-[var(--bg-subtle)] px-1.5 py-0.5 rounded text-[11px]">localStorage</code> do seu navegador.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1.5">
            <div className="font-bold text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Exportação de Perfil Seguro</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Exporta um arquivo <code className="font-mono">.json</code> contendo apenas dados do seu currículo. Totalmente livre de chaves ou senhas, seguro para guardar em nuvem ou enviar.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-1.5">
            <div className="font-bold text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <Download className="w-4 h-4" />
              <span>Backup Completo com Chave</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Salva o perfil junto com suas credenciais de IA para migrar para outro navegador ou computador em poucos segundos.
            </p>
          </div>
        </div>
      </div>

      {/* FAQ Accordion */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-[var(--border-subtle)] space-y-4">
        <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
          <HelpCircle className="w-4 h-4" />
          <span>Dúvidas Frequentes</span>
        </div>
        <h2 className="text-xl font-bold text-[var(--text-main)]">
          Perguntas &amp; Respostas Comuns
        </h2>

        <div className="space-y-3 pt-2">
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div 
                key={idx}
                className="border border-[var(--border-subtle)] rounded-xl overflow-hidden transition-all bg-[var(--bg-subtle)]"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 text-left flex items-center justify-between gap-4 font-semibold text-xs text-[var(--text-main)] hover:bg-[var(--border-subtle)]/40 transition-colors"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-blue-500 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="p-4 pt-0 text-xs text-[var(--text-muted)] leading-relaxed border-t border-[var(--border-subtle)]/60 bg-[var(--bg-card)]">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

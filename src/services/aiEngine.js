/**
 * AI Engine for Job Matching, Profile Evaluation, Resume Tailoring and Cover Letter Generation
 */
import { recordAiRequest } from './quotaTracker.js';
import { cleanResumeTitle, cleanCompanyName, sanitizePdfText } from './pdfService.js';
import { INITIAL_JOBS } from '../data/mockJobs.js';
import { loadAiSettings } from './storageService.js';

// Cache de alta performance para cálculo de compatibilidade de vagas
const matchCache = new Map();

/**
 * Deduplica tópicos de experiência preservando ordem e eliminando repetições literais e semânticas próximas
 */
export function deduplicateBullets(bullets = []) {
  const seen = new Set();
  const result = [];
  for (const b of bullets) {
    if (!b) continue;
    const cleanB = sanitizePdfText(String(b).trim().replace(/^[•\-\s]+/, ''));
    const key = cleanB.toLowerCase().replace(/[^a-z0-9áéíóúãõç]/gi, '');
    if (cleanB && key && !seen.has(key)) {
      seen.add(key);
      result.push(cleanB);
    }
  }
  return result;
}

/**
 * Detects whether a job title, requirements, and description are in English or Portuguese
 */
export function detectJobLanguage(job) {
  if (!job) return 'pt';
  const text = `${job.title || ''} ${(job.requirements || []).join(' ')} ${(job.description || '').slice(0, 1500)}`.toLowerCase();

  const englishSignals = [
    /\b(we are looking for|responsibilities|requirements|qualifications|about the role|about us|you will|must have|nice to have|key responsibilities|what you'll do|what you need|bachelor'?s|degree|years of experience|full-time|part-time|remote|salary range|equal opportunity|fast-paced|hands-on|team player|benefits|overview)\b/i,
    /\b(software engineer|frontend engineer|backend engineer|cloud engineer|developer|internship|tech lead|engineering manager)\b/i,
    /\b(with|and|the|for|our|your|you|this|that|from|have|will|proven|ability to|experience in|proficient in|familiarity with|strong understanding of)\b/gi
  ];

  const portugueseSignals = [
    /\b(requisitos|responsabilidades|estamos buscando|atividades|sobre a vaga|diferencial|benef[íi]cios|contrata[çc][aã]o|faixa salarial|ensino superior|conhecimento em|experi[êe]ncia em|atuar com|desenvolver|possuir|desej[áa]vel|regime clt|pj)\b/i,
    /\b(para|com|como|nossa|nosso|vaga|trabalho|empresa|equipe|conhecimentos|habilidades|experi[êe]ncia)\b/gi
  ];

  let enScore = 0;
  let ptScore = 0;

  if (englishSignals[0].test(text)) enScore += 10;
  if (portugueseSignals[0].test(text)) ptScore += 10;

  const enMatches = text.match(englishSignals[2]) || [];
  const ptMatches = text.match(portugueseSignals[1]) || [];

  enScore += Math.min(enMatches.length, 25);
  ptScore += Math.min(ptMatches.length, 25);

  return (enScore > ptScore && enScore >= 8) ? 'en' : 'pt';
}

export function calculateMatch(userProfile, job) {
  if (!userProfile || !job) return { score: 0, matchedSkills: [], missingSkills: [], strengths: [] };

  // Se a vaga for identificada como não-tecnologia / fora de Tech & Dev, pontuação baixa
  if (!isTechDevJob(job)) {
    return {
      score: 20,
      matchedSkills: [],
      missingSkills: job.requirements || [],
      strengths: ["Vaga fora do segmento de Tecnologia e Desenvolvimento."],
      recommendation: "Não recomendada: cargo fora da área de Desenvolvimento/TI.",
      culturalFitScore: 20,
      atsKeywordsCount: 0
    };
  }

  const cacheKey = `${job.id}_${userProfile.targetRole || ''}_${(userProfile.skills || []).length}_${userProfile.seniority || ''}_${userProfile.workPreference || ''}`;
  if (matchCache.has(cacheKey)) {
    return matchCache.get(cacheKey);
  }

  const userSkillsNorm = (userProfile.skills || []).map(s => s.toLowerCase().trim());
  const allJobTech = (job.requirements && job.requirements.length > 0)
    ? job.requirements
    : extractTechTags(`${job.title || ''} ${(job.description || '').slice(0, 1000)}`);
  const jobReqsNorm = allJobTech.map(r => r.toLowerCase().trim());

  // 1. Skill Match
  const matchedSkills = [];
  const missingSkills = [];

  allJobTech.forEach(req => {
    const reqLower = req.toLowerCase().trim();
    const isMatched = userSkillsNorm.some(skill =>
      skill === reqLower ||
      skill.includes(reqLower) ||
      reqLower.includes(skill)
    );
    if (isMatched) {
      matchedSkills.push(req);
    } else {
      missingSkills.push(req);
    }
  });

  let skillRatio = 0;
  if (jobReqsNorm.length > 0) {
    skillRatio = matchedSkills.length / jobReqsNorm.length;
  } else {
    // Se a vaga não possui requisitos técnicos catalogados, verificar termos do perfil citados no corpo
    const descLower = `${job.title || ''} ${job.description || ''}`.toLowerCase();
    const foundInDesc = userSkillsNorm.filter(skill => descLower.includes(skill));
    if (foundInDesc.length > 0) {
      skillRatio = Math.min(foundInDesc.length / 4, 0.45);
      matchedSkills.push(...foundInDesc.slice(0, 3));
    } else {
      skillRatio = 0.1;
    }
  }

  // 2. Role Title Match
  const targetRoleLower = (userProfile.targetRole || '').toLowerCase();
  const jobTitleLower = (job.title || '').toLowerCase();
  let roleMatchBonus = 0;

  const targetWords = targetRoleLower.split(/\s+/).filter(w => w.length > 2);
  const titleWords = jobTitleLower.split(/\s+/).filter(w => w.length > 2);

  const commonRoleWords = targetWords.filter(w => titleWords.some(tw => tw.includes(w) || w.includes(tw)));
  if (commonRoleWords.length >= 2) roleMatchBonus = 20;
  else if (commonRoleWords.length === 1) roleMatchBonus = 10;

  // 3. Seniority Alignment
  let seniorityBonus = 10;
  const seniorities = Array.isArray(userProfile.seniorities)
    ? userProfile.seniorities
    : (userProfile.seniority ? [userProfile.seniority] : ["Júnior", "Pleno", "Sênior", "Especialista"]);

  if (job.level) {
    const jobLvl = job.level.toLowerCase();
    const isSeniorityMatch = seniorities.some(s => {
      const targetLvl = s.toLowerCase();
      return jobLvl.includes(targetLvl) || targetLvl.includes(jobLvl) ||
        (targetLvl.includes('júnior') && jobLvl.includes('junior')) ||
        (targetLvl.includes('junior') && jobLvl.includes('júnior'));
    });
    if (isSeniorityMatch) {
      seniorityBonus = 15;
    }
  }

  // 4. Work Type Alignment
  let workTypeBonus = 5;
  const workPrefs = Array.isArray(userProfile.workPreferences)
    ? userProfile.workPreferences
    : (userProfile.workPreference ? [userProfile.workPreference] : ["Remoto", "Híbrido", "Presencial"]);

  if (job.workType) {
    const isWorkTypeMatch = workPrefs.some(pref => {
      const p = pref.toLowerCase();
      const jw = job.workType.toLowerCase();
      return p.includes(jw) || jw.includes(p) || p.includes('qualquer') || p.includes('indiferente');
    });
    if (isWorkTypeMatch || job.workType === 'Remoto') {
      workTypeBonus = 10;
    }
  }

  // Calculate final score
  let baseScore = Math.round((skillRatio * 60) + roleMatchBonus + seniorityBonus + workTypeBonus);
  const score = Math.min(Math.max(baseScore, 30), 98); // keep within 30% - 98% realistic range

  // Dynamic Strengths
  const strengths = [];
  if (matchedSkills.length > 0) {
    strengths.push(`Domínio das tecnologias principais: ${matchedSkills.slice(0, 3).join(', ')}.`);
  }
  if (commonRoleWords.length > 0) {
    strengths.push(`Cargo alvo "${userProfile.targetRole}" possui alto alinhamento com a vaga.`);
  }
  if (job.workType === 'Remoto') {
    strengths.push(`Formato de trabalho Remoto atende às preferências do perfil.`);
  }
  if ((job.postedHoursAgo || 0) <= 24) {
    strengths.push(`Publicada há apenas ${job.postedHoursAgo} horas - Alta chance de resposta rápida.`);
  } else {
    strengths.push(`Vaga publicada há ${Math.floor(job.postedHoursAgo / 24)} dia(s) - Ainda vale a pena aplicar.`);
  }

  // Recommendations
  let recommendation = "";
  if (score >= 85) {
    recommendation = "Match Excepcional! Recomendamos fortemente aplicar imediatamente com o currículo sob medida em PDF.";
  } else if (score >= 70) {
    recommendation = "Alto Match. Ajuste seu resumo para incluir as habilidades solicitadas antes de enviar.";
  } else {
    recommendation = "Match Moderado. Destaque experiências correlatas ou conhecimentos conceituais no currículo.";
  }

  const result = {
    score,
    matchedSkills,
    missingSkills,
    strengths,
    recommendation,
    culturalFitScore: Math.min(score + 3, 99),
    atsKeywordsCount: matchedSkills.length
  };

  matchCache.set(cacheKey, result);
  return result;
}

export function generateTailoredResume(userProfile, job, tone = 'balanced', targetLanguage = 'auto') {
  const isEnglish = targetLanguage === 'en' || (targetLanguage === 'auto' && detectJobLanguage(job) === 'en');
  const matchResult = calculateMatch(userProfile, job);

  // Extract candidate profile details
  const userSkills = userProfile.skills || [];
  const firstEdu = userProfile.education && userProfile.education.length > 0 ? userProfile.education[0] : null;
  const eduDegree = firstEdu ? firstEdu.degree : (isEnglish ? "Computer Science / Software Engineering" : "Análise e Desenvolvimento de Sistemas");
  const eduInst = firstEdu ? firstEdu.institution : "SENAC";

  // Job metadata (sanitized and cleaned of slogans like #SANGUELARANJA and emojis)
  const cleanCompany = cleanCompanyName(job.company);
  const companyName = cleanCompany || (isEnglish ? "the company" : "a organização");
  const cleanRole = cleanResumeTitle(job.title);
  const roleName = cleanRole || (isEnglish ? "Full Stack Software Engineer" : "Desenvolvedor Full Stack");
  const workType = job.workType || (isEnglish ? "Remote" : "Remoto");

  // Deep extraction from Job Description and Requirements
  const rawJobDesc = job.description || "";
  const jobFullText = `${job.title || ''} ${(job.requirements || []).join(' ')} ${rawJobDesc}`;
  const extractedJobKeywords = extractTechTags(jobFullText);

  // ATS keywords deduction
  const atsKeywords = [...new Set([...(job.requirements || []), ...extractedJobKeywords, ...(matchResult.matchedSkills || [])])];
  const topAtsStr = atsKeywords.slice(0, 10).join(', ');

  // Semantic domain detection from real job description
  const textLower = jobFullText.toLowerCase();
  const hasCloud = /aws|gcp|azure|nuvem|cloud|ec2|s3|lambda|eks|api gateway/i.test(textLower);
  const hasArchitecture = /arquitetur|escalabil|microsservi|microservice|trade-off|observabil|seguran[çc]a|alta disponibilidade|architecture|scalability/i.test(textLower);
  const hasAgile = /scrum|kanban|[aá]gil|sprint|backlog|agile/i.test(textLower);
  const hasQuality = /clean code|code review|revis[aã]o de c[oó]digo|boas pr[aá]ticas|qualidade|ci\/cd|devops|quality|best practices/i.test(textLower);
  const isFullStack = /full.?stack/i.test(roleName.toLowerCase()) || (/front/i.test(textLower) && /back/i.test(textLower));
  const isFrontend = /front/i.test(roleName.toLowerCase());
  const isBackend = /back/i.test(roleName.toLowerCase());
  const isAutomation = /automa[çc]|n8n|typebot|rpa|scraping|automation/i.test(textLower);

  // 1. Resumo Profissional Conciso (Inglês ou Português)
  let p1 = "";
  let p2 = "";

  if (isEnglish) {
    if (isFullStack) {
      p1 = `Full Stack Software Engineer with a solid background in ${eduDegree}${eduInst ? ` from ${eduInst}` : ''}, specializing in high-performance web applications, scalable architectures, and modern API integrations. Hands-on experience across React, Next.js, Node.js, and relational SQL database modeling.`;
      p2 = `Proven capability in developing RESTful services, automating business processes with Python, and implementing Git version control${hasQuality ? ' alongside clean code best practices' : ''}. Prepared to drive technical excellence as a ${roleName} (${workType}) at ${companyName}.`;
    } else if (isAutomation) {
      p1 = `Software Engineer with an academic foundation in ${eduDegree}${eduInst ? ` from ${eduInst}` : ''}, focused on systems integration, operational workflow automation, and Python/Node.js scripting.`;
      p2 = `Practical experience connecting RESTful APIs, building modular web applications in React/Next.js, and optimizing SQL queries. Aligned with the goals of ${roleName} (${workType}) at ${companyName}.`;
    } else if (isFrontend) {
      p1 = `Frontend Engineer with an academic background in ${eduDegree}${eduInst ? ` from ${eduInst}` : ''}, dedicated to delivering responsive, modern, and accessible user interfaces utilizing React, Next.js, TypeScript, and modern JavaScript.`;
      p2 = `Continuous practice consuming RESTful APIs, building reusable component architectures, and delivering clean, maintainable code${hasQuality ? ' with high delivery quality' : ''}. Eager to contribute as a ${roleName} (${workType}) at ${companyName}.`;
    } else if (isBackend) {
      p1 = `Backend Engineer with a background in ${eduDegree}${eduInst ? ` from ${eduInst}` : ''}, specializing in designing robust RESTful services, Node.js and Python microservices, and relational database schema design in SQL.`;
      p2 = `Skilled in service integrations, workflow optimization, and implementing scalable engineering standards${hasQuality ? ' with automated testing' : ''}. Prepared to excel as a ${roleName} (${workType}) at ${companyName}.`;
    } else {
      p1 = `Software Engineer with a background in ${eduDegree}${eduInst ? ` from ${eduInst}` : ''}, experienced in delivering modern web software by bridging React/Next.js frontends with scalable Node.js and Python backend services.`;
      p2 = `Practical expertise integrating REST APIs, relational database management, and agile software development. Ready to deliver results as a ${roleName} (${workType}) at ${companyName}.`;
    }
  } else {
    if (isFullStack) {
      p1 = `Desenvolvedor Full Stack com sólida base em ${eduDegree}${eduInst ? ` pelo ${eduInst}` : ''}, atuando na construção de aplicações web modernas de alto desempenho, arquiteturas modulares e integração de serviços. Foco consistente em componentização com React, Next.js, Node.js e modelagem relacional de dados em SQL.`;
      p2 = `Experiência prática na estruturação de APIs RESTful, automação de fluxos operacionais com Python, n8n e Typebot, além de versionamento via Git${hasQuality ? ' e aplicação de boas práticas de código limpo' : ''}. Alinhado aos desafios de ${roleName} (${workType}) na ${companyName}.`;
    } else if (isAutomation) {
      p1 = `Desenvolvedor de Software com formação em ${eduDegree}${eduInst ? ` pelo ${eduInst}` : ''}, especializado em integração de sistemas, automação de fluxos operacionais com n8n, Typebot e rotinas em Python/Node.js.`;
      p2 = `Experiência na conexão de APIs RESTful, estruturação de painéis em React/Next.js e consultas em bancos SQL, reduzindo tarefas manuais com foco em confiabilidade. Pronto para agregar como ${roleName} (${workType}) na ${companyName}.`;
    } else if (isFrontend) {
      p1 = `Desenvolvedor Frontend com formação em ${eduDegree}${eduInst ? ` pelo ${eduInst}` : ''}, focado na construção de interfaces web modernas, responsivas e de alta usabilidade utilizando o ecossistema React, Next.js, TypeScript e JavaScript.`;
      p2 = `Prática contínua no consumo de APIs RESTful, componentização reutilizável, controle de versão com Git e código limpo${hasQuality ? ' com foco em qualidade de entrega' : ''}. Motivado para contribuir como ${roleName} (${workType}) na ${companyName}.`;
    } else if (isBackend) {
      p1 = `Desenvolvedor Backend com formação em ${eduDegree}${eduInst ? ` pelo ${eduInst}` : ''}, atuando na arquitetura de APIs RESTful, rotinas em Node.js e Python, além de modelagem e estruturação de bancos de dados relacionais em SQL.`;
      p2 = `Experiência em integrações de serviços, automação de processos operacionais e aplicação criteriosa de padrões de código limpo${hasQuality ? ' e testes' : ''}. Alinhado às demandas de ${roleName} (${workType}) na ${companyName}.`;
    } else {
      p1 = `Desenvolvedor de Software com formação em ${eduDegree}${eduInst ? ` pelo ${eduInst}` : ''}, atuando na evolução de aplicações web modernas e unindo frontend em React/Next.js com backend em Node.js e Python.`;
      p2 = `Vivência prática na integração de APIs RESTful, automação de processos com n8n/Typebot e modelagem em SQL, com forte compromisso com código limpo e entregas ágeis para a vaga de ${roleName} (${workType}) na ${companyName}.`;
    }
  }

  // Enrich summary with career context highlights if present
  let contextHighlightSentence = "";
  if (userProfile.careerContext && userProfile.careerContext.trim().length > 20) {
    const rawCtx = userProfile.careerContext.trim();
    if (isEnglish) {
      if (/n8n|typebot|automa/i.test(rawCtx)) {
        contextHighlightSentence = " Proven trajectory strengthened by hands-on engineering in API workflow automation, system integrations, and script development.";
      } else if (/react|next|front/i.test(rawCtx)) {
        contextHighlightSentence = " Practical background reinforced by modular web engineering, modern component architecture, and responsive user interfaces.";
      } else {
        contextHighlightSentence = " Trajectory supported by practical software engineering projects, modern tooling, and continuous application of clean architecture.";
      }
    } else {
      if (/n8n|typebot|automa/i.test(rawCtx)) {
        contextHighlightSentence = " Trajetória complementada por projetos práticos em automação de rotinas operacionais, integração de APIs e otimização de fluxos de dados com n8n e scripts.";
      } else if (/react|next|front/i.test(rawCtx)) {
        contextHighlightSentence = " Trajetória enriquecida por projetos práticos em desenvolvimento web moderno, componentização modular em React/Next.js e consumo de serviços RESTful.";
      } else {
        contextHighlightSentence = " Bagagem técnica consolidada por projetos práticos, aplicação de Clean Code e evolução contínua em arquitetura de software.";
      }
    }
  }

  if (contextHighlightSentence) {
    p2 = `${p2}${contextHighlightSentence}`;
  }

  const rawTailoredSummary = `${p1}\n\n${p2}`;
  const tailoredSummary = sanitizePdfText(rawTailoredSummary);

  // 2. Intelligent Dynamic Semantic Adaptation for Experience Bullets (Rich STAR Format)
  const tailoredExperiences = (userProfile.experiences || []).map((exp) => {
    let rawDesc = exp.description || "";

    let originalBullets = rawDesc
      .split(/(?:^|\n|-|\u2022)\s*/)
      .map(b => b.trim())
      .filter(b => b.length > 3);

    if (originalBullets.length === 0 && rawDesc.trim()) {
      originalBullets = [rawDesc.trim()];
    }

    const usedArchetypes = new Set();

    const smartBullets = originalBullets.map(bullet => {
      let bTrim = bullet.trim().replace(/^[•\-\s]+/, '');
      let bLower = bTrim.toLowerCase();

      if (isEnglish) {
        if (!usedArchetypes.has('automation') && (bLower.includes('n8n') || bLower.includes('typebot') || bLower.includes('automaç') || bLower.includes('api') || bLower.includes('automation'))) {
          usedArchetypes.add('automation');
          return `Architected, developed, and maintained RESTful API integrations and automated workflow pipelines using Python, Node.js, and modern automation tools, significantly reducing manual effort and ensuring reliable data delivery.`;
        }
        if (!usedArchetypes.has('web_frontend') && (bLower.includes('painel') || bLower.includes('administrativo') || bLower.includes('aplicaç') || bLower.includes('next') || bLower.includes('react') || bLower.includes('dashboard'))) {
          usedArchetypes.add('web_frontend');
          return `Engineered and deployed modular, responsive web applications and dashboards using React, Next.js, and TypeScript, delivering real-time centralized data management, component scalability, and clean code best practices.`;
        }
        if (!usedArchetypes.has('database') && (bLower.includes('sql') || bLower.includes('banco') || bLower.includes('dados') || bLower.includes('consultas') || bLower.includes('database'))) {
          usedArchetypes.add('database');
          return `Structured and optimized relational SQL database queries and schemas, guaranteeing transactional integrity, data consistency, and reliable analytical reporting with strong query performance.`;
        }
        if (!usedArchetypes.has('support') && (bLower.includes('suporte') || bLower.includes('atendimento') || bLower.includes('rotinas') || bLower.includes('chamados') || bLower.includes('support'))) {
          usedArchetypes.add('support');
          return `Delivered technical support and diagnostic troubleshooting for enterprise IT platforms and operating systems, authoring documentation and accelerating incident resolution across engineering teams.`;
        }
        let transformed = bTrim;
        if (/^developed\b/i.test(transformed)) transformed = transformed.replace(/^developed\s+/i, 'Development and maintenance of ');
        else if (/^created\b/i.test(transformed)) transformed = transformed.replace(/^created\s+/i, 'Creation and architecture of ');
        else if (/^built\b/i.test(transformed)) transformed = transformed.replace(/^built\s+/i, 'Engineering and deployment of ');
        transformed = transformed.charAt(0).toUpperCase() + transformed.slice(1);
        if (!/[.!]$/.test(transformed)) transformed += '.';
        return transformed;
      }

      // Check user tasks and rewrite into rich STAR bullet points (Portuguese)
      if (!usedArchetypes.has('automation') && (bLower.includes('n8n') || bLower.includes('typebot') || bLower.includes('automaç') || bLower.includes('api'))) {
        usedArchetypes.add('automation');
        return `Arquitetura, desenvolvimento e sustentação de integrações de APIs RESTful e pipelines de automação de fluxos operacionais com n8n, Typebot e scripts em Python/Node.js, reduzindo o tempo de execução de rotinas manuais e garantindo estabilidade no tráfego de dados.`;
      }
      if (!usedArchetypes.has('web_frontend') && (bLower.includes('painel') || bLower.includes('administrativo') || bLower.includes('aplicaç') || bLower.includes('next') || bLower.includes('react'))) {
        usedArchetypes.add('web_frontend');
        return `Construção e implementação de aplicações web responsivas e painéis administrativos modulares com React, Next.js e TypeScript, garantindo gestão centralizada de dados em tempo real, componentização escalável e alta aderência às boas práticas de engenharia.`;
      }
      if (!usedArchetypes.has('database') && (bLower.includes('sql') || bLower.includes('banco') || bLower.includes('dados') || bLower.includes('consultas'))) {
        usedArchetypes.add('database');
        return `Modelagem, estruturação e otimização de consultas em bancos de dados relacionais (SQL), assegurando integridade transacional, consistência das tabelas e fornecendo suporte analítico confiável com foco em performance e observabilidade.`;
      }
      if (!usedArchetypes.has('support') && (bLower.includes('suporte') || bLower.includes('atendimento') || bLower.includes('rotinas') || bLower.includes('chamados'))) {
        usedArchetypes.add('support');
        return `Suporte técnico a sistemas operacionais e plataformas corporativas de TI, com atuação ágil no diagnóstico de incidentes, sustentação de rotinas internas e elaboração de documentação técnica para suporte aos times de engenharia.`;
      }

      // Default active STAR transformation from the candidate's actual text
      let transformed = bTrim;
      if (/^desenvolvi\b/i.test(transformed)) {
        transformed = transformed.replace(/^desenvolvi\s+/i, 'Desenvolvimento e sustentação de ');
      } else if (/^criei\b/i.test(transformed)) {
        transformed = transformed.replace(/^criei\s+/i, 'Criação, arquitetura e implementação de ');
      } else if (/^fiz\b/i.test(transformed)) {
        transformed = transformed.replace(/^fiz\s+/i, 'Execução e estruturação de ');
      } else if (/^utilizei\b/i.test(transformed)) {
        transformed = transformed.replace(/^utilizei\s+/i, 'Aplicação estratégica de ');
      } else if (/^trabalhei\s+com\b/i.test(transformed)) {
        transformed = transformed.replace(/^trabalhei\s+com\s+/i, 'Atuação direta no desenvolvimento e manutenção com ');
      } else if (/^ajudei\s+a\b/i.test(transformed)) {
        transformed = transformed.replace(/^ajudei\s+a\s+/i, 'Colaboração técnica na melhoria e entrega de ');
      } else if (/^gerenciava\b|^gerenciei\b/i.test(transformed)) {
        transformed = transformed.replace(/^(?:gerenciava|gerenciei)\s+/i, 'Gerenciamento operacional e técnico de ');
      } else if (/^fazia\b/i.test(transformed)) {
        transformed = transformed.replace(/^fazia\s+/i, 'Realização e aprimoramento contínuo de ');
      }

      transformed = transformed.charAt(0).toUpperCase() + transformed.slice(1);
      if (!/[.!]$/.test(transformed)) transformed += '.';
      return transformed;
    });

    // Deduplica bullets preservando ordem
    const finalBullets = deduplicateBullets(smartBullets);
    const seenBullets = new Set(finalBullets.map(b => b.toLowerCase().replace(/[^a-z0-9áéíóúãõç]/gi, '')));

    const addComplementaryBullet = (bulletText) => {
      const cleanB = sanitizePdfText(bulletText.trim());
      const key = cleanB.toLowerCase().replace(/[^a-z0-9áéíóúãõç]/gi, '');
      if (cleanB && key && !seenBullets.has(key)) {
        seenBullets.add(key);
        finalBullets.push(cleanB);
      }
    };

    // Enriquecimento dinâmico caso haja poucos tópicos originais (mínimo de 3 a 4 bullets densos)
    const combinedContextText = `${exp.role || ''} ${exp.company || ''} ${rawDesc} ${(userProfile.skills || []).join(' ')} ${userProfile.careerContext || ''}`.toLowerCase();

    const hasFrontendMention = finalBullets.some(b => /react|next|front|interface|ui|component/i.test(b));
    const hasApiMention = finalBullets.some(b => /api|rest|endpoint|integra[çc]|backend|servi[çc]/i.test(b));
    const hasDatabaseMention = finalBullets.some(b => /sql|banco|dados|query|database|postgre|mysql/i.test(b));
    const hasAutomationMention = finalBullets.some(b => /automa[çc]|n8n|typebot|script|pipeline|fluxo/i.test(b));
    const hasQualityMention = finalBullets.some(b => /clean code|git|qualidade|revis[aã]o|boas pr[aá]ticas|padr[oõ]es/i.test(b));

    if (finalBullets.length < 3) {
      if (isEnglish) {
        if (!hasApiMention && (/api|node|python|back|desenvolv|software|full/i.test(combinedContextText) || isBackend || isFullStack)) {
          addComplementaryBullet("Structured, developed, and consumed RESTful APIs with strict data validation, exception handling, and robust endpoint communication.");
        }
        if (!hasFrontendMention && (/react|next|front|interface|web|full/i.test(combinedContextText) || isFrontend || isFullStack)) {
          addComplementaryBullet("Engineered responsive, reusable component architectures and modern web interfaces using React, Next.js, and TypeScript, maximizing usability.");
        }
        if (!hasDatabaseMention && (/sql|banco|dados|database|postgres|mysql/i.test(combinedContextText))) {
          addComplementaryBullet("Designed and optimized relational SQL database queries and schemas, preserving referential integrity and performance under load.");
        }
        if (!hasAutomationMention && (/automa|n8n|typebot|script/i.test(combinedContextText) || isAutomation)) {
          addComplementaryBullet("Automated routine operational workflows utilizing modern scripting and integration pipelines to reduce manual repetitive effort.");
        }
        if (!hasQualityMention && finalBullets.length < 3) {
          addComplementaryBullet("Applied software engineering best practices including Clean Code principles, Git Flow version control with code reviews, and structured documentation.");
        }
      } else {
        if (!hasApiMention && (/api|node|python|back|desenvolv|software|full/i.test(combinedContextText) || isBackend || isFullStack)) {
          addComplementaryBullet("Estruturação, desenvolvimento e consumo de APIs RESTful com validação criteriosa de dados, tratamento de exceções e foco na estabilidade entre serviços.");
        }
        if (!hasFrontendMention && (/react|next|front|interface|web|full/i.test(combinedContextText) || isFrontend || isFullStack)) {
          addComplementaryBullet("Construção de componentes modulares, responsivos e reutilizáveis em React / Next.js com TypeScript, elevando os padrões de usabilidade e interface.");
        }
        if (!hasDatabaseMention && (/sql|banco|dados|database|postgres|mysql/i.test(combinedContextText))) {
          addComplementaryBullet("Modelagem e otimização de consultas em bancos de dados relacionais (SQL), garantindo integridade transacional e eficiência em queries analíticas.");
        }
        if (!hasAutomationMention && (/automa|n8n|typebot|script/i.test(combinedContextText) || isAutomation)) {
          addComplementaryBullet("Desenvolvimento de fluxos automatizados de processos operacionais com n8n, Typebot e scripts, eliminando etapas manuais e otimizando o fluxo de dados.");
        }
        if (!hasQualityMention && finalBullets.length < 3) {
          addComplementaryBullet("Aplicação contínua de boas práticas de engenharia de software (Clean Code, versionamento estruturado com Git / GitHub e documentação técnica).");
        }
      }
    }

    let cleanPeriod = sanitizePdfText((exp.period || "").replace(/^\((.*)\)$/, "$1"));
    let expCleanCompany = cleanCompanyName(exp.company) || exp.company;

    return {
      ...exp,
      company: expCleanCompany,
      period: cleanPeriod,
      bullets: finalBullets,
      description: finalBullets.map(b => `• ${b}`).join('\n')
    };
  });

  // Deduplicate and prioritize skills
  const rawSkills = [...(matchResult.matchedSkills || []), ...(userProfile.skills || []), ...extractedJobKeywords];
  const uniqueSkillsMap = new Map();
  rawSkills.forEach(s => {
    if (s && s.trim()) {
      const key = s.trim().toLowerCase();
      if (!uniqueSkillsMap.has(key)) {
        uniqueSkillsMap.set(key, s.trim());
      }
    }
  });

  const cleanedSkills = Array.from(uniqueSkillsMap.values());

  return {
    targetJobTitle: cleanRole || job.title,
    targetCompany: cleanCompany || job.company,
    language: isEnglish ? 'en' : 'pt',
    fullName: sanitizePdfText(userProfile.fullName || "Lucas Silva Pessoa"),
    email: sanitizePdfText(userProfile.email || ""),
    phone: sanitizePdfText(userProfile.phone || ""),
    linkedin: sanitizePdfText(userProfile.linkedin || ""),
    github: sanitizePdfText(userProfile.github || ""),
    location: sanitizePdfText(userProfile.location || ""),
    tailoredSummary,
    skills: cleanedSkills.map(sanitizePdfText),
    experiences: tailoredExperiences,
    education: userProfile.education || [],
    languages: (userProfile.languages && userProfile.languages.length > 0)
      ? userProfile.languages.map(l => {
        if (typeof l === 'string') {
          const match = l.match(/^(.*?)\s*\((.*?)\)$/);
          return match ? { name: sanitizePdfText(match[1].trim()), level: sanitizePdfText(match[2].trim()) } : { name: sanitizePdfText(l.trim()), level: 'Intermediário (B2)' };
        }
        return { name: sanitizePdfText(l.name || ''), level: sanitizePdfText(l.level || 'Intermediário (B2)') };
      })
      : [{ name: 'Português', level: 'Nativo' }, { name: 'Inglês', level: 'Intermediário (B2)' }],
    atsKeywords,
    matchScore: matchResult.score,
    isRealAI: false,
    crossMatchHighlights: isEnglish ? [
      `Target role analyzed: ${roleName} at ${companyName}.`,
      `${atsKeywords.length} core technical requirements mapped to your candidate profile.`,
      `Resume tailored with STAR methodology and high-impact terminology for global ATS filters.`
    ] : [
      `Vaga analisada: ${roleName} na empresa ${companyName}.`,
      `${atsKeywords.length} competências e palavras-chave ATS mapeadas entre a vaga e seu perfil.`,
      `Resumo profissional estruturado com terminologia técnica de alto impacto para recrutadores e ATS.`
    ]
  };
}

/**
 * Descobre dinamicamente os modelos de TEXTO habilitados para a chave do usuário via ModelService.ListModels
 */
export async function getAvailableGeminiModels(apiKey = '') {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) return [];

  const endpoints = ['v1beta', 'v1'];
  for (const apiVer of endpoints) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/${apiVer}/models?key=${cleanKey}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models)) {
          // Filtrar ESTRITAMENTE modelos oficiais da família Gemini (rejeitar gemma, bison, TTS, áudio, embeddings, imagem e -exp)
          const textModels = data.models
            .filter(m => {
              if (!Array.isArray(m.supportedGenerationMethods) || !m.supportedGenerationMethods.includes('generateContent')) {
                return false;
              }
              const name = m.name.toLowerCase();
              if (
                !name.includes('gemini') ||
                name.includes('gemma') ||
                name.includes('bison') ||
                name.includes('tts') ||
                name.includes('audio') ||
                name.includes('embed') ||
                name.includes('imagen') ||
                name.includes('aqa') ||
                name.includes('-exp')
              ) {
                return false;
              }
              return true;
            })
            .map(m => m.name.replace(/^models\//, ''));

          if (textModels.length > 0) {
            // Priorizar os modelos estáveis mais modernos e rápidos para texto
            const sorted = [
              textModels.find(m => m === 'gemini-3.8-flash'),
              textModels.find(m => m === 'gemini-flash-lite-latest'),
              textModels.find(m => m === 'gemini-flash-latest'),
              textModels.find(m => m.includes('3.8-flash')),
              textModels.find(m => m === 'gemini-2.0-flash'),
              textModels.find(m => m === 'gemini-1.5-flash-8b'),
              textModels.find(m => m === 'gemini-1.5-flash'),
              ...textModels.filter(m => m.startsWith('gemini') && m !== 'gemini-2.5-flash')
            ].filter(Boolean);

            return Array.from(new Set(sorted));
          }
        }
      }
    } catch (e) {
      console.warn(`Erro ao consultar modelos em ${apiVer}:`, e);
    }
  }
  return [];
}

/**
 * Testa a conexão real com a API do Google Gemini e mede a latência
 */
export async function testGeminiConnection(apiKey = '') {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    return {
      success: false,
      message: 'Nenhuma chave informada. Cole sua chave do Google Gemini no campo abaixo.'
    };
  }

  const startTime = Date.now();

  // 1. Prioriza modelo já confirmado como funcional e os modelos Flash mais rápidos da Google
  let cachedModel = null;
  try {
    const raw = localStorage.getItem('working_gemini_model') || sessionStorage.getItem('working_gemini_model');
    if (raw && raw.startsWith('gemini') && !raw.includes('gemma') && !raw.includes('-exp') && raw !== 'gemini-2.5-flash') {
      cachedModel = raw;
    }
  } catch (_) { }

  // Modelos oficiais do Google Gemini
  const candidates = [
    cachedModel,
    'gemini-3.8-flash',
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
    'gemini-2.0-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-flash'
  ].filter(m => m && m !== 'gemini-2.5-flash');

  const modelsToTry = Array.from(new Set(candidates));
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Responda estritamente apenas a palavra: OK' }] }]
        })
      });

      if (res.status === 429) {
        return {
          success: false,
          message: 'Limite temporário por minuto atingido no Google Gemini (máx. 15 req/min no plano gratuito). Aguarde cerca de 30 a 60 segundos para sua cota ser liberada (sua cota diária de 1.500 ainda está intacta).'
        };
      }

      if (res.ok) {
        const latencyMs = Date.now() - startTime;
        try {
          sessionStorage.setItem('working_gemini_model', model);
          sessionStorage.setItem('working_gemini_apiver', 'v1beta');
          localStorage.setItem('working_gemini_model', model);
          localStorage.setItem('working_gemini_api_ver', 'v1beta');
        } catch (e) { }
        return {
          success: true,
          model,
          apiVer: 'v1beta',
          latencyMs,
          message: `Conectado com sucesso! Google ${model} operacional (${latencyMs}ms).`
        };
      } else {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson.error?.message || `HTTP ${res.status}`;
        lastError = errMsg;

        // Falha imediatamente se a chave for inválida ou não autorizada
        if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid') || res.status === 401 || res.status === 403) {
          return {
            success: false,
            message: `Chave inválida: ${errMsg}. Verifique se copiou a chave completa no Google AI Studio (aistudio.google.com).`
          };
        }

        if (errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
          return {
            success: false,
            message: 'Limite temporário por minuto atingido no Google Gemini (15 req/min). Aguarde 30 a 60 segundos.'
          };
        }
      }
    } catch (e) {
      lastError = e.message;
    }
  }

  // Se nenhum dos modelos oficiais diretos funcionou, tenta listar como último recurso
  try {
    const discovered = await getAvailableGeminiModels(cleanKey);
    for (const model of discovered) {
      if (modelsToTry.includes(model)) continue;
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Responda estritamente apenas a palavra: OK' }] }]
          })
        });
        if (res.ok) {
          const latencyMs = Date.now() - startTime;
          try {
            sessionStorage.setItem('working_gemini_model', model);
            localStorage.setItem('working_gemini_model', model);
          } catch (_) { }
          return {
            success: true,
            model,
            apiVer: 'v1beta',
            latencyMs,
            message: `Conectado com sucesso! Google ${model} operacional (${latencyMs}ms).`
          };
        }
      } catch (_) { }
    }
  } catch (_) { }

  return {
    success: false,
    message: `Falha na conexão: ${lastError || 'Não foi possível contatar o Google Gemini.'}`
  };
}

/**
 * Testa a conexão real com a API da OpenAI (ChatGPT / gpt-4o-mini)
 */
export async function testOpenAIConnection(apiKey = '', model = 'gpt-4o-mini') {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    return {
      success: false,
      message: 'Nenhuma chave informada. Cole sua chave da OpenAI (sk-...) no campo.'
    };
  }

  const startTime = Date.now();
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cleanKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Responda estritamente: OK' }],
        max_tokens: 5
      })
    });

    if (res.ok) {
      const latencyMs = Date.now() - startTime;
      return {
        success: true,
        model: model || 'gpt-4o-mini',
        provider: 'openai',
        latencyMs,
        message: `Conectado com sucesso! OpenAI ${model || 'gpt-4o-mini'} operacional (${latencyMs}ms).`
      };
    } else {
      const errJson = await res.json().catch(() => ({}));
      const errMsg = errJson.error?.message || `HTTP ${res.status}`;
      const errCode = errJson.error?.code || '';

      if (errCode === 'insufficient_quota' || errMsg.includes('exceeded your current quota') || errMsg.includes('billing')) {
        return {
          success: false,
          code: 'insufficient_quota',
          provider: 'openai',
          message: `Sua chave da OpenAI é autêntica, porém sua conta está com saldo $0.00 (sem créditos). A OpenAI exige recarga pré-paga mínima de $5 no Billing da plataforma. Se quiser usar 100% grátis agora, alterne para o Google Gemini!`
        };
      }

      if (res.status === 401 || errCode === 'invalid_api_key' || errMsg.includes('Incorrect API key')) {
        return {
          success: false,
          provider: 'openai',
          message: `Chave da OpenAI inválida ou não encontrada. Verifique se copiou a chave completa (sk-proj-...) gerada no platform.openai.com.`
        };
      }

      return {
        success: false,
        provider: 'openai',
        message: `Erro da OpenAI: ${errMsg}`
      };
    }
  } catch (e) {
    return {
      success: false,
      provider: 'openai',
      message: `Falha na requisição para a OpenAI: ${e.message}`
    };
  }
}

/**
 * Roteador unificado de teste de conexão para qualquer provedor
 */
export async function testAiConnection({ provider = 'gemini', apiKey = '', model = '' } = {}) {
  const cleanKey = (apiKey || '').trim();
  const effectiveProvider = provider === 'openai' || cleanKey.startsWith('sk-') ? 'openai' : 'gemini';

  if (effectiveProvider === 'openai') {
    return testOpenAIConnection(cleanKey, model || 'gpt-4o-mini');
  }
  return testGeminiConnection(cleanKey);
}

/**
 * Gera currículo sob medida utilizando OpenAI (ChatGPT / gpt-4o-mini / gpt-4o)
 */
export async function generateTailoredResumeWithOpenAI(userProfile, job, apiKey = "", tone = 'balanced', model = 'gpt-4o-mini', targetLanguage = 'auto') {
  let cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    try {
      cleanKey = (loadAiSettings()?.apiKey || '').trim();
    } catch (e) { }
  }
  const localBase = generateTailoredResume(userProfile, job, tone, targetLanguage);
  if (!cleanKey) return { ...localBase, isRealAI: false, aiError: 'Chave da OpenAI não configurada.' };

  const prompt = buildResumePrompt(userProfile, job, tone, targetLanguage);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cleanKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: localBase.language === 'en'
              ? 'You are an Elite Tech Recruiter and Senior Staff Software Engineer. Return STRICTLY a valid JSON object adhering to instructions.'
              : 'Você é um Consultor Especialista em Recrutamento Tech (Tech Recruiter). Retorne APENAS um objeto JSON válido estritamente de acordo com as instruções.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2500
      })
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const errMsg = errJson.error?.message || `HTTP ${res.status}`;
      const isQuotaErr = res.status === 429 || errMsg.includes('quota') || errMsg.includes('rate limit');
      return {
        ...localBase,
        isRealAI: false,
        isRateLimited: isQuotaErr,
        aiError: isQuotaErr
          ? 'Limite da OpenAI atingido (429 Rate Limit / Quota). Gerando instantaneamente com o motor ATS local.'
          : `OpenAI: ${errMsg}`
      };
    }

    const data = await res.json();
    let rawContent = (data.choices?.[0]?.message?.content || '{}').trim();
    if (rawContent.startsWith('```json')) {
      rawContent = rawContent.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    } else if (rawContent.startsWith('```')) {
      rawContent = rawContent.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
    }

    let parsed = null;
    try {
      parsed = JSON.parse(rawContent);
    } catch (_) {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    }

    if (!parsed) return { ...localBase, isRealAI: false, aiError: 'Falha ao interpretar resposta da OpenAI.' };

    // Registra métricas de uso
    recordAiRequest('openai', data.usage?.total_tokens || 1100);

    let cleanSummary = (parsed.tailoredSummary || localBase.tailoredSummary || '').trim();
    cleanSummary = cleanSummary.replace(/^binho\b\s*/i, 'Alinhado a ');
    cleanSummary = cleanSummary.replace(/\bbinho\b/gi, 'alinhado');
    cleanSummary = sanitizePdfText(cleanSummary);

    return {
      ...localBase,
      language: localBase.language,
      tailoredSummary: cleanSummary,
      experiences: (userProfile.experiences || []).map((exp, idx) => {
        const llmExp = parsed.experiences?.find(e => e.id === exp.id) || parsed.experiences?.[idx];
        const rawBullets = (llmExp && Array.isArray(llmExp.bullets) && llmExp.bullets.length > 0)
          ? llmExp.bullets
          : (exp.bullets || [exp.description || '']);
        const bullets = deduplicateBullets(rawBullets);
        return {
          ...exp,
          company: cleanCompanyName(exp.company) || exp.company,
          bullets,
          description: bullets.map(b => `• ${b}`).join('\n')
        };
      }),
      skills: (parsed.prioritizedSkills?.length > 0 ? parsed.prioritizedSkills : localBase.skills).map(sanitizePdfText),
      atsKeywords: (parsed.atsKeywords?.length > 0 ? parsed.atsKeywords : localBase.atsKeywords).map(sanitizePdfText),
      crossMatchHighlights: (parsed.crossMatchHighlights?.length > 0 ? parsed.crossMatchHighlights : localBase.crossMatchHighlights).map(sanitizePdfText),
      isRealAI: true,
      aiModel: `OpenAI ${model || 'gpt-4o-mini'}`
    };
  } catch (e) {
    console.error("Erro na geração com OpenAI:", e);
    return {
      ...localBase,
      isRealAI: false,
      aiError: `OpenAI: ${e.name === 'AbortError' ? 'Tempo limite esgotado (timeout 7.5s). Currículo gerado via motor local.' : e.message}`
    };
  }
}

export function buildResumePrompt(userProfile, job, tone = 'balanced', targetLanguage = 'auto') {
  const isEnglish = targetLanguage === 'en' || (targetLanguage === 'auto' && detectJobLanguage(job) === 'en');
  const cleanCompany = cleanCompanyName(job.company) || (isEnglish ? 'the target company' : 'a empresa');
  const cleanRole = cleanResumeTitle(job.title) || job.title;

  if (isEnglish) {
    return `You are an Elite Tech Recruiter and Senior Staff Software Engineer operating behind the scenes.
Your mission is to connect the candidate's REAL profile data to the target job below, generating a custom-tailored, human, authentic, and 100% ATS-optimized resume (for Greenhouse, Lever, Workday, Taleo).
CRITICAL: The target job description is in English, so YOU MUST PRODUCE THE ENTIRE OUTPUT IN IMPECCABLE PROFESSIONAL ENGLISH.

CORE MANDATORY DIRECTIVES:
1. CONCISE PROFESSIONAL SUMMARY (EXACTLY 1 OR 2 SHORT PARAGRAPHS, MAXIMUM 5 LINES IN TOTAL):
   - Recruiters scan summaries in 5 seconds. Keep it punchy, impactful, and under 5 lines total.
   - Paragraph 1: Professional identity, academic foundation (${userProfile.education?.[0]?.degree || 'Software Engineering / Computer Science'}), and proven technical baseline (React, Next.js, Node.js, Python, SQL, automations), positioned with maturity for the ${cleanRole} role.
   - Paragraph 2: Practical business impact, hands-on delivery (web applications, RESTful APIs, automation workflows, clean code best practices) closely aligned with ${cleanCompany}'s requirements, weaving in core ATS keywords naturally.

2. ZERO TOLERANCE FOR HALLUCINATIONS:
   - NEVER invent certifications, degrees, or tech stacks the candidate does not have.
   - Strictly respect the candidate's real companies, real dates, and real technical skills.

3. REWRITE EXPERIENCE BULLET POINTS USING THE ACTIVE STAR METHOD (Action Verb + Tech + Quantifiable/Practical Result):
   - Keep the candidate's real company names, job titles, and date periods intact.
   - Express each bullet point starting with a strong active verb in English (Engineered, Architected, Automated, Optimized, Developed).
   - STRICT ZERO DUPLICATION: Every bullet point within an experience MUST be completely unique. NEVER output identical or redundant bullets.

4. ATS KEYWORD ENRICHMENT & EXPERIENCE DEPTH (NEVER PRODUCE A SPARSE RESUME):
   - Even if the candidate's original job description was brief, NEVER output only 1 or 2 skinny bullet points!
   - MANDATORY: Expand EACH experience into 3 to 5 dense, high-impact STAR bullet points.
   - Leverage the candidate's "Career Context & Trajectory Window", verified skills, and academic foundation to articulate authentic software engineering responsibilities: RESTful API design/consumption, SQL relational data queries, component modularity, Git Flow version control, Clean Code, exception handling, and automation pipelines.
   - Ground all depth in the candidate's real background without fabricating false employment or degrees.

TARGET JOB DETAILS:
- Title: ${cleanRole}
- Company: ${cleanCompany}
- Work Model: ${job.workType || 'Remote / Hybrid'}
- Requirements: ${JSON.stringify(job.requirements || [])}
- Description: ${job.description || 'Software engineering, system design, and product delivery.'}

CANDIDATE'S REAL PROFILE:
- Name: ${userProfile.fullName || 'Lucas Silva Pessoa'}
- Target Role: ${userProfile.targetRole || cleanRole}
- Bio: ${userProfile.bio || ''}
- Career Context & Trajectory Window: ${userProfile.careerContext?.trim() || 'No extra notes provided. Use candidate real stack and education to extract maximum value.'}
- Verified Skills: ${JSON.stringify(userProfile.skills || [])}
- Education: ${JSON.stringify(userProfile.education || [])}
- Real Experiences: ${JSON.stringify((userProfile.experiences || []).map(e => ({
      id: e.id,
      role: e.role,
      company: cleanCompanyName(e.company) || e.company,
      period: e.period,
      originalDescription: e.description
    })), null, 2)}

Desired Tone: ${tone === 'tech' ? 'Technical deep-dive on stack and architecture' : tone === 'impact' ? 'Business results, delivery speed, and process optimization' : 'Balanced, clean, modern, and natural'}

RETURN STRICTLY A VALID JSON OBJECT, NO MARKDOWN, NO WRAPPING TEXT OUTSIDE THE JSON:
{
  "tailoredSummary": "Professional summary in English in 1 or 2 concise paragraphs (maximum 5 lines).",
  "experiences": [
    {
      "id": "matching id",
      "role": "Role title in English",
      "company": "Company",
      "period": "Period",
      "bullets": [
        "Action Verb + Stack + Real practical result",
        "Second rich and accurate bullet point in English detailing API integration or data handling",
        "Third rich bullet point highlighting SQL query modeling, clean code, or workflow automation",
        "Fourth bullet point focusing on agile delivery, Git Flow, and system reliability"
      ]
    }
  ],
  "atsKeywords": ["keyword1", "keyword2", "keyword3"],
  "prioritizedSkills": ["skill1", "skill2", "skill3"],
  "crossMatchHighlights": ["Key alignment highlight 1 in English", "Key alignment highlight 2 in English"]
}`;
  }

  return `Você é um Consultor Especialista em Recrutamento Tech (Tech Recruiter) e Engenheiro de Software Sênior atuando nos bastidores (por baixo dos panos).
Sua missão é conectar os dados REAIS do perfil do candidato à vaga alvo abaixo, gerando um currículo sob medida, limpo, humano, elegante e 100% otimizado para sistemas ATS (Gupy, Kenoby, Greenhouse, Workday).

DIRETRIZES FUNDAMENTAIS:
1. RESUMO PROFISSIONAL CONCISO (EXATAMENTE 1 OU 2 PARÁGRAFOS CURTOS, MÁXIMO 5 LINHAS NO TOTAL):
   - Redija EXATAMENTE 1 ou 2 parágrafos curtos, elegantes e diretos (máximo 5 linhas no total).
   - Parágrafo 1: Identidade técnica do candidato, sua formação e base comprovada, posicionado com maturidade para a vaga de ${cleanRole}.
   - Parágrafo 2: Entregas práticas e impacto real alinhadas às necessidades da ${cleanCompany}, inserindo as principais palavras-chave da vaga de forma fluida.

2. TOLERÂNCIA ZERO PARA ALUCINAÇÕES:
   - PROIBIDO inventar palavras aleatórias ou termos incompletos (NUNCA escreva 'binho').
   - PROIBIDO inventar certificações, formações ou linguagens que o candidato NÃO possui.
   - Seja 100% fiel e rigoroso com as experiências, tecnologias e formação reais do candidato.

3. REESCREVA OS TÓPICOS DE EXPERIÊNCIA COM MÉTODO STAR (Ação + Tecnologia + Resultado):
   - Mantenha estritamente as empresas, cargos e períodos verdadeiros do candidato.
   - Reescreva os bullet points de forma técnica, objetiva e com verbos de ação ativos demonstrando domínio prático.
   - DUPLICAÇÃO ZERO: Cada bullet point deve ser estritamente único. É TERMINANTEMENTE PROIBIDO gerar tópicos idênticos ou redundantes dentro da mesma experiência.

4. RECHEIO TÉCNICO & PROFUNDIDADE ATS (CURRÍCULO DENSO SEM INVENTAR MENTIRAS):
   - Recrutadores técnicos e robôs ATS descartam currículos vazios ou com apenas 1 ou 2 tópicos magros por empresa.
   - OBRIGATÓRIO: Desdobre CADA experiência em 3 a 5 bullet points robustos, densos e bem construídos usando a metodologia STAR (Situação/Desafio, Ação Técnica com Ferramentas Reais, Resultado e Impacto).
   - Se a descrição original do cargo for curta, EXTRAIA VALOR REAL da "JANELA DE CONTEXTO & TRAJETÓRIA TÉCNICA", das tecnologias declaradas (${JSON.stringify(userProfile.skills || [])}) e da formação acadêmica: detalhe desafios de engenharia, integração e consumo de APIs RESTful, consultas e modelagem relacional em SQL, componentização escalável, controle de versão via Git (branches e pull requests), automações de processos (n8n/Typebot/scripts) e boas práticas de código limpo.
   - NUNCA invente empresas fictícias, diplomas falsos ou stacks não mencionadas. Use a bagagem REAL do candidato para deixá-lo com máximo peso técnico e densidade de palavras-chave ATS legítimas!

DADOS DA VAGA ALVO:
- Cargo: ${cleanRole}
- Empresa: ${cleanCompany}
- Modelo de Trabalho: ${job.workType || 'Híbrido/Remoto'}
- Requisitos da Vaga: ${JSON.stringify(job.requirements || [])}
- Descrição da Vaga: ${job.description || 'Desenvolvimento de software.'}

PERFIL REAL DO CANDIDATO:
- Nome: ${userProfile.fullName || 'Lucas Silva Pessoa'}
- Cargo Alvo: ${userProfile.targetRole || cleanRole}
- Resumo Atual / Bio: ${userProfile.bio || ''}
- Janela de Contexto & Trajetória Técnica (Super-Alimento ATS): ${userProfile.careerContext?.trim() || 'Nenhum contexto extra fornecido. Utilize as experiências reais, formação e skills declaradas para enriquecer o currículo.'}
- Habilidades Reais Declaradas: ${JSON.stringify(userProfile.skills || [])}
- Formação Acadêmica: ${JSON.stringify(userProfile.education || [])}
- Experiências Reais: ${JSON.stringify((userProfile.experiences || []).map(e => ({
    id: e.id,
    role: e.role,
    company: cleanCompanyName(e.company) || e.company,
    period: e.period,
    originalDescription: e.description
  })), null, 2)}

Tom desejado: ${tone === 'tech' ? 'Foco aprofundado em stack e arquitetura' : tone === 'impact' ? 'Foco em resultados e otimização de processos' : 'Equilibrado, conciso e natural'}

Retorne APENAS um objeto JSON válido no seguinte formato:
{
  "tailoredSummary": "Resumo profissional ajeitado em 1 ou 2 parágrafos curtos (máximo 5 linhas).",
  "experiences": [
    {
      "id": "id correspondente",
      "role": "cargo",
      "company": "empresa",
      "period": "período",
      "bullets": [
        "Ação + Tecnologia + Impacto prático",
        "Segundo tópico detalhando integração de APIs REST, consumo de dados ou componentização modular",
        "Terceiro tópico destacando modelagem SQL, automações de fluxos ou código limpo",
        "Quarto tópico focado em colaboração com Git Flow e sustentação contínua de software"
      ]
    }
  ],
  "atsKeywords": ["palavra1", "palavra2"],
  "prioritizedSkills": ["skill1", "skill2"],
  "crossMatchHighlights": ["Destaque 1", "Destaque 2"]
}`;
}

export async function generateTailoredResumeWithLLM(userProfile, job, apiKey = "", tone = 'balanced', provider = 'auto', targetLanguage = 'auto') {
  let cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    try {
      cleanKey = (loadAiSettings()?.apiKey || '').trim();
    } catch (e) { }
  }
  const localBase = generateTailoredResume(userProfile, job, tone, targetLanguage);
  if (!cleanKey) {
    return {
      ...localBase,
      isRealAI: false,
      aiError: 'Chave de API não configurada. Salve sua chave do Google Gemini nas configurações.'
    };
  }

  const effectiveProvider = provider === 'openai' || cleanKey.startsWith('sk-') ? 'openai' : 'gemini';
  if (effectiveProvider === 'openai') {
    return generateTailoredResumeWithOpenAI(userProfile, job, cleanKey, tone, 'gpt-4o-mini', targetLanguage);
  }

  const prompt = buildResumePrompt(userProfile, job, tone, targetLanguage);

  // 1. Prioriza modelo já confirmado como funcional e os modelos Flash mais rápidos da Google (Gemini 3.8 Flash / Flash Lite)
  let cachedModel = null;
  try {
    cachedModel = localStorage.getItem('working_gemini_model') || sessionStorage.getItem('working_gemini_model');
    if (cachedModel && (!cachedModel.startsWith('gemini') || cachedModel.includes('gemma') || cachedModel.includes('-exp') || cachedModel === 'gemini-2.5-flash')) {
      localStorage.removeItem('working_gemini_model');
      sessionStorage.removeItem('working_gemini_model');
      cachedModel = null;
    }
  } catch (e) { }

  let discoveredModels = [];
  try {
    discoveredModels = await getAvailableGeminiModels(cleanKey);
  } catch (_) { }

  const priorityFastModels = [
    cachedModel,
    ...discoveredModels,
    'gemini-3.8-flash',
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
    'gemini-2.0-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-flash'
  ].filter(m => m && m.startsWith('gemini') && !m.includes('gemma') && !m.includes('-exp') && m !== 'gemini-2.5-flash');

  const modelsToTry = Array.from(new Set(priorityFastModels));
  let lastError = null;
  let isQuotaExceeded = false;

  // Tentativa com modelos rápidos, timeout de 20s e endpoint v1beta oficial
  for (const model of modelsToTry) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const generationConfig = {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: "application/json"
      };

      console.log(`[vagasATS AI] Gerando currículo sob medida com ${model}...`);

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig
        })
      });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        isQuotaExceeded = true;
        lastError = 'Limite de requisições temporário do Google Gemini atingido (15 RPM). Aguarde 1 minuto.';
        break;
      }

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          const errMsg = errJson.error?.message || `HTTP ${res.status}`;
          if (errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
            isQuotaExceeded = true;
          }
          throw new Error(errMsg);
        }

        const data = await res.json();
        if (data.promptFeedback?.blockReason) {
          throw new Error(`Google Safety: Bloqueado por ${data.promptFeedback.blockReason}`);
        }

        const candidate = data.candidates?.[0];
        let rawText = candidate?.content?.parts?.[0]?.text || "";
        rawText = rawText.trim();

        if (!rawText) {
          const finishReason = candidate?.finishReason;
          throw new Error(finishReason ? `Google finalizou com motivo: ${finishReason}` : 'Resposta vazia da API do Google');
        }

        // Limpeza de cercas de código markdown ```json ... ``` se o modelo retornar
        const codeBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (codeBlockMatch) {
          rawText = codeBlockMatch[1].trim();
        } else if (rawText.startsWith('```')) {
          rawText = rawText.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
        }

        let parsed = null;
        try {
          parsed = JSON.parse(rawText);
        } catch (e) {
          const firstBrace = rawText.indexOf('{');
          const lastBrace = rawText.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            try {
              parsed = JSON.parse(rawText.substring(firstBrace, lastBrace + 1));
            } catch (e2) { }
          }
        }

        if (!parsed) {
          throw new Error('A IA respondeu, mas o formato JSON do currículo veio truncado ou inválido.');
        }

        // Desempacota nós aninhados caso a IA tenha retornado { resume: {...} } ou { data: {...} }
        const root = parsed.resume || parsed.curriculo || parsed.data || parsed;
        const summary = (root.tailoredSummary || root.summary || root.resumo || root.professionalSummary || root.perfil || '').trim();
        const exps = root.experiences || root.experiencias || root.experiencia || null;

        if (summary || (Array.isArray(exps) && exps.length > 0)) {
          console.log(`[vagasATS AI] Currículo gerado com sucesso por ${model}!`);
          try {
            localStorage.setItem('working_gemini_model', model);
            sessionStorage.setItem('working_gemini_model', model);
          } catch (e) { }

          // Registra a requisição e tokens no tracker de cota
          recordAiRequest('gemini', 1800);

          let cleanSummary = (summary || localBase.tailoredSummary || '').trim();
          cleanSummary = cleanSummary.replace(/^binho\b\s*/i, 'Alinhado a ');
          cleanSummary = cleanSummary.replace(/\bbinho\b/gi, 'alinhado');
          cleanSummary = sanitizePdfText(cleanSummary);

          const mappedExperiences = (userProfile.experiences || []).map((exp, idx) => {
            const llmExp = Array.isArray(exps) ? (exps.find(e => e && e.id === exp.id) || exps[idx]) : null;
            const rawBullets = (llmExp && Array.isArray(llmExp.bullets) && llmExp.bullets.length > 0)
              ? llmExp.bullets
              : (exp.bullets || [exp.description || '']);
            const bullets = deduplicateBullets(rawBullets);
            return {
              ...exp,
              company: cleanCompanyName(exp.company) || exp.company,
              bullets: bullets,
              description: bullets.map(b => `• ${b}`).join('\n')
            };
          });

          return {
            ...localBase,
            language: localBase.language,
            tailoredSummary: cleanSummary,
            experiences: mappedExperiences,
            skills: (((root.prioritizedSkills || root.skills) && (root.prioritizedSkills || root.skills).length > 0)
              ? (root.prioritizedSkills || root.skills)
              : localBase.skills).map(sanitizePdfText),
            atsKeywords: (((root.atsKeywords || root.keywords) && (root.atsKeywords || root.keywords).length > 0)
              ? (root.atsKeywords || root.keywords)
              : localBase.atsKeywords).map(sanitizePdfText),
            crossMatchHighlights: (((root.crossMatchHighlights || root.highlights) && (root.crossMatchHighlights || root.highlights).length > 0)
              ? (root.crossMatchHighlights || root.highlights)
              : localBase.crossMatchHighlights).map(sanitizePdfText),
            isRealAI: true,
            aiModel: `Google ${model}`
          };
        } else {
          throw new Error('A IA respondeu, mas a estrutura retornada não contém os campos de resumo ou experiências.');
        }
      } catch (e) {
        lastError = e.name === 'AbortError' ? 'Tempo de resposta esgotado (timeout 20s)' : e.message;
        console.warn(`[vagasATS AI] Falha ao testar ${model}:`, lastError);
        if (isQuotaExceeded) break;
      }
    }

  // Se excedeu cota ou falhou, fallback instantâneo com o currículo ATS local otimizado
  return {
    ...localBase,
    isRealAI: false,
    isRateLimited: isQuotaExceeded,
    aiError: isQuotaExceeded
      ? 'Limite de cota atingido no Google Gemini (15 req/min ou 1.500/dia). O currículo foi gerado instantaneamente pelo motor ATS local.'
      : (lastError ? `Falha ao conectar com IA (${lastError}). Exibindo versão base estruturada.` : 'Falha ao contatar API de IA. Usando motor ATS local.')
  };
}

export function generateCoverLetter(userProfile, job, targetLanguage = 'auto') {
  const isEnglish = targetLanguage === 'en' || (targetLanguage === 'auto' && detectJobLanguage(job) === 'en');
  const matchResult = calculateMatch(userProfile, job);
  const skillsStr = matchResult.matchedSkills.slice(0, 4).join(', ') || (isEnglish ? 'software development and modern architectures' : 'desenvolvimento de software e arquiteturas modernas');
  const cleanCompany = cleanCompanyName(job.company) || (isEnglish ? 'the company' : 'a organização');
  const cleanRole = cleanResumeTitle(job.title) || job.title;

  if (isEnglish) {
    return `Dear Hiring Team at ${cleanCompany},

I am writing to express my strong interest in the ${cleanRole} position recently published.

With a solid engineering background and practical hands-on experience in ${skillsStr}, my professional profile aligns closely with the core technical requirements and high standards of your team.

Throughout my recent work, I have focused on delivering scalable web architectures, writing clean and maintainable code, and driving proactive cross-functional collaboration in agile teams. The opportunity to contribute to ${cleanCompany}'s mission in a ${job.workType || 'Remote / Hybrid'} environment represents an exciting and natural progression for my career.

Please find attached my tailored ATS-optimized resume for this role. Thank you for your time and consideration, and I look forward to discussing how my experience can support your goals.

Sincerely,
${sanitizePdfText(userProfile.fullName)}
${userProfile.phone} | ${userProfile.email}
${userProfile.linkedin}`;
  }

  return `Prezado(a) Recrutador(a) da ${cleanCompany},

Gostaria de manifestar meu forte interesse na vaga de ${cleanRole}, publicada recentemente.

Com base na minha trajetória profissional e nas exigências apresentadas pela vaga, estou certo(a) de que minhas competências em ${skillsStr} estão perfeitamente alinhadas com as necessidades atuais do time.

Em minhas experiências anteriores, destaquei-me pelo desenvolvimento de soluções escaláveis, código limpo e colaboração proativa em equipes ágeis. A oportunidade de contribuir para o crescimento da ${cleanCompany} e atuar em um ambiente ${job.workType || 'Remoto / Híbrido'} vai ao encontro das minhas metas profissionais.

Anexo meu currículo otimizado para esta vaga. Agradeço desde já pela atenção e coloco-me à inteira disposição para uma entrevista.

Atenciosamente,
${sanitizePdfText(userProfile.fullName)}
${userProfile.phone} | ${userProfile.email}
${userProfile.linkedin}`;
}

export async function generateCoverLetterWithLLM(userProfile, job, apiKey = "", targetLanguage = 'auto', tone = 'balanced') {
  let cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    try {
      cleanKey = (loadAiSettings()?.apiKey || '').trim();
    } catch (e) { }
  }
  const fallback = generateCoverLetter(userProfile, job, targetLanguage);
  if (!cleanKey) {
    return { text: fallback, isRealAI: false };
  }

  const isEnglish = targetLanguage === 'en' || (targetLanguage === 'auto' && detectJobLanguage(job) === 'en');
  const cleanCompany = cleanCompanyName(job.company) || (isEnglish ? 'the target company' : 'a empresa contratante');
  const cleanRole = cleanResumeTitle(job.title) || job.title;

  const prompt = `Você é um Consultor Sênior de Carreira Tech e Redator Especialista em Cartas de Apresentação de Alto Impacto para Recrutadores.
Sua missão é escrever uma Carta de Apresentação (Cover Letter) impecável, humana, persuasiva e personalizada em ${isEnglish ? 'Inglês' : 'Português do Brasil'}, conectando com precisão os dados REAIS do candidato à vaga anunciada.

DIRETRIZES FUNDAMENTAIS:
1. Tom: ${tone === 'tech' ? 'Foco técnico, domínio prático da stack e capacidade de entrega de software' : tone === 'impact' ? 'Foco em impacto direto nos resultados do negócio e otimização de processos' : 'Profissional, elegante, confiante e equilibrado'}.
2. NÃO use clichês genéricos. Se houver informações na 'Trajetória & Contexto Adicional' ou experiências reais, conecte de 2 a 3 projetos práticos, automações ou ferramentas reais com as dores e objetivos da vaga.
3. NÃO invente cargos, empresas, certificações ou tecnologias que não estejam nos dados reais fornecidos abaixo.
4. Estrutura limpa (3 a 4 parágrafos concisos):
   - Abertura cativante citando o cargo (${cleanRole}) e empresa (${cleanCompany}).
   - Parágrafo central conectando experiências reais comprovadas com os desafios da vaga.
   - Parágrafo de valor agregado e adequação à cultura de trabalho (${job.workType || 'Remoto/Híbrido'}).
   - Fechamento cordial e chamada para conversa/entrevista.
5. Retorne APENAS o texto da carta de apresentação pronto para envio, sem introduções explicativas do tipo "Aqui está sua carta:". Use o nome e contatos reais do candidato no rodapé.

DADOS DA VAGA:
- Cargo: ${cleanRole}
- Empresa: ${cleanCompany}
- Modelo: ${job.workType || 'Híbrido/Remoto'} - ${job.location || 'Brasil'}
- Requisitos: ${JSON.stringify(job.requirements || [])}
- Descrição da Vaga: ${(job.description || '').slice(0, 1500)}

DADOS REAIS DO CANDIDATO:
- Nome: ${userProfile.fullName || 'Candidato'}
- Cargo Atual / Alvo: ${userProfile.targetRole || cleanRole}
- Bio / Resumo: ${userProfile.bio || ''}
- Trajetória & Contexto Adicional: ${(userProfile.careerContext || '').slice(0, 1000)}
- Habilidades: ${JSON.stringify(userProfile.skills || [])}
- Experiências: ${JSON.stringify((userProfile.experiences || []).map(e => ({ role: e.role, company: cleanCompanyName(e.company) || e.company, period: e.period, description: e.description })))}
- Contatos: ${userProfile.phone || ''} | ${userProfile.email || ''} | ${userProfile.linkedin || ''}`;

  // Se chave da OpenAI (sk-...)
  const effectiveProvider = cleanKey.startsWith('sk-') ? 'openai' : 'gemini';
  if (effectiveProvider === 'openai') {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.35,
          max_tokens: 1200,
          messages: [
            { role: 'system', content: 'Você é um redator profissional de cartas de apresentação para tecnologia.' },
            { role: 'user', content: prompt }
          ]
        })
      });
      if (res.ok) {
        const data = await res.json();
        const letter = data.choices?.[0]?.message?.content?.trim();
        if (letter) {
          recordAiRequest('openai', 900);
          return { text: letter, isRealAI: true, model: 'GPT-4o Mini' };
        }
      }
    } catch (e) {
      console.warn('Erro ao gerar carta com OpenAI:', e);
    }
    return { text: fallback, isRealAI: false };
  }

  // Google Gemini (testa modelos flash rápidos)
  let cachedModel = null;
  try {
    cachedModel = localStorage.getItem('working_gemini_model') || sessionStorage.getItem('working_gemini_model');
    if (cachedModel && (!cachedModel.startsWith('gemini') || cachedModel.includes('gemma') || cachedModel.includes('-exp') || cachedModel === 'gemini-2.5-flash')) {
      cachedModel = null;
    }
  } catch (e) { }

  const modelsToTry = Array.from(new Set([
    cachedModel,
    'gemini-3.8-flash',
    'gemini-flash-lite-latest',
    'gemini-flash-latest',
    'gemini-2.0-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-flash'
  ].filter(m => m && m.startsWith('gemini') && !m.includes('gemma') && !m.includes('-exp') && m !== 'gemini-2.5-flash')));

  for (const model of modelsToTry) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 1500
          }
        })
      });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        break; // Não spamma outros modelos se cota estourou
      }

      if (res.ok) {
        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (rawText && rawText.trim().length > 50) {
          recordAiRequest('gemini', 1000);
          return {
            text: rawText.trim(),
            isRealAI: true,
            model
          };
        }
      }
    } catch (e) {
      // Tenta o próximo modelo
    }
  }

  return { text: fallback, isRealAI: false };
}



export function searchNewJobsWithAI(userRole, hoursMax = 24) {
  const roleName = userRole || 'Desenvolvedor Frontend / Full Stack';

  const freshJobTemplates = [
    {
      title: `${roleName} Júnior - Projetos Cloud & Web`,
      company: "NextGen Tech Americas",
      companyLogo: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100&auto=format&fit=crop&q=80",
      location: "São Paulo, SP (100% Remoto)",
      workType: "Remoto",
      level: "Júnior",
      salary: "R$ 4.800 - R$ 6.500 / mês",
      postedHoursAgo: 1,
      source: "LinkedIn",
      url: "https://www.linkedin.com/jobs",
      requirements: ["React", "TypeScript", "Node.js", "HTML5", "CSS3", "Git"],
      description: "Vaga recém-capturada! Buscamos desenvolvedor(a) Júnior para integrar time de produto global focado em aplicações web modernas.",
      benefits: ["Auxílio Home Office R$ 450", "Plano de Saúde Bradesco Top", "Vale Alimentação R$ 1.300"]
    },
    {
      title: `Engenheiro(a) ${roleName} Júnior - AI & Automação`,
      company: "ByteForce AI Labs",
      companyLogo: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=100&auto=format&fit=crop&q=80",
      location: "Belo Horizonte, MG (Remoto)",
      workType: "Remoto",
      level: "Júnior",
      salary: "R$ 4.900 - R$ 6.800 / mês",
      postedHoursAgo: 1,
      source: "Gupy",
      url: "https://gupy.io",
      requirements: ["Python", "React", "TypeScript", "FastAPI", "PostgreSQL", "Git"],
      description: "Empresa de tecnologia internacional expandindo operação no Brasil. Oportunidade com stack de ponta e mentoria técnica.",
      benefits: ["MacBook fornecido", "Bônus por metas", "Gympass Gold"]
    },
    {
      title: `${roleName} Trainee - Aceleração & Growth`,
      company: "InnovateTech Startups",
      companyLogo: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=100&auto=format&fit=crop&q=80",
      location: "Florianópolis, SC (Remoto)",
      workType: "Remoto",
      level: "Júnior",
      salary: "R$ 4.200 - R$ 5.600 / mês",
      postedHoursAgo: 2,
      source: "Gupy",
      url: "https://gupy.io",
      requirements: ["JavaScript", "React", "HTML5", "CSS3", "Git", "REST API"],
      description: "Programa de incentivo a novos talentos da computação. Mentoria direta com engenheiros sêniores e plano de carreira acelerado.",
      benefits: ["Auxílio Cursos R$ 300/mês", "Plano de Saúde Unimed", "Carga horária 40h"]
    },
    {
      title: `Desenvolvedor(a) Web ${roleName} Júnior`,
      company: "Apex Cloud Systems",
      companyLogo: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80",
      location: "Curitiba, PR (Remoto)",
      workType: "Remoto",
      level: "Júnior",
      salary: "R$ 4.500 - R$ 6.300 / mês",
      postedHoursAgo: 2,
      source: "Vagas.com",
      url: "https://www.vagas.com.br",
      requirements: ["Node.js", "TypeScript", "React", "Docker Basics", "PostgreSQL", "Git"],
      description: "Atuação no desenvolvimento end-to-end de soluções SaaS corporativas com esteira CI/CD automatizada.",
      benefits: ["Vale Refeição R$ 1.100", "Seguro de vida", "Horário 100% flexível"]
    },
    {
      title: `Programador(a) ${roleName} Júnior`,
      company: "Fintech Horizon Labs",
      companyLogo: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=100&auto=format&fit=crop&q=80",
      location: "Rio de Janeiro, RJ (Remoto)",
      workType: "Remoto",
      level: "Júnior",
      salary: "R$ 5.000 - R$ 6.900 / mês",
      postedHoursAgo: 3,
      source: "Gupy",
      url: "https://portal.gupy.io",
      requirements: ["TypeScript", "React", "Node.js", "SQL", "Git", "REST API"],
      description: "Buscamos dev Júnior motivado para integrar squad de desenvolvimento de soluções de pagamentos e Pix.",
      benefits: ["PLR Anual", "Previdência Privada", "Plano SulAmérica Executivo"]
    },
    {
      title: `${roleName} Mobile & Web Júnior`,
      company: "OmniChannel Digital Tech",
      companyLogo: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=100&auto=format&fit=crop&q=80",
      location: "Campinas, SP (Remoto)",
      workType: "Remoto",
      level: "Júnior",
      salary: "R$ 4.400 - R$ 6.100 / mês",
      postedHoursAgo: 3,
      source: "Catho",
      url: "https://www.catho.com.br",
      requirements: ["React Native", "React", "TypeScript", "Tailwind CSS", "Git"],
      description: "Desenvolvimento de interfaces web e mobile multiplataforma para ecossistema de varejo digital.",
      benefits: ["Cartão Flash Flexível R$ 1.000", "Assistência Odontológica"]
    }
  ];

  return freshJobTemplates.map((job, index) => ({
    ...job,
    id: `ai-job-${Date.now()}-${index}`
  }));
}

export function parseResumeText(rawText) {
  if (!rawText) return null;

  const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = rawText.match(/\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}/);
  const linkedinMatch = rawText.match(/(linkedin\.com\/in\/[a-zA-Z0-9_-]+)/i);
  const githubMatch = rawText.match(/(github\.com\/[a-zA-Z0-9_-]+)/i);

  // Common Tech Skills Detection
  const techCatalog = [
    "React", "Node.js", "TypeScript", "JavaScript", "Python", "Docker",
    "PostgreSQL", "MySQL", "MongoDB", "AWS", "Tailwind CSS", "HTML5",
    "CSS3", "Git", "Next.js", "Vue.js", "Angular", "Express", "FastAPI",
    "C#", "Java", "Spring Boot", "Kubernetes", "GraphQL", "Figma", "Redux"
  ];

  const extractedSkills = techCatalog.filter(skill =>
    new RegExp(`\\b${skill.replace('.', '\\.')}\\b`, 'i').test(rawText)
  );

  // Extract Name (First non-empty line)
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const fullName = lines[0] && lines[0].length < 40 ? lines[0] : "Profissional de Tecnologia";

  return {
    fullName,
    email: emailMatch ? emailMatch[0] : "",
    phone: phoneMatch ? phoneMatch[0] : "",
    linkedin: linkedinMatch ? linkedinMatch[0] : "",
    github: githubMatch ? githubMatch[0] : "",
    bio: rawText.slice(0, 350) + "...",
    skills: extractedSkills.length > 0 ? extractedSkills : ["JavaScript", "React", "Node.js", "Git"],
    targetRole: "Desenvolvedor de Software / Tecnologia",
    seniority: "Pleno",
    workPreference: "Remoto"
  };
}

/**
 * Returns the real URL of a job posting, or null when the job is a sample
 * (fictional) listing that has no real page to link to.
 */
export function getJobDirectUrl(job) {
  if (!job || !job.isReal || !job.url) return null;
  return job.url;
}

export function formatPostedAgo(hours) {
  const h = Math.max(0, Math.round(hours || 0));
  if (h < 1) return 'agora há pouco';
  if (h === 1) return 'há 1h';
  if (h < 24) return `há ${h}h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'ontem (há 1 dia)';
  return `há ${days} dias`;
}

function stripHtml(html) {
  if (!html) return '';
  const prepared = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ');
  try {
    const doc = new DOMParser().parseFromString(prepared, 'text/html');
    return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  } catch (e) {
    return prepared.replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
  }
}

export function inferLevel(title = '', description = '') {
  const t = `${title} ${(description || '').slice(0, 400)}`.toLowerCase();
  // 1. Especialista / Tech Lead / Arquiteto / Head
  if (/(especialista|specialist|architect|arquiteto|head\b|diretor|principal engineer|staff engineer)/i.test(t)) {
    return 'Especialista';
  }
  // 2. Sênior / Sr / III
  if (/(s[eê]nior|\bsr\b|tech lead|\blead\b|\biii\b|n[ií]vel 3|\bn3\b)/i.test(t)) {
    return 'Sênior';
  }
  // 3. Júnior / Estágio / Trainee / Iniciante / Assistente / I / Nível 1
  if (/(j[uú]nior|\bjr\b|est[aá]gio|estagi[aá]ri[oa]|trainee|intern\b|internship|entry|iniciante|aprendiz|jovem aprendiz|assistente|auxiliar|\bi\b|n[ií]vel 1|\bn1\b|suporte n1)/i.test(t)) {
    return 'Júnior';
  }
  // 4. Pleno / Mid / II
  if (/(pleno|\bmid\b|\bii\b|n[ií]vel 2|\bn2\b)/i.test(t)) {
    return 'Pleno';
  }
  return 'Pleno';
}


// Blacklist rigorosa de termos e profissões que NÃO são tecnologia / TI / Dev
export const NON_TECH_TITLE_BLACKLIST = /(qu[ií]mic[ao]|farm[aá]c|enferm|m[eé]dic|odont|fisioterap|veterin|biol[oó]g|nutri[çc]|hospitalar|laborat[oó]rio|contas a pagar|contas a receber|tribut[aá]ri|impostos|fiscal\b|escritura[çc][aã]o|cont[aá]bil|contabilidade|faturament|tesourari|cobran[çc]a|recursos humanos|departamento pessoal|\bdp\b|recrutament|psicolog|pedagog|direito\b|jur[ií]dic|advogad|balconista|vendedor|vendedora|atendente de loja|loja internacional|operador de caixa|caixa\b|recepcionista|recep[çc][aã]o|estoquista|almoxarif|log[ií]stica|expedi[çc][aã]o|motorista|porteir|portaria|vigilante|zelador|limpeza|servi[çc]os gerais|auxiliar de produ[çc][aã]o|operador de produ[çc][aã]o|manuten[çc][aã]o predial|engenhari[a] civil|engenheir[oa] civil|engenhari[a] mec[aâ]nica|engenheir[oa] mec[aâ]nic|engenhari[a] qu[ií]mica)/i;

// Regex positivo de cargos e stacks de DEV / TECH / TI / DADOS / CLOUD / SUPORTE
export const TECH_ROLE_POSITIVE_REGEX = /(desenvolv|developer|dev\b|programad|programmer|software|frontend|front-end|backend|back-end|full.?stack|web\b|mobile|android|ios|flutter|react|node|python|django|fastapi|flask|java\b|spring|kotlin|swift|c#|\.net|dotnet|golang|rust|php\b|laravel|ruby|rails|typescript|javascript|vue|angular|next\.?js|html|css|devops|sre\b|cloud|nuvem|aws|azure|gcp|kubernetes|k8s|docker|terraform|ansible|ci\/cd|linux|sysadmin|infraestrutura|infra\b|redes\b|network|telecom|suporte|support|help\s*desk|service\s*desk|analista de ti|t[eé]cnico de inform[aá]tica|t[eé]cnico de ti|assistente de ti|\bti\b|itil|\bn1\b|\bn2\b|\bn3\b|seguran[çc]a da informa[çc][aã]o|cyber|ciberseguran[çc]a|infosec|soc\b|pentest|dados\b|data\b|bi\b|business intelligence|power bi|machine learning|\bia\b|intelig[eê]ncia artificial|dba\b|qa\b|tester|testes|quality assurance|product owner|scrum master|ui\/ux|ux\/ui|product designer)/i;

/**
 * Validador estrito para garantir que uma vaga pertence à área de Tecnologia,
 * Desenvolvimento de Software ou áreas correlatas de TI.
 */
export function isTechDevJob(job) {
  if (!job) return false;
  const title = (job.title || '').trim().toLowerCase();

  // 1. Descarte imediato caso o título corresponda à blacklist de não-tecnologia
  if (NON_TECH_TITLE_BLACKLIST.test(title)) {
    return false;
  }

  // 2. Se o título contiver palavras-chave diretas de DEV / TECH / TI
  if (TECH_ROLE_POSITIVE_REGEX.test(title)) {
    return true;
  }

  // 3. Se possuir requisitos técnicos catalogados (ex: React, SQL, Python, Docker)
  if (Array.isArray(job.requirements) && job.requirements.length > 0) {
    return true;
  }

  // 4. Verificação no início da descrição para identificar se é vaga técnica genuína
  const descPrefix = (job.description || '').slice(0, 500).toLowerCase();
  if (NON_TECH_TITLE_BLACKLIST.test(descPrefix)) {
    return false;
  }

  const STRONG_TECH_TERMS = /(programa[çc][aã]o|desenvolvimento de software|c[oó]digo|linguagem de programa[çc][aã]o|sistemas de informa[çc][aã]o|ci[eê]ncia da computa[çc][aã]o|an[aá]lise e desenvolvimento de sistemas|banco de dados|servidores|chamados t[eé]cnicos|redes de computadores)/i;
  return STRONG_TECH_TERMS.test(descPrefix);
}

export const TECH_AREAS = [
  { id: 'all', label: 'Todas as Áreas Tech', shortLabel: 'Todas as Áreas', iconName: 'Globe', color: 'blue' },
  { id: 'dev', label: 'Dev / Programação', shortLabel: 'Dev & Software', iconName: 'Code2', color: 'blue' },
  { id: 'devops', label: 'DevOps & Cloud', shortLabel: 'DevOps & Cloud', iconName: 'Terminal', color: 'amber' },
  { id: 'support', label: 'Suporte & TI', shortLabel: 'Suporte & TI', iconName: 'Headphones', color: 'emerald' },
  { id: 'infra', label: 'Infra & Redes', shortLabel: 'Infra & Redes', iconName: 'Network', color: 'cyan' },
  { id: 'data', label: 'Dados & IA', shortLabel: 'Dados & IA', iconName: 'Database', color: 'purple' },
  { id: 'qa', label: 'QA & Testes', shortLabel: 'QA & Testes', iconName: 'CheckSquare', color: 'teal' },
  { id: 'security', label: 'Segurança & Cyber', shortLabel: 'Segurança', iconName: 'Shield', color: 'rose' },
];

export function getJobTechArea(job) {
  if (!job) return { id: 'other', label: 'Tech & TI Geral', shortLabel: 'Tech Geral', iconName: 'Cpu', color: 'blue' };

  // Se a vaga for identificada como não-tech, retornar identificador específico
  if (!isTechDevJob(job)) {
    return { id: 'non_tech', label: 'Outras Áreas', shortLabel: 'Não Tech', iconName: 'AlertCircle', color: 'slate' };
  }

  const title = (job.title || '').toLowerCase();
  const text = `${title} ${(job.requirements || []).join(' ')}`.toLowerCase();

  // 1. Suporte Técnico & TI / Service Desk / Help Desk
  if (
    /(suporte|help\s*desk|service\s*desk|atendimento t[eé]cnico|suporte t[eé]cnico|suporte a usu[aá]rio|suporte n[123]|t[eé]cnico de inform[aá]tica|t[eé]cnico de ti|assistente de ti|analista de ti|\bn1\b|\bn2\b|\bn3\b|field service)/i.test(title) ||
    (/(suporte|help\s*desk|service\s*desk|glpi|chamados)/i.test(text) && /(ti\b|suporte|t[eé]cnico|analista|assistente)/i.test(title))
  ) {
    return { id: 'support', label: 'Suporte & TI', shortLabel: 'Suporte & TI', iconName: 'Headphones', color: 'emerald' };
  }

  // 2. DevOps & Cloud & SRE
  if (
    /(devops|sre\b|site reliability|\bcloud\b|nuvem|kubernetes|terraform|platform engineer|cloud engineer|engenheiro devops|finops|cloud architect)/i.test(title) ||
    (/(devops|sre\b|kubernetes|terraform|ci\/cd|helm|ansible)/i.test(text) && /(engenheir|engineer|analista|specialist|especialista)/i.test(title))
  ) {
    return { id: 'devops', label: 'DevOps & Cloud', shortLabel: 'DevOps & Cloud', iconName: 'Terminal', color: 'amber' };
  }

  // 3. Infraestrutura & Redes / SysAdmin
  if (
    /(infraestrutura|infra\b|redes\b|network|sysadmin|administrador de sistemas|administrador de redes|linux admin|windows server|telecom|cisco|mikrotik|virtualiza[çc][aã]o|datacenter)/i.test(title)
  ) {
    return { id: 'infra', label: 'Infra & Redes', shortLabel: 'Infra & Redes', iconName: 'Network', color: 'cyan' };
  }

  // 4. Segurança / Cyber
  if (
    /(seguran[çc]a|cyber|ciberseguran[çc]a|infosec|soc\b|pentest|appsec|siem|vulnerabil)/i.test(title)
  ) {
    return { id: 'security', label: 'Segurança & Cyber', shortLabel: 'Segurança', iconName: 'Shield', color: 'rose' };
  }

  // 5. Dados & IA
  if (
    /(dados\b|data\b|analytics|business intelligence|\bbi\b|machine learning|\bia\b|engenheiro de dados|cientista de dados|analista de dados|dba\b|power bi|big data|engenharia de dados)/i.test(title)
  ) {
    return { id: 'data', label: 'Dados & IA', shortLabel: 'Dados & IA', iconName: 'Database', color: 'purple' };
  }

  // 6. QA & Testes
  if (
    /(qa\b|quality assurance|qualidade de software|testes\b|tester\b|analista de teste|automa[çc][aã]o de testes)/i.test(title)
  ) {
    return { id: 'qa', label: 'QA & Testes', shortLabel: 'QA & Testes', iconName: 'CheckSquare', color: 'teal' };
  }

  // 7. Desenvolvimento / Software / Dev
  if (
    /(desenvolv|developer|dev\b|programad|programmer|software|frontend|front-end|backend|back-end|full.?stack|web\b|mobile|ios|android|react|node|python|java|php|\.net|c#|golang|rust|flutter|kotlin|swift)/i.test(title) ||
    ((job.requirements || []).some(r => /(react|node|python|java|c#|javascript|typescript|php|flutter|sql|html|css|api|git)/i.test(r)))
  ) {
    return { id: 'dev', label: 'Dev & Software', shortLabel: 'Dev & Software', iconName: 'Code2', color: 'blue' };
  }

  return { id: 'other', label: 'Tech & TI Geral', shortLabel: 'Tech Geral', iconName: 'Cpu', color: 'blue' };
}

const TECH_CATALOG = [
  // Linguagens & Frameworks
  'React', 'React Native', 'Node.js', 'TypeScript', 'JavaScript', 'Python', 'Django', 'FastAPI', 'Flask',
  'Java', 'Spring Boot', 'Kotlin', 'Swift', 'Go', 'Golang', 'Rust', 'Ruby', 'Rails', 'PHP', 'Laravel', 'C#', '.NET',
  'Next.js', 'Vue.js', 'Angular', 'Tailwind CSS', 'HTML5', 'CSS3', 'Git', 'SQL', 'Elixir', 'Scala',
  // DevOps & Cloud & SRE
  'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Terraform', 'Ansible', 'Helm', 'Prometheus', 'Grafana',
  'Jenkins', 'GitLab CI', 'GitHub Actions', 'CI/CD', 'CloudFormation', 'ArgoCD', 'OpenShift', 'SRE', 'Linux',
  'Nginx', 'Shell Script', 'Bash', 'Datadog', 'New Relic', 'Cloud', 'DevOps', 'EC2', 'S3', 'Lambda', 'API Gateway', 'EKS',
  // Suporte Técnico & TI & Service Desk
  'Help Desk', 'Service Desk', 'ITIL', 'Active Directory', 'Windows Server', 'Office 365', 'GLPI', 'Zabbix',
  'Jira Service Management', 'Hardware', 'Atendimento ao Usuário', 'TCP/IP', 'VPN', 'DNS', 'DHCP', 'N1', 'N2', 'N3',
  'Firewall', 'Mikrotik', 'Cisco',
  // Infra & Redes & SysAdmin
  'Infraestrutura', 'Redes', 'SysAdmin', 'VMware', 'Virtualização', 'Proxmox', 'Hyper-V', 'Fortinet', 'PFSense', 'Telecom',
  // Banco de Dados & Big Data & IA
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'GraphQL', 'REST API', 'Kafka', 'Machine Learning', 'Power BI',
  'Tableau', 'Snowflake', 'BigQuery', 'dbt', 'Airflow', 'Pandas', 'Spark', 'PySpark', 'Elasticsearch', 'DBA',
  // QA, Automação & Testes
  'Postman', 'Jest', 'Cypress', 'Playwright', 'Selenium', 'Testes Automatizados', 'QA', 'Robot Framework',
  // Segurança & Cyber
  'Cybersecurity', 'Cibersegurança', 'SIEM', 'SOC', 'Pentest', 'ISO 27001', 'LGPD', 'Segurança da Informação',
  // Práticas & Metodologias
  'Scrum', 'Kanban', 'Clean Code', 'Code Review', 'Observabilidade', 'Microsserviços', 'Figma'
];

function extractTechTags(text = '') {
  return TECH_CATALOG.filter(tech => {
    const escaped = tech.replace(/[.+*?^${}()|[\]\\/]/g, '\\$&');
    // Short names (Go, Git, SQL, Java...) collide with common English words, so match them case-sensitively
    const flags = tech.length <= 4 ? '' : 'i';
    return new RegExp(`(^|[^a-zA-Z0-9])${escaped}($|[^a-zA-Z0-9])`, flags).test(text);
  }).slice(0, 8);
}

function hoursSince(dateStr) {
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 36e5));
}

const STOP_WORDS = ['de', 'da', 'do', 'e', 'a', 'o', 'em', 'para', 'com', 'no', 'na', 'nos', 'nas', 'um', 'uma'];
const LEVEL_WORDS = ['junior', 'júnior', 'jr', 'pleno', 'mid', 'senior', 'sênior', 'sr'];

/**
 * Normaliza o termo de busca em português ou tecnologia para consultar as plataformas de vagas brasileiras.
 */
export function toSearchQuery(term = '') {
  const words = term
    .toLowerCase()
    .replace(/[\/|,()&+]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(w => !STOP_WORDS.includes(w) && !LEVEL_WORDS.includes(w));
  return [...new Set(words)].slice(0, 3).join(' ');
}

async function fetchJson(url, label) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${label} respondeu ${res.status}`);
  return res.json();
}

export const BRAZIL_REGIONS = [
  { value: "Todas", label: "Todo o Brasil", state: "" },
  { value: "SP", label: "São Paulo (SP)", state: "São Paulo", aliases: ["são paulo", "sao paulo", "sp", "campinas", "barueri", "são bernardo", "santo andré", "são caetano", "osasco", "guarulhos", "sorocaba", "santos", "ribeirão preto", "alphaville", "jundiaí", "piracicaba"] },
  { value: "RJ", label: "Rio de Janeiro (RJ)", state: "Rio de Janeiro", aliases: ["rio de janeiro", "rj", "niterói", "niteroi"] },
  { value: "MG", label: "Minas Gerais (MG)", state: "Minas Gerais", aliases: ["minas gerais", "mg", "belo horizonte", "bh", "uberlândia", "uberlandia"] },
  { value: "PR", label: "Paraná (PR)", state: "Paraná", aliases: ["paraná", "parana", "pr", "curitiba", "londrina", "maringá"] },
  { value: "SC", label: "Santa Catarina (SC)", state: "Santa Catarina", aliases: ["santa catarina", "sc", "florianópolis", "florianopolis", "joinville", "blumenau"] },
  { value: "RS", label: "Rio Grande do Sul (RS)", state: "Rio Grande do Sul", aliases: ["rio grande do sul", "rs", "porto alegre", "caxias do sul"] },
  { value: "DF", label: "Distrito Federal (DF)", state: "Distrito Federal", aliases: ["distrito federal", "df", "brasília", "brasilia"] },
  { value: "BA", label: "Bahia (BA)", state: "Bahia", aliases: ["bahia", "ba", "salvador"] },
  { value: "PE", label: "Pernambuco (PE)", state: "Pernambuco", aliases: ["pernambuco", "pe", "recife", "porto digital"] },
  { value: "CE", label: "Ceará (CE)", state: "Ceará", aliases: ["ceará", "ceara", "ce", "fortaleza"] },
  { value: "Remoto", label: "100% Remoto Nacional", state: "", aliases: ["100% remoto", "remoto"] },
];

/**
 * Verifica se uma vaga pertence à região selecionada
 */
export function matchesRegion(job, regionKey = 'Todas', includeRemote = true) {
  if (!regionKey || regionKey === 'Todas') return true;

  const reg = BRAZIL_REGIONS.find(r => r.value === regionKey);
  if (!reg) return true;

  const loc = (job.location || '').toLowerCase();
  const title = (job.title || '').toLowerCase();
  const desc = (job.description || '').slice(0, 500).toLowerCase();
  const text = `${loc} ${title} ${desc}`;

  if (regionKey === 'Remoto') {
    return job.workType === 'Remoto' || /remoto/i.test(loc);
  }

  const hasAlias = reg.aliases.some(alias => {
    const rx = new RegExp(`(^|[^a-zA-Z0-9áéíóúâêîôûãõç])${alias}($|[^a-zA-Z0-9áéíóúâêîôûãõç])`, 'i');
    return rx.test(text);
  });

  if (hasAlias) return true;

  // Se a opção de incluir vagas remotas estiver ativa, vagas com 100% remoto também são aceitas
  if (includeRemote && (job.workType === 'Remoto' || /100% remoto/i.test(loc))) {
    return true;
  }

  return false;
}

/**
 * Busca vagas reais brasileiras no portal Gupy com suporte a múltiplos termos e paginação expandida
 */
async function fetchGupy({ query, workplaceType = '', state = '', techArea = 'all' }) {
  const AREA_SPECIFIC_TERMS = {
    support: ['suporte ti', 'analista de suporte', 'help desk', 'service desk', 'suporte tecnico', 'analista ti'],
    devops: ['devops', 'cloud', 'sre', 'engenheiro devops', 'kubernetes', 'infraestrutura cloud'],
    dev: ['desenvolvedor', 'software', 'frontend', 'backend', 'full stack', 'programador', 'react', 'python', 'java'],
    infra: ['infraestrutura', 'redes', 'sysadmin', 'administrador de redes', 'linux'],
    data: ['dados', 'analista de dados', 'engenheiro de dados', 'power bi', 'sql'],
    qa: ['qa', 'analista de teste', 'qualidade de software', 'tester'],
    security: ['seguranca da informacao', 'cybersecurity', 'ciberseguranca', 'soc']
  };

  const defaultTerms = [
    // Desenvolvimento & Software (foco prioritário em DEV)
    'desenvolvedor',
    'programador',
    'developer',
    'software',
    'frontend',
    'backend',
    'full stack',
    'react',
    'node',
    'python',
    'java',
    // Estágios & Início de Carreira ESTRITAMENTE em TI/Dev
    'estagio ti',
    'estagio desenvolvimento',
    'estagio tecnologia',
    'estagio software',
    'desenvolvedor junior',
    'programador junior',
    'junior dev',
    'trainee tech',
    'trainee ti',
    // DevOps, Cloud & Infraestrutura
    'devops',
    'cloud',
    'sre',
    'infraestrutura ti',
    // Suporte & TI & Service Desk
    'suporte ti',
    'analista de suporte',
    'help desk',
    'service desk',
    'analista ti',
    'tecnico de ti',
    // Dados, QA & Segurança
    'analista de dados',
    'engenheiro de dados',
    'qa',
    'seguranca da informacao'
  ];

  let terms = [];
  if (query) {
    terms = [query];
  } else if (techArea && techArea !== 'all' && AREA_SPECIFIC_TERMS[techArea]) {
    terms = AREA_SPECIFIC_TERMS[techArea];
  } else {
    terms = defaultTerms;
  }

  const gupyRequests = [];

  terms.forEach(term => {
    const params = new URLSearchParams({
      jobName: term,
      limit: '50',
      offset: '0'
    });
    if (workplaceType && workplaceType !== 'Todos') {
      const wpMap = { 'Remoto': 'remote', 'Híbrido': 'hybrid', 'Presencial': 'on-site' };
      if (wpMap[workplaceType]) params.set('workplaceType', wpMap[workplaceType]);
    }
    if (state) {
      params.set('state', state);
    }
    gupyRequests.push(`/api/gupy?${params}`);

    // Se um estado foi selecionado, também buscar vagas 100% remotas disponíveis para residentes deste estado
    if (state) {
      const remoteParams = new URLSearchParams({
        jobName: term,
        limit: '100',
        offset: '0',
        workplaceType: 'remote'
      });
      gupyRequests.push(`/api/gupy?${remoteParams}`);
    }
  });

  const responses = await Promise.allSettled(
    gupyRequests.map(url => fetchJson(url, 'Gupy'))
  );

  const rawJobs = [];
  responses.forEach(r => {
    if (r.status === 'fulfilled' && Array.isArray(r.value?.data)) {
      rawJobs.push(...r.value.data);
    }
  });

  // Remover duplicatas retornadas por diferentes termos de busca
  const seenIds = new Set();
  const uniqueGupy = rawJobs.filter(j => {
    if (!j.id || seenIds.has(j.id)) return false;
    seenIds.add(j.id);
    return true;
  });

  return uniqueGupy
    .map(j => {
      const plainDescription = stripHtml(j.description || '');
      const title = (j.name || '').trim();
      const isRemote = j.workplaceType === 'remote';
      const isHybrid = j.workplaceType === 'hybrid';
      const loc = isRemote
        ? (j.city ? `${j.city}, ${j.state || 'BR'} (100% Remoto)` : 'Brasil (100% Remoto)')
        : (isHybrid ? `${j.city || 'Brasil'}, ${j.state || ''} (Híbrido)` : `${j.city || 'Brasil'}, ${j.state || ''} (Presencial)`);

      return {
        id: `gupy-${j.id}`,
        isReal: true,
        isBrazilFriendly: true,
        title,
        company: cleanCompanyName(j.careerPageName) || 'Empresa Nacional',
        companyLogo: j.careerPageLogo || 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=100&auto=format&fit=crop&q=80',
        location: loc,
        workType: isRemote ? 'Remoto' : (isHybrid ? 'Híbrido' : 'Presencial'),
        level: inferLevel(title, plainDescription),
        salary: 'A combinar (CLT/PJ)',
        publishedDate: j.publishedDate,
        postedHoursAgo: hoursSince(j.publishedDate),
        source: 'Gupy',
        url: j.jobUrl || `https://portal.gupy.io/job-search/jobs?jobName=${encodeURIComponent(title)}`,
        requirements: extractTechTags(`${title} ${plainDescription}`),
        description: plainDescription,
        benefits: []
      };
    })
    .filter(job => isTechDevJob(job));
}

/**
 * Busca vagas reais nas maiores comunidades abertas de tecnologia do Brasil no GitHub
 * (FrontendBR, Backend-BR, DevOps Brasil, Data Science BR, React Brasil, SouJava, PHPDevBR, FlutterBR, QA Brasil)
 */
async function fetchGitHubRepoIssues({ repo, source, query = '' }) {
  try {
    let issues = null;
    // 1. Tenta endpoint de proxy (/api/github-jobs)
    try {
      const url = `/api/github-jobs?repo=${encodeURIComponent(repo)}`;
      const res = await fetch(url);
      if (res.ok) {
        issues = await res.json();
      }
    } catch (e) { }

    // 2. Fallback resiliente direto para API pública do GitHub (CORS liberado no navegador)
    if (!Array.isArray(issues) || issues.length === 0) {
      try {
        const directUrl = `https://api.github.com/repos/${repo}/issues?state=open&sort=created&direction=desc&per_page=100`;
        const directRes = await fetch(directUrl, {
          headers: {
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        if (directRes.ok) {
          issues = await directRes.json();
        }
      } catch (e) { }
    }

    if (!Array.isArray(issues)) return [];

    const q = query.toLowerCase().trim();
    const shortTechTokens = ['ti', 'qa', 'go', 'ui', 'c#', 'ai', 'ia', 'bi', 'db', 'os'];

    return issues
      .filter(i => !i.pull_request)
      .filter(i => {
        if (!q) return true;
        const haystack = `${i.title} ${(i.labels || []).map(l => l.name || '').join(' ')} ${i.body || ''}`.toLowerCase();
        return q.split(/\s+/).some(token => {
          if (token.length > 2 || shortTechTokens.includes(token)) {
            return haystack.includes(token);
          }
          return false;
        });
      })
      .map(i => {
        const body = i.body || '';
        const plainDescription = stripHtml(body);
        const labels = (i.labels || []).map(l => (typeof l === 'string' ? l : l.name || ''));
        const fullText = `${i.title} ${labels.join(' ')} ${plainDescription}`;

        // Limpar título removendo prefixos entre colchetes como [Remoto], [São Paulo/SP]
        let cleanTitle = i.title.replace(/^\[[^\]]+\]\s*/, '').trim();

        // Extrair nome da empresa quando presente no título
        let company = 'Empresa Brasileira';
        const atMatch = cleanTitle.match(/\s+(?:na|no|at|@)\s+([A-Za-z0-9\s\-&.]+)/i);
        if (atMatch) {
          company = atMatch[1].trim();
          cleanTitle = cleanTitle.replace(atMatch[0], '').trim();
        } else {
          const parenMatch = cleanTitle.match(/\s*\(([A-Za-z0-9\s\-&.]+)\)\s*$/);
          if (parenMatch) {
            company = parenMatch[1].trim();
            cleanTitle = cleanTitle.replace(parenMatch[0], '').trim();
          } else {
            const dashMatch = cleanTitle.match(/\s+-\s+(?!end\b)([A-Za-z0-9\s&.]+)\s*$/i);
            if (dashMatch) {
              company = dashMatch[1].trim();
              cleanTitle = cleanTitle.replace(dashMatch[0], '').trim();
            } else if (i.user?.login) {
              company = i.user.login;
            }
          }
        }

        // Modalidade e Localização
        const isRemote = /remoto|remote/i.test(i.title) || labels.some(l => /remoto/i.test(l));
        const isHybrid = /híbrido|hibrido|hybrid/i.test(i.title) || labels.some(l => /híbrido|hibrido/i.test(l));
        const workType = isRemote ? 'Remoto' : (isHybrid ? 'Híbrido' : 'Presencial');
        const location = isRemote ? 'Brasil (100% Remoto)' : (isHybrid ? 'São Paulo / Híbrido' : 'Brasil (Presencial)');

        // Senioridade
        let level = 'Pleno';
        if (/(junior|júnior|\bjr\b|estágio|estagio|trainee|intern|iniciante|aprendiz|assistente|\bi\b)/i.test(i.title) || labels.some(l => /junior|júnior|jr|estágio|estagio|trainee|iniciante/i.test(l))) {
          level = 'Júnior';
        } else if (/(senior|sênior|\bsr\b|tech lead|lead|staff|\biii\b)/i.test(i.title) || labels.some(l => /senior|sênior|sr/i.test(l))) {
          level = 'Sênior';
        } else if (/(especialista|architect|principal|diretor|head)/i.test(i.title) || labels.some(l => /especialista|specialist/i.test(l))) {
          level = 'Especialista';
        } else {
          level = inferLevel(cleanTitle, plainDescription);
        }

        // Link direto de candidatura dentro da descrição ou na issue
        const applyMatch = body.match(/(?:candidat(?:ar|e)|inscri[çc][ãa]o|link|apply)[^\n]*?(https?:\/\/[^\s\)\],>]+)/i)
          || body.match(/https?:\/\/(?:[a-z0-9\-]+\.)?(?:gupy\.io|greenhouse\.io|lever\.co|workable\.com|vagas\.com|kenoby\.com|forms\.gle|coodesh\.com)[^\s\)\],>]+/i)
          || body.match(/https?:\/\/[^\s\)\],>]+/);
        const applyUrl = applyMatch ? (applyMatch[1] || applyMatch[0]) : i.html_url;

        // Tags técnicas
        const tags = [...new Set([...labels, ...extractTechTags(fullText)])].filter(
          t => t.length > 1 && !/remoto|clt|pj|pleno|sênior|junior|híbrido/i.test(t)
        );

        // Recência inteligente baseada na data de criação ou última interação/atualização ativa
        const effectiveHoursAgo = Math.min(
          hoursSince(i.created_at),
          hoursSince(i.updated_at || i.created_at)
        );

        return {
          id: `gh-${repo.replace('/', '-')}-${i.number}`,
          isReal: true,
          isBrazilFriendly: true,
          title: cleanTitle || i.title,
          company: cleanCompanyName(company) || 'Empresa Tecnologia',
          companyLogo: i.user?.avatar_url || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100&auto=format&fit=crop&q=80',
          location,
          workType,
          level,
          salary: labels.find(l => /pj|clt|r\$/i.test(l)) || 'A combinar (CLT/PJ)',
          publishedDate: i.created_at,
          updatedDate: i.updated_at,
          postedHoursAgo: effectiveHoursAgo,
          source,
          url: applyUrl,
          requirements: tags.slice(0, 8),
          description: plainDescription,
          benefits: []
        };
      });
  } catch (err) {
    console.warn(`Erro ao consultar ${source}:`, err.message);
    return [];
  }
}

/**
 * Busca vagas reais no portal Nerdin (Tecnologia & TI)
 */
async function fetchNerdin({ query = '', techArea = 'all' }) {
  try {
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    if (techArea && techArea !== 'all') params.set('techArea', techArea);

    const url = `/api/nerdin-jobs?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Nerdin respondeu status ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('Erro ao consultar Nerdin:', err.message);
    return [];
  }
}

// Cache em memória para busca de vagas reais (TTL: 4 minutos)
const realJobsCache = new Map();

/**
 * Busca vagas REAIS exclusivamente de plataformas e comunidades brasileiras.
 * Suporta: Gupy, Nerdin, FrontendBR, BackendBR, DevOps Brasil, Data Science BR e Comunidades BR.
 */
export async function fetchRealJobs(options = {}) {
  const {
    searchTerm = '',
    seniorities = [],
    platforms = ['Gupy', 'Nerdin', 'FrontendBR', 'BackendBR', 'Comunidades BR'],
    workTypeFilter = 'Todos',
    region = 'Todas',
    techArea = 'all',
    forceRefresh = false
  } = options;

  const cacheKey = `${searchTerm.trim().toLowerCase()}_${platforms.sort().join(',')}_${workTypeFilter}_${region}_${techArea}`;
  if (forceRefresh) {
    realJobsCache.delete(cacheKey);
  } else {
    const cached = realJobsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 3 * 60 * 1000)) {
      return cached.data;
    }
  }

  const query = toSearchQuery(searchTerm);

  const regObj = BRAZIL_REGIONS.find(r => r.value === region);
  const gupyState = regObj ? regObj.state : '';

  const sources = [];

  // Gupy Brasil (múltiplas consultas concorrentes para maximizar vagas retornadas)
  if (platforms.includes('Gupy')) {
    sources.push(['Gupy', () => fetchGupy({ query, workplaceType: workTypeFilter, state: gupyState, techArea })]);
  }

  // Nerdin (Portal Brasileiro de Vagas em TI & Tech)
  if (platforms.includes('Nerdin')) {
    sources.push(['Nerdin', () => fetchNerdin({ query, techArea })]);
  }

  // FrontendBR (Comunidade Frontend Brasil - até 100 vagas)
  if (platforms.includes('FrontendBR')) {
    sources.push(['FrontendBR', () => fetchGitHubRepoIssues({ repo: 'frontendbr/vagas', source: 'FrontendBR', query })]);
  }

  // BackendBR (Comunidade Backend Brasil - até 100 vagas)
  if (platforms.includes('BackendBR')) {
    sources.push(['BackendBR', () => fetchGitHubRepoIssues({ repo: 'backend-br/vagas', source: 'BackendBR', query })]);
  }

  // Outras Comunidades de Tecnologia Brasileiras (DevOps, Data Science, Java, QA, etc)
  if (platforms.includes('Comunidades BR')) {
    sources.push(['DevOps Brasil', () => fetchGitHubRepoIssues({ repo: 'devops-brasil/vagas', source: 'DevOps Brasil', query })]);
    sources.push(['Data Science BR', () => fetchGitHubRepoIssues({ repo: 'datascience-br/vagas', source: 'Data Science BR', query })]);
    sources.push(['React Brasil', () => fetchGitHubRepoIssues({ repo: 'react-brasil/vagas', source: 'React Brasil', query })]);
    sources.push(['SouJava', () => fetchGitHubRepoIssues({ repo: 'soujava/vagas-java', source: 'SouJava', query })]);
    sources.push(['FlutterBR', () => fetchGitHubRepoIssues({ repo: 'flutterbr/vagas', source: 'FlutterBR', query })]);
    sources.push(['QA Brasil', () => fetchGitHubRepoIssues({ repo: 'qa-brasil/vagas', source: 'QA Brasil', query })]);
    sources.push(['PHPDevBR', () => fetchGitHubRepoIssues({ repo: 'phpdevbr/vagas', source: 'PHPDevBR', query })]);
    sources.push(['Vue Brasil', () => fetchGitHubRepoIssues({ repo: 'vuejs-br/vagas', source: 'Vue Brasil', query })]);
    sources.push(['Android BR', () => fetchGitHubRepoIssues({ repo: 'androiddevbr/vagas', source: 'Android BR', query })]);
  }

  const results = await Promise.allSettled(sources.map(([, run]) => run()));

  const errors = [];
  const merged = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') merged.push(...r.value);
    else errors.push(`${sources[i][0]}: ${r.reason?.message || 'falhou'}`);
  });

  if (merged.length === 0) {
    let fallback = INITIAL_JOBS.filter(isTechDevJob);
    if (query) {
      const q = query.toLowerCase();
      fallback = fallback.filter(j =>
        (j.title || '').toLowerCase().includes(q) ||
        (j.requirements || []).some(r => r.toLowerCase().includes(q))
      );
    }
    if (techArea && techArea !== 'all') {
      fallback = fallback.filter(j => getJobTechArea(j) === techArea);
    }
    if (workTypeFilter && workTypeFilter !== 'Todos') {
      fallback = fallback.filter(j => j.workType === workTypeFilter);
    }
    return {
      jobs: fallback.length > 0 ? fallback : INITIAL_JOBS.filter(isTechDevJob),
      errors: []
    };
  }

  // Remove duplicatas por ID e por combinação de título + empresa, garantindo ESTRITAMENTE vagas Tech/Dev
  const seen = new Set();
  const unique = merged
    .filter(j => isTechDevJob(j))
    .filter(j => {
      const key = `${(j.title || '').toLowerCase()}|${(j.company || '').toLowerCase()}`;
      if (seen.has(j.id) || seen.has(key)) return false;
      seen.add(j.id);
      seen.add(key);
      return true;
    });

  // Ordena: se um estado específico foi selecionado (ex: SP), vagas do estado aparecem no topo!
  unique.sort((a, b) => {
    if (region && region !== 'Todas') {
      const aMatch = matchesRegion(a, region, false) ? 1 : 0;
      const bMatch = matchesRegion(b, region, false) ? 1 : 0;
      if (bMatch !== aMatch) return bMatch - aMatch;
    }
    return (a.postedHoursAgo || 0) - (b.postedHoursAgo || 0);
  });

  const output = { jobs: unique, errors };
  realJobsCache.set(cacheKey, { timestamp: Date.now(), data: output });

  return output;
}

/**
 * Analisa qualquer vaga a partir de um link (Gupy, LinkedIn, Vagas.com, etc) ou texto manual
 * e prepara a estrutura completa para cálculo de Match e Currículo sob medida com normas ATS.
 */
export async function analyzeJobFromUrlOrText({
  url = '',
  platform = '',
  rawText = '',
  customTitle = '',
  customCompany = ''
}) {
  let title = customTitle.trim();
  let company = customCompany.trim();
  let description = rawText.trim();
  let location = 'Brasil (Remoto / Híbrido)';
  let workType = 'Remoto';
  let targetUrl = url.trim();

  // Se URL foi informada, tenta buscar os dados detalhados via API
  if (targetUrl) {
    try {
      const res = await fetch('/api/analyze-job-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl, platform })
      });
      const data = await res.json();

      if (data.notSupported) {
        throw new Error(data.message);
      }

      if (data.requiresManualText && !description) {
        return {
          requiresManualText: true,
          platform: data.platform || platform,
          suggestedTitle: cleanResumeTitle(data.suggestedTitle) || '',
          suggestedCompany: cleanCompanyName(data.suggestedCompany) || '',
          url: targetUrl,
          message: data.message
        };
      }

      if (data.success && data.job) {
        if (!title && data.job.title) title = cleanResumeTitle(data.job.title);
        if (!company && data.job.company) company = cleanCompanyName(data.job.company);
        if (!description && data.job.description) description = data.job.description;
        if (data.job.location) location = data.job.location;
        if (data.job.workType) workType = data.job.workType;
      } else if (!description && data.message) {
        throw new Error(data.message);
      }
    } catch (e) {
      if (e.message && (e.message.includes('não está na lista') || e.message.includes('plataformas populares'))) {
        throw e;
      }
      if (!description) {
        throw new Error(e.message || 'Não foi possível ler a URL automaticamente. Cole a descrição da vaga manualmente.');
      }
    }
  }

  if (!description && !title) {
    throw new Error('Informe o link ou cole a descrição da vaga para realizar a análise.');
  }

  // Tenta extrair título inteligente se estiver vazio
  if (!title) {
    const lines = description.split('\n').map(l => l.trim()).filter(Boolean);
    title = lines[0] ? lines[0].slice(0, 80) : 'Oportunidade em Tecnologia';
  }

  if (!company) {
    company = platform && platform !== 'Qualquer Plataforma'
      ? `Empresa via ${platform}`
      : (targetUrl.includes('gupy') ? 'Empresa Gupy' : targetUrl.includes('vagas') ? 'Empresa Vagas.com' : 'Empresa Contratante');
  }

  // Detecta formato de trabalho
  const descLower = description.toLowerCase();
  if (/remoto|100% remoto|home office|anywhere/i.test(descLower)) workType = 'Remoto';
  else if (/h[ií]brido/i.test(descLower)) workType = 'Híbrido';
  else if (/presencial/i.test(descLower)) workType = 'Presencial';

  // Extrai tags técnicas e palavras-chave para o algoritmo ATS
  const requirements = extractTechTags(`${title} ${description}`);
  const level = inferLevel(title, description);

  return {
    id: `custom-analyzed-${Date.now()}`,
    isReal: true,
    isBrazilFriendly: true,
    title,
    company,
    companyLogo: 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=100&auto=format&fit=crop&q=80',
    location,
    workType,
    level,
    salary: 'A combinar (CLT/PJ)',
    postedHoursAgo: 1,
    source: platform || (targetUrl.includes('gupy') ? 'Gupy' : targetUrl.includes('vagas') ? 'Vagas.com' : 'Link Direto'),
    url: targetUrl || '',
    requirements,
    description,
    benefits: []
  };
}

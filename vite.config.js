import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
}

function extractJobFromHtml(html, url = '') {
  let job = {
    title: '',
    company: '',
    description: '',
    location: 'Brasil',
    workType: 'Remoto',
    url
  };

  // 1. JSON-LD Schema.org JobPosting
  const ldMatches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis)];
  for (const m of ldMatches) {
    try {
      const decoded = decodeHtmlEntities(m[1].trim());
      const parsed = JSON.parse(decoded);
      const post = parsed['@type'] === 'JobPosting'
        ? parsed
        : (Array.isArray(parsed['@graph']) ? parsed['@graph'].find(x => x && x['@type'] === 'JobPosting') : null);
      if (post) {
        if (post.title) job.title = post.title;
        if (post.hiringOrganization?.name) job.company = post.hiringOrganization.name;
        if (post.description) job.description = post.description;
        if (post.jobLocation?.address?.addressLocality) {
          job.location = `${post.jobLocation.address.addressLocality}, ${post.jobLocation.address.addressRegion || 'BR'}`;
        }
        if (post.employmentType || post.jobLocationType) {
          job.workType = /remote|telecommute/i.test(JSON.stringify(post)) ? 'Remoto' : 'Presencial';
        }
        break;
      }
    } catch (e) { }
  }

  // 2. OpenGraph Meta Tags
  if (!job.title) {
    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (ogTitle) job.title = decodeHtmlEntities(ogTitle[1]);
  }
  if (!job.company) {
    const ogSite = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
    if (ogSite) job.company = decodeHtmlEntities(ogSite[1]);
  }
  if (!job.description) {
    const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    if (ogDesc) job.description = decodeHtmlEntities(ogDesc[1]);
  }

  // 3. HTML Title Tag fallback
  if (!job.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      job.title = decodeHtmlEntities(titleMatch[1]).split(/[-|•–]/)[0].trim();
    }
  }

  // 4. LinkedIn Guest markup selectors
  if (!job.description) {
    const liDescMatch = html.match(/class="[^"]*(?:show-more-less-html__markup|description__text)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)>/i);
    if (liDescMatch) {
      job.description = decodeHtmlEntities(liDescMatch[1]);
    }
  }
  if (!job.title) {
    const liTitleMatch = html.match(/<h[12][^>]*class="[^"]*(?:top-card-layout__title|topcard__title)[^"]*"[^>]*>([\s\S]*?)<\/h[12]>/i);
    if (liTitleMatch) {
      job.title = decodeHtmlEntities(liTitleMatch[1].replace(/<[^>]+>/g, '').trim());
    }
  }
  if (!job.company) {
    const liCompMatch = html.match(/class="[^"]*(?:topcard__org-name-link|topcard__flavor--black-link)[^"]*"[^>]*>([\s\S]*?)<\/(?:a|span)>/i)
      || html.match(/class="[^"]*topcard__flavor[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    if (liCompMatch) {
      job.company = decodeHtmlEntities(liCompMatch[1].replace(/<[^>]+>/g, '').trim());
    }
  }
  if (!job.location || job.location === 'Brasil') {
    const liLocMatch = html.match(/class="[^"]*(?:topcard__flavor--bullet|top-card-layout__second-sub-line)[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    if (liLocMatch) {
      job.location = decodeHtmlEntities(liLocMatch[1].replace(/<[^>]+>/g, '').trim());
    }
  }

  // Limpeza de tags HTML da descrição para texto legível
  job.plainDescription = (job.description || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return job;
}

const SUPPORTED_PLATFORMS_CONFIG = [
  { id: 'gupy', name: 'Gupy', domains: ['gupy.io'] },
  { id: 'glassdoor', name: 'Glassdoor', domains: ['glassdoor.com', 'glassdoor.com.br'] },
  { id: 'linkedin', name: 'LinkedIn', domains: ['linkedin.com'] },
  { id: 'vagas', name: 'Vagas.com', domains: ['vagas.com.br', 'vagas.com'] },
  { id: 'greenhouse', name: 'Greenhouse', domains: ['greenhouse.io'] },
  { id: 'lever', name: 'Lever', domains: ['lever.co'] },
  { id: 'catho', name: 'Catho', domains: ['catho.com.br'] },
  { id: 'infojobs', name: 'InfoJobs', domains: ['infojobs.com.br'] },
  { id: 'programathor', name: 'Programathor', domains: ['programathor.com.br'] },
  { id: 'indeed', name: 'Indeed', domains: ['indeed.com', 'indeed.com.br'] },
  { id: 'nerdin', name: 'Nerdin', domains: ['nerdin.com.br'] },
];

function detectPlatform(url = '') {
  const u = url.toLowerCase();
  for (const p of SUPPORTED_PLATFORMS_CONFIG) {
    if (p.domains.some(d => u.includes(d))) return p.name;
  }
  return null;
}

function parseSlugMetadata(url = '', platform = '') {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;

    // Glassdoor: /job-listing/slug-JV_...htm ou /Job/...
    if (platform === 'Glassdoor' || pathname.includes('job-listing') || pathname.toLowerCase().includes('/job') || pathname.toLowerCase().includes('/vaga')) {
      const match = pathname.match(/\/job-listing\/([^\/]+?)(?:-JV_|\.htm|$)/i)
        || pathname.match(/\/(?:Job|Vaga|vagas|vaga)\/([^\/]+?)(?:-SRCH_|-KO|\.htm|$)/i)
        || pathname.match(/\/([^\/]+?)(?:-JV_|\.htm|$)/i);
      if (match) {
        let clean = match[1].replace(/[-_]+/g, ' ').replace(/\bvagas\b|\bjobs\b/gi, '').trim();
        const words = clean.split(/\s+/).filter(Boolean);
        if (words.length > 2) {
          const atIdx = words.findIndex(w => ['at', 'na', 'em', 'no'].includes(w.toLowerCase()));
          if (atIdx > 0) {
            return {
              title: words.slice(0, atIdx).join(' ').replace(/\b\w/g, c => c.toUpperCase()),
              company: words.slice(atIdx + 1).join(' ').replace(/\b\w/g, c => c.toUpperCase())
            };
          }
          return {
            title: words.slice(0, -1).join(' ').replace(/\b\w/g, c => c.toUpperCase()),
            company: words.slice(-1).join(' ').replace(/\b\w/g, c => c.toUpperCase())
          };
        } else if (words.length > 0) {
          return { title: clean.replace(/\b\w/g, c => c.toUpperCase()), company: 'Empresa no Glassdoor' };
        }
      }
    }

    // LinkedIn: /jobs/view/slug-12345/ ou /jobs/search/?currentJobId=...
    if (platform === 'LinkedIn' || pathname.includes('/jobs/') || url.includes('linkedin.com')) {
      const keywords = parsed.searchParams.get('keywords');
      const match = pathname.match(/\/jobs\/view\/([^\/]+)/i);
      if (match) {
        const raw = match[1].replace(/-\d+$/, '').replace(/-at-/, ' em ');
        let clean = raw.replace(/[-_]+/g, ' ').trim();
        // Se for puramente numérico (apenas o ID da vaga como 4462832829), NÃO usar como título!
        if (/^\d+$/.test(clean)) {
          clean = keywords ? decodeURIComponent(keywords).trim() : '';
        }
        if (clean) {
          const emMatch = clean.split(/\s+em\s+/i);
          if (emMatch.length === 2) {
            return {
              title: emMatch[0].replace(/\b\w/g, c => c.toUpperCase()),
              company: emMatch[1].replace(/\b\w/g, c => c.toUpperCase())
            };
          }
          return { title: clean.replace(/\b\w/g, c => c.toUpperCase()), company: 'Empresa no LinkedIn' };
        }
      }
      if (keywords) {
        return {
          title: decodeURIComponent(keywords).trim().replace(/\b\w/g, c => c.toUpperCase()),
          company: 'Empresa no LinkedIn'
        };
      }
      return { title: '', company: 'Empresa no LinkedIn' };
    }

    // Indeed: /cmp/company/jobs/...
    if (platform === 'Indeed' || pathname.includes('/cmp/')) {
      const match = pathname.match(/\/cmp\/([^\/]+)\/jobs\/([^\/]+)/i);
      if (match) {
        return {
          title: match[2].replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          company: match[1].replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        };
      }
    }

    // Nerdin: /vaga_emprego/vaga-analista-de-testes-manuais-pleno-senior-99694.php
    if (platform === 'Nerdin' || pathname.includes('vaga_emprego')) {
      const match = pathname.match(/vaga-(.*?)-\d+\.php/i) || pathname.match(/vaga_emprego\/(.*?)\.php/i);
      if (match) {
        const words = match[1].replace(/[-_]+/g, ' ').replace(/\bvaga\b/gi, '').trim().split(/\s+/).filter(Boolean);
        return {
          title: words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          company: 'Empresa via Nerdin'
        };
      }
    }
  } catch (e) { }
  return null;
}

const githubIssuesCache = new Map();

function parseNerdinHtml(html) {
  const cards = [];
  const cardRegex = /<div class="vaga-card"[^>]*data-href="([^"]+)"[\s\S]*?(?=<div class="vaga-card"|$)/gi;
  let match;

  while ((match = cardRegex.exec(html)) !== null) {
    const cardHtml = match[0];
    const rawHref = match[1];
    const fullUrl = rawHref.startsWith('http') ? rawHref : `https://www.nerdin.com.br/${rawHref.replace(/^\//, '')}`;

    const idMatch = rawHref.match(/(\d+)\.php/i);
    const id = idMatch ? `nerdin-${idMatch[1]}` : `nerdin-${cards.length + 1}`;

    const titleMatch = cardHtml.match(/<h3 class="vaga-titulo">([\s\S]*?)<\/h3>/i);
    let title = '';
    if (titleMatch) {
      title = decodeHtmlEntities(titleMatch[1].replace(/<span[\s\S]*?<\/span>/gi, '').replace(/<[^>]+>/g, '').trim());
    }

    const compMatch = cardHtml.match(/<span class="vaga-empresa-nome">([\s\S]*?)<\/span>/i);
    const company = compMatch ? decodeHtmlEntities(compMatch[1].replace(/<[^>]+>/g, '').trim()) : 'Empresa via Nerdin';

    const locMatch = cardHtml.match(/<div class="vaga-local-linha">[\s\S]*?<span>([\s\S]*?)<\/span>/i);
    const rawLoc = locMatch ? decodeHtmlEntities(locMatch[1].replace(/<[^>]+>/g, '').trim()) : 'Brasil';

    const resumoMatch = cardHtml.match(/<p class="vaga-resumo-linha">([\s\S]*?)<\/p>/i);
    const resumo = resumoMatch ? decodeHtmlEntities(resumoMatch[1].replace(/<[^>]+>/g, '').trim()) : '';

    const isRemote = /home office|remoto/i.test(rawLoc) || /home office|remoto/i.test(resumo);
    const isHybrid = /híbrido|hibrido/i.test(rawLoc) || /híbrido|hibrido/i.test(resumo);
    const workType = isRemote ? 'Remoto' : (isHybrid ? 'Híbrido' : 'Presencial');
    const location = isRemote ? 'Brasil (Home Office)' : rawLoc;

    let level = 'Pleno';
    if (/júnior|junior|\bjr\b|estágio|estagio|estagi[aá]ri[oa]|trainee|aprendiz|jovem aprendiz|assistente|iniciante|auxiliar|\bi\b|n1/i.test(title) || /júnior|junior|\bjr\b|estágio|estagio|trainee|aprendiz/i.test(resumo)) {
      level = 'Júnior';
    } else if (/sênior|senior|\bsr\b|tech lead|especialista|\biii\b/i.test(title) || /sênior|senior/i.test(resumo)) {
      level = 'Sênior';
    }

    const salMatch = cardHtml.match(/<div class="vaga-salario-destaque">[\s\S]*?<span>([\s\S]*?)<\/span>/i);
    const salary = salMatch ? decodeHtmlEntities(salMatch[1].replace(/<[^>]+>/g, '').trim()) : 'Salário a combinar';

    const timeMatch = cardHtml.match(/<time datetime="([^"]+)"/i);
    const publishedDate = timeMatch ? timeMatch[1] : new Date().toISOString();
    const t = new Date(publishedDate).getTime();
    const postedHoursAgo = !Number.isNaN(t) ? Math.max(0, Math.round((Date.now() - t) / 36e5)) : 2;

    const tags = [...cardHtml.matchAll(/class="hashtag">[\s\S]*?#([^<]+)<\/a>/gi)]
      .map(m => decodeHtmlEntities(m[1]).trim())
      .filter(t => t.length > 1);

    cards.push({
      id,
      isReal: true,
      isBrazilFriendly: true,
      title: title || 'Vaga em Tecnologia',
      company: company || 'Empresa de TI',
      companyLogo: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100&auto=format&fit=crop&q=80',
      location,
      workType,
      level,
      salary: salary || 'A combinar (CLT/PJ)',
      publishedDate,
      postedHoursAgo,
      source: 'Nerdin',
      url: fullUrl,
      requirements: tags.slice(0, 8),
      description: `${title} na empresa ${company}. Modalidade: ${workType} (${location}). Tags técnicas: ${tags.join(', ')}.`,
      benefits: []
    });
  }

  return cards;
}

function jobAnalyzerPlugin() {
  return {
    name: 'job-analyzer-plugin',
    configureServer(server) {
      server.middlewares.use('/api/github-jobs', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
          const parsed = new URL(req.url, 'http://localhost:5173');
          const repo = parsed.searchParams.get('repo');
          if (!repo) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Missing repo parameter' }));
          }

          const cached = githubIssuesCache.get(repo);
          const now = Date.now();
          if (cached && (now - cached.timestamp < 10 * 60 * 1000)) {
            return res.end(JSON.stringify(cached.data));
          }

          const ghUrl = `https://api.github.com/repos/${repo}/issues?state=open&sort=created&direction=desc&per_page=100`;
          const ghRes = await fetch(ghUrl, {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'ia-vagas-app'
            }
          });

          if (ghRes.ok) {
            const data = await ghRes.json();
            githubIssuesCache.set(repo, { timestamp: now, data });
            return res.end(JSON.stringify(data));
          } else {
            if (cached && cached.data) {
              return res.end(JSON.stringify(cached.data));
            }
            return res.end(JSON.stringify([]));
          }
        } catch (e) {
          res.end(JSON.stringify([]));
        }
      });

      const nerdinJobsCache = new Map();

      server.middlewares.use('/api/nerdin-jobs', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
          const parsed = new URL(req.url, 'http://localhost:5173');
          const query = parsed.searchParams.get('query') || '';
          const techArea = parsed.searchParams.get('techArea') || 'all';
          const cacheKey = `nerdin_${query.trim().toLowerCase()}_${techArea}`;
          const now = Date.now();

          const cached = nerdinJobsCache.get(cacheKey);
          if (cached && (now - cached.timestamp < 10 * 60 * 1000)) {
            return res.end(JSON.stringify(cached.data));
          }

          let targetUrl = 'https://www.nerdin.com.br/vagas.php';
          if (query) {
            targetUrl = `https://www.nerdin.com.br/vagas.php?busca=${encodeURIComponent(query.trim())}`;
          } else if (techArea === 'dev') {
            targetUrl = 'https://www.nerdin.com.br/vagas-desenvolvedor-sistemas.php';
          } else if (techArea === 'infra') {
            targetUrl = 'https://www.nerdin.com.br/vagas-infraestrutura-ti.php';
          } else if (techArea === 'data') {
            targetUrl = 'https://www.nerdin.com.br/vagas-area-dados.php';
          } else if (techArea === 'devops') {
            targetUrl = 'https://www.nerdin.com.br/vagas.php?busca=devops';
          } else if (techArea === 'support') {
            targetUrl = 'https://www.nerdin.com.br/vagas.php?busca=suporte';
          } else if (techArea === 'qa') {
            targetUrl = 'https://www.nerdin.com.br/vagas.php?busca=qa';
          } else if (techArea === 'security') {
            targetUrl = 'https://www.nerdin.com.br/vagas.php?busca=seguranca';
          }

          const nerdinRes = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'pt-BR,pt;q=0.9'
            }
          });

          if (!nerdinRes.ok) {
            if (cached && cached.data) return res.end(JSON.stringify(cached.data));
            return res.end(JSON.stringify([]));
          }

          const html = await nerdinRes.text();
          const parsedJobs = parseNerdinHtml(html);
          nerdinJobsCache.set(cacheKey, { timestamp: now, data: parsedJobs });
          return res.end(JSON.stringify(parsedJobs));
        } catch (e) {
          res.end(JSON.stringify([]));
        }
      });

      server.middlewares.use('/api/analyze-job-url', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
          let url = '';
          let platform = '';

          if (req.method === 'POST') {
            const buffers = [];
            for await (const chunk of req) buffers.push(chunk);
            const body = JSON.parse(Buffer.concat(buffers).toString());
            url = body.url || '';
            platform = body.platform || '';
          } else {
            const parsedUrl = new URL(req.url, 'http://localhost:5173');
            url = parsedUrl.searchParams.get('url') || '';
            platform = parsedUrl.searchParams.get('platform') || '';
          }

          if (!url) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ success: false, message: 'URL da vaga não informada.' }));
          }

          // Validação dos sites populares suportados
          const detectedPlat = detectPlatform(url) || platform;
          if (!detectedPlat) {
            return res.end(JSON.stringify({
              success: false,
              notSupported: true,
              message: 'Este site não está na lista de plataformas populares suportadas (Gupy, Glassdoor, LinkedIn, Vagas.com, Catho, InfoJobs, Programathor, Greenhouse, Lever ou Indeed). Use a aba "Colar Texto / Descrição Manual" para analisar qualquer vaga!'
            }));
          }

          platform = detectedPlat;

          // Se for Glassdoor ou LinkedIn, verificar slug antes
          const slugMeta = parseSlugMetadata(url, platform);

          // Se for LinkedIn e tiver jobId numérico, tentar montar URL canônica pública de visualização
          let targetFetchUrl = url;
          if (platform === 'LinkedIn') {
            const idMatch = url.match(/(?:currentJobId=|\/jobs\/view\/)(\d+)/i);
            if (idMatch) {
              targetFetchUrl = `https://www.linkedin.com/jobs/view/${idMatch[1]}`;
            }
          }

          // Tenta buscar a página diretamente via Node.js
          let fetchRes = null;
          try {
            fetchRes = await fetch(targetFetchUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://www.google.com/'
              }
            });
          } catch (e) {
            // Falha de rede ou DNS
          }

          // Se a plataforma retornou 403, 429 ou erro de proteção
          if (!fetchRes || !fetchRes.ok || [403, 429, 999].includes(fetchRes.status)) {
            return res.end(JSON.stringify({
              success: true,
              requiresManualText: true,
              platform,
              suggestedTitle: slugMeta?.title || '',
              suggestedCompany: slugMeta?.company || `Empresa via ${platform}`,
              url,
              message: `${platform} detectado com sucesso! Cole o texto da vaga no campo abaixo (Ctrl+V) para a IA gerar o currículo ATS com máxima precisão.`
            }));
          }

          const html = await fetchRes.text();
          const extracted = extractJobFromHtml(html, url);

          // Se a extração falhou mas temos slug metadata
          if (!extracted.title && !extracted.plainDescription) {
            return res.end(JSON.stringify({
              success: true,
              requiresManualText: true,
              platform,
              suggestedTitle: slugMeta?.title || '',
              suggestedCompany: slugMeta?.company || 'Empresa Contratante',
              url,
              message: `${platform} detectado! Cole o texto da vaga no campo abaixo para prosseguir com a análise ATS.`
            }));
          }

          return res.end(JSON.stringify({
            success: true,
            requiresManualText: false,
            job: {
              title: extracted.title || slugMeta?.title || 'Vaga em Análise',
              company: extracted.company || slugMeta?.company || `Empresa via ${platform}`,
              location: extracted.location || 'Brasil',
              workType: extracted.workType || 'Remoto',
              description: extracted.plainDescription || extracted.description,
              url,
              platform
            }
          }));
        } catch (err) {
          return res.end(JSON.stringify({
            success: false,
            message: `Erro na leitura: ${err.message}`
          }));
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), jobAnalyzerPlugin()],
  server: {
    proxy: {
      // Proxy para API de vagas da Gupy no Brasil
      '/api/gupy': {
        target: 'https://portal.gupy.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gupy/, '/api/job-search/jobs'),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      },
    },
  },
})


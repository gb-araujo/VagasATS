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
    } catch(e) {}
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let url = '';
    let platform = '';

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      url = body.url || '';
      platform = body.platform || '';
    } else {
      const parsedUrl = new URL(req.url, 'http://localhost');
      url = parsedUrl.searchParams.get('url') || '';
      platform = parsedUrl.searchParams.get('platform') || '';
    }

    if (!url) {
      return res.status(400).json({ success: false, message: 'URL da vaga não informada.' });
    }

    const detectedPlat = detectPlatform(url) || platform;
    if (!detectedPlat) {
      return res.status(200).json({
        success: false,
        notSupported: true,
        message: 'Este site não está na lista de plataformas populares suportadas. Use a aba "Colar Texto / Descrição Manual" para analisar qualquer vaga!'
      });
    }

    platform = detectedPlat;

    let fetchRes = null;
    try {
      fetchRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Referer': 'https://www.google.com/'
        }
      });
    } catch(e) {}

    if (!fetchRes || !fetchRes.ok || [403, 429, 999].includes(fetchRes.status)) {
      return res.status(200).json({
        success: true,
        requiresManualText: true,
        platform,
        url,
        message: `${platform} detectado com sucesso! Cole o texto da vaga no campo abaixo (Ctrl+V) para a IA gerar o currículo ATS com máxima precisão.`
      });
    }

    const html = await fetchRes.text();
    const extracted = extractJobFromHtml(html, url);

    if (!extracted.title && !extracted.plainDescription) {
      return res.status(200).json({
        success: true,
        requiresManualText: true,
        platform,
        url,
        message: `${platform} detectado! Cole o texto da vaga no campo abaixo para prosseguir com a análise ATS.`
      });
    }

    return res.status(200).json({
      success: true,
      requiresManualText: false,
      job: {
        title: extracted.title || 'Vaga em Análise',
        company: extracted.company || `Empresa via ${platform}`,
        location: extracted.location || 'Brasil',
        workType: extracted.workType || 'Remoto',
        description: extracted.plainDescription || extracted.description,
        url,
        platform
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: `Erro na leitura: ${err.message}`
    });
  }
}

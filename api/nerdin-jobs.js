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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const query = url.searchParams.get('query') || '';
    const techArea = url.searchParams.get('techArea') || 'all';

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
    }

    const nerdinRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9'
      }
    });

    if (!nerdinRes.ok) {
      return res.status(200).json([]);
    }

    const html = await nerdinRes.text();
    const parsedJobs = parseNerdinHtml(html);
    return res.status(200).json(parsedJobs);
  } catch(e) {
    return res.status(200).json([]);
  }
}

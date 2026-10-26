import { jsPDF } from 'jspdf';

/**
 * Limpa títulos de vagas excessivamente longos para cabeçalhos de currículo,
 * removendo disclaimers afirmativos, modelos de contratação, bancos de talentos e tags de local.
 */
export function cleanResumeTitle(rawTitle = '') {
  if (!rawTitle) return '';
  let cleaned = String(rawTitle).trim();

  // 1. Remove parênteses e colchetes com informações afirmativas, PCD, contrato ou modelo
  cleaned = cleaned.replace(/\s*\((?:vaga\s+)?(?:afirmativa|exclusiv[ao]|pcd|mulheres|negros|pret[ao]s|pessoas|remoto|h[ií]brido|presencial|clt|pj|banco de talentos|est[aá]gio)[^)]*\)/gi, '');
  cleaned = cleaned.replace(/\s*\[(?:vaga\s+)?(?:afirmativa|exclusiv[ao]|pcd|mulheres|negros|pret[ao]s|pessoas|remoto|h[ií]brido|presencial|clt|pj|banco de talentos|est[aá]gio)[^\]]*\]/gi, '');

  // 2. Remove caudas após "|" ou "/" ou " - " que contenham slogans afirmativos, diversidade ou banco de talentos
  cleaned = cleaned.replace(/\s*\|\s*(?:vaga\s+afirmativa|afirmativa|exclusiv[ao]|pessoas|pcd|mulheres|lgbt|pretx|pret[ao]s|diversidade|banco de talentos|100%|remoto|h[ií]brido|presencial|clt|pj).*$/i, '');
  cleaned = cleaned.replace(/\s*[-–—]\s*(?:vaga\s+afirmativa|afirmativa|exclusiv[ao]|pessoas|pcd|mulheres|lgbt|pretx|pret[ao]s|diversidade|banco de talentos|100%\s*remoto).*$/i, '');
  cleaned = cleaned.replace(/\s*[-–—]\s*(?:100%\s*)?(?:remoto|h[ií]brido|presencial)\s*$/i, '');

  // 3. Se ainda sobrou algum separador de cauda como " | " com mais de 2 partes
  if (cleaned.includes(' | ')) {
    const parts = cleaned.split(' | ');
    if (parts[0] && parts[0].length >= 5) {
      cleaned = parts[0].trim();
    }
  }

  // 4. Limpeza de pontuação e traços soltos nas bordas
  cleaned = cleaned.replace(/[-–—|/,\s]+$/, '').replace(/^[-–—|/,\s]+/, '').trim();

  return sanitizePdfText(cleaned) || rawTitle;
}

/**
 * Limpa nomes de empresas para currículos e resumos ATS,
 * convertendo slogans de campanhas de contratação (ex: "VENHA SER #SANGUELARANJA") em nomes corporativos reais (ex: "Banco Inter"),
 * removendo hashtags, emojis e prefixos publicitários.
 */
export function cleanCompanyName(rawCompany = '') {
  if (!rawCompany) return '';
  let cleaned = String(rawCompany).trim();

  // 1. Dicionário de slogans conhecidos de empresas brasileiras
  const lower = cleaned.toLowerCase();
  if (lower.includes('sanguelaranja') || lower.includes('sangue laranja')) return 'Banco Inter';
  if (lower.includes('vem pra stone') || lower.includes('vem ser stone')) return 'Stone';
  if (lower.includes('vem ser ambev') || lower.includes('ambev tech')) return 'Ambev';
  if (lower.includes('vem ser totver') || lower.includes('totver')) return 'TOTVS';
  if (lower.includes('vem ser nubank') || lower.includes('sangueroxo') || lower.includes('sangue roxo')) return 'Nubank';
  if (lower.includes('vem ser mercado livre') || lower.includes('meli') || lower.includes('mercadolivre')) return 'Mercado Livre';
  if (lower.includes('vem ser globo')) return 'Globo';
  if (lower.includes('vem ser itau') || lower.includes('vem ser itaú') || lower.includes('vem pro itau')) return 'Itaú';
  if (lower.includes('vem pra claro') || lower.includes('vem ser claro')) return 'Claro';
  if (lower.includes('vem ser vivo') || lower.includes('vem pra vivo')) return 'Vivo';
  if (lower.includes('vem ser tim') || lower.includes('vem pra tim')) return 'TIM';
  if (lower.includes('vem ser cielo')) return 'Cielo';
  if (lower.includes('vem ser pagseguro') || lower.includes('vem pro pagbank')) return 'PagBank';
  if (lower.includes('vem ser picpay')) return 'PicPay';
  if (lower.includes('vem pro c6') || lower.includes('vem ser c6')) return 'C6 Bank';
  if (lower.includes('vem ser btg')) return 'BTG Pactual';
  if (lower.includes('vem ser bradesco')) return 'Bradesco';
  if (lower.includes('vem ser santander')) return 'Santander';
  if (lower.includes('vem ser luiza') || lower.includes('luizalabs')) return 'LuizaLabs';
  if (lower.includes('vem ser ifood')) return 'iFood';
  if (lower.includes('vem ser quintoandar') || lower.includes('vem pro quintoandar')) return 'QuintoAndar';

  // 2. Remove emojis e pares substitutos UTF-16
  cleaned = cleaned.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '');
  cleaned = cleaned.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');
  cleaned = cleaned.replace(/[\uD800-\uDFFF]/g, '');

  // 3. Remove prefixos promocionais de vagas (ex: "Venha ser", "Vem pra", "Trabalhe na", etc.)
  cleaned = cleaned.replace(/^(?:venha|vem)\s+(?:ser|pra|para|fazer\s+parte(?:\s+d[eoa]s?)?)\s+(?:o|a|um|uma|nosso\s+time(?:\s+d[eoa]s?)?)?\s*/i, '');
  cleaned = cleaned.replace(/^(?:trabalhe|carreira[s]?|oportunidade[s]?)\s+(?:n[ao]|na|no|em)\s+/i, '');
  cleaned = cleaned.replace(/^(?:banco\s+de\s+talentos(?:\s*[-–—|:]\s*)?)/i, '');

  // 4. Remove hashtags e menções
  cleaned = cleaned.replace(/#\w+/g, '').replace(/@\w+/g, '');

  // 5. Remove tags entre parênteses como "(Remoto)", "(Brasil)", "(TI)", "(Afirmativa)"
  cleaned = cleaned.replace(/\s*\((?:vaga|remoto|h[ií]brido|presencial|brasil|sp|rj|mg|ti|tech|exclusiv[ao]|afirmati[va])[^)]*\)/gi, '');

  // 6. Remove caudas após "|" ou " - " com slogans
  cleaned = cleaned.replace(/\s*[|/]\s*.*$/, '');
  cleaned = cleaned.replace(/\s*[-–—]\s*(?:vaga|remoto|tecnologia|brasil).*$/i, '');

  // 7. Limpeza de pontuação nas bordas e espaços múltiplos
  cleaned = cleaned.replace(/[-–—|/,\s]+$/, '').replace(/^[-–—|/,\s]+/, '').replace(/\s{2,}/g, ' ').trim();

  return sanitizePdfText(cleaned) || 'Empresa Confidencial';
}

/**
 * Sanitiza texto para renderização segura no jsPDF com fontes padrão (WinAnsi / Latin-1).
 * Elimina emojis e caracteres especiais que geram corrupção de bytes (como 'Ø>ÝáØ=Þ€'),
 * normaliza aspas, travessões, quebras de linha e preserva 100% da acentuação da língua portuguesa.
 */
export function sanitizePdfText(text = '') {
  if (typeof text !== 'string') return '';
  if (!text) return '';

  let sanitized = text;

  // 1. Substitui caracteres tipográficos complexos por equivalentes padrão Latin-1
  sanitized = sanitized
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')   // Aspas curvas duplas
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")   // Aspas curvas simples
    .replace(/[\u2013\u2014\u2015]/g, '-')         // Meia-risca e travessão
    .replace(/\u2026/g, '...')                     // Reticências
    .replace(/\u00A0/g, ' ')                       // Espaço inquebrável
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')    // Zero-width spaces
    .replace(/[\t\r]/g, ' ');

  // 2. Remove emojis (tanto formato Unicode moderno quanto pares substitutos UTF-16)
  sanitized = sanitized.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '');
  sanitized = sanitized.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');
  sanitized = sanitized.replace(/[\uD800-\uDFFF]/g, '');

  // 3. Remove caracteres fora do intervalo Latin-1 seguro do jsPDF (\x20-\x7E e \xA0-\xFF)
  // Preserva totalmente acentos em português: á, é, í, ó, ú, à, ã, õ, ç, ê, ô, etc.
  sanitized = sanitized.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ');

  // 4. Normaliza espaços múltiplos mantendo quebras de linha
  sanitized = sanitized.replace(/[ ]{2,}/g, ' ');

  return sanitized.trim();
}

/**
 * Service to generate high-resolution ATS-friendly PDF Resumes
 */
export function exportResumeToPDF(tailoredResume, templateStyle = 'modern') {
  const doc = buildResumePDF(tailoredResume, templateStyle);
  doc.save(getResumeFileName(tailoredResume));
}

/**
 * Nome de arquivo padronizado do currículo (usado no download e nos anexos do robô)
 */
export function getResumeFileName(tailoredResume) {
  const isEn = tailoredResume.language === 'en';
  const safeName = (tailoredResume.fullName || "Curriculo").trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeCompany = (cleanCompanyName(tailoredResume.targetCompany) || "Vaga").trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${isEn ? 'Resume' : 'Curriculo'}_${safeName}_${safeCompany}.pdf`;
}

/**
 * Monta o documento jsPDF do currículo sem salvar (funciona no navegador e no Node)
 */
export function buildResumePDF(tailoredResume, templateStyle = 'modern') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const margin = 15;
  let y = 18;

  // Primary Theme Colors
  const primaryColor = templateStyle === 'executive' ? [30, 58, 138] : [37, 99, 235]; // Blue
  const textColor = [31, 41, 55]; // Gray-800
  const secondaryTextColor = [75, 85, 99]; // Gray-600

  const isEn = tailoredResume.language === 'en';

  // 1. Header (Name & Target Role)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...primaryColor);
  doc.text(sanitizePdfText(tailoredResume.fullName || "Lucas Silva Pessoa"), margin, y);
  y += 7;

  // Clean and wrap the Target Job Title so it NEVER overflows the PDF width
  const rawRole = tailoredResume.targetJobTitle || (isEn ? "Professional Resume" : "Curriculo Profissional");
  const cleanTitle = cleanResumeTitle(rawRole);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(75, 85, 99);
  const titleLines = doc.splitTextToSize(cleanTitle.toUpperCase(), pageWidth - (margin * 2));
  doc.text(titleLines, margin, y);
  y += (titleLines.length * 4.8) + 1.5;

  // Contact Info Line (wrapped safely to fit printable area)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...secondaryTextColor);
  const contactText = [
    tailoredResume.email,
    tailoredResume.phone,
    tailoredResume.location,
    tailoredResume.linkedin
  ].filter(Boolean).map(sanitizePdfText).join("  |  ");

  const contactLines = doc.splitTextToSize(contactText, pageWidth - (margin * 2));
  doc.text(contactLines, margin, y);
  y += (contactLines.length * 4) + 2.5;

  // Divider Line
  doc.setDrawColor(229, 231, 235); // Light border
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6.5;

  // Helper for Section Titles
  function addSectionHeader(title) {
    if (y > 265) {
      doc.addPage();
      y = 18;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...primaryColor);
    doc.text(title.toUpperCase(), margin, y);

    // Underline accent
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.6);
    doc.line(margin, y + 1.5, margin + 25, y + 1.5);

    y += 7;
  }

  // 2. Summary Section
  addSectionHeader(isEn ? "Professional Summary" : "Resumo Profissional");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...textColor);

  const rawSummary = tailoredResume.tailoredSummary || "";
  const paragraphs = rawSummary.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  if (paragraphs.length > 0) {
    paragraphs.forEach((paragraph) => {
      if (y > 265) {
        doc.addPage();
        y = 18;
      }
      const safeP = sanitizePdfText(paragraph);
      const pLines = doc.splitTextToSize(safeP, pageWidth - (margin * 2));
      doc.text(pLines, margin, y);
      y += (pLines.length * 4.4) + 3;
    });
  } else {
    const safeSummary = sanitizePdfText(rawSummary);
    const summaryLines = doc.splitTextToSize(safeSummary, pageWidth - (margin * 2));
    doc.text(summaryLines, margin, y);
    y += (summaryLines.length * 4.4) + 3;
  }
  y += 2;

  // 3. Technical Skills Section
  addSectionHeader(isEn ? "Technical Skills" : "Habilidades Tecnicas");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...textColor);

  const skillsList = Array.isArray(tailoredResume.skills) ? tailoredResume.skills : [];
  const skillsStr = skillsList.map(sanitizePdfText).filter(Boolean).join("  |  ");
  const skillsLines = doc.splitTextToSize(skillsStr, pageWidth - (margin * 2));
  doc.text(skillsLines, margin, y);
  y += (skillsLines.length * 4.5) + 4;

  // 4. Work Experience Section
  addSectionHeader(isEn ? "Professional Experience" : "Experiencia Profissional");

  (tailoredResume.experiences || []).forEach((exp) => {
    if (y > 255) {
      doc.addPage();
      y = 18;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.text(sanitizePdfText(exp.role || (isEn ? "Role" : "Cargo")), margin, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...secondaryTextColor);
    const cleanPeriod = sanitizePdfText((exp.period || "").replace(/^\((.*)\)$/, "$1"));
    const cleanCompany = cleanCompanyName(exp.company) || (isEn ? 'Company' : 'Empresa');
    doc.text(`${cleanCompany}  ${cleanPeriod ? `• ${cleanPeriod}` : ''}`, pageWidth - margin, y, { align: "right" });
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);

    // Render bullets individually with strict deduplication and clean vector bullet circle
    const rawBullets = Array.isArray(exp.bullets) && exp.bullets.length > 0
      ? exp.bullets
      : (exp.description || "").split('\n').filter(Boolean);

    const seenPdfBullets = new Set();

    rawBullets.forEach((bullet) => {
      const cleanB = sanitizePdfText(bullet.replace(/^[•\-\s]+/, '').trim());
      if (!cleanB) return;

      // Anti-duplication check: ignore if identical bullet was already rendered
      const normKey = cleanB.toLowerCase().replace(/[^a-z0-9áéíóúãõç]/gi, '');
      if (!normKey || seenPdfBullets.has(normKey)) return;
      seenPdfBullets.add(normKey);

      if (y > 270) {
        doc.addPage();
        y = 18;
      }

      // Draw clean vector bullet circle
      doc.setFillColor(...primaryColor);
      doc.circle(margin + 2, y - 1, 0.7, 'F');

      const bulletLines = doc.splitTextToSize(cleanB, pageWidth - (margin * 2) - 6);
      doc.text(bulletLines, margin + 5.5, y);
      y += (bulletLines.length * 4.2) + 1.8;
    });

    y += 2.5;
  });

  // 5. Education & Languages
  if (tailoredResume.education && tailoredResume.education.length > 0) {
    addSectionHeader(isEn ? "Education" : "Formacao Academica");
    tailoredResume.education.forEach((edu) => {
      if (y > 265) {
        doc.addPage();
        y = 18;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...textColor);
      doc.text(sanitizePdfText(edu.degree || ""), margin, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...secondaryTextColor);
      const safeInst = sanitizePdfText(edu.institution || '');
      const safeYear = sanitizePdfText(edu.year ? `(${edu.year})` : '');
      doc.text(`${safeInst} ${safeYear}`.trim(), pageWidth - margin, y, { align: "right" });
      y += 5;
    });
  }

  if (tailoredResume.languages && tailoredResume.languages.length > 0) {
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...primaryColor);
    doc.text(isEn ? "LANGUAGES: " : "IDIOMAS: ", margin, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    const langStrings = tailoredResume.languages.map(l => {
      if (!l) return '';
      if (typeof l === 'string') return sanitizePdfText(l);
      const safeName = sanitizePdfText(l.name || '');
      const safeLevel = sanitizePdfText(l.level || '');
      return safeLevel ? `${safeName} (${safeLevel})` : safeName;
    }).filter(Boolean);
    doc.text(langStrings.join("  |  "), margin + (isEn ? 25 : 22), y);
    y += 6;
  }

  // PDF 100% limpo, sem marcas d'água ou rodapé de IA
  return doc;
}


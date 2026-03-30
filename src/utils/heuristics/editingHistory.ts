type Lang = 'ru' | 'en' | 'uz';

export interface EditingAnalysis {
  edited: boolean;
  software: string[];
  editingLevel: 'none' | 'basic' | 'professional';
  hints: string[];
  isAiGenerated: boolean;
  aiTool: string | null;
}

interface SoftwareProfile {
  level: 'none' | 'basic' | 'professional';
  hint: Record<Lang, string>;
}

const SOFTWARE_PROFILES: Record<string, SoftwareProfile> = {
  'Adobe Photoshop': { level: 'professional', hint: { ru: 'Профессиональный редактор изображений', en: 'Professional image editor', uz: 'Professional rasm muharriri' } },
  'Adobe Lightroom': { level: 'professional', hint: { ru: 'Обработка RAW — вероятно, фотограф', en: 'RAW processing — likely a photographer', uz: 'RAW ishlov berish — fotograf' } },
  'Capture One': { level: 'professional', hint: { ru: 'Инструмент коммерческих фотографов', en: 'Commercial photography tool', uz: 'Professional fotograf vositasi' } },
  'Affinity Photo': { level: 'professional', hint: { ru: 'Профессиональная обработка', en: 'Professional editing', uz: 'Professional tahrirlash' } },
  'GIMP': { level: 'professional', hint: { ru: 'Открытый редактор — технически подкованный пользователь', en: 'Open-source editor — technically savvy user', uz: 'Ochiq kodli muharrir' } },
  'DaVinci Resolve': { level: 'professional', hint: { ru: 'Кадр из видеоредактора — видеограф', en: 'Video editor frame — videographer', uz: 'Video muharriri kadri' } },
  'Snapseed': { level: 'basic', hint: { ru: 'Мобильная обработка перед публикацией', en: 'Mobile editing before publishing', uz: 'Nashr oldidan mobil tahrirlash' } },
  'VSCO': { level: 'basic', hint: { ru: 'Мобильные фильтры — типично для Instagram', en: 'Mobile filters — typical for Instagram', uz: 'Mobil filtrlar — Instagram uchun' } },
  'PicsArt': { level: 'basic', hint: { ru: 'Мобильный фоторедактор с эффектами', en: 'Mobile photo editor with effects', uz: 'Effektli mobil foto muharriri' } },
  'Photos': { level: 'basic', hint: { ru: 'Стандартное приложение Apple', en: 'Apple Photos app', uz: 'Apple Photos ilovasi' } },
  'Google Photos': { level: 'basic', hint: { ru: 'Обработка в Google Photos — данные в облаке Google', en: 'Google Photos — data in Google cloud', uz: 'Google Photos — ma\'lumotlar bulutda' } },
  'Samsung Gallery': { level: 'basic', hint: { ru: 'Стандартный редактор Samsung', en: 'Samsung default editor', uz: 'Samsung standart muharriri' } },
  'Remini': { level: 'basic', hint: { ru: 'AI-апскейлер — оригинал низкого качества', en: 'AI upscaler — original was low quality', uz: 'AI upskeyler — asl sifat past' } },
  'Topaz': { level: 'professional', hint: { ru: 'Профессиональный AI-апскейлинг', en: 'Professional AI upscaling', uz: 'Professional AI upskeyling' } },
};

// AI generation markers found in XMP/EXIF
const AI_MARKERS: Array<{ pattern: RegExp; tool: string }> = [
  { pattern: /stable.?diffusion/i, tool: 'Stable Diffusion' },
  { pattern: /midjourney/i, tool: 'Midjourney' },
  { pattern: /dall.?e/i, tool: 'DALL-E' },
  { pattern: /firefly/i, tool: 'Adobe Firefly' },
  { pattern: /comfyui/i, tool: 'ComfyUI' },
  { pattern: /automatic1111|a1111/i, tool: 'Automatic1111' },
  { pattern: /novelai/i, tool: 'NovelAI' },
  { pattern: /\bflux\b/i, tool: 'Flux' },
  { pattern: /ai_type/i, tool: 'AI (unknown)' },
  { pattern: /dream\s?studio/i, tool: 'DreamStudio' },
  { pattern: /leonardo\.ai/i, tool: 'Leonardo.AI' },
  { pattern: /runway/i, tool: 'Runway' },
];

export function analyzeEditingHistory(
  metadata: Record<string, unknown>,
  xmp: Record<string, unknown>,
  lang: Lang
): EditingAnalysis {
  const softwareSources = [
    metadata.Software ?? metadata.software,
    xmp.CreatorTool ?? xmp.creatorTool,
    xmp.Creator ?? xmp.creator,
  ].filter(Boolean).map(String);

  const allText = softwareSources.join(' ');
  const foundSoftware: string[] = [];
  const hints: string[] = [];
  let maxLevel: 'none' | 'basic' | 'professional' = 'none';

  for (const [name, profile] of Object.entries(SOFTWARE_PROFILES)) {
    if (allText.toLowerCase().includes(name.toLowerCase())) {
      foundSoftware.push(name);
      hints.push(profile.hint[lang]);
      if (profile.level === 'professional') maxLevel = 'professional';
      else if (profile.level === 'basic' && maxLevel === 'none') maxLevel = 'basic';
    }
  }

  // Check for unknown software not in the dictionary
  for (const sw of softwareSources) {
    const known = Object.keys(SOFTWARE_PROFILES).some(k => sw.toLowerCase().includes(k.toLowerCase()));
    if (!known && sw.length > 1) {
      foundSoftware.push(sw);
    }
  }

  // AI generation detection
  let isAiGenerated = false;
  let aiTool: string | null = null;

  const xmpStr = JSON.stringify(xmp).toLowerCase();
  const searchText = [...softwareSources, xmpStr].join(' ');
  for (const marker of AI_MARKERS) {
    if (marker.pattern.test(searchText)) {
      isAiGenerated = true;
      aiTool = marker.tool;
      break;
    }
  }

  // Check XMP for explicit AI markers
  if (!isAiGenerated && (xmpStr.includes('"ai_type"') || xmpStr.includes('"source":"ai"') || xmpStr.includes('generative'))) {
    isAiGenerated = true;
    aiTool = 'AI (unknown)';
  }

  return {
    edited: foundSoftware.length > 0,
    software: foundSoftware,
    editingLevel: maxLevel,
    hints,
    isAiGenerated,
    aiTool,
  };
}

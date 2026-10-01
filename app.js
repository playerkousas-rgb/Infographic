const STORAGE_KEY = 'frame-canvas-workspace-v2';
const TEMPLATES_KEY = 'frame-canvas-templates-v1';
const API_KEY_SESSION_KEY = 'frame-canvas-api-key-session-v1';
const DEFAULT_API_HEADERS = `{
  "Content-Type": "application/json",
  "Authorization": "Bearer {{api_key}}"
}`;
const DEFAULT_API_BODY = `{
  "model": "{{model}}",
  "temperature": 0.2,
  "response_format": { "type": "json_object" },
  "messages": [
    { "role": "system", "content": "{{system_prompt}}" },
    { "role": "user", "content": "請依指令完成以下資訊圖版位，回傳完整 JSON：\\n\\n{{payload}}" }
  ]
}`;
const DEFAULT_API_SETTINGS = {
  preset: 'openai-compatible',
  endpoint: 'https://api.openai.com/v1/chat/completions',
  method: 'POST',
  model: 'gpt-4.1-mini',
  headersTemplate: DEFAULT_API_HEADERS,
  bodyTemplate: DEFAULT_API_BODY,
  responsePath: 'choices.0.message.content',
  timeoutSeconds: 120,
  rememberKey: false,
};

const PALETTES = {
  citrus: { name: '柑橘暖光', background: '#FFF6E9', paper: '#FFFAF2', ink: '#27382F', muted: '#738078', accent: '#DE785B', secondary: '#E7B361', tint: '#F4E4D1' },
  botanical: { name: '植感日常', background: '#EFF2E7', paper: '#FAF9EF', ink: '#2C4034', muted: '#748276', accent: '#6D866B', secondary: '#CD8C65', tint: '#DCE6D2' },
  midnight: { name: '莓果夜色', background: '#202F29', paper: '#2B3B33', ink: '#F4F0E3', muted: '#B4C0B2', accent: '#D7ED78', secondary: '#EFA486', tint: '#35473D' },
};

const ART_STYLES = {
  editorial: { name: '編輯刊物', description: '清楚的網格、俐落細線、有層次的刊物排版' },
  soft: { name: '柔和插畫', description: '溫和插畫感、圓潤區塊、親切的生活風格' },
  minimal: { name: '極簡留白', description: '大量留白、細描邊、克制裝飾與精簡排版' },
};

const RATIOS = {
  '4:5': { width: 1080, height: 1350, label: '直式貼文' },
  '1:1': { width: 1080, height: 1080, label: '方形貼文' },
  '9:16': { width: 1080, height: 1920, label: '限時動態' },
};

const TYPE_META = {
  label: { name: '識別標籤', icon: 'Aa', role: '系列標籤' },
  heading: { name: '標題', icon: 'T', role: '主標題' },
  text: { name: '文字', icon: '≡', role: '補充說明' },
  image: { name: '圖片', icon: '▧', role: '主視覺圖片' },
  stat: { name: '數據', icon: '#', role: '關鍵數據' },
  steps: { name: '步驟', icon: '↟', role: '操作步驟' },
  chart: { name: '圖表', icon: '▥', role: '資料圖表' },
};

function makeBlock(id, type, role, position, content, taskMode = 'provided', instruction = '') {
  return {
    id,
    type,
    role,
    position: { ...position, z: 1 },
    content,
    task: { mode: taskMode, instruction, query: '', source_preference: 'official', require_citations: true, data_source: 'project_context' },
    style: { align: 'left', font_size: 'medium', fill: 'none' },
  };
}

function sampleBlocks() {
  return [
    makeBlock('slot-kicker', 'label', '系列識別標籤', { x: 7, y: 5, w: 65, h: 6 }, { text: 'DAILY WELLNESS  /  生活提案' }),
    makeBlock('slot-title', 'heading', '主標題', { x: 7, y: 12, w: 86, h: 16 }, { text: '喝水這件事\n可以更剛好' }, 'provided', '保留簡潔、有記憶點的主標題，避免誇大健康效果。'),
    makeBlock('slot-intro', 'text', '一句話引言', { x: 8, y: 29, w: 82, h: 8 }, { text: '補水不必硬背 8 杯，讓喝水自然融入日常節奏。' }, 'summarize', '從整體資料中整理一句 35 字以內的引言。'),
    makeBlock('slot-hero-image', 'image', '主視覺圖片', { x: 8, y: 39, w: 84, h: 25 }, { prompt: '晨光照進窗邊，一只透明玻璃水杯與一片檸檬，清爽生活風格編輯插畫，暖白留白背景，無文字。', alt_text: '窗邊的玻璃水杯與檸檬', asset_url: '' }, 'image', '依據圖卡主題生成一張無文字的主視覺，避免在圖片內生成任何標題。'),
    makeBlock('slot-stat', 'stat', '關鍵數據', { x: 8, y: 67, w: 39, h: 14 }, { value: '8 杯', label: '日常飲水參考', description: '實際需求依個人狀況調整' }, 'research', '查找可信賴的飲水建議，說明「8 杯」只能作為參考，不得當成人人適用的醫療建議。'),
    makeBlock('slot-steps', 'steps', '行動步驟', { x: 50, y: 67, w: 42, h: 21 }, { title: '讓喝水變簡單', steps: ['起床先喝一杯', '每小時補充幾口', '睡前避免大量飲水'] }, 'research', '查核一般生活補水習慣，整理成三個簡短、可執行的行動步驟。'),
    makeBlock('slot-footer', 'text', '頁尾提醒', { x: 8, y: 90, w: 84, h: 6 }, { text: '傾聽身體訊號，找到適合自己的補水節奏。' }, 'provided', '沿用使用者提供的語氣與重點，不新增承諾。'),
  ];
}

function defaultState() {
  return {
    projectName: '每日補水指南',
    ratio: '4:5',
    palette: 'citrus',
    artStyle: 'editorial',
    locale: 'zh-Hant',
    apiSettings: { ...DEFAULT_API_SETTINGS },
    globalContext: {
      topic: '給忙碌上班族的每日補水指南',
      brief: '以一般生活健康資訊為主，避免醫療診斷或誇大效果。飲水需求因活動量、環境與個人狀況而異，請清楚保留彈性說明。',
      sourceMaterial: '',
      sourceUrls: '',
      requireCitations: true,
      preserveFacts: true,
      lockLayout: true,
    },
    blocks: sampleBlocks(),
  };
}

function uniqueId(prefix = 'slot') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function createBlock(type, overrides = {}) {
  const meta = TYPE_META[type] || TYPE_META.text;
  const defaultContent = {
    label: { text: 'SECTION LABEL  /  分類標籤' },
    heading: { text: '在這裡輸入標題' },
    text: { text: '加入一段簡短說明，或指示 AI 從資料中整理重點。' },
    image: { prompt: '描述想要生成的圖片，並指定風格、物件與構圖。', alt_text: '圖片的文字描述', asset_url: '' },
    stat: { value: '01', label: '關鍵數據名稱', description: '數據說明或來源補充' },
    steps: { title: '步驟說明', steps: ['第一個步驟', '第二個步驟', '第三個步驟'] },
    chart: { title: '資料比較', data: [{ label: '項目 A', value: 72 }, { label: '項目 B', value: 48 }, { label: '項目 C', value: 90 }] },
  }[type] || { text: '' };
  const suggestedTask = type === 'image' ? 'image' : type === 'stat' || type === 'chart' ? 'research' : 'provided';
  const contentHeight = { label: 7, heading: 14, text: 12, image: 22, stat: 16, steps: 22, chart: 22 }[type] || 12;
  return {
    id: uniqueId(),
    type,
    role: overrides.role || meta.role,
    position: { x: 8, y: 8, w: type === 'stat' ? 42 : 84, h: contentHeight, z: 1, ...(overrides.position || {}) },
    content: { ...defaultContent, ...(overrides.content || {}) },
    task: { mode: suggestedTask, instruction: '', query: '', source_preference: 'official', require_citations: true, data_source: 'project_context', ...(overrides.task || {}) },
    style: { align: 'left', font_size: 'medium', fill: 'none', ...(overrides.style || {}) },
  };
}

function blankState() {
  const state = defaultState();
  state.projectName = '未命名資訊圖';
  state.globalContext = { topic: '', brief: '', sourceMaterial: '', sourceUrls: '', requireCitations: true, preserveFacts: true, lockLayout: true };
  state.blocks = [
    makeBlock(uniqueId(), 'heading', '主標題', { x: 8, y: 8, w: 84, h: 16 }, { text: '你的主題標題' }, 'provided', ''),
    makeBlock(uniqueId(), 'text', '引言文字', { x: 8, y: 27, w: 84, h: 11 }, { text: '貼上資料、加入說明，或請 AI 從來源中整理摘要。' }, 'summarize', ''),
    makeBlock(uniqueId(), 'image', '主視覺圖片', { x: 8, y: 42, w: 84, h: 24 }, { prompt: '在這裡描述要生成的圖片', alt_text: '待生成的主視覺圖片', asset_url: '' }, 'image', ''),
  ];
  return state;
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizePosition(position = {}) {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const w = clamp(position.w ?? position.width ?? 40, 5, 100);
  const h = clamp(position.h ?? position.height ?? 12, 4, 100);
  return {
    x: clamp(position.x, 0, 100 - w),
    y: clamp(position.y, 0, 100 - h),
    w,
    h,
    z: clamp(position.z ?? 1, 1, 99),
  };
}

function normalizeBlock(block, index = 0) {
  const type = TYPE_META[block?.type] ? block.type : 'text';
  const fallback = createBlock(type);
  return {
    ...fallback,
    ...block,
    id: String(block?.id || `slot-${index + 1}`),
    type,
    role: String(block?.role || TYPE_META[type].role).slice(0, 60),
    position: normalizePosition(block?.position || block?.geometry || fallback.position),
    content: { ...fallback.content, ...(block?.content && typeof block.content === 'object' ? block.content : {}) },
    task: { ...fallback.task, ...(block?.task && typeof block.task === 'object' ? block.task : {}) },
    style: { ...fallback.style, ...(block?.style && typeof block.style === 'object' ? block.style : {}) },
  };
}

function loadWorkspace() {
  const fallback = defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const context = parsed.globalContext && typeof parsed.globalContext === 'object' ? parsed.globalContext : {};
    return {
      ...fallback,
      ...parsed,
      ratio: RATIOS[parsed.ratio] ? parsed.ratio : fallback.ratio,
      palette: PALETTES[parsed.palette] ? parsed.palette : fallback.palette,
      artStyle: ART_STYLES[parsed.artStyle] ? parsed.artStyle : fallback.artStyle,
      apiSettings: { ...DEFAULT_API_SETTINGS, ...(parsed.apiSettings && typeof parsed.apiSettings === 'object' ? parsed.apiSettings : {}) },
      globalContext: { ...fallback.globalContext, ...context },
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks.slice(0, 40).map(normalizeBlock) : fallback.blocks,
    };
  } catch (error) {
    console.warn('讀取本機畫布失敗，載入預設範例。', error);
    return fallback;
  }
}

let state = loadWorkspace();
let transientApiKey = '';
if (state.apiSettings?.rememberKey) {
  try {
    transientApiKey = sessionStorage.getItem(API_KEY_SESSION_KEY) || '';
    if (!transientApiKey) state.apiSettings.rememberKey = false;
  } catch (error) {
    state.apiSettings.rememberKey = false;
  }
}
let selectedBlockId = state.blocks.find((block) => block.type === 'heading')?.id || state.blocks[0]?.id || null;
let inspectorTab = 'content';
let zoom = 1;
let saveTimer = 0;
let toastTimer = 0;
let pointerSession = null;

const els = {
  projectName: document.getElementById('projectName'),
  board: document.getElementById('canvasBoard'),
  stage: document.getElementById('canvasStage'),
  saveStatus: document.getElementById('saveStatus'),
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toastMessage'),
  selectedBlockMeta: document.getElementById('selectedBlockMeta'),
  inspectorSlotCount: document.getElementById('inspectorSlotCount'),
  contentFields: document.getElementById('contentFields'),
  aiFields: document.getElementById('aiFields'),
  styleFields: document.getElementById('styleFields'),
  jsonOutput: document.getElementById('jsonOutput'),
  customTemplates: document.getElementById('customTemplates'),
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function safeImageUrl(value) {
  const input = String(value || '').trim();
  if (/^https:\/\//i.test(input)) return input;
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(input)) return input;
  return '';
}

function getSelectedBlock() {
  return state.blocks.find((block) => block.id === selectedBlockId) || null;
}

function blockTypeIcon(type) {
  return TYPE_META[type]?.icon || '▧';
}

function blockTypeName(type) {
  return TYPE_META[type]?.name || '內容';
}

function taskName(mode) {
  return ({ provided: '使用提供資料', summarize: '整理資料', research: '查找資料', image: '生成圖像' })[mode] || '使用提供資料';
}

function taskBadgeName(block) {
  if (block?.task?.status === 'completed' || block?.research_result) return 'AI 已回填';
  return taskName(currentTaskMode(block));
}

function currentTaskMode(block) {
  return ['provided', 'summarize', 'research', 'image'].includes(block?.task?.mode) ? block.task.mode : 'provided';
}

function formatContentMarkup(block) {
  const content = block.content || {};
  const safeText = (value) => escapeHtml(value).replace(/\n/g, '<br>');
  switch (block.type) {
    case 'label':
      return `<div class="block-body"><span>${safeText(content.text || 'SERIES LABEL')}</span></div>`;
    case 'heading':
      return `<div class="block-body"><h2>${escapeHtml(content.text || '資訊圖卡標題')}</h2></div>`;
    case 'text':
      return `<div class="block-body"><p>${safeText(content.text || '補充說明文字')}</p></div>`;
    case 'image': {
      const imageUrl = safeImageUrl(content.asset_url);
      const art = imageUrl
        ? `<img class="uploaded-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(content.alt_text || '')}" />`
        : '<span class="image-art-sun"></span><span class="image-art-orbit"></span><span class="image-art-cup"></span><span class="image-art-leaf"></span>';
      return `<div class="block-body">${art}<div class="image-overlay"><strong>${escapeHtml(imageUrl ? (content.alt_text || '圖片素材') : (content.prompt || 'AI 圖像生成位置'))}</strong><span>${imageUrl ? 'IMAGE ASSET' : 'IMAGE SLOT'}</span></div></div>`;
    }
    case 'stat':
      return `<div class="block-body"><strong>${escapeHtml(content.value || '00')}</strong><span class="stat-label">${escapeHtml(content.label || '數據名稱')}</span><span class="stat-description">${escapeHtml(content.description || '')}</span></div>`;
    case 'steps': {
      const steps = Array.isArray(content.steps) ? content.steps : [];
      return `<div class="block-body"><h3 class="steps-title">${escapeHtml(content.title || '步驟流程')}</h3><div class="steps-list">${steps.slice(0, 5).map((step, index) => `<div class="step-row"><span class="step-number">${String(index + 1).padStart(2, '0')}</span><span>${escapeHtml(step)}</span></div>`).join('')}</div></div>`;
    }
    case 'chart': {
      const chartData = Array.isArray(content.data) && content.data.length ? content.data.slice(0, 6) : [{ label: 'A', value: 55 }, { label: 'B', value: 76 }, { label: 'C', value: 42 }];
      const maxValue = Math.max(1, ...chartData.map((item) => Number(item.value) || 0));
      return `<div class="block-body"><h3 class="chart-title">${escapeHtml(content.title || '資料比較')}</h3><div class="chart-bars">${chartData.map((item) => {
        const value = Math.max(4, Math.min(100, (Number(item.value) / maxValue) * 100));
        return `<div class="chart-bar-group"><span class="chart-bar-value">${escapeHtml(item.value)}</span><span class="chart-bar" style="height:${value}%"></span><span class="chart-bar-label">${escapeHtml(item.label)}</span></div>`;
      }).join('')}</div></div>`;
    }
    default:
      return `<div class="block-body"><p>${safeText(content.text || '')}</p></div>`;
  }
}

function renderCanvas() {
  const palette = PALETTES[state.palette] || PALETTES.citrus;
  const artStyle = ART_STYLES[state.artStyle] ? state.artStyle : 'editorial';
  els.board.className = `canvas-board theme-${state.palette} art-${artStyle}`;
  els.board.dataset.ratio = RATIOS[state.ratio] ? state.ratio : '4:5';
  const baseWidth = state.ratio === '9:16' ? 340 : 480;
  els.board.style.setProperty('--board-width', `${Math.round(baseWidth * zoom)}px`);
  els.board.style.setProperty('--board-bg', palette.background);
  els.board.style.setProperty('--board-paper', palette.paper);
  els.board.style.setProperty('--board-ink', palette.ink);
  els.board.style.setProperty('--board-muted', palette.muted);
  els.board.style.setProperty('--board-accent', palette.accent);
  els.board.style.setProperty('--board-secondary', palette.secondary);
  els.board.innerHTML = state.blocks.map((block) => {
    const pos = normalizePosition(block.position);
    const style = block.style || {};
    const isSelected = block.id === selectedBlockId;
    const mode = currentTaskMode(block);
    return `<article class="canvas-block block-${escapeHtml(block.type)} fill-${escapeHtml(style.fill || 'none')} align-${escapeHtml(style.align || 'left')} text-size-${escapeHtml(style.font_size || 'medium')} ${isSelected ? 'is-selected' : ''}" data-block-id="${escapeHtml(block.id)}" style="left:${pos.x}%;top:${pos.y}%;width:${pos.w}%;height:${pos.h}%;z-index:${pos.z};" aria-label="${escapeHtml(block.role)}，${blockTypeName(block.type)}">
      ${formatContentMarkup(block)}
      ${isSelected ? `<div class="block-floating"><span>${escapeHtml(block.role)} · ${escapeHtml(blockTypeName(block.type))}</span><button type="button" class="block-delete" data-action="remove" aria-label="刪除版位">×</button></div><button type="button" class="resize-handle" data-action="resize" aria-label="調整版位大小"></button>` : ''}
      <span class="block-task-dot ${mode === 'provided' ? 'provided' : ''} ${(block.task?.status === 'completed' || block.research_result) ? 'completed' : ''}" title="${escapeHtml(taskBadgeName(block))}"></span>
    </article>`;
  }).join('');
  document.getElementById('canvasBlockCount').textContent = `${state.blocks.length} 個版位`;
  document.getElementById('canvasRatioBadge').textContent = state.ratio;
  document.getElementById('ratioSelect').value = state.ratio;
  document.getElementById('zoomValue').textContent = `${Math.round(zoom * 100)}%`;
}

function fieldGroup(label, control, hint = '') {
  return `<div class="field-group"><label class="field-label">${label}</label>${control}${hint ? `<div class="field-hint">${hint}</div>` : ''}</div>`;
}

function inputControl(value, field, placeholder = '', options = {}) {
  const type = options.type || 'text';
  const maxLength = options.maxLength ? `maxlength="${options.maxLength}"` : '';
  return `<input class="field-control" type="${type}" data-${options.scope || 'content'}-field="${field}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${maxLength} />`;
}

function areaControl(value, field, placeholder = '', scope = 'content', className = '') {
  return `<textarea class="field-area ${className}" data-${scope}-field="${field}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`;
}

function parseChartTextarea(data) {
  return String(data || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.split(/[，,|\t]/).map((part) => part.trim());
    const match = line.match(/^(.+?)\s*[:：]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (match) return { label: match[1].trim(), value: Number(match[2]) || 0 };
    return { label: parts[0] || '項目', value: Number(parts[1]) || 0 };
  }).slice(0, 8);
}

function chartTextarea(data) {
  return (Array.isArray(data) ? data : []).map((item) => `${item.label}, ${item.value}`).join('\n');
}

function renderContentFields(block) {
  const base = fieldGroup('這個版位的名稱', inputControl(block.role, 'role', '例如：主標題', { scope: 'block', maxLength: 60 }), '此名稱會成為 AI 對應資料的版位 ID 說明。');
  const content = block.content || {};
  let specific = '';
  if (block.type === 'heading') {
    specific += fieldGroup('標題文字', areaControl(content.text, 'text', '輸入標題；可用換行控制行距。', 'content', 'small-area'));
  } else if (block.type === 'label') {
    specific += fieldGroup('標籤文字', inputControl(content.text, 'text', '例如：生活提案 · 01', { maxLength: 50 }));
  } else if (block.type === 'text') {
    specific += fieldGroup('文字內容', areaControl(content.text, 'text', '輸入說明，或指定 AI 從資料中整理。', 'content'));
  } else if (block.type === 'image') {
    specific += fieldGroup('圖片生成描述', areaControl(content.prompt, 'prompt', '描述物件、場景、構圖和視覺風格…', 'content'), '可使用右側「AI 任務」要求生成圖像。');
    specific += fieldGroup('替代文字 / 圖片說明', inputControl(content.alt_text, 'alt_text', '簡短描述圖片內容', { maxLength: 100 }));
    specific += fieldGroup('圖片網址（可選）', inputControl(content.asset_url, 'asset_url', 'https://…', { type: 'url' }), '支援 HTTPS 圖片連結；也可以先保留為 AI 圖像版位。');
  } else if (block.type === 'stat') {
    specific += fieldGroup('關鍵數值', inputControl(content.value, 'value', '例如：72%', { maxLength: 24 }));
    specific += fieldGroup('數據名稱', inputControl(content.label, 'label', '例如：受訪者回覆', { maxLength: 48 }));
    specific += fieldGroup('補充說明', areaControl(content.description, 'description', '簡短註明資料脈絡或限制。', 'content', 'small-area'));
  } else if (block.type === 'steps') {
    specific += fieldGroup('流程標題', inputControl(content.title, 'title', '例如：三步驟開始', { maxLength: 44 }));
    specific += fieldGroup('步驟清單', areaControl((content.steps || []).join('\n'), 'steps', '每行一個步驟', 'content'), '每行會成為一個獨立步驟。');
  } else if (block.type === 'chart') {
    specific += fieldGroup('圖表標題', inputControl(content.title, 'title', '例如：每週完成率', { maxLength: 44 }));
    specific += fieldGroup('圖表資料', areaControl(chartTextarea(content.data), 'data', '每行：標籤, 數值\n例如：第一週, 65', 'content'), '請確認單位與資料來源；AI 研究結果可附在回覆中。');
  }
  const pos = normalizePosition(block.position);
  const position = `<div class="position-box"><div class="position-head"><span>畫布位置與尺寸</span><small>百分比 %</small></div><div class="position-fields">${[['x','X',pos.x],['y','Y',pos.y],['w','W',pos.w],['h','H',pos.h]].map(([field,label,value]) => `<label class="position-field"><span>${label}</span><input type="number" min="0" max="100" step="1" value="${Math.round(value)}" data-position-field="${field}" aria-label="${label} 位置百分比" /></label>`).join('')}</div></div>`;
  return base + specific + position;
}

function renderAiFields(block) {
  const mode = currentTaskMode(block);
  const modes = [
    ['provided', '提供資料', '不查找，直接使用'],
    ['summarize', '整理內容', '摘要或改寫資料'],
    ['research', '查找資料', 'AI 搜尋並附來源'],
    ['image', '生成圖像', '建立圖片素材'],
  ];
  const options = modes.map(([key, title, description]) => {
    const disabled = key === 'image' && block.type !== 'image';
    return `<button class="ai-mode-option ${mode === key ? 'active' : ''} ${disabled ? 'disabled' : ''}" type="button" data-task-mode="${key}" aria-pressed="${mode === key}" ${disabled ? 'disabled title="請先新增圖片版位"' : ''}><span class="mode-mini-icon">${({ provided: '✓', summarize: '≡', research: '⌕', image: '▧' })[key]}</span><span><strong>${title}</strong><small>${disabled ? '請使用圖片版位' : description}</small></span></button>`;
  }).join('');
  let modeDetails = '';
  if (mode === 'research') {
    modeDetails += fieldGroup('研究問題 / 搜尋方向', areaControl(block.task.query, 'query', '要 AI 查找什麼？描述問題、時間範圍或地區。', 'task', 'small-area'));
    modeDetails += fieldGroup('優先來源類型', `<select class="field-select" data-task-field="source_preference"><option value="official" ${block.task.source_preference === 'official' ? 'selected' : ''}>官方／政府／機構</option><option value="academic" ${block.task.source_preference === 'academic' ? 'selected' : ''}>研究／學術來源</option><option value="reputable" ${block.task.source_preference === 'reputable' ? 'selected' : ''}>可信賴媒體</option><option value="provided" ${block.task.source_preference === 'provided' ? 'selected' : ''}>優先用提供資料</option></select>`);
    modeDetails += `<label class="check-setting"><input type="checkbox" data-task-field="require_citations" ${block.task.require_citations ? 'checked' : ''}/> 這個版位必須附上來源</label>`;
  } else if (mode === 'image') {
    modeDetails += `<div class="ai-output-note"><span class="note-symbol">▧</span><span><strong>圖像版位</strong> AI 回覆可附生成後的圖片網址，或回傳可直接使用的完整 prompt。</span></div>`;
  } else if (mode === 'summarize') {
    modeDetails += `<div class="ai-output-note"><span class="note-symbol">≡</span><span><strong>資料來源</strong> AI 會以「資料與 AI 規則」中的共用資料為優先。</span></div>`;
  }
  const specific = mode !== 'provided' ? fieldGroup('版位專屬指示', areaControl(block.task.instruction, 'instruction', '例如：找完資料後，以 40 字內繁體中文填入此數據版位。', 'task')) : fieldGroup('使用說明', areaControl(block.task.instruction, 'instruction', '補充這個版位要如何使用你提供的資料。', 'task', 'small-area'));
  const dataSource = `<div class="field-group"><label class="field-label">優先資料來源</label><select class="field-select" data-task-field="data_source"><option value="project_context" ${block.task.data_source === 'project_context' ? 'selected' : ''}>整體資料池與參考網址</option><option value="user_content" ${block.task.data_source === 'user_content' ? 'selected' : ''}>只使用我提供的內容</option><option value="web_research" ${block.task.data_source === 'web_research' ? 'selected' : ''}>允許 AI 網路查找</option></select></div>`;
  return `<p class="ai-task-intro"><strong>這一格要 AI 做什麼？</strong><br/>每個版位可以有不同任務；匯出時會帶上任務、資料來源和預期輸出型態。</p><div class="ai-mode-label">選擇資料處理方式</div><div class="ai-mode-grid">${options}</div>${modeDetails}${specific}${dataSource}<div class="ai-output-note"><span class="note-symbol">↳</span><span>AI 回覆時只填這格的內容與研究來源，版位位置和大小會保持鎖定。</span></div>`;
}

function renderStyleFields(block) {
  const paletteOptions = Object.entries(PALETTES).map(([key, palette]) => `<button class="palette-choice ${state.palette === key ? 'active' : ''}" type="button" data-palette-choice="${key}" aria-pressed="${state.palette === key}"><span class="palette-swatch-row"><i></i><i></i><i></i></span><strong>${palette.name}</strong></button>`).join('');
  const artOptions = Object.entries(ART_STYLES).map(([key, style]) => `<button class="art-style-option ${state.artStyle === key ? 'active' : ''}" type="button" data-art-style="${key}" aria-pressed="${state.artStyle === key}"><strong>${style.name}</strong><span>${({ editorial: '工整層次', soft: '親切柔和', minimal: '留白俐落' })[key]}</span></button>`).join('');
  const alignmentButtons = [['left', '<path d="M4 5h12M4 8h8M4 11h12M4 14h8"/>'], ['center', '<path d="M4 5h12M6 8h8M4 11h12M6 14h8"/>'], ['right', '<path d="M4 5h12M8 8h8M4 11h12M8 14h8"/>']].map(([align, icon]) => `<button type="button" class="align-button ${block.style.align === align ? 'active' : ''}" data-align="${align}" aria-label="${({ left: '靠左對齊', center: '置中', right: '靠右對齊' })[align]}" aria-pressed="${block.style.align === align}"><svg viewBox="0 0 20 20" aria-hidden="true">${icon}</svg></button>`).join('');
  const fillOptions = ['none','paper','tint','accent','outline'].map((fill) => `<button type="button" class="fill-option ${block.style.fill === fill ? 'active' : ''}" data-fill="${fill}" aria-label="${({ none:'透明', paper:'紙白', tint:'淡色底', accent:'主色底', outline:'描邊' })[fill]}" aria-pressed="${block.style.fill === fill}"></button>`).join('');
  return `<div class="field-group"><div class="field-label">整張圖的色彩主題 <small>全域設定</small></div><div class="style-choice-grid">${paletteOptions}</div></div><div class="style-divider"></div><div class="field-group"><div class="field-label">整體視覺語氣 <small>全域設定</small></div><div class="art-style-row">${artOptions}</div></div><div class="style-divider"></div><div class="field-group"><div class="field-label">文字對齊</div><div class="align-button-row">${alignmentButtons}</div></div><div class="field-group"><label class="field-label" for="fontSizeSelect">字級強調</label><select id="fontSizeSelect" class="field-select" data-style-field="font_size"><option value="small" ${block.style.font_size === 'small' ? 'selected' : ''}>小</option><option value="medium" ${block.style.font_size === 'medium' ? 'selected' : ''}>標準</option><option value="large" ${block.style.font_size === 'large' ? 'selected' : ''}>強調</option></select></div><div class="field-group"><div class="field-label">區塊底色</div><div class="fill-option-row">${fillOptions}</div></div><div class="ai-output-note"><span class="note-symbol">✳</span><span>色彩和視覺語氣會作為整份 JSON 的全域設計系統，讓系列輸出維持一致。</span></div>`;
}

function renderInspector() {
  const block = getSelectedBlock();
  const inspectorTabs = document.querySelectorAll('.inspector-tab');
  const pages = document.querySelectorAll('.inspector-page');
  if (!block) {
    els.selectedBlockMeta.innerHTML = '<span class="selected-type-icon">+</span><span><strong>尚未選取版位</strong><small>請從畫布或工具箱開始</small></span>';
    els.inspectorSlotCount.textContent = `— / ${String(state.blocks.length).padStart(2, '0')}`;
    els.contentFields.innerHTML = '<div class="no-selection"><span>＋</span><strong>建立一個資訊位置</strong><p>從左側工具箱加入標題、文字、圖片、數據、步驟或圖表。</p></div>';
    els.aiFields.innerHTML = '<div class="no-selection"><span>✳</span><strong>先選取或建立版位</strong><p>再為該版位指定要使用資料、整理文字、查找來源或生成圖像。</p></div>';
    els.styleFields.innerHTML = '<div class="no-selection"><span>◒</span><strong>選取版位調整樣式</strong><p>也可以在樣式分頁設定整份圖卡的色彩與視覺語氣。</p></div>';
    document.getElementById('duplicateBlockBtn').disabled = true;
    document.getElementById('deleteBlockBtn').disabled = true;
  } else {
    const index = state.blocks.indexOf(block) + 1;
    const mode = currentTaskMode(block);
    els.selectedBlockMeta.innerHTML = `<span class="selected-type-icon">${escapeHtml(blockTypeIcon(block.type))}</span><span><strong>${escapeHtml(block.role)}</strong><small>${escapeHtml(blockTypeName(block.type).toUpperCase())} · ${escapeHtml(block.id)}</small></span><span class="task-indicator ${mode === 'provided' ? 'mode-provided' : ''} ${(block.task?.status === 'completed' || block.research_result) ? 'mode-complete' : ''}">${escapeHtml(taskBadgeName(block))}</span>`;
    els.inspectorSlotCount.textContent = `${String(index).padStart(2, '0')} / ${String(state.blocks.length).padStart(2, '0')}`;
    els.contentFields.innerHTML = renderContentFields(block);
    els.aiFields.innerHTML = renderAiFields(block);
    els.styleFields.innerHTML = renderStyleFields(block);
    document.getElementById('duplicateBlockBtn').disabled = false;
    document.getElementById('deleteBlockBtn').disabled = false;
  }
  inspectorTabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.inspectorTab === inspectorTab));
  pages.forEach((page) => page.classList.toggle('active', page.dataset.inspectorPage === inspectorTab));
}

function makeTask(block) {
  const mode = currentTaskMode(block);
  const taskActions = {
    provided: 'use_user_provided_content',
    summarize: 'summarize_or_rewrite_project_material',
    research: 'web_research_and_fill_this_slot',
    image: 'generate_or_source_image_for_this_slot',
  };
  const expected = block.type === 'image'
    ? ['content.prompt', 'content.alt_text', 'content.asset_url', 'research_result.references']
    : block.type === 'stat' || block.type === 'chart'
      ? ['content', 'research_result.references', 'research_result.notes']
      : ['content'];
  return {
    mode,
    action: taskActions[mode],
    status: mode === 'provided' ? 'ready_for_user_input' : (block.task?.status || (block.research_result ? 'completed' : 'pending_ai')),
    instruction: block.task.instruction || '',
    query: block.task.query || '',
    data_source: block.task.data_source || 'project_context',
    source_preference: block.task.source_preference || 'official',
    require_citations: Boolean(block.task.require_citations || state.globalContext.requireCitations),
    expected_output_fields: expected,
  };
}

function buildAiPrompt() {
  const ratio = RATIOS[state.ratio] || RATIOS['4:5'];
  const tasks = state.blocks.filter((block) => currentTaskMode(block) !== 'provided' && block.task?.status !== 'completed' && !block.research_result);
  const taskLines = tasks.length
    ? tasks.map((block) => `- ${block.id}（${block.role}／${blockTypeName(block.type)}）：${taskName(block.task.mode)}。${block.task.query || block.task.instruction || ''}`).join('\n')
    : '- 目前沒有待執行的 AI 任務；可在畫布右側為版位選擇資料處理方式。';
  return `你是資訊圖卡資料研究與版面填稿助手。請依照使用者提供的 frame-canvas JSON 執行指定任務。\n\n專案主題：${state.globalContext.topic || state.projectName}\n整體背景：${state.globalContext.brief || '依照 JSON 的 global_context 與各版位指示。'}\n畫布：${ratio.label} ${state.ratio}（${ratio.width} × ${ratio.height} px），輸出語言 ${state.locale}。\n\n待處理版位：\n${taskLines}\n\n執行規則：\n1. 逐一讀取每個 blocks[].ai_task，依 mode 使用提供資料、整理內容、網路查找或生成圖像。research 任務需查證事實並回傳 references；圖像任務不得把文字烘焙進圖像，並提供 asset_url 或完整圖像 prompt。\n2. 每個文字版位只填入適合該版位的精簡內容；不確定的事實請明確標示，不得杜撰數字或來源。\n3. 回傳完整 JSON，不要加 Markdown 程式碼框或額外說明。\n4. 必須保留 schema_version、block id、type、role、position、style、canvas 和 design_system；不可新增、刪除、重新命名或移動版位。\n5. 只可以更新 blocks[].content、blocks[].research_result 與 blocks[].ai_task.status；維持繁體中文及整份圖卡統一的設計系統。\n6. 若有多個相同主題版位，維持用字、單位、語氣、引用格式一致。`;
}

function buildSpec() {
  const ratio = RATIOS[state.ratio] || RATIOS['4:5'];
  const palette = PALETTES[state.palette] || PALETTES.citrus;
  const artStyle = ART_STYLES[state.artStyle] || ART_STYLES.editorial;
  const blocks = state.blocks.map((block, index) => ({
    id: block.id,
    order: index + 1,
    role: block.role,
    type: block.type,
    geometry: {
      x_percent: Math.round(block.position.x * 10) / 10,
      y_percent: Math.round(block.position.y * 10) / 10,
      width_percent: Math.round(block.position.w * 10) / 10,
      height_percent: Math.round(block.position.h * 10) / 10,
      z_index: block.position.z || 1,
    },
    content: deepCopy(block.content),
    ai_task: makeTask(block),
    style: { ...block.style },
    ...(block.research_result ? { research_result: deepCopy(block.research_result) } : {}),
  }));
  return {
    schema_version: 'frame.canvas.v1',
    task: 'fill_infographic_slots_without_changing_layout',
    project: { name: state.projectName.trim() || '未命名資訊圖', locale: state.locale },
    canvas: { aspect_ratio: state.ratio, width_px: ratio.width, height_px: ratio.height, orientation: 'portrait', safe_margin_percent: 6 },
    design_system: {
      palette: { name: palette.name, background: palette.background, surface: palette.paper, text: palette.ink, muted_text: palette.muted, accent: palette.accent, secondary: palette.secondary, tint: palette.tint },
      art_direction: { style: state.artStyle, name: artStyle.name, description: artStyle.description },
      rules: ['所有版位沿用相同色盤、字體層級與圖示風格。', '資訊順序由上至下，保持清楚層級及安全留白。', '使用指定輸出語言；不得自行增加未提供的品牌或裝飾文字。'],
    },
    global_context: {
      topic: state.globalContext.topic || '',
      brief: state.globalContext.brief || '',
      source_material: state.globalContext.sourceMaterial || '',
      reference_urls: String(state.globalContext.sourceUrls || '').split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
      rules: { require_citations: Boolean(state.globalContext.requireCitations), preserve_facts: Boolean(state.globalContext.preserveFacts), lock_layout: Boolean(state.globalContext.lockLayout) },
    },
    blocks,
    ai_job: {
      instruction: '依照每個版位的 ai_task 填入對應內容；版位結構與設計系統不可更動。',
      execution_prompt: buildAiPrompt(),
      response_contract: {
        format: 'return_the_complete_json_object',
        preserve_fields: ['schema_version', 'project', 'canvas', 'design_system', 'blocks[].id', 'blocks[].order', 'blocks[].role', 'blocks[].type', 'blocks[].geometry', 'blocks[].style'],
        may_update_fields: ['blocks[].content', 'blocks[].research_result', 'blocks[].ai_task.status'],
        do_not_add_or_remove_blocks: true,
      },
    },
  };
}

function updateJsonPanel() {
  const spec = buildSpec();
  els.jsonOutput.textContent = JSON.stringify(spec, null, 2);
  const isPending = (block) => block.task?.status !== 'completed' && !block.research_result;
  const researchCount = state.blocks.filter((block) => currentTaskMode(block) === 'research' && isPending(block)).length;
  const imageCount = state.blocks.filter((block) => currentTaskMode(block) === 'image' && isPending(block)).length;
  const taskCount = state.blocks.filter((block) => currentTaskMode(block) !== 'provided' && isPending(block)).length;
  document.getElementById('taskCountBadge').textContent = `${taskCount} 個 AI 任務`;
  document.getElementById('pendingResearchCount').textContent = String(researchCount);
  document.getElementById('pendingImageCount').textContent = String(imageCount);
  document.getElementById('slotTotalCount').textContent = String(state.blocks.length);
  document.getElementById('jsonFileMeta').textContent = `${state.ratio} · ${state.blocks.length} SLOTS · FRAME CANVAS V1`;
}

function renderAll() {
  renderCanvas();
  renderInspector();
  updateJsonPanel();
  renderGlobalForm();
  renderApiForm();
  updateApiCounters();
}

function renderApiForm() {
  const api = state.apiSettings || DEFAULT_API_SETTINGS;
  document.getElementById('apiPresetSelect').value = api.preset || 'custom';
  document.getElementById('apiEndpointInput').value = api.endpoint || '';
  document.getElementById('apiMethodSelect').value = api.method || 'POST';
  document.getElementById('apiModelInput').value = api.model || '';
  document.getElementById('apiHeadersInput').value = api.headersTemplate || '';
  document.getElementById('apiBodyInput').value = api.bodyTemplate || '';
  document.getElementById('apiResponsePathInput').value = api.responsePath || '';
  document.getElementById('apiTimeoutInput').value = String(api.timeoutSeconds || 120);
  document.getElementById('rememberApiKeyCheck').checked = Boolean(api.rememberKey);
  const keyInput = document.getElementById('apiKeyInput');
  if (api.rememberKey && !transientApiKey) {
    try { transientApiKey = sessionStorage.getItem(API_KEY_SESSION_KEY) || ''; } catch (error) { /* session storage may be disabled */ }
  }
  keyInput.value = transientApiKey;
}

function updateApiCounters() {
  const isPending = (block) => block.task?.status !== 'completed' && !block.research_result;
  const pending = state.blocks.filter((block) => currentTaskMode(block) !== 'provided' && isPending(block)).length;
  const slots = state.blocks.length;
  const pendingNode = document.getElementById('apiPendingCount');
  const slotNode = document.getElementById('apiSlotCount');
  if (pendingNode) pendingNode.textContent = String(pending);
  if (slotNode) slotNode.textContent = String(slots);
}

function renderGlobalForm() {
  const context = state.globalContext;
  document.getElementById('topicInput').value = context.topic || '';
  document.getElementById('globalBriefInput').value = context.brief || '';
  document.getElementById('sourceUrlsInput').value = context.sourceUrls || '';
  document.getElementById('localeSelect').value = state.locale || 'zh-Hant';
  document.getElementById('citationsCheck').checked = Boolean(context.requireCitations);
  document.getElementById('preserveFactsCheck').checked = Boolean(context.preserveFacts);
  document.getElementById('keepLayoutCheck').checked = Boolean(context.lockLayout);
}

function persistState() {
  window.clearTimeout(saveTimer);
  els.saveStatus.classList.add('saving');
  els.saveStatus.classList.remove('error');
  els.saveStatus.lastElementChild.textContent = '儲存中';
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      els.saveStatus.classList.remove('saving', 'error');
      els.saveStatus.lastElementChild.textContent = '已儲存';
      document.getElementById('footerSaveText').textContent = '草稿只存於目前瀏覽器';
    } catch (error) {
      els.saveStatus.classList.remove('saving');
      els.saveStatus.classList.add('error');
      els.saveStatus.lastElementChild.textContent = '儲存失敗';
      document.getElementById('footerSaveText').textContent = '瀏覽器儲存空間不足';
      console.warn('無法儲存本機畫布。', error);
    }
  }, 220);
}

function showToast(message) {
  els.toastMessage.textContent = message;
  els.toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => els.toast.classList.remove('visible'), 2600);
}

function setView(view) {
  const allowed = ['canvas', 'brief', 'api', 'json'];
  if (!allowed.includes(view)) return;
  document.querySelectorAll('.app-view').forEach((panel) => {
    const active = panel.id === `view-${view}`;
    panel.hidden = !active;
    panel.classList.toggle('active', active);
  });
  document.querySelectorAll('[data-view]').forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    if (button.classList.contains('nav-item')) {
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  });
  if (view === 'json') updateJsonPanel();
  if (window.matchMedia('(max-width: 640px)').matches) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setInspectorTab(tab) {
  inspectorTab = tab;
  renderInspector();
}

function selectBlock(id, { keepInspectorTab = true } = {}) {
  selectedBlockId = state.blocks.some((block) => block.id === id) ? id : null;
  if (!keepInspectorTab) inspectorTab = 'content';
  renderCanvas();
  renderInspector();
}

function moveOrResizeBlock(id, patch) {
  const block = state.blocks.find((item) => item.id === id);
  if (!block) return;
  block.position = normalizePosition({ ...block.position, ...patch });
  const element = [...els.board.querySelectorAll('[data-block-id]')].find((item) => item.dataset.blockId === id);
  if (element) {
    const pos = block.position;
    element.style.left = `${pos.x}%`;
    element.style.top = `${pos.y}%`;
    element.style.width = `${pos.w}%`;
    element.style.height = `${pos.h}%`;
    element.style.zIndex = String(pos.z || 1);
  }
}

function startPointerOperation(event, blockId, kind = 'move') {
  const block = state.blocks.find((item) => item.id === blockId);
  if (!block) return;
  pointerSession = {
    id: blockId,
    kind,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    position: { ...block.position },
    moved: false,
    boardRect: els.board.getBoundingClientRect(),
  };
  document.body.classList.add('pointer-editing');
  event.preventDefault();
}

function pointerMove(event) {
  if (!pointerSession || event.pointerId !== pointerSession.pointerId) return;
  const session = pointerSession;
  const dx = (event.clientX - session.startX) / session.boardRect.width * 100;
  const dy = (event.clientY - session.startY) / session.boardRect.height * 100;
  if (!session.moved && Math.abs(dx) + Math.abs(dy) < 0.5) return;
  session.moved = true;
  const snap = (value) => Math.round(value);
  const patch = session.kind === 'resize'
    ? { w: snap(Math.max(8, Math.min(100 - session.position.x, session.position.w + dx))), h: snap(Math.max(4, Math.min(100 - session.position.y, session.position.h + dy))) }
    : { x: snap(Math.max(0, Math.min(100 - session.position.w, session.position.x + dx))), y: snap(Math.max(0, Math.min(100 - session.position.h, session.position.y + dy))) };
  moveOrResizeBlock(session.id, patch);
}

function pointerUp(event) {
  if (!pointerSession || (event && event.pointerId !== pointerSession.pointerId)) return;
  const session = pointerSession;
  pointerSession = null;
  document.body.classList.remove('pointer-editing');
  if (session.moved) {
    renderInspector();
    updateJsonPanel();
    persistState();
  }
}

function nextPosition(type) {
  const height = ({ label: 7, heading: 14, text: 12, image: 23, stat: 16, steps: 22, chart: 22 })[type] || 12;
  const bottom = state.blocks.reduce((max, block) => Math.max(max, block.position.y + block.position.h), 5);
  if (bottom + height + 1 <= 98) return { x: 8, y: Math.min(100 - height, bottom + 2), w: type === 'stat' ? 42 : 84, h: height, z: 1 };
  return { x: 8 + ((state.blocks.length % 2) ? 46 : 0), y: 8, w: type === 'stat' ? 42 : 44, h: height, z: 1 };
}

function addBlock(type, position = null) {
  if (!TYPE_META[type]) return;
  if (state.blocks.length >= 40) {
    showToast('單張畫布最多加入 40 個版位');
    return;
  }
  const block = createBlock(type, { position: position || nextPosition(type) });
  state.blocks.push(block);
  selectedBlockId = block.id;
  inspectorTab = 'content';
  renderCanvas();
  renderInspector();
  updateJsonPanel();
  persistState();
  if (window.matchMedia('(max-width: 830px)').matches) document.querySelector('.inspector-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function removeBlock(id = selectedBlockId) {
  const index = state.blocks.findIndex((block) => block.id === id);
  if (index < 0) return;
  state.blocks.splice(index, 1);
  selectedBlockId = state.blocks[Math.min(index, state.blocks.length - 1)]?.id || null;
  renderAll();
  persistState();
  showToast('已刪除版位');
}

function duplicateBlock() {
  const selected = getSelectedBlock();
  if (!selected) return;
  const copy = deepCopy(selected);
  copy.id = uniqueId();
  copy.role = `${selected.role} 副本`.slice(0, 60);
  copy.position = normalizePosition({ ...selected.position, x: Math.min(100 - selected.position.w, selected.position.x + 4), y: Math.min(100 - selected.position.h, selected.position.y + 4), z: selected.position.z + 1 });
  state.blocks.splice(state.blocks.indexOf(selected) + 1, 0, copy);
  selectedBlockId = copy.id;
  renderAll();
  persistState();
  showToast('已複製版位，可拖曳調整位置');
}

function applyPreset(name) {
  if (name === 'steps') {
    state.ratio = '9:16';
    state.projectName = '步驟教學圖卡';
    state.blocks = [
      makeBlock('steps-kicker', 'label', '系列識別標籤', { x: 8, y: 5, w: 78, h: 6 }, { text: 'HOW TO  /  圖文教學' }),
      makeBlock('steps-title', 'heading', '教學主標題', { x: 8, y: 12, w: 84, h: 15 }, { text: '從零開始\n完成一件事' }, 'provided', '主標題用簡短動詞呈現，清楚說明本教學要完成的目標。'),
      makeBlock('steps-intro', 'text', '教學摘要', { x: 8, y: 28, w: 84, h: 8 }, { text: '依照以下步驟，逐步完成你的第一個成果。' }, 'summarize', '整理共用資料，寫一段簡短導讀。'),
      makeBlock('steps-image', 'image', '教學情境圖', { x: 8, y: 38, w: 84, h: 19 }, { prompt: '呈現教學主題相關的情境插畫，步驟感、乾淨背景、無文字。', alt_text: '教學情境插畫', asset_url: '' }, 'image', '生成一張無文字的輔助情境圖。'),
      makeBlock('steps-list', 'steps', '操作流程', { x: 8, y: 60, w: 84, h: 28 }, { title: '照著做，三步完成', steps: ['準備所需工具與材料', '依照順序完成主要操作', '確認結果並記錄心得'] }, 'research', '請查核正確流程，整理成 3 至 4 個清楚、可執行的步驟。'),
      makeBlock('steps-note', 'text', '完成提醒', { x: 8, y: 90, w: 84, h: 6 }, { text: '小提醒：依實際情況調整每一步。' }, 'summarize', '依資料整理一則必要的注意事項。'),
    ];
  } else if (name === 'data') {
    state.ratio = '4:5';
    state.projectName = '數據快報';
    state.blocks = [
      makeBlock('data-kicker', 'label', '資料分類', { x: 8, y: 6, w: 75, h: 6 }, { text: 'DATA BRIEF  /  數據快報' }),
      makeBlock('data-title', 'heading', '報告標題', { x: 8, y: 14, w: 84, h: 13 }, { text: '重要趨勢，\n一眼看懂' }, 'provided', '保持中性，不要讓標題超出資料能支持的結論。'),
      makeBlock('data-stat', 'stat', '核心指標', { x: 8, y: 31, w: 39, h: 21 }, { value: '72%', label: '核心觀察數據', description: '期間與計算方式待補充' }, 'research', '從可靠來源查找核心數據，並確認統計期間、地區與母體。'),
      makeBlock('data-chart', 'chart', '比較圖表', { x: 50, y: 31, w: 42, h: 25 }, { title: '各項數值比較', data: [{ label: '第一項', value: 72 }, { label: '第二項', value: 51 }, { label: '第三項', value: 88 }] }, 'research', '找出可比較的同一口徑數據；如果口徑不同，請勿放在同一圖表。'),
      makeBlock('data-image', 'image', '數據情境插圖', { x: 8, y: 59, w: 84, h: 20 }, { prompt: '極簡編輯風格的抽象數據視覺，不含文字與數字。', alt_text: '抽象數據視覺', asset_url: '' }, 'image', '生成一張不含文字與數字、與數據主題相關的抽象插圖。'),
      makeBlock('data-insight', 'text', '關鍵洞察', { x: 8, y: 82, w: 84, h: 12 }, { text: '一句話整理資料趨勢，避免把相關性說成因果。' }, 'summarize', '依照圖表和引用來源，寫一段有根據的摘要。'),
    ];
  } else {
    state.ratio = '4:5';
    state.projectName = '重點整理資訊圖';
    state.blocks = sampleBlocks();
  }
  selectedBlockId = state.blocks[0]?.id || null;
  inspectorTab = 'content';
  zoom = 1;
  els.projectName.value = state.projectName;
  renderAll();
  persistState();
  showToast(`${name === 'steps' ? '步驟教學' : name === 'data' ? '數據快報' : '重點整理'}版型已套用`);
  setView('canvas');
}

function loadTemplates() {
  try {
    const value = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (error) {
    return [];
  }
}

function renderSavedTemplates() {
  const templates = loadTemplates();
  if (!templates.length) {
    els.customTemplates.innerHTML = '<div class="no-templates">還沒有儲存的版型</div>';
    return;
  }
  els.customTemplates.innerHTML = templates.map((template) => `<div class="custom-template-row-wrap"><button class="custom-template-row" type="button" data-load-template="${escapeHtml(template.id)}"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="3" width="12" height="14" rx="1.5"/><path d="M7 7h6M7 10h6M7 13h4"/></svg><span>${escapeHtml(template.name)}</span></button><button type="button" class="delete-template" data-delete-template="${escapeHtml(template.id)}" aria-label="刪除範本" title="刪除範本">×</button></div>`).join('');
}

function saveTemplate() {
  const name = window.prompt('為這份版型命名：', `${state.projectName || '資訊圖'}版型`);
  if (!name || !name.trim()) return;
  const templates = loadTemplates();
  templates.unshift({
    id: uniqueId('template'),
    name: name.trim().slice(0, 36),
    ratio: state.ratio,
    palette: state.palette,
    artStyle: state.artStyle,
    blocks: deepCopy(state.blocks),
    saved_at: new Date().toISOString(),
  });
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates.slice(0, 12)));
    renderSavedTemplates();
    showToast('版型已儲存在這部瀏覽器');
  } catch (error) {
    showToast('儲存失敗，瀏覽器儲存空間可能已滿');
  }
}

function applySavedTemplate(id) {
  const template = loadTemplates().find((item) => item.id === id);
  if (!template) return;
  state.ratio = RATIOS[template.ratio] ? template.ratio : '4:5';
  state.palette = PALETTES[template.palette] ? template.palette : 'citrus';
  state.artStyle = ART_STYLES[template.artStyle] ? template.artStyle : 'editorial';
  state.blocks = Array.isArray(template.blocks) ? template.blocks.map((block, index) => normalizeBlock({ ...block, id: uniqueId(`slot${index + 1}`) }, index)) : sampleBlocks();
  state.projectName = `${template.name}（副本）`;
  selectedBlockId = state.blocks[0]?.id || null;
  els.projectName.value = state.projectName;
  renderAll();
  persistState();
  setView('canvas');
  showToast(`已載入「${template.name}」版型`);
}

function deleteSavedTemplate(id) {
  const templates = loadTemplates().filter((template) => template.id !== id);
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  renderSavedTemplates();
  showToast('已刪除儲存的版型');
}

function resetProject() {
  if (!window.confirm('建立新畫布會取代目前的自動儲存草稿。已儲存的版型不受影響，確定繼續嗎？')) return;
  const savedApiSettings = deepCopy(state.apiSettings);
  state = blankState();
  state.apiSettings = savedApiSettings;
  selectedBlockId = state.blocks[0]?.id || null;
  inspectorTab = 'content';
  zoom = 1;
  els.projectName.value = state.projectName;
  renderAll();
  persistState();
  setView('canvas');
  showToast('已建立空白畫布');
}

function parseAIResponse(rawText) {
  let text = String(rawText || '').trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  return JSON.parse(text);
}

function responseBlocks(parsed) {
  return parsed?.blocks || parsed?.document?.blocks || parsed?.result?.blocks || parsed?.data?.blocks || parsed?.fills || parsed?.results || [];
}

function fillBlocksFromResponse(parsed) {
  const returnedBlocks = responseBlocks(parsed);
  if (!Array.isArray(returnedBlocks)) return 0;
  let count = 0;
  for (const result of returnedBlocks) {
    const target = state.blocks.find((block) => block.id === result?.id);
    if (!target) continue;
    let responseContent = result.content;
    if (typeof responseContent === 'string') {
      if (['heading','text','label'].includes(target.type)) responseContent = { text: responseContent };
      else continue;
    }
    if (responseContent && typeof responseContent === 'object' && !Array.isArray(responseContent)) {
      const permitted = new Set(Object.keys(target.content));
      for (const [key, value] of Object.entries(responseContent)) {
        if (!permitted.has(key)) continue;
        if (target.type === 'steps' && key === 'steps' && typeof value === 'string') target.content.steps = value.split(/\\r?\\n/).map((step) => step.trim()).filter(Boolean).slice(0, 8);
        else if (target.type === 'chart' && key === 'data' && typeof value === 'string') target.content.data = parseChartTextarea(value);
        else target.content[key] = value;
      }
    }
    if (result.research_result && typeof result.research_result === 'object') target.research_result = result.research_result;
    target.task.status = result.ai_task?.status ? String(result.ai_task.status) : 'completed';
    count += 1;
  }
  if (count) selectedBlockId = state.blocks.find((block) => returnedBlocks.some((result) => result?.id === block.id))?.id || selectedBlockId;
  return count;
}

function finishAIFill(count, message = '') {
  if (!count) return false;
  inspectorTab = 'content';
  renderAll();
  persistState();
  setView('canvas');
  showToast(message || `AI 已完成並填入 ${count} 個版位，畫布位置保持不變`);
  return true;
}

function applyAIResponse() {
  const textarea = document.getElementById('aiResponseInput');
  let parsed;
  try {
    parsed = parseAIResponse(textarea.value);
  } catch (error) {
    showToast('無法讀取 JSON，請確認貼上的 AI 回覆格式');
    textarea.focus();
    return;
  }
  const count = fillBlocksFromResponse(parsed);
  if (count === 0) {
    showToast('沒有符合的版位 ID；請使用這份畫布匯出的 JSON 再交給 AI');
    return;
  }
  document.getElementById('importModal').hidden = true;
  textarea.value = '';
  finishAIFill(count, `已將 AI 回覆填入 ${count} 個對應版位，版型位置保持不變`);
}

function openImportModal() {
  document.getElementById('importModal').hidden = false;
  window.setTimeout(() => document.getElementById('aiResponseInput').focus(), 30);
}

function closeImportModal() {
  document.getElementById('importModal').hidden = true;
}

async function copyText(text, successMessage) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const temporary = document.createElement('textarea');
      temporary.value = text;
      temporary.setAttribute('readonly', '');
      temporary.style.position = 'fixed';
      temporary.style.left = '-9999px';
      document.body.appendChild(temporary);
      temporary.select();
      const copied = document.execCommand('copy');
      temporary.remove();
      if (!copied) throw new Error('clipboard copy command failed');
    }
    showToast(successMessage);
  } catch (error) {
    console.warn('複製失敗。', error);
    showToast('複製失敗，請改用選取文字的方式複製。');
  }
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(buildSpec(), null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const baseName = (state.projectName.trim() || 'frame-canvas')
    .toLowerCase().replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-+|-+$/g, '') || 'frame-canvas';
  anchor.href = url;
  anchor.download = `${baseName}-frame-canvas.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('統一 JSON 已下載');
}

function sanitizeHeadersTemplate(value, key) {
  let safe = String(value || '');
  if (key) safe = safe.split(key).join('{{api_key}}');
  try {
    const headers = JSON.parse(safe);
    if (headers && typeof headers === 'object' && !Array.isArray(headers)) {
      for (const [name, value] of Object.entries(headers)) {
        if (!/authorization|api[-_]?key|api[-_]?token|x-token/i.test(name) || typeof value !== 'string' || value.includes('{{api_key}}') || !value.trim()) continue;
        const scheme = value.match(/^\s*(Bearer|Basic|Token)\s+/i)?.[0] || '';
        headers[name] = `${scheme}{{api_key}}`;
      }
      return JSON.stringify(headers, null, 2);
    }
  } catch (error) {
    // Avoid saving a partially typed credential while the JSON header editor is invalid.
    if (/(?:sk-[A-Za-z0-9_-]{10,}|AIza[0-9A-Za-z_-]{18,}|Bearer\s+[A-Za-z0-9._~+/-]{24,})/i.test(safe)) return state.apiSettings.headersTemplate || DEFAULT_API_HEADERS;
  }
  return safe;
}

function syncApiSettingsFromForm() {
  const settings = state.apiSettings;
  const key = document.getElementById('apiKeyInput').value.trim();
  transientApiKey = key;
  settings.rememberKey = document.getElementById('rememberApiKeyCheck').checked;
  const protect = (value) => key ? String(value).split(key).join('{{api_key}}') : String(value);
  settings.preset = document.getElementById('apiPresetSelect').value || 'custom';
  settings.endpoint = protect(document.getElementById('apiEndpointInput').value.trim());
  settings.method = document.getElementById('apiMethodSelect').value || 'POST';
  settings.model = document.getElementById('apiModelInput').value.trim();
  settings.headersTemplate = sanitizeHeadersTemplate(document.getElementById('apiHeadersInput').value, key);
  settings.bodyTemplate = protect(document.getElementById('apiBodyInput').value);
  settings.responsePath = document.getElementById('apiResponsePathInput').value.trim();
  settings.timeoutSeconds = Math.min(300, Math.max(10, Number(document.getElementById('apiTimeoutInput').value) || 120));
  if (settings.rememberKey && key) {
    try { sessionStorage.setItem(API_KEY_SESSION_KEY, key); } catch (error) { /* session storage may be disabled */ }
  } else {
    try { sessionStorage.removeItem(API_KEY_SESSION_KEY); } catch (error) { /* session storage may be disabled */ }
  }
  return key;
}

function setApiConnectionStatus(type, message) {
  const status = document.getElementById('apiConnectionStatus');
  status.classList.remove('connected', 'error');
  if (type === 'connected') status.classList.add('connected');
  if (type === 'error') status.classList.add('error');
  status.lastElementChild.textContent = message;
}

function setApiCallStatus(type, message) {
  const status = document.getElementById('apiCallStatus');
  status.classList.remove('loading', 'success', 'error');
  if (type) status.classList.add(type);
  status.lastElementChild.textContent = message;
}

function applyOpenAICompatiblePreset() {
  const rememberKey = Boolean(state.apiSettings.rememberKey);
  state.apiSettings = { ...DEFAULT_API_SETTINGS, rememberKey };
  renderApiForm();
  persistState();
  setApiConnectionStatus('', '尚未測試連線');
  setApiCallStatus('', '設定完成後即可呼叫');
  showToast('已載入 OpenAI 相容 API 範本');
}

function parseJsonTemplate(template, label) {
  try {
    return JSON.parse(template);
  } catch (error) {
    throw new Error(`${label} 不是合法 JSON，請檢查逗號、引號與括號。`);
  }
}

function replaceTemplateTokens(value, tokens) {
  if (typeof value === 'string') {
    return value.replace(/\{\{([a-z_]+)\}\}/gi, (match, name) => Object.prototype.hasOwnProperty.call(tokens, name.toLowerCase()) ? String(tokens[name.toLowerCase()]) : match);
  }
  if (Array.isArray(value)) return value.map((item) => replaceTemplateTokens(item, tokens));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceTemplateTokens(item, tokens)]));
  return value;
}

function getObjectPath(value, path) {
  const normalized = String(path || '').replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '');
  if (!normalized) return value;
  return normalized.split('.').filter(Boolean).reduce((current, key) => current == null ? undefined : current[key], value);
}

function hasBlockResults(value) {
  const blocks = responseBlocks(value);
  return Array.isArray(blocks) && blocks.length > 0;
}

function parseApiResultValue(value) {
  if (typeof value === 'string') return parseAIResponse(value);
  if (!value || typeof value !== 'object') throw new Error('API 回覆中找不到 JSON 內容。');
  if (hasBlockResults(value)) return value;
  throw new Error('抽取到的回覆沒有 blocks 版位；請確認回覆路徑或 AI 的 JSON 格式。');
}

function extractApiResult(responseData, responsePath) {
  if (responsePath) {
    const value = getObjectPath(responseData, responsePath);
    if (value === undefined) throw new Error(`找不到回覆路徑「${responsePath}」，請修改回覆內容路徑。`);
    return parseApiResultValue(value);
  }
  if (hasBlockResults(responseData)) return responseData;
  const candidatePaths = ['choices.0.message.content', 'choices.0.text', 'output_text', 'candidates.0.content.parts.0.text', 'content.0.text', 'result', 'data'];
  for (const path of candidatePaths) {
    const value = getObjectPath(responseData, path);
    if (value !== undefined) {
      try { return parseApiResultValue(value); } catch (error) { /* try next response shape */ }
    }
  }
  throw new Error('無法從 API 回覆辨識畫布 JSON。請設定正確的回覆內容路徑。');
}

async function callAiApi() {
  const key = syncApiSettingsFromForm();
  persistState();
  const settings = state.apiSettings;
  const endpointTemplate = settings.endpoint.trim();
  const headersText = settings.headersTemplate.trim();
  const bodyText = settings.bodyTemplate.trim();
  const buttons = [document.getElementById('callAiBtn'), document.getElementById('callAiFromJsonBtn')];
  if (!endpointTemplate) {
    setApiConnectionStatus('error', '請先填入 API URL');
    setApiCallStatus('error', '請輸入 API Endpoint URL');
    setView('api');
    document.getElementById('apiEndpointInput').focus();
    return;
  }
  if (!bodyText || !headersText) {
    setApiConnectionStatus('error', '設定不完整');
    setApiCallStatus('error', '請填入 Headers 與 Request Body JSON');
    setView('api');
    return;
  }
  if (endpointTemplate.includes('{{api_key}}') || bodyText.includes('{{api_key}}')) {
    setApiConnectionStatus('error', 'API Key 位置不安全');
    setApiCallStatus('error', '請只在 Request Headers 中使用 {{api_key}}，不要把 Key 放入網址或 Request Body。');
    setView('api');
    return;
  }
  const keyRequired = headersText.includes('{{api_key}}');
  if (keyRequired && !key) {
    setApiConnectionStatus('error', '需要 API Key');
    setApiCallStatus('error', '請填入 API Key，或移除設定中的 {{api_key}} 變數');
    setView('api');
    document.getElementById('apiKeyInput').focus();
    return;
  }
  let endpoint;
  try {
    endpoint = replaceTemplateTokens(endpointTemplate, { model: settings.model, locale: state.locale });
    const parsedUrl = new URL(endpoint);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('URL 必須使用 HTTP 或 HTTPS。');
    if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(parsedUrl.hostname.toLowerCase())) throw new Error('請填入瀏覽器可連線的公開 endpoint；不可直接呼叫 localhost。');
  } catch (error) {
    setApiConnectionStatus('error', 'API URL 無效');
    setApiCallStatus('error', error.message || '請輸入有效的 API Endpoint URL');
    setView('api');
    return;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), settings.timeoutSeconds * 1000);
  buttons.forEach((button) => { button.disabled = true; });
  setApiConnectionStatus('', '正在呼叫你的 API');
  setApiCallStatus('loading', `正在送出 ${state.blocks.length} 個版位與任務規格…`);
  try {
    const spec = buildSpec();
    const tokens = {
      model: settings.model,
      payload: JSON.stringify(spec, null, 2),
      prompt: buildAiPrompt(),
      system_prompt: '你是資訊圖內容研究與填稿助手。嚴格依照使用者傳入的 JSON 與 ai_job.execution_prompt 執行；只更新 blocks[].content、blocks[].research_result、blocks[].ai_task.status，必須保留所有 block id、type、role、geometry、style、canvas 與 design_system。回傳完整 JSON，不要加 Markdown。',
      schema: 'frame.canvas.v1',
      locale: state.locale,
    };
    const headerTemplate = parseJsonTemplate(headersText, 'Request Headers');
    const bodyTemplate = parseJsonTemplate(bodyText, 'Request Body Template');
    const expandedHeaders = replaceTemplateTokens(headerTemplate, { ...tokens, api_key: key });
    const body = replaceTemplateTokens(bodyTemplate, tokens);
    if (!expandedHeaders || Array.isArray(expandedHeaders) || typeof expandedHeaders !== 'object') throw new Error('Request Headers 必須是 JSON 物件。');
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error('Request Body Template 的根節點必須是 JSON 物件。');
    const headers = {};
    for (const [name, value] of Object.entries(expandedHeaders)) if (value !== null && value !== undefined) headers[name] = String(value);
    if (!Object.keys(headers).some((name) => name.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
    const response = await fetch(endpoint, { method: settings.method || 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    const rawText = await response.text();
    if (!response.ok) throw new Error(`API 回傳 HTTP ${response.status}: ${rawText.slice(0, 350) || response.statusText}`);
    let responseData;
    try { responseData = JSON.parse(rawText); }
    catch (error) { throw new Error(`API 回傳不是 JSON，請確認未啟用串流模式。${rawText.slice(0, 100) ? ` 回覆：${rawText.slice(0, 100)}` : ''}`); }
    const aiResult = extractApiResult(responseData, settings.responsePath);
    const count = fillBlocksFromResponse(aiResult);
    if (!count) throw new Error('AI 回覆沒有包含可對應的版位 ID。請將完整輸出規格傳給 AI，並保留 blocks[].id。');
    setApiConnectionStatus('connected', 'API 呼叫成功');
    setApiCallStatus('success', `成功回填 ${count} 個版位；已保留原本位置與樣式。`);
    finishAIFill(count, `AI 已完成並填入 ${count} 個版位`);
  } catch (error) {
    const message = error.name === 'AbortError'
      ? `請求逾時（${settings.timeoutSeconds} 秒）；可延長逾時時間或減少任務。`
      : error instanceof TypeError
        ? '連線失敗：請檢查網址、網路與 CORS 設定。API 必須允許此瀏覽器來源直接呼叫。'
        : (error.message || 'API 呼叫失敗。');
    setApiConnectionStatus('error', 'API 呼叫失敗');
    setApiCallStatus('error', message);
    showToast(message.length > 52 ? 'API 呼叫失敗，請查看連線狀態說明' : message);
    console.warn('AI API request failed:', error);
  } finally {
    window.clearTimeout(timeoutId);
    buttons.forEach((button) => { button.disabled = false; });
  }
}

function updateBlockValue(block, key, value, source = 'content') {
  if (source === 'block') {
    if (key === 'role') block.role = String(value).slice(0, 60);
  } else if (source === 'content') {
    if (key === 'steps') block.content.steps = String(value).split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
    else if (key === 'data') block.content.data = parseChartTextarea(value);
    else block.content[key] = value;
  } else if (source === 'task') {
    if (key === 'require_citations') block.task[key] = Boolean(value);
    else block.task[key] = value;
  }
}

// Navigation and global project controls.
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
document.getElementById('newProjectBtn').addEventListener('click', resetProject);
document.getElementById('saveTemplateBtn').addEventListener('click', saveTemplate);
document.getElementById('downloadJsonTopBtn').addEventListener('click', downloadJson);
document.getElementById('downloadJsonBtn').addEventListener('click', downloadJson);
document.getElementById('copyJsonBtn').addEventListener('click', () => copyText(JSON.stringify(buildSpec(), null, 2), '統一 JSON 已複製'));
document.getElementById('copyAiPromptBtn').addEventListener('click', () => copyText(buildAiPrompt(), 'AI 執行指令已複製'));
document.getElementById('callAiBtn').addEventListener('click', callAiApi);
document.getElementById('callAiFromJsonBtn').addEventListener('click', () => { setView('api'); callAiApi(); });
document.getElementById('importResponseBtn').addEventListener('click', openImportModal);
document.getElementById('importResponseTopBtn').addEventListener('click', openImportModal);
document.getElementById('closeImportModalBtn').addEventListener('click', closeImportModal);
document.getElementById('cancelImportBtn').addEventListener('click', closeImportModal);
document.getElementById('applyResponseBtn').addEventListener('click', applyAIResponse);
document.getElementById('importModal').addEventListener('click', (event) => { if (event.target.id === 'importModal') closeImportModal(); });
document.getElementById('pasteClipboardBtn').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    document.getElementById('aiResponseInput').value = text;
    showToast('已貼上剪貼簿內容');
  } catch (error) {
    showToast('瀏覽器未允許讀取剪貼簿，請在欄位中手動貼上');
  }
});

const apiConfigInputIds = ['apiEndpointInput','apiMethodSelect','apiModelInput','apiHeadersInput','apiBodyInput','apiResponsePathInput','apiTimeoutInput','apiPresetSelect'];
function handleApiSettingsEdit(event) {
  if (event.target.id === 'apiKeyInput') {
    transientApiKey = event.target.value;
    if (document.getElementById('rememberApiKeyCheck').checked && transientApiKey) {
      try { sessionStorage.setItem(API_KEY_SESSION_KEY, transientApiKey); } catch (error) { /* storage may be disabled */ }
    }
    setApiConnectionStatus('', '設定已變更，尚未測試');
    setApiCallStatus('', '設定完成後即可呼叫');
    return;
  }
  syncApiSettingsFromForm();
  persistState();
  setApiConnectionStatus('', '設定已儲存，尚未測試');
  setApiCallStatus('', '設定完成後即可呼叫');
}
apiConfigInputIds.forEach((id) => {
  const element = document.getElementById(id);
  element.addEventListener(element.tagName === 'SELECT' ? 'change' : 'input', handleApiSettingsEdit);
});
document.getElementById('apiKeyInput').addEventListener('input', handleApiSettingsEdit);
document.getElementById('rememberApiKeyCheck').addEventListener('change', (event) => {
  state.apiSettings.rememberKey = event.target.checked;
  if (event.target.checked && transientApiKey) {
    try { sessionStorage.setItem(API_KEY_SESSION_KEY, transientApiKey); } catch (error) { /* storage may be disabled */ }
  } else {
    try { sessionStorage.removeItem(API_KEY_SESSION_KEY); } catch (error) { /* storage may be disabled */ }
  }
  persistState();
});
document.getElementById('toggleApiKeyBtn').addEventListener('click', () => {
  const input = document.getElementById('apiKeyInput');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  document.getElementById('toggleApiKeyBtn').textContent = showing ? '顯示' : '隱藏';
  document.getElementById('toggleApiKeyBtn').setAttribute('aria-label', showing ? '顯示 API Key' : '隱藏 API Key');
});
document.getElementById('apiPresetSelect').addEventListener('change', (event) => {
  if (event.target.value === 'openai-compatible') applyOpenAICompatiblePreset();
});
document.getElementById('restoreApiTemplateBtn').addEventListener('click', applyOpenAICompatiblePreset);
document.getElementById('saveApiSettingsBtn').addEventListener('click', () => {
  syncApiSettingsFromForm();
  persistState();
  setApiConnectionStatus('', '設定已儲存，尚未測試');
  showToast('API 設定已儲存（API Key 未寫入專案）');
});

// Saved templates and preset layouts.
document.querySelectorAll('[data-preset]').forEach((button) => button.addEventListener('click', () => applyPreset(button.dataset.preset)));
els.customTemplates.addEventListener('click', (event) => {
  const load = event.target.closest('[data-load-template]');
  const remove = event.target.closest('[data-delete-template]');
  if (load) applySavedTemplate(load.dataset.loadTemplate);
  if (remove) deleteSavedTemplate(remove.dataset.deleteTemplate);
});

// Toolbox supports both click-to-add and drag-and-drop onto the canvas.
document.querySelectorAll('[data-add-block]').forEach((button) => {
  button.addEventListener('click', () => addBlock(button.dataset.addBlock));
  button.addEventListener('dragstart', (event) => {
    event.dataTransfer.setData('application/x-frame-block', button.dataset.addBlock);
    event.dataTransfer.effectAllowed = 'copy';
  });
});
els.board.addEventListener('dragover', (event) => {
  if (event.dataTransfer.types.includes('application/x-frame-block')) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }
});
els.board.addEventListener('drop', (event) => {
  const type = event.dataTransfer.getData('application/x-frame-block');
  if (!TYPE_META[type]) return;
  event.preventDefault();
  const rect = els.board.getBoundingClientRect();
  const place = { x: Math.round((event.clientX - rect.left) / rect.width * 100), y: Math.round((event.clientY - rect.top) / rect.height * 100) };
  const pos = nextPosition(type);
  addBlock(type, normalizePosition({ ...pos, x: Math.min(100 - pos.w, place.x - pos.w / 2), y: Math.min(100 - pos.h, place.y - pos.h / 2) }));
});

// Pointer interactions move and resize canvas slots without altering their content.
els.board.addEventListener('pointerdown', (event) => {
  const blockElement = event.target.closest('[data-block-id]');
  if (!blockElement) {
    if (event.target === els.board) selectBlock(null);
    return;
  }
  const id = blockElement.dataset.blockId;
  if (event.target.closest('[data-action="remove"]')) return;
  const resizing = Boolean(event.target.closest('[data-action="resize"]'));
  selectBlock(id);
  startPointerOperation(event, id, resizing ? 'resize' : 'move');
});
els.board.addEventListener('click', (event) => {
  const remove = event.target.closest('[data-action="remove"]');
  if (remove) {
    const block = event.target.closest('[data-block-id]');
    if (block) removeBlock(block.dataset.blockId);
  }
});
window.addEventListener('pointermove', pointerMove);
window.addEventListener('pointerup', pointerUp);
window.addEventListener('pointercancel', pointerUp);

// Inspector controls update the selected block and immediately refresh the canvas and JSON.
document.querySelectorAll('.inspector-tab').forEach((button) => button.addEventListener('click', () => setInspectorTab(button.dataset.inspectorTab)));
document.getElementById('inspectorScroll').addEventListener('input', (event) => {
  const block = getSelectedBlock();
  if (!block) return;
  const input = event.target;
  const positionField = input.dataset.positionField;
  if (positionField) {
    const value = Math.max(0, Math.min(100, Number(input.value) || 0));
    const patch = { [positionField]: value };
    moveOrResizeBlock(block.id, patch);
  } else if (input.dataset.blockField) {
    updateBlockValue(block, input.dataset.blockField, input.value, 'block');
    renderCanvas();
  } else if (input.dataset.contentField) {
    updateBlockValue(block, input.dataset.contentField, input.value, 'content');
    renderCanvas();
  } else if (input.dataset.taskField) {
    updateBlockValue(block, input.dataset.taskField, input.type === 'checkbox' ? input.checked : input.value, 'task');
    renderCanvas();
    const status = els.selectedBlockMeta.querySelector('.task-indicator');
    if (status) {
      status.textContent = taskName(currentTaskMode(block));
      status.classList.toggle('mode-provided', currentTaskMode(block) === 'provided');
    }
  } else if (input.dataset.styleField) {
    block.style[input.dataset.styleField] = input.value;
    renderCanvas();
  }
  updateJsonPanel();
  persistState();
});
els.inspectorScroll.addEventListener('change', (event) => {
  const input = event.target;
  if (input.dataset.positionField) {
    const block = getSelectedBlock();
    if (block) {
      renderInspector();
      updateJsonPanel();
    }
  }
});
els.inspectorScroll.addEventListener('click', (event) => {
  const modeButton = event.target.closest('[data-task-mode]');
  const paletteButton = event.target.closest('[data-palette-choice]');
  const artButton = event.target.closest('[data-art-style]');
  const alignButton = event.target.closest('[data-align]');
  const fillButton = event.target.closest('[data-fill]');
  const block = getSelectedBlock();
  if (modeButton && block) {
    block.task.mode = modeButton.dataset.taskMode;
    if (block.task.mode === 'image' && block.type !== 'image') block.task.instruction ||= '依照此版位的內容任務生成一張無文字的輔助圖片。';
    inspectorTab = 'ai';
    renderAll();
    persistState();
  } else if (paletteButton) {
    state.palette = paletteButton.dataset.paletteChoice;
    renderAll();
    persistState();
  } else if (artButton) {
    state.artStyle = artButton.dataset.artStyle;
    renderAll();
    persistState();
  } else if (alignButton && block) {
    block.style.align = alignButton.dataset.align;
    renderAll();
    persistState();
  } else if (fillButton && block) {
    block.style.fill = fillButton.dataset.fill;
    renderAll();
    persistState();
  }
});
document.getElementById('duplicateBlockBtn').addEventListener('click', duplicateBlock);
document.getElementById('deleteBlockBtn').addEventListener('click', () => removeBlock());

// Project context is shared with all selected AI tasks.
els.projectName.addEventListener('input', () => { state.projectName = els.projectName.value; updateJsonPanel(); persistState(); });
const globalFields = [
  ['topicInput', 'topic', 'input'],
  ['globalBriefInput', 'brief', 'input'],
  ['sourceUrlsInput', 'sourceUrls', 'input'],
];
globalFields.forEach(([id, key, eventName]) => document.getElementById(id).addEventListener(eventName, (event) => {
  state.globalContext[key] = event.target.value;
  updateJsonPanel();
  persistState();
}));
document.getElementById('localeSelect').addEventListener('change', (event) => { state.locale = event.target.value; updateJsonPanel(); persistState(); });
[
  ['citationsCheck', 'requireCitations'],
  ['preserveFactsCheck', 'preserveFacts'],
  ['keepLayoutCheck', 'lockLayout'],
].forEach(([id,key]) => document.getElementById(id).addEventListener('change', (event) => {
  state.globalContext[key] = event.target.checked;
  updateJsonPanel();
  persistState();
}));

// Canvas toolbar.
document.getElementById('ratioSelect').addEventListener('change', (event) => {
  state.ratio = RATIOS[event.target.value] ? event.target.value : '4:5';
  renderCanvas();
  updateJsonPanel();
  persistState();
});
document.getElementById('zoomOutBtn').addEventListener('click', () => { zoom = Math.max(.65, Math.round((zoom - .1) * 10) / 10); renderCanvas(); });
document.getElementById('zoomInBtn').addEventListener('click', () => { zoom = Math.min(1.3, Math.round((zoom + .1) * 10) / 10); renderCanvas(); });
document.getElementById('fitCanvasBtn').addEventListener('click', () => { zoom = 1; renderCanvas(); });
document.getElementById('addBlockFooterBtn').addEventListener('click', () => addBlock('text'));

// Keyboard shortcuts: save, create, delete selected slot, and escape selection.
document.addEventListener('keydown', (event) => {
  const target = event.target;
  const typing = target && ['INPUT','TEXTAREA','SELECT'].includes(target.tagName);
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    document.getElementById('newProjectBtn').click();
  } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    persistState();
    showToast('草稿已儲存在本機瀏覽器');
  } else if (!typing && (event.key === 'Delete' || event.key === 'Backspace') && selectedBlockId && !document.getElementById('importModal').hidden) {
    // Keep the active modal text untouched.
  } else if (!typing && (event.key === 'Delete' || event.key === 'Backspace') && selectedBlockId) {
    removeBlock();
  } else if (event.key === 'Escape') {
    if (!document.getElementById('importModal').hidden) closeImportModal();
    else if (selectedBlockId) selectBlock(null);
  }
});

// First paint and restore locally-saved templates.
els.projectName.value = state.projectName || '';
renderSavedTemplates();
renderAll();

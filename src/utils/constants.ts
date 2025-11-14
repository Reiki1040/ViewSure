// Application constants
export const APP_CONSTANTS = {
  // Default adjustment values
  INITIAL_BRIGHTNESS: 100,
  INITIAL_CONTRAST: 0,
  MAX_BRIGHTNESS: 200,
  MIN_BRIGHTNESS: 0,
  MAX_CONTRAST: 100,
  MIN_CONTRAST: -100,

  // Aspect ratios
  DEFAULT_WCAG_ASPECT: 9 / 16,
  DEFAULT_VIEWPORT_ASPECT: 16 / 9,

  // Status messages
  INITIAL_STATUS_MESSAGE: 'PDF または画像ファイルを読み込んでください',
  READY_STATUS_MESSAGE: '準備完了。PDF / PPTX / 画像ファイルをドラッグ＆ドロップしてください。',
  LOADING_MESSAGE: '読み込み中です...',
  EXPORTING_MESSAGE: 'PDFを準備しています...',

  // File handling
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  SUPPORTED_FILE_TYPES: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/heif',
    '.heic',
    '.heif'
  ] as const,

  // Projector settings
  PROJECTOR_DEFAULTS: {
    gamma: 2.2,
    blackLift: 0.12,
    colorTempShift: 0,
    vignette: 0.18,
    hotspot: 0.08
  },

  // WCAG thresholds
  WCAG_THRESHOLDS: {
    MIN_HEADING_FONT_SIZE: 28,
    MIN_BODY_FONT_SIZE: 18,
    CONTRAST_RATIO_HEADING: 3,
    CONTRAST_RATIO_BODY: 4.5,
    LUMINANCE_DARK: 0.45,
    LUMINANCE_BRIGHT: 0.75
  },

  // Performance settings
  RAF_DEBOUNCE_MS: 16, // ~60fps
  RESIZE_DEBOUNCE_MS: 100,
  ERROR_TIMEOUT_MS: 5000,

  // UI constants
  SLIDER_STEP: 1,
  PAGE_INPUT_MIN: 1,
  Z_INDEX: {
    OVERLAY: 1000,
    MODAL: 900,
    TOOLBAR: 800,
    NAVIGATION: 700
  }
} as const;

// WebGL constants
export const WEBGL_CONSTANTS = {
  VERTEX_SHADER_SOURCE: `
attribute vec2 a_position;
attribute vec2 a_uv;
varying vec2 v_uv;
uniform vec2 u_scale;

void main() {
  vec2 scaled = a_position * u_scale;
  gl_Position = vec4(scaled, 0.0, 1.0);
  v_uv = vec2(a_uv.x, 1.0 - a_uv.y);
}
`,

  FRAGMENT_SHADER_SOURCE: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_gamma;
uniform float u_blackLift;
uniform vec3  u_colorGain;
uniform float u_vignette;
uniform float u_hotspot;
uniform float u_projEnabled;

vec3 applyContrast(vec3 color, float contrastFactor) {
  return (color - 0.5) * contrastFactor + 0.5;
}

void main() {
  vec4 texColor = texture2D(u_texture, v_uv);
  vec3 contrasted = applyContrast(texColor.rgb, u_contrast);
  vec3 adjusted = clamp(contrasted * u_brightness, 0.0, 1.0);

  if (u_projEnabled > 0.5) {
    adjusted *= u_colorGain;
    adjusted = clamp(adjusted, 0.0, 1.0);

    float invGamma = max(0.001, 1.0 / max(0.001, u_gamma));
    adjusted = pow(adjusted, vec3(invGamma));

    adjusted = clamp(adjusted * (1.0 - u_blackLift) + vec3(u_blackLift), 0.0, 1.0);

    vec2 centered = v_uv * 2.0 - 1.0;
    float r = length(centered);
    float vig = 1.0 - u_vignette * smoothstep(0.4, 1.0, r);
    float hot = 1.0 + u_hotspot * (1.0 - smoothstep(0.0, 1.0, r)) * 0.25;
    adjusted *= vig * hot;
    adjusted = clamp(adjusted, 0.0, 1.0);
  }

  gl_FragColor = vec4(adjusted, texColor.a);
}
`,

  POSITIONS: new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    1, 1
  ]),

  UVS: new Float32Array([
    0, 0,
    1, 0,
    0, 1,
    1, 1
  ])
} as const;

// Error messages
export const ERROR_MESSAGES = {
  FILE: {
    UNSUPPORTED_FORMAT: '対応していないファイル形式です。PDF / PPTX / PNG / JPEG / WEBP / HEIC を使用してください。',
    LOAD_FAILED: 'ファイルの読み込みに失敗しました',
    CONVERSION_FAILED: '画像データの変換に失敗しました',
    HEIC_CONVERSION_FAILED: 'HEIC 画像の変換に失敗しました'
  },
  RENDER: {
    INIT_FAILED: 'WebGL レンダラーの初期化が完了していません',
    CONTEXT_FAILED: 'キャンバスの初期化に失敗しました',
    TEXTURE_FAILED: 'テクスチャの作成に失敗しました'
  },
  EXPORT: {
    FRAME_CAPTURE_FAILED: 'プレビュー画像の書き出しに失敗しました',
    PDF_GENERATION_FAILED: 'PDF の生成に失敗しました',
    NO_PAGES: 'PDF 生成対象のページがありません'
  },
  ANALYSIS: {
    FAILED: 'WCAG 解析に失敗しました',
    NO_ASSET: 'まず資料を読み込んでください',
    NOT_READY: 'WCAG 解析結果を準備中です…'
  },
  NETWORK: {
    MODULE_LOAD_FAILED: 'モジュールの読み込みに失敗しました',
    WASM_LOAD_FAILED: 'WebAssembly モジュールの読み込みに失敗しました'
  }
} as const;

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  PREVIOUS_PAGE: ['ArrowLeft', 'ArrowUp'],
  NEXT_PAGE: ['ArrowRight', 'ArrowDown'],
  OPEN_FILE: ['o', 'O'],
  DOWNLOAD: ['d', 'D'],
  RESET: ['r', 'R'],
  TOGGLE_PROJECTOR: ['p', 'P']
} as const;

// Color constants
export const COLORS = {
  BACKGROUND: 'rgba(0.1, 0.12, 0.2, 1)',
  OVERLAY: 'rgba(0, 0, 0, 0.7)',
  TEXT_PRIMARY: 'rgba(244, 248, 255, 0.95)',
  TEXT_SECONDARY: 'rgba(224, 230, 255, 0.85)',
  SHADOW: 'rgba(0, 0, 0, 0.35)'
} as const;

// Performance constants
export const PERFORMANCE = {
  SAMPLING_STEP: 100, // For luminance calculation
  MAX_CACHE_SIZE: 50, // For PDF page caching
  DEBOUNCE_DELAY: 16, // RequestAnimationFrame timing
  MEMORY_THRESHOLD: 0.8 // 80% memory usage threshold
} as const;
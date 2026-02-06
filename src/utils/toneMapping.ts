// src/utils/toneMapping.ts

interface WasmInstance {
  exports: {
    memory: WebAssembly.Memory;
    allocate: (size: number) => number;
    deallocate: (ptr: number, size: number) => void;
    transform: (ptr: number, width: number, height: number) => void;
    brightnessOffset: (offset: number) => void;
    contrastFactor: (factor: number) => void;
  };
}

let wasmInstance: WasmInstance | null = null;

const clamp255 = (value: number) => Math.max(0, Math.min(255, value));

const applyProjectorCurve = (data: Uint8ClampedArray) => {
  // プロジェクターでの「白っぽく・少し暗く・緩いコントラスト」を模倣する係数
  // - brightness: マイナスで暗く、プラスで明るく。数値が大きいほど変化が強い。
  // - contrast: 1より小さいとコントラスト低下、1より大きいとコントラスト強調。
  // - warmTint: r/g/bを1より大きくするとその色成分を強め、1未満で弱める（色かぶりを演出）。
  // - haze: 0〜1で白かぶりの強さ。大きいほど霧がかった見た目になる。
  const brightness = -16; // 輝度を下げる
  const contrast = 0.9;   // コントラストを弱める
  const warmTint = { r: 1, g: 1, b: 1 }; // 色温度は変えず中立
  const haze = 0.20;       // 白ベール（霧がかった見た目）

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    r = ((r - 128) * contrast + 128) * warmTint.r + brightness;
    g = ((g - 128) * contrast + 128) * warmTint.g + brightness;
    b = ((b - 128) * contrast + 128) * warmTint.b + brightness;

    // apply white haze
    r = r * (1 - haze) + 255 * haze;
    g = g * (1 - haze) + 255 * haze;
    b = b * (1 - haze) + 255 * haze;

    data[i] = clamp255(r);
    data[i + 1] = clamp255(g);
    data[i + 2] = clamp255(b);
    // alpha untouched
  }
};

/**
 * Loads and initializes the WebAssembly module.
 * Must be called once before using the apply function.
 */
export async function initWasm(): Promise<void> {
  if (wasmInstance) {
    return;
  }
  try {
    const response = await fetch('/wasm/tone_mapping.wasm');
    const buffer = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(buffer);
    wasmInstance = instance as unknown as WasmInstance;
    console.log('Tone mapping WASM module initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize tone mapping WASM module:', error);
    throw new Error('Could not initialize WASM.');
  }
}

/**
 * Applies a tone mapping effect to the given canvas context.
 * `initWasm` must be called before this function.
 * @param ctx The 2D rendering context of the canvas to modify.
 * @param width The width of the canvas area to process.
 * @param height The height of the canvas area to process.
 */
export function applyToneMapping(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  // Step 0: 投影で発生する解像感の低下を模倣（ダウンスケール→アップスケールで輪郭を甘くする）
  // 低解像度化による“にじみ”を先に入れてから、トーン/コントラスト補正を行う
  const resolutionFactor = 0.7; // 1未満にするとソフトフォーカスに近づく
  const sourceCanvas = ctx.canvas as HTMLCanvasElement;
  const lowResCanvas = document.createElement('canvas');
  lowResCanvas.width = Math.max(1, Math.round(width * resolutionFactor));
  lowResCanvas.height = Math.max(1, Math.round(height * resolutionFactor));
  const lowResCtx = lowResCanvas.getContext('2d');
  if (lowResCtx) {
    lowResCtx.imageSmoothingEnabled = true;
    lowResCtx.drawImage(sourceCanvas, 0, 0, lowResCanvas.width, lowResCanvas.height);
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(lowResCanvas, 0, 0, width, height);
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const byteLength = data.byteLength;

  let wasmPtr = 0;
  try {
    if (wasmInstance) {
      // 1. WASM側に処理用のメモリを確保
      wasmPtr = wasmInstance.exports.allocate(byteLength);
      if (wasmPtr === 0) {
        throw new Error('Failed to allocate memory in WASM.');
      }

      // 2. 画像データをWASMメモリへコピー
      const wasmMemory = new Uint8Array(wasmInstance.exports.memory.buffer, wasmPtr, byteLength);
      wasmMemory.set(data);

      // 3. WASMのパラメータをセット（輝度・コントラスト補正）
      wasmInstance.exports.brightnessOffset(-15);
      wasmInstance.exports.contrastFactor(1.25);

      // 4. トーンマッピングをWASM側で実行
      wasmInstance.exports.transform(wasmPtr, width, height);

      // 5. 補正後データを読み出し、さらにプロジェクター風カーブを適用
      const modifiedData = new Uint8ClampedArray(wasmMemory.buffer, wasmPtr, byteLength);
      applyProjectorCurve(modifiedData);

      ctx.putImageData(new ImageData(modifiedData, width, height), 0, 0);
      return;
    }

    throw new Error('WASM module not initialized');

  } catch (error) {
    console.warn('Tone mapping (WASM) unavailable, using JS fallback.', error);
    // JavaScriptフォールバック：プロジェクター風カーブのみ適用
    const fallbackData = new Uint8ClampedArray(data);
    applyProjectorCurve(fallbackData);
    ctx.putImageData(new ImageData(fallbackData, width, height), 0, 0);
  } finally {
    // 7. 確保したWASMメモリを解放
    if (wasmPtr !== 0 && wasmInstance) {
      wasmInstance.exports.deallocate(wasmPtr, byteLength);
    }
  }
}

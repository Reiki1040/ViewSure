export type ToneMappingExports = {
  contrastFactor: (contrast: number) => number;
  brightnessOffset: (brightness: number) => number;
};

let wasmExportsPromise: Promise<ToneMappingExports> | null = null;

const instantiateModule = async () => {
  const wasmUrl = new URL('../wasm/tone_mapping.wasm', import.meta.url);

  if (typeof WebAssembly.instantiateStreaming === 'function') {
    try {
      const { instance } = await WebAssembly.instantiateStreaming(fetch(wasmUrl));
      return instance.exports as unknown as ToneMappingExports;
    } catch {
      // Safari currently requires ArrayBuffer instantiation.
    }
  }

  const response = await fetch(wasmUrl);
  const buffer = await response.arrayBuffer();
  const { instance } = await WebAssembly.instantiate(buffer);
  return instance.exports as unknown as ToneMappingExports;
};

export const loadToneMappingModule = async (): Promise<ToneMappingExports> => {
  if (!wasmExportsPromise) {
    wasmExportsPromise = instantiateModule();
  }
  return wasmExportsPromise;
};


declare module '*.wasm?url' {
  const url: string;
  export default url;
}

declare module '*.js?url' {
  const url: string;
  export default url;
}

interface Window {
  PptxPreview?: {
    renderAsync: (
      source: ArrayBuffer | Uint8Array | Blob,
      container: HTMLElement,
      options?: {
        slideNumber?: number;
        slideSize?: {
          width: number;
          height: number;
        };
      }
    ) => Promise<void>;
  };
}

declare module 'heic2any' {
  type Heic2AnyOptions = {
    blob: Blob;
    toType?: string;
    quality?: number;
  };

  type Heic2AnyResult = Blob | Blob[];

  export default function heic2any(options: Heic2AnyOptions): Promise<Heic2AnyResult>;
}

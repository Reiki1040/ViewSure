/**
 * WebGLベースのプロジェクションレンダリングフック
 *
 * このフックはWebGLを使用して画像のレンダリングとリアルタイム調整を提供します。
 * 明るさ・コントラスト調整、プロジェクタープレビュー効果、フレームキャプチャなどの機能を担当します。
 *
 * 主要機能:
 * - WebGLコンテキストの初期化と管理
 * - 画像のテクスチャとしての読み込みと表示
 * - リアルタイムの画像調整（明るさ、コントラスト）
 * - プロジェクターシミュレーション効果
 * - フレームキャプチャとエクスポート
 * - WASMベースのトーンマッピング
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadToneMappingModule, type ToneMappingExports } from '../utils/toneMappingWasm';
import { calculateScale, resizeCanvasToDisplaySize } from '../utils/webgl';
import { WebGLResourceManager, type ProjectorSettings } from '../lib/webgl/WebGLResourceManager';

export type CaptureFrameResult = {
  blob: Blob;
  width: number;
  height: number;
};

export type AdjustmentPayload = {
  brightness: number;
  contrast: number;
};

const INITIAL_ADJUSTMENTS = { brightness: 1, contrast: 1 };
const INITIAL_INPUTS = { brightness: 100, contrast: 0 };
const DEFAULT_PROJECTOR_SETTINGS: ProjectorSettings = {
  enabled: false,
  gamma: 1.0,
  blackLift: 0.0,
  colorGain: { r: 1.0, g: 1.0, b: 1.0 },
  vignette: 0.0,
  hotspot: 0.0
};

export const useProjectionRenderer = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const resourceManagerRef = useRef<WebGLResourceManager | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  
  const toneMappingRef = useRef<ToneMappingExports | null>(null);
  const adjustmentsRef = useRef<AdjustmentPayload>(INITIAL_ADJUSTMENTS);
  const lastInputRef = useRef<{ brightness: number; contrast: number }>(INITIAL_INPUTS);
  const rafHandleRef = useRef<number | null>(null);

  const firstAspectRatioRef = useRef<number | null>(null);
  const projectorSettingsRef = useRef<ProjectorSettings>(DEFAULT_PROJECTOR_SETTINGS);

  const drawScene = useCallback(() => {
    const resourceManager = resourceManagerRef.current;
    const canvas = canvasRef.current;
    if (!resourceManager || !canvas) {
      return;
    }

    const resources = resourceManager.getResources();
    if (!resources || !resources.imageSize) {
      return;
    }

    const needsResize = resizeCanvasToDisplaySize(canvas);
    if (needsResize) {
      resources.canvasSize = { width: canvas.width, height: canvas.height };
    }

    resources.gl.viewport(0, 0, canvas.width, canvas.height);
    resources.gl.clearColor(0.1, 0.12, 0.2, 1);
    resources.gl.clear(resources.gl.COLOR_BUFFER_BIT);

    const scale = calculateScale(
      resources.canvasSize,
      resources.imageSize
    );
    resourceManager.updateScaleUniform(scale.x, scale.y);
    resourceManager.updateAdjustmentUniforms(
      adjustmentsRef.current.brightness,
      adjustmentsRef.current.contrast
    );
    resourceManager.updateProjectorUniforms(projectorSettingsRef.current);

    resources.gl.drawArrays(resources.gl.TRIANGLE_STRIP, 0, 4);
  }, []);

  const scheduleDraw = useCallback(() => {
    if (rafHandleRef.current !== null) {
      return;
    }
    rafHandleRef.current = window.requestAnimationFrame(() => {
      rafHandleRef.current = null;
      drawScene();
    });
  }, [drawScene]);

  const loadImage = useCallback(
    async (source: TexImageSource) => {
      const resourceManager = resourceManagerRef.current;
      if (!resourceManager) {
        throw new Error('WebGL レンダラーの初期化が完了していません');
      }

      resourceManager.loadTexture(source);

      const getSourceDimensions = (source: TexImageSource) => {
        if (source instanceof ImageBitmap) {
          return { width: source.width, height: source.height };
        }
        if (source instanceof HTMLImageElement) {
          return { width: source.naturalWidth || source.width, height: source.naturalHeight || source.height };
        }
        if (source instanceof HTMLCanvasElement) {
          return { width: source.width, height: source.height };
        }
        if (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) {
          return { width: source.width, height: source.height };
        }
        if (source instanceof ImageData) {
          return { width: source.width, height: source.height };
        }
        if (source instanceof HTMLVideoElement) {
          return { width: source.videoWidth, height: source.videoHeight };
        }
        return { width: 0, height: 0 };
      };

      const imageSize = getSourceDimensions(source);
      if (imageSize.width > 0 && imageSize.height > 0) {
        if (firstAspectRatioRef.current === null) {
          firstAspectRatioRef.current = imageSize.height / imageSize.width;
          console.debug('[ProjectionRenderer] Initial aspect ratio captured', {
            width: imageSize.width,
            height: imageSize.height,
            aspect: firstAspectRatioRef.current
          });
        }
        setAspectRatio(firstAspectRatioRef.current);
      } else {
        console.warn('[ProjectionRenderer] Invalid image dimensions detected', imageSize);
      }

      setIsReady(true);
      scheduleDraw();

      if (source instanceof ImageBitmap && typeof source.close === 'function') {
        try {
          source.close();
        } catch {
          // ignore
        }
      }
    },
    [scheduleDraw]
  );

  const resetAspectRatio = useCallback(() => {
    firstAspectRatioRef.current = null;
    setAspectRatio(null);
    console.debug('[ProjectionRenderer] resetAspectRatio invoked');
  }, []);

  const updateAspectRatio = useCallback((ratio: number | null) => {
    setAspectRatio(ratio);
    console.debug('[ProjectionRenderer] updateAspectRatio invoked', ratio);
  }, []);

  const updateAdjustments = useCallback(
    ({ brightness, contrast }: AdjustmentPayload) => {
      lastInputRef.current = { brightness, contrast };
      const wasm = toneMappingRef.current;
      const brightnessFactor = wasm ? wasm.brightnessOffset(brightness) : Math.max(brightness / 100, 0.0);
      const contrastFactor = wasm ? wasm.contrastFactor(contrast) : 1 + contrast / 100;
      adjustmentsRef.current = {
        brightness: brightnessFactor,
        contrast: contrastFactor
      };
      scheduleDraw();
    },
    [scheduleDraw]
  );

  const updateProjectorPreview = useCallback(
    (params: {
      enabled?: boolean;
      gamma?: number;
      blackLift?: number;
      colorTempShift?: number; // -1 (warm) .. +1 (cool)
      vignette?: number;
      hotspot?: number;
    }) => {
      const next = projectorSettingsRef.current;
      if (typeof params.enabled === 'boolean') next.enabled = params.enabled;
      if (typeof params.gamma === 'number') next.gamma = Math.max(0.5, Math.min(params.gamma, 3.0));
      if (typeof params.blackLift === 'number') next.blackLift = Math.max(0.0, Math.min(params.blackLift, 0.5));
      if (typeof params.vignette === 'number') next.vignette = Math.max(0.0, Math.min(params.vignette, 1.0));
      if (typeof params.hotspot === 'number') next.hotspot = Math.max(0.0, Math.min(params.hotspot, 1.0));
      if (typeof params.colorTempShift === 'number') {
        const s = Math.max(-1, Math.min(1, params.colorTempShift));
        const r = 1 + 0.08 * s;
        const g = 1.0;
        const b = 1 - 0.08 * s;
        next.colorGain = {
          r: Math.max(0.7, Math.min(1.3, r)),
          g: g,
          b: Math.max(0.7, Math.min(1.3, b))
        };
      }
      scheduleDraw();
    },
    [scheduleDraw]
  );

  const initializeWebGL = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (!canvas) {
        return;
      }

      resourceManagerRef.current = new WebGLResourceManager();
      resourceManagerRef.current.initialize(canvas);
      resizeCanvasToDisplaySize(canvas);
    },
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    initializeWebGL(canvas);
    const handleResize = () => scheduleDraw();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafHandleRef.current !== null) {
        cancelAnimationFrame(rafHandleRef.current);
        rafHandleRef.current = null;
      }
      resourceManagerRef.current?.dispose();
      resourceManagerRef.current = null;
    };
  }, [initializeWebGL, scheduleDraw]);

  const captureFrame = useCallback(async (): Promise<CaptureFrameResult> => {
    const canvas = canvasRef.current;
    const resourceManager = resourceManagerRef.current;

    if (!canvas || !resourceManager) {
      throw new Error('WebGL レンダラーの初期化が完了していません');
    }

    const resources = resourceManager.getResources();
    if (!resources || !resources.imageSize) {
      throw new Error('WebGL レンダラーの初期化が完了していません');
    }

    drawScene();
    try {
      resources.gl.finish?.();
    } catch {
      // finish が未定義の環境向けフォールバック
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error('プレビュー画像の書き出しに失敗しました'));
        }
      }, 'image/png');
    });

    return {
      blob,
      width: canvas.width,
      height: canvas.height
    };
  }, [drawScene]);

  useEffect(() => {
    let disposed = false;
    loadToneMappingModule()
      .then((exports) => {
        if (disposed) {
          return;
        }
        toneMappingRef.current = exports;
        const { brightness, contrast } = lastInputRef.current;
        adjustmentsRef.current = {
          brightness: exports.brightnessOffset(brightness),
          contrast: exports.contrastFactor(contrast)
        };
        scheduleDraw();
      })
      .catch((error) => {
        console.error('WebAssembly モジュールの読み込みに失敗しました', error);
      });

    return () => {
      disposed = true;
    };
  }, [scheduleDraw]);

  return useMemo(
    () => ({
      canvasRef,
      isReady,
      loadImage,
      updateAdjustments,
      updateProjectorPreview,
      captureFrame,
      imageAspectRatio: aspectRatio,
      resetAspectRatio,
      updateAspectRatio
    }),
    [
      aspectRatio,
      captureFrame,
      isReady,
      loadImage,
      resetAspectRatio,
      updateAdjustments,
      updateProjectorPreview,
      updateAspectRatio
    ]
  );
};
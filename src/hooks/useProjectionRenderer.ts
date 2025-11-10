import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadToneMappingModule, type ToneMappingExports } from '../utils/toneMappingWasm';
import { calculateScale, createProgram, resizeCanvasToDisplaySize } from '../utils/webgl';

type WebGLResources = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  positionBuffer: WebGLBuffer;
  uvBuffer: WebGLBuffer;
  texture: WebGLTexture;
  attributeLocations: {
    position: number;
    uv: number;
  };
  uniformLocations: {
    brightness: WebGLUniformLocation;
    contrast: WebGLUniformLocation;
    scale: WebGLUniformLocation;
  };
  canvasSize: {
    width: number;
    height: number;
  };
  imageSize: {
    width: number;
    height: number;
  } | null;
};

type AdjustmentPayload = {
  brightness: number;
  contrast: number;
};

export type CaptureFrameResult = {
  blob: Blob;
  width: number;
  height: number;
};

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

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_uv;
varying vec2 v_uv;
uniform vec2 u_scale;

void main() {
  vec2 scaled = a_position * u_scale;
  gl_Position = vec4(scaled, 0.0, 1.0);
  v_uv = vec2(a_uv.x, 1.0 - a_uv.y);
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_gamma;       // projector gamma
uniform float u_blackLift;   // black level lift (0..0.5)
uniform vec3  u_colorGain;   // RGB gain for color temp shift
uniform float u_vignette;    // vignette strength 0..1
uniform float u_hotspot;     // center hotspot 0..1
uniform float u_projEnabled; // 0 or 1

vec3 applyContrast(vec3 color, float contrastFactor) {
  return (color - 0.5) * contrastFactor + 0.5;
}

void main() {
  vec4 texColor = texture2D(u_texture, v_uv);
  vec3 contrasted = applyContrast(texColor.rgb, u_contrast);
  vec3 adjusted = clamp(contrasted * u_brightness, 0.0, 1.0);

  // Projector preview effects
  if (u_projEnabled > 0.5) {
    // Color temperature shift via per-channel gain
    adjusted *= u_colorGain;
    adjusted = clamp(adjusted, 0.0, 1.0);

    // Gamma (projector typically > 1.0)
    float invGamma = max(0.001, 1.0 / max(0.001, u_gamma));
    adjusted = pow(adjusted, vec3(invGamma));

    // Black level lift (ambient washout)
    adjusted = clamp(adjusted * (1.0 - u_blackLift) + vec3(u_blackLift), 0.0, 1.0);

    // Vignette (edge falloff) and hotspot (center boost)
    vec2 centered = v_uv * 2.0 - 1.0; // -1..1
    float r = length(centered);
    float vig = 1.0 - u_vignette * smoothstep(0.4, 1.0, r);
    float hot = 1.0 + u_hotspot * (1.0 - smoothstep(0.0, 1.0, r)) * 0.25;
    adjusted *= vig * hot;
    adjusted = clamp(adjusted, 0.0, 1.0);
  }

  gl_FragColor = vec4(adjusted, texColor.a);
}
`;

const POSITIONS = new Float32Array([
  -1, -1,
  1, -1,
  -1, 1,
  1, 1
]);

const UVS = new Float32Array([
  0, 0,
  1, 0,
  0, 1,
  1, 1
]);

export const useProjectionRenderer = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const resourcesRef = useRef<WebGLResources | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const toneMappingRef = useRef<ToneMappingExports | null>(null);
  const adjustmentsRef = useRef<AdjustmentPayload>({ brightness: 1, contrast: 1 });
  const lastInputRef = useRef<{ brightness: number; contrast: number }>({ brightness: 100, contrast: 0 });
  const rafHandleRef = useRef<number | null>(null);

  const firstAspectRatioRef = useRef<number | null>(null);
  const currentAspectRef = useRef<number | null>(null);
  const projectorRef = useRef({
    enabled: false,
    gamma: 1.0,
    blackLift: 0.0,
    colorGain: { r: 1.0, g: 1.0, b: 1.0 },
    vignette: 0.0,
    hotspot: 0.0
  });

  const drawScene = useCallback(() => {
    const resources = resourcesRef.current;
    const canvas = canvasRef.current;
    if (!resources || !canvas) {
      return;
    }

    const { gl, program, uniformLocations } = resources;
      const { brightness, contrast } = adjustmentsRef.current;

    const needsResize = resizeCanvasToDisplaySize(canvas);
    if (needsResize) {
      resources.canvasSize = { width: canvas.width, height: canvas.height };
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.12, 0.2, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (!resources.imageSize) {
      return;
    }

    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, resources.texture);

    gl.uniform1f(uniformLocations.brightness, brightness);
    gl.uniform1f(uniformLocations.contrast, contrast);

    const scale = calculateScale(
      resources.canvasSize,
      resources.imageSize
    );
    gl.uniform2f(uniformLocations.scale, scale.x, scale.y);

    // Set projector uniforms (cached for performance)
    const pj = projectorRef.current;
    const uGamma = gl.getUniformLocation(program, 'u_gamma');
    const uBlackLift = gl.getUniformLocation(program, 'u_blackLift');
    const uColorGain = gl.getUniformLocation(program, 'u_colorGain');
    const uVignette = gl.getUniformLocation(program, 'u_vignette');
    const uHotspot = gl.getUniformLocation(program, 'u_hotspot');
    const uProjEnabled = gl.getUniformLocation(program, 'u_projEnabled');
    if (uGamma && uBlackLift && uColorGain && uVignette && uHotspot && uProjEnabled) {
      gl.uniform1f(uGamma, pj.gamma);
      gl.uniform1f(uBlackLift, pj.blackLift);
      gl.uniform3f(uColorGain, pj.colorGain.r, pj.colorGain.g, pj.colorGain.b);
      gl.uniform1f(uVignette, pj.vignette);
      gl.uniform1f(uHotspot, pj.hotspot);
      gl.uniform1f(uProjEnabled, pj.enabled ? 1.0 : 0.0);
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
      const resources = resourcesRef.current;
      if (!resources) {
        throw new Error('WebGL レンダラーの初期化が完了していません');
      }

      const { gl, texture } = resources;

      gl.bindTexture(gl.TEXTURE_2D, texture);
      if (source instanceof ImageData) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as
          | HTMLImageElement
          | HTMLCanvasElement
          | HTMLVideoElement
          | ImageBitmap);
      }

      const imageSize = getSourceDimensions(source);
      const isPowerOfTwo = (value: number) => {
        if (!Number.isFinite(value) || value <= 0) {
          return false;
        }
        const rounded = Math.round(value);
        if (Math.abs(rounded - value) > 0.0001) {
          return false;
        }
        return (rounded & (rounded - 1)) === 0;
      };
      const canUseMipmaps =
        imageSize.width > 0 &&
        imageSize.height > 0 &&
        isPowerOfTwo(imageSize.width) &&
        isPowerOfTwo(imageSize.height);

      if (canUseMipmaps) {
        gl.generateMipmap(gl.TEXTURE_2D);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      resources.imageSize = imageSize;
      if (imageSize.width > 0 && imageSize.height > 0) {
        if (firstAspectRatioRef.current === null) {
          firstAspectRatioRef.current = imageSize.height / imageSize.width;
          console.debug('[ProjectionRenderer] Initial aspect ratio captured', {
            width: imageSize.width,
            height: imageSize.height,
            aspect: firstAspectRatioRef.current
          });
        }
        currentAspectRef.current = firstAspectRatioRef.current;
        setAspectRatio(firstAspectRatioRef.current);
      } else {
        console.warn('[ProjectionRenderer] Invalid image dimensions detected', imageSize);
      }

      resources.canvasSize = {
        width: canvasRef.current?.width ?? imageSize.width,
        height: canvasRef.current?.height ?? imageSize.height
      };

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
    currentAspectRef.current = null;
    setAspectRatio(null);
    console.debug('[ProjectionRenderer] resetAspectRatio invoked');
  }, []);

  const updateAspectRatio = useCallback((ratio: number | null) => {
    currentAspectRef.current = ratio;
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
      const next = projectorRef.current;
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

      const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
      if (!gl) {
        throw new Error('WebGL レンダラーの初期化が完了していません');
      }

      resizeCanvasToDisplaySize(canvas);

      const program = createProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
      gl.useProgram(program);

      const positionLocation = gl.getAttribLocation(program, 'a_position');
      const uvLocation = gl.getAttribLocation(program, 'a_uv');
      const brightnessLocation = gl.getUniformLocation(program, 'u_brightness');
      const contrastLocation = gl.getUniformLocation(program, 'u_contrast');
      const scaleLocation = gl.getUniformLocation(program, 'u_scale');

      if (
        positionLocation < 0 ||
        uvLocation < 0 ||
        !brightnessLocation ||
        !contrastLocation ||
        !scaleLocation
      ) {
        throw new Error('WebGL レンダラーの初期化が完了していません');
      }

      const positionBuffer = gl.createBuffer();
      const uvBuffer = gl.createBuffer();
      const texture = gl.createTexture();

      if (!positionBuffer || !uvBuffer || !texture) {
        throw new Error('WebGL レンダラーの初期化が完了していません');
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, POSITIONS, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, UVS, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(uvLocation);
      gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      resourcesRef.current = {
        gl,
        program,
        positionBuffer,
        uvBuffer,
        texture,
        attributeLocations: {
          position: positionLocation,
          uv: uvLocation
        },
        uniformLocations: {
          brightness: brightnessLocation,
          contrast: contrastLocation,
          scale: scaleLocation
        },
        canvasSize: {
          width: canvas.width,
          height: canvas.height
        },
        imageSize: null
      };

      gl.clearColor(0.1, 0.12, 0.2, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
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
      const resources = resourcesRef.current;
      if (resources) {
        const { gl, program, positionBuffer, uvBuffer, texture } = resources;
        gl.deleteBuffer(positionBuffer);
        gl.deleteBuffer(uvBuffer);
        gl.deleteTexture(texture);
        gl.deleteProgram(program);
      }
      resourcesRef.current = null;
    };
  }, [initializeWebGL, scheduleDraw]);

  const captureFrame = useCallback(async (): Promise<CaptureFrameResult> => {
    const canvas = canvasRef.current;
    const resources = resourcesRef.current;

    if (!canvas || !resources || !resources.imageSize) {
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

import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadToneMappingModule, type ToneMappingExports } from '../utils/toneMappingWasm';

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

vec3 applyContrast(vec3 color, float contrastFactor) {
  return (color - 0.5) * contrastFactor + 0.5;
}

void main() {
  vec4 texColor = texture2D(u_texture, v_uv);
  vec3 contrasted = applyContrast(texColor.rgb, u_contrast);
  vec3 adjusted = clamp(contrasted * u_brightness, 0.0, 1.0);
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

const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('シェーダーの作成に失敗しました');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`シェーダーのコンパイルに失敗しました: ${info ?? '不明なエラー'}`);
  }
  return shader;
};

const createProgram = (gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string) => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) {
    throw new Error('WebGL プログラムの作成に失敗しました');
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!success) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`WebGL プログラムのリンクに失敗しました: ${info ?? '不明なエラー'}`);
  }

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return program;
};

const resizeCanvasToDisplaySize = (canvas: HTMLCanvasElement) => {
  const dpr = window.devicePixelRatio ?? 1;
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  return false;
};

const calculateScale = (canvasSize: { width: number; height: number }, imageSize: { width: number; height: number }) => {
  const canvasAspect = canvasSize.width / canvasSize.height;
  const imageAspect = imageSize.width / imageSize.height;

  if (canvasAspect > imageAspect) {
    const scaleX = imageAspect / canvasAspect;
    return { x: scaleX, y: 1 };
  }

  const scaleY = canvasAspect / imageAspect;
  return { x: 1, y: scaleY };
};

const useStableRef = <T,>(value: T): MutableRefObject<T> => {
  const ref = useRef(value);
  ref.current = value;
  return ref;
};

export const useProjectionRenderer = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const resourcesRef = useRef<WebGLResources | null>(null);
  const [isReady, setIsReady] = useState(false);
  const toneMappingRef = useRef<ToneMappingExports | null>(null);
  const adjustmentsRef = useStableRef<AdjustmentPayload>({ brightness: 1, contrast: 1 });
  const lastInputRef = useRef<{ brightness: number; contrast: number }>({ brightness: 100, contrast: 0 });
  const rafHandleRef = useRef<number | null>(null);

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
    gl.clearColor(0.04, 0.05, 0.08, 1);
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

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [adjustmentsRef]);

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
      gl.generateMipmap(gl.TEXTURE_2D);

      const imageSize = getSourceDimensions(source);
      resources.imageSize = imageSize;

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
    [adjustmentsRef, scheduleDraw]
  );

  const initializeWebGL = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (!canvas) {
        return;
      }

      const gl = canvas.getContext('webgl');
      if (!gl) {
        throw new Error('WebGL を初期化できませんでした。対応しているブラウザをご確認ください。');
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
        throw new Error('WebGL の属性またはユニフォームの取得に失敗しました');
      }

      const positionBuffer = gl.createBuffer();
      const uvBuffer = gl.createBuffer();
      const texture = gl.createTexture();

      if (!positionBuffer || !uvBuffer || !texture) {
        throw new Error('WebGL リソースの確保に失敗しました');
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

      gl.clearColor(0.04, 0.05, 0.08, 1);
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
  }, [adjustmentsRef, scheduleDraw]);

  return useMemo(
    () => ({
      canvasRef,
      isReady,
      loadImage,
      updateAdjustments
    }),
    [isReady, loadImage, updateAdjustments]
  );
};

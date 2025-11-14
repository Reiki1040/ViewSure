/**
 * WebGLリソース管理クラス
 *
 * ViewSureのWebGLレンダリングエンジンのコアクラスです。
 * WebGLコンテキスト、シェーダープログラム、バッファ、テクスチャなどの
 * リソースを一元管理し、効率的なレンダリングを実現します。
 *
 * 主要機能:
 * - WebGLコンテキストの初期化と管理
 * - シェーダープログラムのコンパイルとリンク
 * - 頂点バッファとUVバッファの管理
 * - テクスチャの作成と更新
 * - ユニフォーム変数の設定
 * - プロジェクター効果の適用
 * - リソースの解放とメモリ管理
 */
import { createProgram } from '../../utils/webgl';

export interface WebGLResources {
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
}

export interface ProjectorSettings {
  enabled: boolean;
  gamma: number;
  blackLift: number;
  colorGain: { r: number; g: number; b: number };
  vignette: number;
  hotspot: number;
}

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

export class WebGLResourceManager {
  private resources: WebGLResources | null = null;
  private canvas: HTMLCanvasElement | null = null;

  initialize(canvas: HTMLCanvasElement): WebGLResources {
    this.canvas = canvas;
    
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) {
      throw new Error('WebGL レンダラーの初期化が完了していません');
    }

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

    this.resources = {
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

    return this.resources;
  }

  getResources(): WebGLResources | null {
    return this.resources;
  }

  setImageSize(width: number, height: number): void {
    if (this.resources) {
      this.resources.imageSize = { width, height };
    }
  }

  updateProjectorUniforms(settings: ProjectorSettings): void {
    if (!this.resources) return;

    const { gl, program } = this.resources;
    const uGamma = gl.getUniformLocation(program, 'u_gamma');
    const uBlackLift = gl.getUniformLocation(program, 'u_blackLift');
    const uColorGain = gl.getUniformLocation(program, 'u_colorGain');
    const uVignette = gl.getUniformLocation(program, 'u_vignette');
    const uHotspot = gl.getUniformLocation(program, 'u_hotspot');
    const uProjEnabled = gl.getUniformLocation(program, 'u_projEnabled');

    if (uGamma && uBlackLift && uColorGain && uVignette && uHotspot && uProjEnabled) {
      gl.uniform1f(uGamma, settings.gamma);
      gl.uniform1f(uBlackLift, settings.blackLift);
      gl.uniform3f(uColorGain, settings.colorGain.r, settings.colorGain.g, settings.colorGain.b);
      gl.uniform1f(uVignette, settings.vignette);
      gl.uniform1f(uHotspot, settings.hotspot);
      gl.uniform1f(uProjEnabled, settings.enabled ? 1.0 : 0.0);
    }
  }

  updateAdjustmentUniforms(brightness: number, contrast: number): void {
    if (!this.resources) return;

    const { gl, uniformLocations } = this.resources;
    gl.uniform1f(uniformLocations.brightness, brightness);
    gl.uniform1f(uniformLocations.contrast, contrast);
  }

  updateScaleUniform(scaleX: number, scaleY: number): void {
    if (!this.resources) return;

    const { gl, uniformLocations } = this.resources;
    gl.uniform2f(uniformLocations.scale, scaleX, scaleY);
  }

  loadTexture(source: TexImageSource): void {
    if (!this.resources) return;

    const { gl, texture } = this.resources;

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

    const dimensions = this.getSourceDimensions(source);
    const canUseMipmaps =
      dimensions.width > 0 &&
      dimensions.height > 0 &&
      isPowerOfTwo(dimensions.width) &&
      isPowerOfTwo(dimensions.height);

    if (canUseMipmaps) {
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    this.setImageSize(dimensions.width, dimensions.height);
  }

  private getSourceDimensions(source: TexImageSource): { width: number; height: number } {
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
  }

  dispose(): void {
    if (!this.resources) return;

    const { gl, program, positionBuffer, uvBuffer, texture } = this.resources;
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(uvBuffer);
    gl.deleteTexture(texture);
    gl.deleteProgram(program);

    this.resources = null;
    this.canvas = null;
  }
}
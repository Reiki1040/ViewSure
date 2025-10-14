type Scale2D = { x: number; y: number };

export const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
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

export const createProgram = (gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string) => {
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

export const resizeCanvasToDisplaySize = (canvas: HTMLCanvasElement) => {
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

export const calculateScale = (
  canvasSize: { width: number; height: number },
  imageSize: { width: number; height: number }
): Scale2D => {
  const canvasAspect = canvasSize.width / canvasSize.height;
  const imageAspect = imageSize.width / imageSize.height;

  if (canvasAspect > imageAspect) {
    const scaleX = imageAspect / canvasAspect;
    return { x: scaleX, y: 1 };
  }

  const scaleY = canvasAspect / imageAspect;
  return { x: 1, y: scaleY };
};


import CardManager from "#/static/lib/card_manager.js";

const JS_VERSION = "1.0.0";
const LOCAL_BASE = "/static/lib/";

const loadScript = (url: string) =>
  new Promise<void>((resolve, reject) => {
    const scriptUrl = new URL(url, document.baseURI);
    scriptUrl.searchParams.set("v", JS_VERSION);
    const fullUrl = scriptUrl.href;

    const existing = Array.from(document.scripts).find((item) => {
      if (!item.src) return false;
      try {
        const loaded = new URL(item.src);
        return loaded.origin === scriptUrl.origin && loaded.pathname === scriptUrl.pathname;
      } catch {
        return false;
      }
    });

    if (existing && existing.src === fullUrl) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = fullUrl;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${fullUrl}`));
    document.body.appendChild(script);
  });

const loadDependencies = async () => {
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const isWebGLClient =
    (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) ||
    /android/i.test(userAgent) ||
    /Macintosh|MacIntel|MacPPC|Mac68K/.test(userAgent);

  const scripts = [
    `${LOCAL_BASE}decoderMain.js`,
    `${LOCAL_BASE}mutex.js`,
    `${LOCAL_BASE}decoder.js`,
  ];

  if (isWebGLClient) {
    scripts.push(
      `${LOCAL_BASE}numjs.min.js`,
      `${LOCAL_BASE}upng.js`,
      `${LOCAL_BASE}load_data.js`,
      `${LOCAL_BASE}renderer_webglW.js`,
      `${LOCAL_BASE}renderer_webgl0.js`,
      `${LOCAL_BASE}renderer.js`,
      `${LOCAL_BASE}rendererMain.js`,
    );
  }

  await Promise.all(scripts.map((item) => loadScript(item)));
};

class AvatarJS {
  private canvasOption: { canvas: HTMLCanvasElement; canvasWidth?: number; canvasHight?: number };
  private modelUrl: string;
  private cardManager: any = null;
  private fpsTemp = 24;
  private onWorkerReady: () => void;
  private onAnimationReady: () => void;
  private onPlayEnd: () => void;
  private onError: (payload: unknown) => void;
  private pendingReceiveCb: (() => void) | null = null;

  constructor(
    canvasOption: { canvas: HTMLCanvasElement; canvasWidth?: number; canvasHight?: number },
    onWorkersReady: () => void = () => {},
    onAnimationReady: () => void = () => {},
    onPlayEnd: () => void = () => {},
    onError: (payload: unknown) => void = () => {},
    modelUrl = "",
  ) {
    this.canvasOption = canvasOption;
    this.modelUrl = modelUrl;
    this.onWorkerReady = onWorkersReady;
    this.onAnimationReady = onAnimationReady;
    this.onPlayEnd = onPlayEnd;
    this.onError = onError;
    this.init();
  }

  private async init() {
    try {
      if (!this.modelUrl) {
        this.onError({ message: "Missing modelUrl" });
        return;
      }
      if (!this.modelUrl.endsWith("/")) this.modelUrl += "/";

      await loadDependencies();
      const width = this.canvasOption.canvasWidth || this.canvasOption.canvas.offsetWidth;
      const height = this.canvasOption.canvasHight || this.canvasOption.canvas.offsetHeight;
      this.canvasOption.canvas.width = width;
      this.canvasOption.canvas.height = height;

      this.cardManager = new CardManager(
        this.canvasOption.canvas,
        () => {
          this.cardManager.drawDefaultImage(this.modelUrl);
          this.cardManager.enableCameraMotion(false);
          this.onWorkerReady();
          this.cardManager.pauseBodyVideo();
        },
        () => {
          this.onAnimationReady();
          if (this.pendingReceiveCb) {
            const cb = this.pendingReceiveCb;
            this.pendingReceiveCb = null;
            cb();
          }
        },
        () => {
          this.cardManager.pauseBodyVideo();
          this.onPlayEnd();
        },
        (payload: unknown) => this.onError(payload),
        () => {},
        () => {},
        `${LOCAL_BASE}decoderWorker.js`,
        `${LOCAL_BASE}rendererWorker.js`,
      );

      this.cardManager.loadModel(this.modelUrl);
    } catch (error) {
      this.onError(error);
    }
  }

  startPlay2() {
    if (!this.cardManager) return;
    this.cardManager.startPlay(this.fpsTemp);
  }

  startPlay() {
    // Keep same API shape as ppt-talk.
  }

  stopPlay() {
    if (!this.cardManager) return;
    this.cardManager.stopPlay();
  }

  receiveData(
    data: {
      audio?: string;
      audioArray?: number[];
      AK?: string;
      ABI?: string;
      ATI?: string;
      API?: string;
      fps?: number;
      status?: string;
      content?: string;
    },
    append = false,
    onReady?: () => void,
  ) {
    if (!this.cardManager) return;
    if (!data.AK || !data.ABI || !data.ATI || !data.API) return;

    if (onReady) {
      this.pendingReceiveCb = onReady;
    }

    const atfData: any = {
      data: {
        AK: data.AK,
        ABI: data.ABI,
        ATI: data.ATI,
        API: data.API,
        fps: data.fps || this.fpsTemp,
        status: data.status || "",
      },
    };
    if (data.audio) atfData.data.audio = data.audio;
    if (data.audioArray) atfData.data.audioArray = data.audioArray;

    this.fpsTemp = data.fps || this.fpsTemp;
    this.cardManager.setFPS(this.fpsTemp);
    this.cardManager.setAnimationJson(atfData, false, append);
  }

  close() {
    if (!this.cardManager) return;
    if (this.cardManager.worker) {
      this.cardManager.worker.terminate();
    }
  }
}

export default AvatarJS;

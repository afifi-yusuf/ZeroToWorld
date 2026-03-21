declare module "@mkkellogg/gaussian-splats-3d" {
  export enum SceneRevealMode {
    Default = 0,
    Gradual = 1,
    Instant = 2,
  }

  export interface ViewerOptions {
    cameraUp?: number[];
    initialCameraPosition?: number[];
    initialCameraLookAt?: number[];
    rootElement?: HTMLElement;
    selfDrivenMode?: boolean;
    useBuiltInControls?: boolean;
    dynamicScene?: boolean;
    sceneRevealMode?: SceneRevealMode | number;
    sharedMemoryForWorkers?: boolean;
  }

  export interface SplatSceneOptions {
    splatAlphaRemovalThreshold?: number;
    showLoadingUI?: boolean;
    progressiveLoad?: boolean;
    onProgress?: (percent: number) => void;
  }

  export class Viewer {
    constructor(options?: ViewerOptions);
    addSplatScene(
      url: string,
      options?: SplatSceneOptions
    ): Promise<void>;
    start(): Promise<void>;
    dispose(): void;
  }
}

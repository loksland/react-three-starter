import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// import gsap from 'gsap';
import * as THREE from 'three';
import { debounce } from '@/anim/utils/debounce';

import { destroyThreeObj } from '@/anim/utils/threeUtils';
import {
  killTweensOfThreeObj,
  killChildTweensOfThreeObj,
} from '@/anim/utils/gsapUtils';
// import { delay } from '@/anim/utils/async';
import { CustomMaterial, debugThrowAndShow } from '@/anim/custom-material';

import { Timer } from 'three/addons/misc/Timer.js';

const fixedConfig = {
  maxPixelRatio: 2.0,
  /** If true renderer will be resized to fixedCanvasDims, otherwise will be responsive to parent  */
  isFixedCanvas: false,
  /** Canvas size if isFixedCanvas is true, otherwise ignored  */
  fixedCanvasDims: { width: 640, height: 360 },
  /** If true doesn't resize the (perceived) camera on canvas resize, will use fixedCameraDims instead  */
  isCameraFixedSize: false,
  /** If isCameraFixedSize is true camera will render as is these are the canvas dimensions , otherwise ignored */
  fixedCameraDims: { width: 360, height: 640 },
  cameraFOV: 60,
  txExt: '.png', // '.webp',
  defaultMode: 'reset', // 'reset',
  enableMaterialCloning: false,
  maxFrameDelta: 10.0 / 60.0,
  bgColor: '#F5F5DC',
} as const;

// Can be changed at runtime using updateConfig()
export const defaultConfig = {
  ...{
    sceneDraggable: true,
    materialWireframe: false,
    cameraPosX: 0.0,
    cameraPosY: 0.0,
    cameraPosZ: 4.0,
    cameraFOV: 70.0,
    /** Offset perspective point vertically. If fixed is a percentage of fixedCameraDims.height, otherwise dims.height  */
    cameraYOffsetFactor: 0.0,
  },
  ...fixedConfig,
};

export type AnimConfig = typeof defaultConfig;

// import { KawaseBlurFilter } from 'pixi-filters';

type InitProps = {
  parent: HTMLElement;
  /** Used for hiding the loader */
  onLoaded?: () => void;
};

export type Anim = {
  init: (initProps: InitProps) => void;
  setMode: (mode: string) => void;
  updateConfig: (configFragment: Partial<AnimConfig>) => void;
  destroy: () => Promise<void>;
  /** Show config values */
  outputConfig: () => void;
  /** Used for debugging */
  outputRenderInfo: () => void;
  /** Used for debugging */
  outputScene: () => void;
} | null;

export type AnimProps = {
  isDev: boolean;
  /** Base path used to load assets  */
  basePath?: string;
  defaultDims?: { width: number; height: number };
};

export function createAnim({ isDev, basePath = '/' }: AnimProps): Anim {
  if (!window) {
    return null;
  }

  let config: AnimConfig = { ...defaultConfig };

  const pxRatio = window
    ? Math.min(window.devicePixelRatio, config.maxPixelRatio)
    : 1.0; // Pixel ratio is locked for duration

  const dims = {
    width: config.isFixedCanvas ? config.fixedCanvasDims.width : 30.0,
    height: config.isFixedCanvas ? config.fixedCanvasDims.width : 30.0,
  };

  let resizeObserver: ResizeObserver | undefined;

  // Three
  let scene: THREE.Scene | undefined;
  let camera: THREE.PerspectiveCamera | undefined;
  let renderer: THREE.WebGLRenderer | undefined;
  let orbit: OrbitControls | undefined;
  const refs: Record<string, THREE.Object3D> = {};
  let material: CustomMaterial | undefined;

  // Create reference to shared
  const timer = new Timer();
  let timerEnabled = true;
  if (window?.document) {
    timer.connect(window.document);
  }

  async function init({ parent, onLoaded }: InitProps) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.bgColor);

    // Camera
    camera = new THREE.PerspectiveCamera(
      config.cameraFOV, // \FOV
      dims.width / dims.height,
      0.1,
      50,
    );

    // Offset perspective from the center of the canvas
    camera.userData.offsetY = config.cameraYOffsetFactor;
    camera.updateProjectionMatrix = function () {
      const aspect = this.aspect;
      const fov = THREE.MathUtils.degToRad(this.fov);
      const near = this.near;
      const top = Math.tan(fov / 2) * near;
      const height = 2 * top;
      const width = height * aspect;
      const left = -width / 2;
      const bottom = -top;
      const right = width / 2;
      const offsetY = (this.userData.offsetY || 0) * height;
      this.projectionMatrix.makePerspective(
        left,
        right,
        top - offsetY,
        bottom - offsetY,
        near,
        this.far,
      );
    };

    scene.add(camera);

    renderer = new THREE.WebGLRenderer({
      antialias: !window || window.devicePixelRatio === 1, // Cannot change this later,
      alpha: false, //  controls the default clear alpha value. When set to true, the value is 0. Otherwise it's 1
      precision: 'lowp',
    });

    if (isDev && debugThrowAndShow) {
      renderer.debug.onShaderError = (
        gl,
        _program,
        vertexShader,
        fragmentShader,
      ) => {
        const vertexShaderSource = gl.getShaderSource(vertexShader);
        const fragmentShaderSource = gl.getShaderSource(fragmentShader);

        console.groupCollapsed('vertexShader');
        console.log(vertexShaderSource);
        console.groupEnd();

        console.groupCollapsed('fragmentShader');
        console.log(fragmentShaderSource);
        console.groupEnd();
      };
    }

    // renderer.domElement.style.zIndex = '3';
    renderer.setSize(dims.width, dims.height);
    renderer.setPixelRatio(pxRatio);

    // renderer.setClearColor(new THREE.Color('#ff3333'), 1.0);

    renderer.outputColorSpace = THREE.SRGBColorSpace; // optional with post-processing
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.NoToneMapping;

    orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableZoom = false;

    const textureLoader = new THREE.TextureLoader();

    const sampleMap = await textureLoader.loadAsync(
      `${basePath}anim/sample-map${pxRatio > 1 ? '@2x' : ''}${config.txExt}`,
    );

    // Set wrapping mode
    sampleMap.wrapS = THREE.RepeatWrapping;
    sampleMap.wrapT = THREE.RepeatWrapping;

    // Repeat the texture (e.g., 4 times across and 2 times down)
    sampleMap.repeat.set(2, 2);

    material = new CustomMaterial();
    material.texture = sampleMap;
    // material.alpha = 0.5;

    // Attach after loading

    parent.appendChild(renderer.domElement);

    // Observe stage dims

    resizeObserver = new ResizeObserver(
      debounce((entries: ResizeObserverEntry[]) => {
        if (entries.length >= 1) {
          onStageResize(
            Math.round(entries[0].contentRect.width),
            Math.round(entries[0].contentRect.height),
          );
        }
      }, -1),
    );
    resizeObserver.observe(parent);

    if (onLoaded) {
      onLoaded();
    }
  }

  // - |dims| will be set before this is called
  // - |onStageResize| will be called immediately after
  function start() {
    if (scene) {
      refs.group = new THREE.Group();
      scene.add(refs.group);

      const geometry = new THREE.SphereGeometry(1.1, 32, 32); // new THREE.BoxGeometry(1.5, 1.5, 1.5, 1.0, 1.0); //s
      refs.sphere = new THREE.Mesh(geometry, material);
      refs.sphere.receiveShadow = false;
      refs.sphere.castShadow = false;
      refs.sphere.position.set(0.0, 0.0, 0.0);
      refs.group.add(refs.sphere);
    }

    updateConfig({ ...config }, true);

    onTick();
  }

  let startCalled = false;
  // Shouldn't have to check if items exist
  function onStageResize(width: number, height: number) {
    dims.width = width;
    dims.height = height;

    if (!startCalled) {
      startCalled = true;
      start();
    }
    if (camera) {
      camera.aspect = dims.width / dims.height;

      let offsetY = 0.0;
      if (config.isCameraFixedSize) {
        const tanFOV = Math.tan(((Math.PI / 180.0) * config.cameraFOV) / 2);
        camera.fov =
          (360.0 / Math.PI) *
          Math.atan(tanFOV * (dims.height / config.fixedCameraDims.height));
        offsetY =
          config.fixedCameraDims.height * (0.5 - config.cameraYOffsetFactor);
        camera.userData.offsetY = 0.5 - offsetY / dims.height;
      }
      camera.updateProjectionMatrix();
    }

    renderer?.setSize(dims.width, dims.height);

    if (isDev) {
      console.log('[stage dims]', dims.width * 0.5, 'x', dims.height * 0.5);
    }
  }

  let elapsedTime = 0.0;
  let timeScale = 0.0;
  let dt = 0.0;

  function onTick(timestamp?: number) {
    if (!timerEnabled) {
      return;
    }
    requestAnimationFrame(onTick);
    timer.update(timestamp);

    dt = Math.min(config.maxFrameDelta, timer.getDelta());

    timeScale = dt / (1.0 / 60.0);
    elapsedTime += dt;

    if (material) {
      material.time = elapsedTime;
    }

    if (renderer && scene && camera) {
      // console.log(renderer.info.render);
      renderer.render(scene, camera);
    } else {
      console.log(elapsedTime, dt, timeScale);
    }
  }

  function updateConfig(configFragment: Partial<AnimConfig>, isInit = false) {
    config = { ...config, ...configFragment };

    if (configFragment.sceneDraggable !== undefined && orbit) {
      orbit.enabled = config.sceneDraggable;
    }
    if (configFragment.cameraPosX !== undefined && camera) {
      camera.position.x = config.cameraPosX;
    }
    if (configFragment.cameraPosY !== undefined && camera) {
      camera.position.y = config.cameraPosY;
    }
    if (configFragment.cameraPosZ !== undefined && camera) {
      camera.position.z = config.cameraPosZ;
    }

    if (configFragment.materialWireframe !== undefined && material) {
      material.wireframe = config.materialWireframe;
      material.isSolidFill = config.materialWireframe;
    }

    if (isInit) {
      return;
    }

    if (isDev) {
      for (const key of Object.keys(fixedConfig)) {
        if (configFragment[key as keyof AnimConfig] !== undefined) {
          console.warn(`[config] Key '${key}' cannot be updated at runtime`);
        }
      }
    }

    if (configFragment.cameraFOV !== undefined && camera) {
      camera.fov = config.cameraFOV; // Update FOV value
      camera.updateProjectionMatrix(); // Apply changes
    }

    if (configFragment.cameraYOffsetFactor !== undefined && camera) {
      camera.userData.offsetY = config.cameraYOffsetFactor; // Update FOV value
      camera.updateProjectionMatrix(); // Apply changes
    }

    /*
    if (
      ['propA', 'propB', 'propC'].some(
        (key) => configFragment[key as keyof AnimConfig] !== undefined,
      )
    ) {
      updateSphereGeometry();
    }
    */
  }
  function setMode(mode: string) {
    console.log('[mode]', mode);
  }

  async function destroy() {
    timer?.disconnect();
    timer?.dispose();
    timerEnabled = false;
    resizeObserver?.disconnect(); // Unobserves all observed Element or SVGElement targets.

    // three

    for (const ref in refs) {
      killTweensOfThreeObj(refs[ref]);
      delete refs[ref];
    }

    if (camera) {
      killTweensOfThreeObj(camera);
      camera = undefined;
    }

    if (scene) {
      killChildTweensOfThreeObj(scene); // Kill any tweens not present in refs
      destroyThreeObj(scene, true, true, true, true);
      scene = undefined;
    }
    renderer?.domElement?.parentNode?.removeChild(renderer?.domElement);
    renderer?.dispose();
    renderer = undefined;

    orbit?.dispose();
    orbit = undefined;
  }

  function outputScene() {
    scene?.traverse((obj) => {
      console.log(obj);
    });
  }

  function outputRenderInfo() {
    console.log(renderer?.info.render);
    console.log('[dims]', dims);
  }

  function outputConfig() {
    console.log(config);
  }

  return {
    init,
    setMode,
    updateConfig,
    outputConfig,
    outputScene,
    outputRenderInfo,
    destroy,
  };
}

// Reference: https://github.com/pmndrs/drei/tree/master/src/materials
import * as THREE from 'three';
// import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.175.0/build/three.module.js';

// Settings
const enableDistortion = true;
const enableBlur = false;

// Debug
const debugAlpha = false;

export const debugThrowAndShow = false;

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

const vertexShader = /*glsl*/ `

#define PI 3.14159265

attribute vec4 color;

// All uniforms
uniform bool uIsSolidFill;
uniform sampler2D uTexture; // Texture map
${enableBlur ? 'uniform sampler2D uTextureBlur;' : ''}  // Texture map (full blur)
uniform float uAlpha;
uniform float uTime;

varying vec3 vPosition;
varying vec4 vColor;
varying vec2 vUv; 

void main()	{

  // Float bobble
  vPosition = position;

  vColor = color;

  vec4 viewPosition = modelViewMatrix * vec4(vPosition, 1.0);

  gl_Position = projectionMatrix * viewPosition;

  vUv = uv; // To be sent to fragment shader

  ${debugThrowAndShow ? 'throw' : ''}

}
`;

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

const fragmentShader = /*glsl*/ `

#define DISTORT_STRETCH 0.9

// All uniforms

uniform bool uIsSolidFill;
uniform sampler2D uTexture; // Texture map
${enableBlur ? 'uniform sampler2D uTextureBlur;' : ''}  // Texture map (full blur)
uniform float uAlpha;
uniform float uTime;

varying vec3 vPosition;
varying vec4 vColor;
varying vec2 vUv; 

// varying float vAlpha; 

void main()	{

  vec2 uv = vUv;

  // Simple distortion demo
  // uv.x += cos(vPosition.x * 10.) * 0.01;

  ${enableDistortion ? 'uv.x -= 0.5 * cos(vPosition.x*DISTORT_STRETCH *  vPosition.y*DISTORT_STRETCH * vPosition.z*DISTORT_STRETCH + uTime*0.8); uv.y += 0.5* sin(vPosition.x*DISTORT_STRETCH *   vPosition.y*DISTORT_STRETCH * vPosition.z*DISTORT_STRETCH + uTime*0.8);' : ''}

  vec4 outputColor =  texture2D(uTexture, uv);

  outputColor.a *= uAlpha;

  gl_FragColor = outputColor;

  if (uIsSolidFill) {
    gl_FragColor = vec4(1.,1.,1.,1.);
  }

  ${debugAlpha ? 'gl_FragColor = vec4(outputColor.a,outputColor.a,outputColor.a,1.);' : ''}

}
`;

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

export interface CustomMaterialType extends THREE.ShaderMaterial {
  texture: THREE.Texture | null;
  isSolidFill: boolean;
  alpha: number;
  time: number;
  makeClone: () => CustomMaterial;
}

interface Uniform<T> {
  value: T;
}

export class CustomMaterial
  extends THREE.ShaderMaterial
  implements CustomMaterialType
{
  // Supported uniform types:
  // THREE.Texture | THREE.TypedArray | THREE.Matrix4 | THREE.Matrix3 | THREE.Quaternion | THREE.Vector4 | THREE.Vector3 | THREE.Vector2 | THREE.Color | number | boolean | null;

  _texture: Uniform<THREE.Texture | null>;
  _isSolidFill: Uniform<boolean>;
  _alpha: Uniform<number>;
  _time: Uniform<number>;

  constructor() {
    // parameters: THREE.ShaderMaterialParameters
    super({
      uniforms: {
        uTexture: { value: null },
        uIsSolidFill: { value: false },
        uAlpha: { value: 1.0 },
        uTime: { value: 0.0 },
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      side: THREE.FrontSide,
      transparent: true,
      //clipping: false, // Optional
      depthTest: false, // Renders this mesh on top, ignoring depth
      depthWrite: false,
      lights: false,
      wireframe: false,
      precision: 'lowp',
    });

    this._texture = this.uniforms.uTexture;

    this._isSolidFill = this.uniforms.uIsSolidFill;
    this._alpha = this.uniforms.uAlpha;
    this._time = this.uniforms.uTime;
  }

  get texture() {
    return this._texture.value;
  }

  set texture(v) {
    this._texture.value = v;
  }

  get isSolidFill() {
    return this._isSolidFill.value;
  }

  set isSolidFill(v) {
    this._isSolidFill.value = v;
  }

  get alpha() {
    return this._alpha.value;
  }

  set alpha(v) {
    this._alpha.value = v;
  }

  get time() {
    return this._time.value;
  }

  set time(v) {
    this._time.value = v;
  }

  makeClone() {
    const clone = super.clone();
    clone._texture = clone.uniforms.uTexture;

    clone._isSolidFill = clone.uniforms.uIsSolidFill;
    clone._alpha = clone.uniforms.uAlpha;
    clone._time = clone.uniforms.uTime;
    return clone;
  }
}

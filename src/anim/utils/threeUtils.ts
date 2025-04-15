/* 
Usage: 
```js
import * as threeUtils from './utils/threeUtils.js';
scenethreeJS = threeUtils.destroy(scenethreeJS, true, true, true, true);
```
*/

import * as THREE from 'three';

export function destroyThreeObj(
  object3d: THREE.Object3D,
  recursive = true,
  destroyGeometry = true,
  destroyMaterial = true,
  destroyTextures = false,
) {
  if (recursive) {
    for (let i = object3d.children.length - 1; i >= 0; i--) {
      destroyThreeObj(
        object3d.children[i],
        recursive,
        destroyGeometry,
        destroyMaterial,
        destroyTextures,
      );
    }
  }

  if (object3d instanceof THREE.Mesh) {
    if (destroyGeometry) {
      object3d.geometry.dispose();
    }

    if (destroyTextures) {
      for (const key in object3d.material) {
        const value = object3d.material[key];
        if (value && typeof value['dispose'] === 'function') {
          value.dispose();
        }
      }
    }

    if (destroyMaterial) {
      object3d.material.dispose();
    }

    if (object3d.parent) {
      object3d.removeFromParent();
    }
  }

  return null;
}

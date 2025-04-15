import { createAnim, Anim, defaultConfig } from '@/anim';
import { cn } from '@/libs/cn';
import { ClassValue } from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { useControls, button, folder, Leva } from 'leva';
type AnimWrapperProps = { className?: ClassValue };

export function AnimComp({ className }: AnimWrapperProps) {
  const [showLeva, setShowLeva] = useState(true);

  useControls({
    Scene: folder({
      sceneDraggable: {
        value: defaultConfig.sceneDraggable,
        onChange: (val) => {
          anim.current?.updateConfig({ sceneDraggable: val });
        },
      },
      cameraPosX: {
        value: defaultConfig.cameraPosX,
        min: -20.0,
        max: 20.0,
        onChange: (val) => {
          anim.current?.updateConfig({ cameraPosX: val });
        },
      },
      cameraPosY: {
        value: defaultConfig.cameraPosY,
        min: -20.0,
        max: 20.0,
        onChange: (val) => {
          anim.current?.updateConfig({ cameraPosY: val });
        },
      },
      cameraPosZ: {
        value: defaultConfig.cameraPosZ,
        min: -20.0,
        max: 20.0,
        onChange: (val) => {
          anim.current?.updateConfig({ cameraPosZ: val });
        },
      },
      cameraFOV: {
        value: defaultConfig.cameraFOV,
        min: 1.0,
        max: 179.0,
        onChange: (val) => {
          anim.current?.updateConfig({ cameraFOV: val });
        },
      },
      cameraYOffsetFactor: {
        value: defaultConfig.cameraYOffsetFactor,
        min: -1.0,
        max: 1.0,
        onChange: (val) => {
          anim.current?.updateConfig({ cameraYOffsetFactor: val });
        },
      },
    }),

    Material: folder({
      materialWireframe: {
        value: defaultConfig.materialWireframe,
        onChange: (val) => {
          anim.current?.updateConfig({ materialWireframe: val });
        },
      },
    }),

    Utils: folder({
      'hide panel': button(() => {
        setShowLeva(false);
      }),
      outputConfig: button(() => {
        anim.current?.outputConfig();
      }),
      destroy: button(() => {
        anim.current?.destroy();
        anim.current = null;
      }),
    }),
  });

  const anim = useRef<Anim>(null);
  const containingDiv = useRef(null);

  // const [isLoading, setIsLoading] = useState(false); // Used for the loader

  // Create and destroy

  // defaultDims={{ width: 360, height: 640 }}

  useEffect(() => {
    if (containingDiv.current) {
      const _anim = createAnim({
        isDev: import.meta.env.DEV,
        basePath: import.meta.env.BASE_URL,
      });
      if (_anim) {
        //setIsLoading(true);
        anim.current = _anim; // For this comp to communicate with
        const initResult = _anim.init({
          parent: containingDiv.current,
          onLoaded: () => {
            //setIsLoading(false);
            if (import.meta.env.DEV) {
              console.log('Load complete');
            }
          },
        });
        return () => {
          async function delayedDestroy() {
            anim.current = null; // Prevent references
            await initResult; // Ensure the init is complete before destroying (this is required for safe mode compatibility)
            _anim?.destroy(); // This may be async
          }
          delayedDestroy();
        };
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Needed to trigger HMR on anim change
  }, [createAnim]); // Triggers HMR when anim function changes

  // Notes:

  return (
    <div
      className={cn(
        defaultConfig.isFixedCanvas
          ? 'flex flex-1 items-start justify-center overflow-hidden relative max-w-dvw max-h-dvh'
          : 'absolute w-full h-full self-stretch',
        className,
      )}
    >
      <Leva collapsed={true} hidden={!showLeva} />
      <div
        ref={containingDiv}
        className={cn(
          'overflow-hidden', // Prevent the canvas pushing out the size of its own container
          defaultConfig.isFixedCanvas ? 'absolute' : 'w-full h-full',
        )}
        style={
          defaultConfig.isFixedCanvas
            ? {
                width: defaultConfig.fixedCanvasDims.width,
                height: defaultConfig.fixedCanvasDims.height,
              }
            : {}
        }
      ></div>
    </div>
  );
}

'use client';

import * as React from 'react';
import { cn } from '../cn';

export type ReducedMotionStrategy = 'user' | 'always' | 'never';

interface MotionContextValue {
  reducedMotion: ReducedMotionStrategy;
  prefersReducedMotion: boolean;
}

const MotionContext = React.createContext<MotionContextValue>({
  reducedMotion: 'user',
  prefersReducedMotion: false,
});

export interface MotionConfigProps {
  reducedMotion?: ReducedMotionStrategy;
  children: React.ReactNode;
}

export function MotionConfig({ reducedMotion = 'user', children }: MotionConfigProps) {
  const [systemReduced, setSystemReduced] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setSystemReduced(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => {
      setSystemReduced(event.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
    return undefined;
  }, []);

  const prefersReducedMotion =
    reducedMotion === 'always' ? true : reducedMotion === 'never' ? false : systemReduced;

  return (
    <MotionContext.Provider value={{ reducedMotion, prefersReducedMotion }}>
      {children}
    </MotionContext.Provider>
  );
}

export interface LazyMotionProps {
  children: React.ReactNode;
}

export function LazyMotion({ children }: LazyMotionProps) {
  return <>{children}</>;
}

export interface MotionProviderProps {
  reducedMotion?: ReducedMotionStrategy;
  children: React.ReactNode;
}

/**
 * Proveedor de animaciones `MotionProvider` montado una sola vez en `src/app/providers.tsx`
 * con `LazyMotion` y `MotionConfig reducedMotion="user"` (Regla 60).
 */
export function MotionProvider({ reducedMotion = 'user', children }: MotionProviderProps) {
  return (
    <LazyMotion>
      <MotionConfig reducedMotion={reducedMotion}>{children}</MotionConfig>
    </LazyMotion>
  );
}

export function useReducedMotionPreference(): boolean {
  return React.useContext(MotionContext).prefersReducedMotion;
}

export type MotionPresetName = 'fadeIn' | 'fadeOut' | 'slideUpSheet' | 'highlightItem';

export interface MotionTransformState {
  opacity: number;
  x: number;
  y: number;
  scale: number;
}

export interface MotionPresetDefinition {
  name: MotionPresetName;
  animatedProperties: readonly ('opacity' | 'transform')[];
  initial: MotionTransformState;
  animate: MotionTransformState;
  exit: MotionTransformState;
  transition: {
    durationMs: number;
    easing: string;
  };
}

export const MOTION_PRESETS: Record<MotionPresetName, MotionPresetDefinition> = {
  fadeIn: {
    name: 'fadeIn',
    animatedProperties: ['opacity'],
    initial: { opacity: 0, x: 0, y: 0, scale: 1 },
    animate: { opacity: 1, x: 0, y: 0, scale: 1 },
    exit: { opacity: 0, x: 0, y: 0, scale: 1 },
    transition: { durationMs: 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  },
  fadeOut: {
    name: 'fadeOut',
    animatedProperties: ['opacity'],
    initial: { opacity: 1, x: 0, y: 0, scale: 1 },
    animate: { opacity: 0, x: 0, y: 0, scale: 1 },
    exit: { opacity: 0, x: 0, y: 0, scale: 1 },
    transition: { durationMs: 150, easing: 'ease-out' },
  },
  slideUpSheet: {
    name: 'slideUpSheet',
    animatedProperties: ['opacity', 'transform'],
    initial: { opacity: 0, x: 0, y: 24, scale: 1 },
    animate: { opacity: 1, x: 0, y: 0, scale: 1 },
    exit: { opacity: 0, x: 0, y: 16, scale: 1 },
    transition: { durationMs: 240, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  },
  highlightItem: {
    name: 'highlightItem',
    animatedProperties: ['opacity', 'transform'],
    initial: { opacity: 0.85, x: 0, y: 0, scale: 0.98 },
    animate: { opacity: 1, x: 0, y: 0, scale: 1 },
    exit: { opacity: 0, x: 0, y: 0, scale: 1 },
    transition: { durationMs: 220, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  },
};

/**
 * Devuelve el preset de animación oficial respetando `prefers-reduced-motion` (Regla 60):
 * cuando `prefersReducedMotion` es `true`, ningún preset desplaza ni escala (`x=0, y=0, scale=1`).
 */
export function getMotionPreset(
  preset: MotionPresetName,
  prefersReducedMotion: boolean
): MotionPresetDefinition {
  const base = MOTION_PRESETS[preset];
  if (!prefersReducedMotion) {
    return base;
  }

  return {
    ...base,
    animatedProperties: ['opacity'],
    initial: { opacity: base.initial.opacity, x: 0, y: 0, scale: 1 },
    animate: { opacity: base.animate.opacity, x: 0, y: 0, scale: 1 },
    exit: { opacity: base.exit.opacity, x: 0, y: 0, scale: 1 },
    transition: {
      durationMs: 150,
      easing: 'linear',
    },
  };
}

export interface AnimatedBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  preset?: MotionPresetName;
}

export function AnimatedBox({
  preset = 'fadeIn',
  className,
  children,
  ...props
}: AnimatedBoxProps) {
  const prefersReducedMotion = useReducedMotionPreference();
  const activePreset = getMotionPreset(preset, prefersReducedMotion);

  return (
    <div
      data-motion-preset={activePreset.name}
      data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
      className={cn('transition-opacity duration-200', className)}
      {...props}
    >
      {children}
    </div>
  );
}

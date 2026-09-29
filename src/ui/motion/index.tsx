'use client';

import * as React from 'react';
import { LazyMotion, MotionConfig, domAnimation, m } from 'motion/react';
import { cn } from '@/ui/cn';

export type MotionPresetName = 'fadeIn' | 'slideUp' | 'scaleTap' | 'sheetSpring' | 'none';

export interface MotionPresetConfig {
  duration: number;
  initialClass: string;
  animateClass: string;
}

export const MOTION_PRESETS: Record<MotionPresetName, MotionPresetConfig> = {
  fadeIn: {
    duration: 0.18,
    initialClass: 'opacity-0',
    animateClass: 'opacity-100',
  },
  slideUp: {
    duration: 0.22,
    initialClass: 'opacity-0 translate-y-2',
    animateClass: 'opacity-100 translate-y-0',
  },
  scaleTap: {
    duration: 0.12,
    initialClass: 'scale-95',
    animateClass: 'scale-100',
  },
  sheetSpring: {
    duration: 0.25,
    initialClass: 'translate-y-4 opacity-0',
    animateClass: 'translate-y-0 opacity-100',
  },
  none: {
    duration: 0,
    initialClass: '',
    animateClass: '',
  },
} as const;

export function useReducedMotionPreference(): boolean {
  const [prefersReduced, setPrefersReduced] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches);
    };
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return prefersReduced;
}

const MotionContext = React.createContext<{ reducedMotion: boolean }>({
  reducedMotion: false,
});

export interface MotionProviderProps {
  children: React.ReactNode;
  forceReducedMotion?: boolean;
  reducedMotion?: 'user' | 'always' | 'never' | boolean;
}

export function MotionProvider({
  children,
  forceReducedMotion,
  reducedMotion: reducedMotionProp,
}: MotionProviderProps) {
  const systemReduced = useReducedMotionPreference();
  const forcedBool =
    forceReducedMotion ??
    (typeof reducedMotionProp === 'boolean'
      ? reducedMotionProp
      : reducedMotionProp === 'always'
        ? true
        : reducedMotionProp === 'never'
          ? false
          : undefined);
  const reducedMotion = forcedBool ?? systemReduced;

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
        <MotionContext.Provider value={{ reducedMotion }}>{children}</MotionContext.Provider>
      </MotionConfig>
    </LazyMotion>
  );
}

export function resolveMotionPreset(
  preset: MotionPresetName,
  reducedMotion: boolean
): MotionPresetConfig {
  if (reducedMotion) {
    return MOTION_PRESETS.none;
  }
  return MOTION_PRESETS[preset];
}

export interface AnimatedBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  preset?: MotionPresetName;
  reducedMotionOverride?: boolean;
}

export function AnimatedBox({
  preset = 'fadeIn',
  reducedMotionOverride,
  className,
  children,
  ...props
}: AnimatedBoxProps) {
  const ctx = React.useContext(MotionContext);
  const systemReduced = useReducedMotionPreference();
  const effectiveReduced = reducedMotionOverride ?? (ctx.reducedMotion || systemReduced);
  const config = resolveMotionPreset(preset, effectiveReduced);

  return (
    <m.div
      data-motion-preset={preset}
      data-reduced-motion={String(effectiveReduced)}
      initial={effectiveReduced ? false : { opacity: 0.98 }}
      animate={{ opacity: 1 }}
      transition={{ duration: config.duration }}
      className={cn('transition-all', config.animateClass, className)}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </m.div>
  );
}

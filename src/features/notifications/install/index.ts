'use client';

export * from './is-ios';
export * from './is-standalone';
export * from './standalone-redirect';
export * from './standalone-back-link';
export * from './ios-install-guide-sheet';

export const loadIosInstallGuideSheet = () =>
  import('./ios-install-guide-sheet').then((module) => ({
    default: module.IosInstallGuideSheet,
  }));



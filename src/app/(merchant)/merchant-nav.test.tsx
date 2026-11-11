// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const nav = vi.hoisted(() => ({ pathname: '/merchant/plan' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

import { MerchantNav } from './merchant-nav';

describe('T-431: MerchantNav marca «Cuenta» también en sus subpáginas', () => {
  afterEach(cleanup);

  it.each(['/merchant/plan', '/merchant/plan/notifications'])('en %s «Cuenta» queda activa', (pathname) => {
    nav.pathname = pathname;
    render(<MerchantNav />);
    expect(screen.getByRole('link', { name: /Cuenta/ }).getAttribute('aria-current')).toBe('page');
  });

  it('una ruta que solo empieza igual no activa «Cuenta»', () => {
    nav.pathname = '/merchant/planes';
    render(<MerchantNav />);
    expect(screen.getByRole('link', { name: /Cuenta/ }).getAttribute('aria-current')).toBeNull();
  });
});

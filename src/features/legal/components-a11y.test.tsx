// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RegisterForm } from '@/features/auth';
import { MerchantOnboardingForm } from '@/features/merchants';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe('H07: Checkboxes de consentimiento con nombre accesible', () => {
  afterEach(cleanup);

  it('RegisterForm expone checkbox con nombre accesible que referencia términos y privacidad', () => {
    render(<RegisterForm />);
    const checkbox = screen.getByRole('checkbox', { name: /términos.*privacidad/i });
    expect(checkbox).toBeDefined();
    expect(checkbox).not.toBeNull();
  });

  it('MerchantOnboardingForm expone checkbox con nombre accesible que referencia términos del piloto', () => {
    render(<MerchantOnboardingForm zones={[]} />);
    const checkbox = screen.getByRole('checkbox', { name: /términos del piloto/i });
    expect(checkbox).toBeDefined();
    expect(checkbox).not.toBeNull();
  });
});

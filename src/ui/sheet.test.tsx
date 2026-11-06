// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Sheet, SheetContent, SheetTitle } from './sheet';

function renderSheet(side?: 'bottom' | 'right') {
  render(
    <Sheet defaultOpen>
      <SheetContent side={side}>
        <SheetTitle>Panel</SheetTitle>
      </SheetContent>
    </Sheet>
  );
  const dialog = screen.getByRole('dialog');
  const wrapper = dialog.closest('[data-sheet-wrapper]');
  if (!wrapper) throw new Error('falta el contenedor del Sheet');
  return { dialog, wrapper };
}

describe('CC-046: posición del Sheet según side', () => {
  it('side="right" apoya el panel en el borde derecho (justify-end), no lo centra', () => {
    const { dialog, wrapper } = renderSheet('right');
    expect(dialog.getAttribute('data-sheet-side')).toBe('right');
    expect(wrapper.classList.contains('justify-end')).toBe(true);
    expect(wrapper.classList.contains('justify-center')).toBe(false);
  });

  it('side="bottom" (por defecto) sigue centrado horizontalmente', () => {
    const { dialog, wrapper } = renderSheet();
    expect(dialog.getAttribute('data-sheet-side')).toBe('bottom');
    expect(wrapper.classList.contains('justify-center')).toBe(true);
    expect(wrapper.classList.contains('justify-end')).toBe(false);
  });

  it('conserva la alineación vertical y la capa fija sobre toda la pantalla', () => {
    for (const side of ['right', 'bottom'] as const) {
      const { wrapper } = renderSheet(side);
      for (const token of ['fixed', 'inset-0', 'z-50', 'flex', 'items-end', 'sm:items-center']) {
        expect(wrapper.classList.contains(token), `${side}: ${token}`).toBe(true);
      }
      cleanup();
    }
  });
});

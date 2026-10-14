// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

const ZONE_A = '0f8d3b8e-1c2a-4f6b-9a1e-000000000001';
const ZONE_B = '0f8d3b8e-1c2a-4f6b-9a1e-000000000002';

function options() {
  return (
    <SelectContent>
      <SelectItem value={ZONE_A}>Centro</SelectItem>
      <SelectItem value={ZONE_B}>Villa Nueva</SelectItem>
    </SelectContent>
  );
}

function ControlledInForm({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = React.useState(ZONE_A);
  return (
    <form>
      <Select
        value={value}
        onValueChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      >
        <SelectTrigger aria-label="Barrio">
          <SelectValue placeholder="Elegí un barrio" />
        </SelectTrigger>
        {options()}
      </Select>
    </form>
  );
}

function openAndPick(label: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Barrio' }));
  fireEvent.click(screen.getByRole('option', { name: label }));
}

describe('CC-018 Select', () => {
  afterEach(() => {
    cleanup();
  });

  it('controlado dentro de <form>: elegir B emite solo B, nunca un reset a vacío', () => {
    const onChange = vi.fn<(value: string) => void>();
    render(<ControlledInForm onChange={onChange} />);

    openAndPick('Villa Nueva');

    expect(onChange.mock.calls).toEqual([[ZONE_B]]);
    expect(screen.getByRole('combobox', { name: 'Barrio' }).textContent).toContain('Villa Nueva');
  });

  it('controlado: la prop value es la fuente de verdad aunque el padre no la actualice', () => {
    const onValueChange = vi.fn<(value: string) => void>();
    render(
      <Select value={ZONE_A} onValueChange={onValueChange}>
        <SelectTrigger aria-label="Barrio">
          <SelectValue />
        </SelectTrigger>
        {options()}
      </Select>
    );

    openAndPick('Villa Nueva');

    expect(onValueChange.mock.calls).toEqual([[ZONE_B]]);
    expect(screen.getByRole('combobox', { name: 'Barrio' }).textContent).toContain('Centro');
  });

  it('no controlado: respeta defaultValue y las selecciones posteriores', () => {
    const onValueChange = vi.fn<(value: string) => void>();
    render(
      <form>
        <Select defaultValue={ZONE_A} onValueChange={onValueChange}>
          <SelectTrigger aria-label="Barrio">
            <SelectValue />
          </SelectTrigger>
          {options()}
        </Select>
      </form>
    );

    const trigger = screen.getByRole('combobox', { name: 'Barrio' });
    expect(trigger.textContent).toContain('Centro');

    openAndPick('Villa Nueva');

    expect(onValueChange.mock.calls).toEqual([[ZONE_B]]);
    expect(trigger.textContent).toContain('Villa Nueva');
  });

  it('conserva roles, ARIA, apertura/cierre y aria-selected en la opción elegida', () => {
    render(<ControlledInForm onChange={() => undefined} />);

    const trigger = screen.getByRole('combobox', { name: 'Barrio' });
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.click(trigger);
    const listbox = screen.getByRole('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(listbox.id);
    expect(screen.getByRole('option', { name: 'Centro' }).getAttribute('aria-selected')).toBe(
      'true'
    );
    expect(screen.getByRole('option', { name: 'Villa Nueva' }).getAttribute('aria-selected')).toBe(
      'false'
    );

    fireEvent.click(screen.getByRole('option', { name: 'Villa Nueva' }));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByRole('option', { name: 'Villa Nueva' }).getAttribute('aria-selected')).toBe(
      'true'
    );
  });

  it('no renderiza un <select> nativo como sustituto', () => {
    const { container } = render(<ControlledInForm onChange={() => undefined} />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Barrio' }));

    expect(container.querySelector('select')).toBeNull();
    expect(document.querySelector('select')).toBeNull();
  });
});

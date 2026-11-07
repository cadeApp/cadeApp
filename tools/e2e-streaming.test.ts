// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Page } from '@playwright/test';
import { collectRevealState, inspectStreamingSegments, isStreamingSettled } from '../e2e/helpers/streaming';
import { waitForNoSkeletons } from '../e2e/helpers/skeletons';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  const globals = window as unknown as Record<string, unknown>;
  delete globals['$RB'];
  delete globals['$RT'];
});

const boundary = (n: number) => `<template id="B:${n}"></template>`;
const segment = (n: number, text = `contenido ${n}`) => `<div hidden id="S:${n}"><p>${text}</p></div>`;

describe('T-429: inspectStreamingSegments', () => {
  it('sin segmentos no hay pendientes ni huérfanos', () => {
    document.body.innerHTML = '<main><p>Listo</p></main>';
    expect(inspectStreamingSegments(document)).toEqual({ pending: [], orphaned: [] });
  });

  it('un segmento con su boundary todavía en el DOM está pendiente', () => {
    document.body.innerHTML = `<main>${boundary(1)}</main>${segment(1)}`;
    expect(inspectStreamingSegments(document)).toEqual({ pending: ['S:1'], orphaned: [] });
  });

  it('un segmento cuyo boundary ya no existe quedó huérfano', () => {
    document.body.innerHTML = `<main><p>Entrega 1 entregada</p></main>${segment(1, 'Entrega 1 entregada')}`;
    expect(inspectStreamingSegments(document)).toEqual({ pending: [], orphaned: ['S:1'] });
  });

  it('distingue varios a la vez y no cuenta divs ocultos que no son segmentos', () => {
    document.body.innerHTML = `<main>${boundary(2)}<div hidden id="menu"></div></main>${segment(1)}${segment(2)}${segment(3)}`;
    expect(inspectStreamingSegments(document)).toEqual({ pending: ['S:2'], orphaned: ['S:1', 'S:3'] });
  });

  it('un segmento visible (ya revelado a mano) no cuenta', () => {
    document.body.innerHTML = '<div id="S:1"><p>visible</p></div>';
    expect(inspectStreamingSegments(document)).toEqual({ pending: [], orphaned: [] });
  });

  it('funciona serializada como texto, igual que la recibe el navegador', () => {
    document.body.innerHTML = `<main>${boundary(1)}</main>${segment(1)}${segment(4)}`;
    const run = new Function(`return (${inspectStreamingSegments.toString()})(document);`) as () => unknown;
    expect(run()).toEqual({ pending: ['S:1'], orphaned: ['S:4'] });
  });
});

describe('T-429: collectRevealState', () => {
  it('reporta el estado de la pestaña y de la cola de revelado de React', () => {
    const globals = window as unknown as Record<string, unknown>;
    globals['$RB'] = [{}, {}];
    globals['$RT'] = 123;
    expect(collectRevealState(window)).toEqual({
      visibilityState: document.visibilityState,
      revealTimerType: 'number',
      revealQueueLength: 2,
    });
  });

  it('sin cola de revelado informa null y el tipo undefined; también serializada', () => {
    const run = new Function(`return (${collectRevealState.toString()})(window);`) as () => unknown;
    expect(run()).toMatchObject({ revealTimerType: 'undefined', revealQueueLength: null });
  });
});

describe('PR655-H01: isStreamingSettled', () => {
  it.each([
    ['DOM vacío', '', true],
    ['boundary y segmento pendiente', `<main>${boundary(1)}</main>${segment(1)}`, false],
    ['boundary aislado (el segmento todavía no llegó)', `<main>${boundary(1)}</main>`, false],
    ['segmento huérfano sin boundary', `<main><p>ok</p></main>${segment(1)}`, true],
    ['varios: un huérfano y un boundary pendiente', `<main>${boundary(2)}</main>${segment(1)}${segment(2)}`, false],
  ])('%s → %s', (_name, html, settled) => {
    document.body.innerHTML = html;
    expect(isStreamingSettled(document)).toBe(settled);
    const run = new Function(`return (${isStreamingSettled.toString()})(document);`) as () => unknown;
    expect(run()).toBe(settled);
  });
});

/**
 * `Page` simulado para el helper real (PR655-H03). `waitForFunction` y `evaluate` ejecutan el texto que reciben contra
 * el `document` de jsdom; cada vuelta de espera avanza el reloj y aplica el siguiente cambio de DOM programado. Así una
 * condición falsa nunca resuelve sola: tiene que cambiar el DOM.
 */
function mockPage(options: { skeletonMs?: number; streamingSteps?: readonly (() => void)[]; stepMs?: number } = {}) {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const steps = [...(options.streamingSteps ?? [])];
  const stepMs = options.stepMs ?? 100;
  const waitFor = vi.fn(async ({ timeout }: { state: string; timeout: number }) => {
    const ms = options.skeletonMs ?? 0;
    if (ms > timeout) throw new Error(`skeletons: timeout ${timeout}ms`);
    now += ms;
  });
  const locator = { filter: vi.fn(() => locator), first: vi.fn(() => locator), waitFor };
  const waitForFunction = vi.fn(async (expression: string, _arg: unknown, { timeout }: { timeout: number }) => {
    if (!(timeout > 0)) throw new Error(`waitForFunction sin límite: ${timeout}`);
    const evaluate = new Function(`return (${expression});`) as () => unknown;
    let waited = 0;
    while (!evaluate()) {
      const next = steps.shift();
      waited += stepMs;
      now += stepMs;
      if (waited > timeout || !next) throw new Error(`waitForFunction: timeout ${timeout}ms`);
      next();
    }
  });
  const evaluate = vi.fn(async (expression: string) => (new Function(`return (${expression});`) as () => unknown)());
  // Fidelidad con la API anterior del helper (dos waitForSelector, cada uno con el timeout completo).
  const waitForSelector = vi.fn(async (_selector: string, { timeout }: { state: string; timeout: number }) => {
    const ms = options.skeletonMs ?? 0;
    if (ms > timeout) throw new Error(`skeletons: timeout ${timeout}ms`);
    now += ms;
  });
  const page = {
    locator: vi.fn(() => locator),
    waitForSelector,
    waitForFunction,
    evaluate,
    url: () => 'http://localhost:3100/admin/merchants',
  } as unknown as Page;
  return { page, waitForFunction, locator, waitFor };
}

describe('PR655-H03: waitForNoSkeletons (helper real)', () => {
  it('espera a que React revele el segmento pendiente antes de devolver el control', async () => {
    document.body.innerHTML = `<main>${boundary(1)}</main>${segment(1)}`;
    const reveal = () => {
      document.getElementById('S:1')?.remove();
      document.getElementById('B:1')?.replaceWith(Object.assign(document.createElement('p'), { textContent: 'listo' }));
    };
    const { page, waitForFunction } = mockPage({ streamingSteps: [reveal] });

    await waitForNoSkeletons(page);

    expect(waitForFunction).toHaveBeenCalledTimes(1);
    expect(document.querySelector('template[id^="B:"]')).toBeNull();
    expect(document.getElementById('S:1')).toBeNull();
  });

  it('PR655-H01: un boundary sin segmento no cuenta como streaming terminado', async () => {
    document.body.innerHTML = `<main>${boundary(1)}</main>`;
    const { page } = mockPage({ streamingSteps: [] });
    await expect(waitForNoSkeletons(page, { timeout: 1_000 })).rejects.toThrow(/timeout/);
  });

  it('un huérfano no bloquea: se informa con diagnóstico y la prueba sigue', async () => {
    document.body.innerHTML = `<main><p>ok</p></main>${segment(3)}`;
    (window as unknown as Record<string, unknown>)['$RB'] = [{}, {}];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { page } = mockPage();

    await waitForNoSkeletons(page);

    expect(warn).toHaveBeenCalledTimes(1);
    const [message] = warn.mock.calls[0] ?? [];
    expect(String(message)).toContain('[T-429 streaming] segmento huérfano');
    expect(JSON.parse(String(message).slice(String(message).indexOf('{')))).toMatchObject({
      url: 'http://localhost:3100/admin/merchants',
      orphaned: ['S:3'],
      pending: [],
      revealQueueLength: 2,
    });
  });

  it('sin huérfanos no escribe nada en la consola', async () => {
    document.body.innerHTML = '<main><p>ok</p></main>';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await waitForNoSkeletons(mockPage().page);
    expect(warn).not.toHaveBeenCalled();
  });

  it('PR655-H02: el límite es para toda la función (14 s de skeletons + 2 s de streaming con 15 s falla)', async () => {
    document.body.innerHTML = `<main>${boundary(1)}</main>${segment(1)}`;
    const revealAt2s = Array.from({ length: 20 }, (_, i) =>
      i === 19 ? () => { document.getElementById('S:1')?.remove(); document.getElementById('B:1')?.remove(); } : () => undefined
    );
    const { page } = mockPage({ skeletonMs: 14_000, streamingSteps: revealAt2s });
    await expect(waitForNoSkeletons(page, { timeout: 15_000 })).rejects.toThrow(/timeout/);
  });

  it('PR655-H02: con el plazo ya agotado por los skeletons falla sin pasar un timeout 0', async () => {
    document.body.innerHTML = '<main><p>ok</p></main>';
    const { page, waitForFunction } = mockPage({ skeletonMs: 15_000 });
    await expect(waitForNoSkeletons(page, { timeout: 15_000 })).rejects.toThrow(/timeout/i);
    expect(waitForFunction).not.toHaveBeenCalled();
  });

  it('los skeletons se esperan como «ningún skeleton visible» con el plazo completo', async () => {
    document.body.innerHTML = '<main><p>ok</p></main>';
    const { page, locator, waitFor } = mockPage();
    await waitForNoSkeletons(page, { timeout: 9_000, selector: '.animate-pulse' });
    expect(page.locator).toHaveBeenCalledWith('.animate-pulse');
    expect(locator.filter).toHaveBeenCalledWith({ visible: true });
    expect(waitFor).toHaveBeenCalledWith({ state: 'detached', timeout: 9_000 });
  });
});


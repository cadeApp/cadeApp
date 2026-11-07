// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { collectRevealState, inspectStreamingSegments } from '../e2e/helpers/streaming';

afterEach(() => {
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

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../App';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type RenderedApp = {
  container: HTMLDivElement;
  root: Root;
  unmount: () => Promise<void>;
};

const mounted: RenderedApp[] = [];

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

async function renderApp(): Promise<RenderedApp> {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<App />);
  });
  await flush();

  const rendered = {
    container,
    root,
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };

  mounted.push(rendered);
  return rendered;
}

function getTextarea(container: HTMLDivElement): HTMLTextAreaElement {
  const textarea = container.querySelector('textarea[aria-label="Round-trip output"]');
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error('Round-trip output textarea not found.');
  }
  return textarea;
}

function getParseButton(container: HTMLDivElement): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((element) => element.textContent?.includes('Parse Into Lexical'));
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error('Parse Into Lexical button not found.');
  }
  return button;
}

function getStatus(container: HTMLDivElement): HTMLElement {
  const status = container.querySelector('[role="status"]');
  if (!(status instanceof HTMLElement)) {
    throw new Error('Parse status element not found.');
  }
  return status;
}

async function changeTextarea(textarea: HTMLTextAreaElement, value: string): Promise<void> {
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  if (!valueSetter) {
    throw new Error('Textarea value setter not found.');
  }

  await act(async () => {
    valueSetter.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await flush();
}

afterEach(async () => {
  while (mounted.length > 0) {
    const app = mounted.pop();
    if (app) {
      await app.unmount();
    }
  }
});

describe('App manual parse-back', () => {
  it('does not reverse parse until the button is clicked', async () => {
    const { container } = await renderApp();
    const textarea = getTextarea(container);
    const button = getParseButton(container);
    const editorSurface = container.querySelector('.editor-surface');

    expect(editorSurface?.textContent).toContain('Freemarker playground');

    await changeTextarea(textarea, 'Manual parse only');

    expect(button.disabled).toBe(false);
    expect(getStatus(container).textContent).toContain('Draft changed');
    expect(editorSurface?.textContent).not.toContain('Manual parse only');
  });

  it('parse button imports output back into the editor', async () => {
    const { container } = await renderApp();
    const textarea = getTextarea(container);
    const button = getParseButton(container);

    await changeTextarea(textarea, 'Parsed paragraph');

    await act(async () => {
      button.click();
    });
    await flush();

    expect(getStatus(container).textContent).toContain('Import complete');
    expect(container.querySelector('.editor-surface')?.textContent).toContain('Parsed paragraph');
  });

  it('keeps malformed freemarker input localized instead of crashing the editor', async () => {
    const { container } = await renderApp();
    const textarea = getTextarea(container);
    const button = getParseButton(container);

    await changeTextarea(textarea, 'Intro\n\n<#if user.active>\nBroken\n\nOutro');

    await act(async () => {
      button.click();
    });
    await flush();

    expect(getStatus(container).textContent).toContain('Partial import');
    expect(container.querySelector('.editor-surface')?.textContent).toContain('Intro');
    expect(container.querySelector('.editor-surface')?.textContent).toContain('Outro');
    expect(container.querySelector('.if-card-error-text')?.textContent).toContain('Unclosed <#if block');
  });

  it('successful parse clears prior error state', async () => {
    const { container } = await renderApp();
    const textarea = getTextarea(container);
    const button = getParseButton(container);

    await changeTextarea(textarea, 'Intro\n\n<#if user.active>\nBroken\n\nOutro');

    await act(async () => {
      button.click();
    });
    await flush();

    expect(container.querySelector('.if-card-error-text')).not.toBeNull();

    await changeTextarea(textarea, 'Fixed\n\n<#if user.active>\n  Yep\n</#if>');

    await act(async () => {
      button.click();
    });
    await flush();

    expect(getStatus(container).textContent).toContain('Import complete');
    expect(container.querySelector('.if-card-error-text')).toBeNull();
  });
});

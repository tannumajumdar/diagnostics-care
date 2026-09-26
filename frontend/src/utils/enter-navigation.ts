/**
 * Enter moves to the next field, so the desk can fill a form from the
 * keyboard without reaching for the mouse. On the last field of a form it
 * submits, as Enter always did.
 *
 * A field that gives Enter its own meaning (a search box, a picker, an
 * inline save) calls `preventDefault()` and is left alone. Anything inside
 * `data-enter="default"` opts out as well.
 */

const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'file']);

const isField = (el: Element): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => {
  if (el instanceof HTMLInputElement) return !SKIP_TYPES.has(el.type);
  return el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
};

const canTakeFocus = (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) =>
  !el.disabled &&
  !(el as HTMLInputElement).readOnly &&
  el.tabIndex >= 0 &&
  el.getClientRects().length > 0 &&
  getComputedStyle(el).visibility !== 'hidden';

/**
 * A marked panel first (a small form nested in a bigger one), then the form
 * the field is in, then the popup it sits in, else the page.
 */
const scopeOf = (el: HTMLElement): HTMLElement =>
  el.closest<HTMLElement>('[data-enter-scope]') ||
  el.closest<HTMLElement>('form') ||
  el.closest<HTMLElement>('[role="dialog"], .fixed.inset-0') ||
  document.body;

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key !== 'Enter' || e.defaultPrevented || e.isComposing) return;
  if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;

  const target = e.target;
  // Textareas keep Enter for a new line; buttons and links keep their click.
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
  if (!isField(target) || target.closest('[data-enter="default"]')) return;

  const scope = scopeOf(target);
  const fields = Array.from(scope.querySelectorAll('input, select, textarea')).filter(
    (el): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => isField(el) && canTakeFocus(el)
  );
  const next = fields[fields.indexOf(target) + 1];

  e.preventDefault();
  if (next) {
    next.focus();
    // A prefilled value is picked whole, so typing replaces it.
    if (next instanceof HTMLInputElement) {
      try {
        next.select();
      } catch {
        // Some input types do not support selection.
      }
    }
    return;
  }

  if (scope instanceof HTMLFormElement) scope.requestSubmit();
};

export const installEnterNavigation = () => {
  document.addEventListener('keydown', onKeyDown);
  return () => document.removeEventListener('keydown', onKeyDown);
};

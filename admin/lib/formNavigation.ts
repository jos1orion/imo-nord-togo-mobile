export const focusForm = (formId: string) => {
  const form = document.getElementById(formId);
  form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  form?.querySelector<HTMLElement>('input:not([type="file"]), select, textarea')?.focus({ preventScroll: true });
};

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const initial = browser ? (localStorage.getItem('wt-theme') || 'light') : 'light';
export const theme = writable(initial);

theme.subscribe(t => {
  if (!browser) return;
  localStorage.setItem('wt-theme', t);
  document.documentElement.setAttribute('data-theme', t);
});

export function toggleTheme() {
  theme.update(t => (t === 'dark' ? 'light' : 'dark'));
}

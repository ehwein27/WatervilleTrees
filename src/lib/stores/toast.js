import { writable } from 'svelte/store';

export const toastMessage = writable(null); // { text, type } | null
export const confirmState = writable(null); // { message } | null

let toastTimer;
let confirmResolve;

export function showToast(text, type = 'success') {
  clearTimeout(toastTimer);
  toastMessage.set({ text, type });
  toastTimer = setTimeout(() => toastMessage.set(null), 3500);
}

export function showConfirm(message) {
  return new Promise(resolve => {
    confirmResolve = resolve;
    confirmState.set({ message });
  });
}

export function answerConfirm(result) {
  confirmState.set(null);
  confirmResolve?.(result);
  confirmResolve = null;
}

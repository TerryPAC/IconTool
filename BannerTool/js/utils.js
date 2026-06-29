import { SCALE_TO_NORMAL } from './constants.js';

export function debounce(fn, ms) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function scaleInt(value) {
  return Math.round(Number(value) * SCALE_TO_NORMAL);
}

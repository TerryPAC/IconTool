let statusEl = null;
let toastContainerEl = null;

export function bindUI({ statusText, toastContainer }) {
  statusEl = statusText;
  toastContainerEl = toastContainer;
}

export function setStatus(msg, isError) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.style.color = isError ? '#f7768e' : '#9ece6a';
}

export function setStatusNeutral(msg) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.style.color = '#565f89';
}

export function showToast(message, type = 'success', durationMs = 2800) {
  if (!toastContainerEl || !message) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainerEl.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('toast-visible');
  });

  const remove = () => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 300);
  };

  setTimeout(remove, durationMs);
}

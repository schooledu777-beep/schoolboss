import { state } from './state.js';

const routes = {};
let currentCleanup = null;

export function registerRoute(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  state.currentPage = path;
  window.location.hash = path;
}

export function getCurrentRoute() {
  return window.location.hash.slice(1) || 'dashboard';
}

export async function handleRoute() {
  const fullHash = window.location.hash.slice(1) || 'dashboard';
  const path = fullHash.split('?')[0];
  console.log('[Router] Navigating to:', path, 'Full hash:', fullHash);
  state.currentPage = path;
  
  // Cleanup previous page
  if (currentCleanup) { currentCleanup(); currentCleanup = null; }
  
  const handler = routes[path];
  if (handler) {
    const cleanup = await handler();
    if (typeof cleanup === 'function') currentCleanup = cleanup;
  }
  
  // Update sidebar active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === path);
  });
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
}

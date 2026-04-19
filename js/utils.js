// ==================== 工具函数 ====================
import { CONSTANTS } from './constants.js';

export function getLocalDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
}

export function showToast(msg, duration = 2000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  toast.setAttribute('role', 'status');
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

export function generateUniqueId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch (e) {}
  return Date.now() + '-' + Math.random().toString(36).slice(2) + '-' + Math.floor(performance.now() * 1000);
}

export function validateEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (!entry.id || typeof entry.id !== 'string') return false;
  if (!entry.date || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return false;
  if (typeof entry.amount !== 'number' || isNaN(entry.amount) || entry.amount <= 0) return false;
  if (entry.amount > CONSTANTS.MAX_AMOUNT) return false;
  if (entry.type !== 'expense' && entry.type !== 'income') return false;
  if (typeof entry.note !== 'string') entry.note = '';
  if (entry.note.length > CONSTANTS.MAX_NOTE_LENGTH) {
    entry.note = entry.note.slice(0, CONSTANTS.MAX_NOTE_LENGTH);
  }
  return true;
}

export function formatDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function detectBrowser() {
  const ua = navigator.userAgent;
  if (/Edg/.test(ua)) return 'edge';
  if (/Chrome/.test(ua) && /Google Inc/.test(navigator.vendor)) return 'chrome';
  if (/SamsungBrowser/.test(ua)) return 'samsung';
  if (/Firefox/.test(ua)) return 'firefox';
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'safari';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  return 'other';
}

export function isRunningAsPWA() {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.navigator.standalone === true) return true;
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
  if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
  return false;
}

// HSL 颜色转换
export function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToHsl(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) h = s = 0;
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function getDateRangeFromEntries(entriesList) {
  if (!entriesList.length) return '无数据';
  const dates = entriesList.map(e => e.date).sort();
  return `${dates[0]} 至 ${dates[dates.length - 1]}`;
}

export function calculateTotalByType(entriesList, type) {
  return entriesList.filter(e => e.type === type).reduce((sum, e) => sum + e.amount, 0);
}
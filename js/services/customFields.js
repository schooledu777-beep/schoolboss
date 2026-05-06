import { state } from '../state.js';
import { escapeHTML } from '../ui.js?v=20260502-photo-sync';

const ARABIC_KEY_MAP = {
  ا: 'a', أ: 'a', إ: 'i', آ: 'a', ب: 'b', ت: 't', ث: 'th', ج: 'j', ح: 'h', خ: 'kh',
  د: 'd', ذ: 'dh', ر: 'r', ز: 'z', س: 's', ش: 'sh', ص: 's', ض: 'd', ط: 't', ظ: 'z',
  ع: 'a', غ: 'gh', ف: 'f', ق: 'q', ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', و: 'w',
  ي: 'y', ى: 'a', ة: 'h', ء: '', ئ: 'y', ؤ: 'w', لا: 'la'
};

export function buildFieldKey(label) {
  const text = String(label || '').trim().toLowerCase();
  let converted = '';
  for (const ch of text) converted += ARABIC_KEY_MAP[ch] ?? ch;
  const key = converted
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return key || `field_${Date.now()}`;
}

export function getCustomFields(targetEntity) {
  return (state.customFieldsSchema || [])
    .filter(field => field.target_entity === targetEntity && field.is_active !== false)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

export function renderCustomFieldInputs(targetEntity, values = {}, prefix = 'cf') {
  const fields = getCustomFields(targetEntity);
  if (!fields.length) return '';

  return `
    <div class="custom-fields-section full-width">
      <div class="custom-fields-header">
        <div>
          <h4>${state.lang === 'ar' ? 'معلومات إضافية' : 'Additional Information'}</h4>
          <p>${state.lang === 'ar' ? 'حقول مخصصة أضافتها إدارة المدرسة.' : 'Custom fields configured by school admin.'}</p>
        </div>
        <span>${fields.length}</span>
      </div>
      <div class="custom-fields-grid">
        ${fields.map(field => renderInput(field, values[field.field_key], prefix)).join('')}
      </div>
    </div>`;
}

function renderInput(field, value, prefix) {
  const id = `${prefix}-${field.field_key}`;
  const required = field.is_required ? 'required' : '';
  const label = `${escapeHTML(field.field_label || field.field_key)}${field.is_required ? ' *' : ''}`;
  const type = field.field_type || 'text';

  if (type === 'dropdown') {
    return `
      <div class="form-group">
        <label>${label}</label>
        <select id="${id}" class="form-select custom-field-input" data-field-key="${escapeHTML(field.field_key)}" data-field-type="dropdown" ${required}>
          <option value="">${state.lang === 'ar' ? 'اختر...' : 'Select...'}</option>
          ${(field.options || []).map(option => `<option value="${escapeHTML(option)}" ${value === option ? 'selected' : ''}>${escapeHTML(option)}</option>`).join('')}
        </select>
      </div>`;
  }

  if (type === 'boolean') {
    return `
      <label class="custom-checkbox-field">
        <input id="${id}" class="custom-field-input" type="checkbox" data-field-key="${escapeHTML(field.field_key)}" data-field-type="boolean" ${value === true ? 'checked' : ''}>
        <span>${label}</span>
      </label>`;
  }

  return `
    <div class="form-group">
      <label>${label}</label>
      <input id="${id}" class="form-input custom-field-input" type="${type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'}"
        data-field-key="${escapeHTML(field.field_key)}" data-field-type="${escapeHTML(type)}" value="${escapeHTML(value ?? '')}" ${required}>
    </div>`;
}

export function collectCustomFieldValues(targetEntity) {
  const fields = getCustomFields(targetEntity);
  const values = {};

  for (const field of fields) {
    const input = Array.from(document.querySelectorAll('.custom-field-input'))
      .find(item => item.dataset.fieldKey === field.field_key);
    if (!input) continue;
    let value;
    if (field.field_type === 'boolean') value = input.checked;
    else if (field.field_type === 'number') value = input.value === '' ? null : Number(input.value);
    else value = input.value;

    if (field.is_required && (value === '' || value === null || value === undefined || value === false)) {
      throw new Error(`${field.field_label || field.field_key} مطلوب`);
    }
    values[field.field_key] = value;
  }

  return values;
}

export function renderCustomDataSummary(targetEntity, values = {}) {
  const fields = getCustomFields(targetEntity).filter(field => values[field.field_key] !== undefined && values[field.field_key] !== '');
  if (!fields.length) return '';

  return `
    <div class="sp-section-card">
      <h4 class="sp-section-title">${state.lang === 'ar' ? '🧩 معلومات إضافية' : '🧩 Additional Information'}</h4>
      <div class="sp-info-grid">
        ${fields.map(field => `
          <div class="sp-info-item">
            <span class="sp-info-icon">•</span>
            <div>
              <span class="sp-info-label">${escapeHTML(field.field_label || field.field_key)}</span>
              <span class="sp-info-value">${escapeHTML(formatCustomValue(field, values[field.field_key]))}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
}

export function formatCustomValue(field, value) {
  if (value === undefined || value === null || value === '') return '—';
  if (field.field_type === 'boolean') return value ? (state.lang === 'ar' ? 'نعم' : 'Yes') : (state.lang === 'ar' ? 'لا' : 'No');
  return String(value);
}

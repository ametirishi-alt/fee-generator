import { PROFILES, SERVICES, SOURCE, GROUP_RULES, INDIVIDUAL_BASE } from './pricing.mjs';
import { calculate, formatMoney, formatRange, quoteText } from './calculator.mjs';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let nextId = 2;
const blankEntity = id => ({ id, name: '', profile: '', turnover: null, payroll: false });
const initial = () => ({ mode: 'business', client: '', year: '2026', entities: [blankEntity(1)], returns: 1, groupMode: 'per-entity', groupPayrollConfirmed: false, services: {}, gst: 'unspecified' });
let model = initial(), currentResult;
const getEntity = id => model.entities.find(e => e.id === Number(id));
const toNumber = value => value.trim() === '' ? null : Number(value);
const clampCount = value => Math.max(1, Math.min(10000, value));
let toastTimer;

function notify(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
}

function renderEntities() {
  const grouped = model.groupMode !== 'per-entity';
  $('entity-list').innerHTML = model.entities.map((entity, index) => {
    const profile = PROFILES.find(p => p.id === entity.profile);
    const payroll = grouped && entity.payroll;
    const needsTurnover = grouped || !!profile?.turnoverRate || (!!profile && entity.turnover !== null);
    const presets = [0, 50000, 100000, 250000, 500000, 1000000, 2000000, 5000000].filter(value => payroll || !profile || value < profile.limit);
    return `<article class="entity-card" data-entity="${entity.id}">
      <div class="entity-heading"><span class="entity-title">Entity ${index + 1}</span>${model.entities.length > 1 ? `<button type="button" class="remove-entity" data-remove="${entity.id}" aria-label="Remove entity ${index + 1}">Remove</button>` : ''}</div>
      <label class="entity-name-field">Entity name <span class="optional">optional</span><input data-entity-name="${entity.id}" type="text" maxlength="150" placeholder="Entity ${index + 1}" value="${esc(entity.name)}" autocomplete="off"></label>
      <div class="entity-fields ${needsTurnover ? 'has-turnover' : ''}">
        <label class="profile-field">Business type<select data-profile="${entity.id}" ${payroll ? 'disabled' : ''}><option value="">Select a business type</option>${PROFILES.map(p => `<option value="${p.id}" ${entity.profile === p.id ? 'selected' : ''}>${p.label}</option>`).join('')}</select></label>
        ${needsTurnover ? `<label>Annual turnover ($)${!grouped && !profile?.turnoverRate ? ' <span class="optional">optional</span>' : ''}<input type="number" min="0" max="1000000000000" step="0.01" inputmode="decimal" data-turnover="${entity.id}" value="${entity.turnover === null ? '' : esc(entity.turnover)}" placeholder="Enter or select below"></label>` : ''}
      </div>
      ${payroll ? `<p class="profile-fee">$4,000 payroll entity base + group turnover adjustment</p>` : profile ? `<p class="profile-fee">${formatMoney(profile.base)} base${grouped ? ' + group turnover adjustment' : profile.turnoverRate ? ' + 0.15% of turnover' : ' · flat fee'}</p>` : '<p class="help">Base fee includes year-end financial statements and tax return preparation.</p>'}
      ${profile && !payroll ? `<p class="help">Turnover must be below ${formatMoney(profile.limit)}.${profile.id.startsWith('small-') ? ' For exactly 5 employees, confirm which pricing category to use.' : ''}</p>` : ''}
      ${needsTurnover ? `<div class="turnover-presets" role="group" aria-label="Quick turnover amounts for entity ${index + 1}"><span class="preset-label">Quick select</span>${presets.map(value => `<button type="button" data-preset="${value}" data-for-entity="${entity.id}" aria-label="Set entity ${index + 1} turnover to ${formatMoney(value)}" class="${entity.turnover === value ? 'active' : ''}">${value === 0 ? '$0' : value >= 1000000 ? '$' + value / 1000000 + 'm' : '$' + value / 1000 + 'k'}</button>`).join('')}</div>` : ''}
      ${grouped ? `<label class="payroll-check"><input type="checkbox" data-payroll="${entity.id}" ${entity.payroll ? 'checked' : ''}>Payroll entity</label>` : ''}
    </article>`;
  }).join('');
  const payrollSelected = grouped && model.entities.some(entity => entity.payroll);
  $('payroll-confirm-label').hidden = !payrollSelected;
  $('payroll-confirm').checked = model.groupPayrollConfirmed;
  const rules = GROUP_RULES[model.groupMode];
  $('group-description').textContent = rules
    ? `The ${model.groupMode} group rate is ${(rules.rate * 100).toFixed(2)}% of combined turnover, applied once. Non-payroll entities use their selected base fee. Enter turnover for every entity.`
    : 'Standard pricing applies the turnover adjustment to each applicable entity.';
}

function servicePrice(service) {
  if (service.choices) return '$180 or $240 · confirm rate';
  return `${formatRange(service.low, service.high)} / ${service.unit}`;
}
function renderServices() {
  const services = SERVICES.filter(s => s.scope === model.mode);
  const sections = [...new Set(services.map(s => s.section))];
  $('service-list').innerHTML = sections.map(section => `<h3 class="service-section-title">${esc(section)}</h3><div class="services-grid">${services.filter(s => s.section === section).map(service => {
    const selected = model.services[service.id];
    return `<div class="service-card ${selected ? 'selected' : ''}" data-service-card="${service.id}">
      <label class="service-option" for="service-${service.id}"><input type="checkbox" id="service-${service.id}" data-service="${service.id}" ${selected ? 'checked' : ''}><span><span class="service-name">${esc(service.label)}</span><span class="service-price">${servicePrice(service)}</span></span></label>
      ${selected ? `<div class="service-controls"><span class="quantity-label">Quantity</span><div class="quantity-control"><button type="button" data-step="-1" data-step-service="${service.id}" aria-label="One fewer ${esc(service.label)}" ${selected.quantity <= 1 ? 'disabled' : ''}>−</button><input type="number" min="1" max="10000" step="1" data-quantity="${service.id}" value="${Number.isFinite(selected.quantity) ? selected.quantity : ''}" aria-label="Quantity for ${esc(service.label)}"><button type="button" data-step="1" data-step-service="${service.id}" aria-label="One more ${esc(service.label)}" ${selected.quantity >= 10000 ? 'disabled' : ''}>+</button></div></div>
        ${service.choices ? `<p class="rate-conflict">The source lists minimum $240 and maximum $180.</p><label class="fee-level">Rate to use<select data-rate="${service.id}"><option value="">Choose rate</option>${service.choices.map(rate => `<option value="${rate}" ${selected.rate === rate ? 'selected' : ''}>${formatMoney(rate)} per schedule</option>`).join('')}</select></label>` : service.low !== service.high ? `<label class="fee-level">Fee level<select data-fee-choice="${service.id}"><option value="range" ${selected.choice === 'range' ? 'selected' : ''}>Show fee range</option><option value="low" ${selected.choice === 'low' ? 'selected' : ''}>Lower fee · ${formatMoney(service.low)}</option><option value="high" ${selected.choice === 'high' ? 'selected' : ''}>Upper fee · ${formatMoney(service.high)}</option></select></label>` : ''}` : ''}
    </div>`;
  }).join('')}</div>`).join('');
  const count = services.filter(s => model.services[s.id]).length;
  $('selection-count').textContent = `${count} selected`;
}

function renderMode() {
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === model.mode)));
  const business = model.mode === 'business';
  $('business-base').hidden = !business;
  $('individual-base').hidden = business;
  $('add-entity').hidden = !business;
  $('base-heading').textContent = business ? 'Business entities' : 'Tax returns';
  $('return-count').value = model.returns;
  $('group-mode').value = model.groupMode;
  renderEntities();
  renderServices();
  updateQuote();
}

function updateQuote() {
  currentResult = calculate(model);
  const result = currentResult, hasFees = result.lines.length > 0;
  const amount = $('estimate-amount');
  amount.textContent = formatRange(result.totalLow, result.totalHigh);
  amount.classList.toggle('range', result.totalLow !== result.totalHigh);
  $('estimate-caption').textContent = result.ready ? 'Total fee estimate' : hasFees ? 'Known fees · complete inputs below' : 'Calculated from your selections';
  $('estimate-tax-label').textContent = !hasFees ? 'Choose a business type to begin' : model.gst === 'exclusive' ? 'Including 10% GST' : model.gst === 'inclusive' ? 'GST included in listed prices' : model.gst === 'none' ? 'No GST added as selected' : 'GST treatment not yet selected';
  $('quote-status').textContent = result.ready ? result.feeLow === result.feeHigh ? 'Ready' : 'Fee range' : hasFees ? 'Complete inputs' : 'Choose services';
  $('quote-status').classList.toggle('ready', result.ready);
  let previousKind;
  $('quote-details').innerHTML = result.lines.map(line => {
    const groupLabel = line.kind !== previousKind ? `<p class="detail-group-label">${line.kind === 'base' ? 'Base fees' : line.kind === 'turnover' ? 'Turnover adjustment' : 'Selected services'}</p>` : '';
    previousKind = line.kind;
    const quantity = line.quantity ? `<small>${line.quantity} × ${line.unitLow !== undefined ? formatRange(line.unitLow, line.unitHigh) : formatMoney(line.unitRate)}${line.unit ? ` / ${esc(line.unit)}` : ' / return'}</small>` : '';
    return `${groupLabel}<div class="quote-line"><span>${esc(line.label)}${quantity}</span><span class="${line.low !== line.high ? 'ranged-price' : ''}">${formatRange(line.low, line.high)}</span></div>`;
  }).join('');
  const row = (label, low, high, final = false) => `<div class="total-row ${final ? 'final' : ''}"><span>${label}</span><span>${formatRange(low, high)}</span></div>`;
  $('totals').innerHTML = !hasFees ? '' : model.gst === 'exclusive'
    ? row('Fees excluding GST', result.feeLow, result.feeHigh) + row('GST (10%)', result.taxLow, result.taxHigh) + row('Total including GST', result.totalLow, result.totalHigh, true)
    : model.gst === 'inclusive' ? row('GST included', result.taxLow, result.taxHigh) + row('Total including GST', result.totalLow, result.totalHigh, true)
      : row(model.gst === 'none' ? 'Total · no GST added' : 'Fees · GST not specified', result.feeLow, result.feeHigh, true);
  const issues = result.issues.filter(issue => hasFees || !issue.startsWith('Choose how GST'));
  $('issues').hidden = !hasFees && model.entities.every(e => !e.profile) && model.mode === 'business' || issues.length === 0;
  $('issues').innerHTML = `<strong>Complete your quote</strong><ul>${issues.map(issue => `<li>${esc(issue)}</li>`).join('')}</ul>`;
  $('copy-quote').disabled = !result.ready;
  $('print-quote').disabled = !result.ready;
  document.querySelectorAll('[data-gst]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.gst === model.gst)));
  $('return-count').value = Number.isFinite(model.returns) ? model.returns : '';
  document.querySelector('[data-return-step="-1"]').disabled = model.returns <= 1;
  document.querySelector('[data-return-step="1"]').disabled = model.returns >= 10000;
  const scoped = SERVICES.filter(s => s.scope === model.mode);
  $('selection-count').textContent = `${scoped.filter(s => model.services[s.id]).length} selected`;
  buildPrintView(result);
}

function buildPrintView(result) {
  if (!result.ready) { $('print-area').innerHTML = ''; return; }
  $('print-area').innerHTML = `<div class="print-header"><h1>Fee estimate</h1><h2>${esc(model.client.trim() || 'Client quote')}</h2><p>Financial year ending 30 June ${esc(model.year)}</p><p>${model.mode === 'business' ? 'Financial statements and tax returns' : 'Individual tax returns'}</p></div>
    <table><thead><tr><th>Service</th><th>Quantity</th><th>Fee (AUD)</th></tr></thead><tbody>${result.lines.map(line => `<tr><td>${esc(line.label)}</td><td>${line.quantity || '1'}</td><td>${formatRange(line.low, line.high)}</td></tr>`).join('')}</tbody></table>
    <div class="print-totals">${model.gst === 'exclusive' ? `<p>Fees excluding GST: ${formatRange(result.feeLow, result.feeHigh)}</p><p>GST (10%): ${formatRange(result.taxLow, result.taxHigh)}</p>` : model.gst === 'inclusive' ? `<p>GST included: ${formatRange(result.taxLow, result.taxHigh)}</p>` : '<p>No GST added as selected.</p>'}<p class="print-total">${model.gst === 'none' ? 'Total' : 'Total including GST'}: ${formatRange(result.totalLow, result.totalHigh)}</p></div>
    ${result.feeLow !== result.feeHigh ? '<p class="print-note">One or more services have a minimum and maximum price. Select a fee level in the calculator to produce a single amount.</p>' : ''}<p class="print-note">Rates from the uplifted Price List dated ${SOURCE.date}.</p>`;
}

function renderRateTable() {
  const table = rows => `<table><thead><tr><th>Service</th><th>Fee (AUD)</th><th>Basis</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row[0])}</td><td>${esc(row[1])}</td><td>${esc(row[2])}</td></tr>`).join('')}</tbody></table>`;
  let html = '<h3>Business base rates</h3>' + table(PROFILES.map(p => [p.label, formatMoney(p.base), p.turnoverRate ? '+ 0.15% of turnover' : 'Flat fee']));
  html += '<h3>Group pricing</h3>' + table([['Medium group · 5–10 entities', '$4,000 / payroll entity', 'Non-payroll bases as above + 0.15% of group turnover under $10m'], ['Large group · more than 10 entities', '$4,000 / payroll entity', 'Non-payroll bases as above + 0.10% of group turnover over $10m']]);
  for (const section of ['Year-end adjustments', 'Other services', 'Tax return schedules']) {
    const rows = SERVICES.filter(s => s.section === section).map(s => [s.label, s.choices ? '$240 minimum / $180 maximum' : formatRange(s.low, s.high), `Per ${s.unit}`]);
    if (section === 'Tax return schedules') rows.unshift(['Individual tax return preparation', formatMoney(INDIVIDUAL_BASE), 'Per tax return']);
    html += `<h3>${section}</h3>` + table(rows);
  }
  $('rate-table').innerHTML = html;
}

$('client-name').addEventListener('input', event => { model.client = event.target.value; updateQuote(); });
$('financial-year').addEventListener('change', event => { model.year = event.target.value; updateQuote(); });
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => { model.mode = button.dataset.mode; renderMode(); }));
document.querySelectorAll('[data-gst]').forEach(button => button.addEventListener('click', () => { model.gst = button.dataset.gst; updateQuote(); }));
$('add-entity').addEventListener('click', () => {
  if (model.entities.length >= 100) { notify('A quote supports up to 100 entities.'); return; }
  const entity = blankEntity(nextId++);
  model.entities.push(entity);
  renderEntities(); updateQuote();
  document.querySelector(`[data-profile="${entity.id}"]`).focus();
});
$('entity-list').addEventListener('change', event => {
  const target = event.target;
  if (target.dataset.profile) {
    getEntity(target.dataset.profile).profile = target.value;
    renderEntities(); updateQuote();
    document.querySelector(`[data-profile="${target.dataset.profile}"]`)?.focus();
  }
  if (target.dataset.payroll) {
    getEntity(target.dataset.payroll).payroll = target.checked;
    renderEntities(); updateQuote();
    document.querySelector(`[data-payroll="${target.dataset.payroll}"]`)?.focus();
  }
});
$('entity-list').addEventListener('input', event => {
  const target = event.target;
  if (target.dataset.turnover) {
    getEntity(target.dataset.turnover).turnover = toNumber(target.value);
    document.querySelectorAll(`[data-for-entity="${target.dataset.turnover}"]`).forEach(button => button.classList.toggle('active', Number(button.dataset.preset) === getEntity(target.dataset.turnover).turnover));
    updateQuote();
  }
  if (target.dataset.entityName) { getEntity(target.dataset.entityName).name = target.value; updateQuote(); }
});
$('entity-list').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.remove) {
    model.entities = model.entities.filter(entity => entity.id !== Number(button.dataset.remove));
    renderEntities(); updateQuote(); $('add-entity').focus();
  }
  if (button.dataset.preset !== undefined) {
    getEntity(button.dataset.forEntity).turnover = Number(button.dataset.preset);
    renderEntities(); updateQuote();
    document.querySelector(`[data-for-entity="${button.dataset.forEntity}"][data-preset="${button.dataset.preset}"]`)?.focus();
  }
});
$('group-mode').addEventListener('change', event => { model.groupMode = event.target.value; renderEntities(); updateQuote(); });
$('payroll-confirm').addEventListener('change', event => { model.groupPayrollConfirmed = event.target.checked; updateQuote(); });
$('return-count').addEventListener('input', event => { model.returns = event.target.value === '' ? NaN : Number(event.target.value); updateQuote(); });
document.querySelectorAll('[data-return-step]').forEach(button => button.addEventListener('click', () => { model.returns = clampCount((Number.isFinite(model.returns) ? model.returns : 1) + Number(button.dataset.returnStep)); updateQuote(); }));
$('service-list').addEventListener('change', event => {
  const target = event.target;
  if (target.dataset.service) {
    if (target.checked) model.services[target.dataset.service] = { quantity: 1, choice: 'range', rate: null };
    else delete model.services[target.dataset.service];
    renderServices(); updateQuote(); $('service-' + target.dataset.service).focus();
  }
  if (target.dataset.feeChoice) { model.services[target.dataset.feeChoice].choice = target.value; updateQuote(); }
  if (target.dataset.rate) { model.services[target.dataset.rate].rate = target.value === '' ? null : Number(target.value); updateQuote(); }
});
$('service-list').addEventListener('input', event => {
  if (event.target.dataset.quantity) {
    const id = event.target.dataset.quantity;
    model.services[id].quantity = event.target.value === '' ? NaN : Number(event.target.value);
    const card = event.target.closest('[data-service-card]');
    card.querySelector('[data-step="-1"]').disabled = model.services[id].quantity <= 1;
    card.querySelector('[data-step="1"]').disabled = model.services[id].quantity >= 10000;
    updateQuote();
  }
});
$('service-list').addEventListener('click', event => {
  const button = event.target.closest('[data-step-service]');
  if (!button) return;
  const selected = model.services[button.dataset.stepService];
  selected.quantity = clampCount((Number.isFinite(selected.quantity) ? selected.quantity : 1) + Number(button.dataset.step));
  renderServices(); updateQuote();
  const newButton = document.querySelector(`[data-step-service="${button.dataset.stepService}"][data-step="${button.dataset.step}"]`);
  if (!newButton?.disabled) newButton?.focus(); else document.querySelector(`[data-quantity="${button.dataset.stepService}"]`)?.focus();
});
$('reset-button').addEventListener('click', () => {
  model = initial(); nextId = 2;
  $('client-name').value = ''; $('financial-year').value = '2026'; $('group-details').open = false;
  renderMode(); notify('New quote ready.');
});
$('rates-button').addEventListener('click', () => $('rates-dialog').showModal());
$('close-rates').addEventListener('click', () => $('rates-dialog').close());
$('done-rates').addEventListener('click', () => $('rates-dialog').close());
$('close-copy').addEventListener('click', () => $('copy-dialog').close());
$('done-copy').addEventListener('click', () => $('copy-dialog').close());
for (const dialog of [$('rates-dialog'), $('copy-dialog')]) dialog.addEventListener('click', event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
$('copy-quote').addEventListener('click', async () => {
  if (!currentResult.ready) return;
  const text = quoteText(model, currentResult);
  try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(text); notify('Quote copied.'); }
  catch { $('quote-text').value = text; $('copy-dialog').showModal(); $('quote-text').focus(); $('quote-text').select(); }
});
$('print-quote').addEventListener('click', () => { if (currentResult.ready) window.print(); });
window.addEventListener('beforeprint', () => buildPrintView(currentResult));

renderRateTable();
renderMode();

// Expose the same calculation journey to supporting browser agents.
const context = document.modelContext;
if (context?.registerTool) {
  const lifecycle = new AbortController();
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  const register = tool => { try { Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch {} };
  register({ name: 'read_fee_estimate', title: 'Read fee estimate', description: 'Read the visible quote, required inputs, and the selectable service and business-type IDs. Does not change the quote.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: () => ({ client: model.client, year: model.year, mode: model.mode, ...calculate(model), profiles: PROFILES.map(p => ({ id: p.id, label: p.label })), services: SERVICES.filter(s => s.scope === model.mode).map(s => ({ id: s.id, label: s.label, unit: s.unit })) }) });
  register({ name: 'configure_fee_estimate', title: 'Configure fee estimate', description: 'Update the visible quote by selecting a client type, business entities, service quantities, fee levels, and GST treatment. Does not send or save a quote.', inputSchema: { type: 'object', properties: { mode: { type: 'string', enum: ['business', 'individual'] }, client: { type: 'string', maxLength: 150 }, year: { type: 'string', enum: ['2025', '2026', '2027', '2028', '2029', '2030'] }, returns: { type: 'integer', minimum: 1, maximum: 10000 }, gst: { type: 'string', enum: ['unspecified', 'exclusive', 'inclusive', 'none'] }, groupMode: { type: 'string', enum: ['per-entity', 'medium', 'large'] }, groupPayrollConfirmed: { type: 'boolean' }, entities: { type: 'array', minItems: 1, maxItems: 100, items: { type: 'object', properties: { name: { type: 'string', maxLength: 150 }, profile: { type: 'string', enum: ['', ...PROFILES.map(p => p.id)] }, turnover: { anyOf: [{ type: 'number', minimum: 0, maximum: 1e12 }, { type: 'null' }] }, payroll: { type: 'boolean' } }, additionalProperties: false } }, services: { type: 'array', items: { type: 'object', properties: { id: { type: 'string', enum: SERVICES.map(s => s.id) }, quantity: { type: 'integer', minimum: 1, maximum: 10000 }, choice: { type: 'string', enum: ['range', 'low', 'high'] }, rate: { type: 'number', enum: [180, 240] } }, required: ['id', 'quantity'], additionalProperties: false } } }, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: input => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Inputs must be an object.');
    const allowed = ['mode', 'client', 'year', 'returns', 'gst', 'groupMode', 'groupPayrollConfirmed', 'entities', 'services'];
    if (Object.keys(input).some(key => !allowed.includes(key))) throw new Error('Unknown quote input.');
    const candidate = structuredClone(model);
    for (const key of ['mode', 'client', 'year', 'returns', 'gst', 'groupMode', 'groupPayrollConfirmed']) if (input[key] !== undefined) candidate[key] = input[key];
    if (typeof candidate.client !== 'string' || candidate.client.length > 150 || !['2025', '2026', '2027', '2028', '2029', '2030'].includes(candidate.year) || !['per-entity', 'medium', 'large'].includes(candidate.groupMode) || typeof candidate.groupPayrollConfirmed !== 'boolean' || !Number.isInteger(candidate.returns) || candidate.returns < 1 || candidate.returns > 10000) throw new Error('Invalid client, year, return count, or group setting.');
    if (input.entities !== undefined) {
      if (!Array.isArray(input.entities) || input.entities.length < 1 || input.entities.length > 100) throw new Error('Supply 1–100 entities.');
      candidate.entities = input.entities.map((entity, index) => {
        if (!entity || typeof entity !== 'object' || Array.isArray(entity) || Object.keys(entity).some(key => !['name', 'profile', 'turnover', 'payroll'].includes(key))) throw new Error('Invalid entity inputs.');
        if (entity.profile !== undefined && entity.profile !== '' && !PROFILES.some(p => p.id === entity.profile)) throw new Error('Unknown business type.');
        if (entity.name !== undefined && (typeof entity.name !== 'string' || entity.name.length > 150)) throw new Error('Invalid entity name.');
        if (entity.turnover !== undefined && entity.turnover !== null && (typeof entity.turnover !== 'number' || !Number.isFinite(entity.turnover) || entity.turnover < 0 || entity.turnover > 1e12)) throw new Error('Invalid annual turnover.');
        if (entity.payroll !== undefined && typeof entity.payroll !== 'boolean') throw new Error('Invalid payroll entity selection.');
        return { ...blankEntity(index + 1), ...entity };
      });
    }
    if (input.services !== undefined) {
      if (!Array.isArray(input.services)) throw new Error('Services must be an array.');
      const services = {};
      for (const selected of input.services) {
        if (!selected || typeof selected !== 'object' || Object.keys(selected).some(key => !['id', 'quantity', 'choice', 'rate'].includes(key))) throw new Error('Invalid service inputs.');
        const service = SERVICES.find(s => s.id === selected.id);
        if (!service || service.scope !== candidate.mode || services[selected.id] || !Number.isInteger(selected.quantity) || selected.quantity < 1 || selected.quantity > 10000 || selected.choice !== undefined && !['range', 'low', 'high'].includes(selected.choice)) throw new Error('Invalid service or quantity.');
        if (selected.rate !== undefined && (!service.choices || !service.choices.includes(selected.rate))) throw new Error('Invalid service rate.');
        services[selected.id] = { quantity: selected.quantity, choice: selected.choice || 'range', rate: selected.rate ?? null };
      }
      candidate.services = services;
    }
    const result = calculate(candidate);
    model = candidate; nextId = Math.max(...model.entities.map(e => e.id), 0) + 1;
    $('client-name').value = model.client; $('financial-year').value = model.year;
    $('group-details').open = model.groupMode !== 'per-entity';
    renderMode();
    return { mode: model.mode, ready: result.ready, feeLow: result.feeLow, feeHigh: result.feeHigh, totalLow: result.totalLow, totalHigh: result.totalHigh, issues: result.issues };
  } });
}

import { PROFILES, SERVICES, GROUP_RULES, INDIVIDUAL_BASE } from './pricing.mjs';

export const cents = value => Math.round((value + Number.EPSILON) * 100);
const money = value => value / 100;
const positiveCount = value => Number.isSafeInteger(value) && value > 0 && value <= 10000;
const validTurnover = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e12;

export function calculate(model) {
  const lines = [], issues = [];
  const add = (label, low, high = low, extra = {}) => lines.push({ label, low: cents(low), high: cents(high), ...extra });
  if (!['business', 'individual'].includes(model.mode)) throw new Error('Choose a valid quote type.');
  if (model.mode === 'business') {
    const entities = model.entities || [];
    const grouped = model.groupMode !== 'per-entity';
    const group = grouped ? GROUP_RULES[model.groupMode] : null;
    if (grouped && !group) throw new Error('Choose a valid group pricing basis.');
    if (!entities.length) issues.push('Add at least one business entity.');
    let groupTurnover = 0, missingGroupTurnover = false, payrollCount = 0;
    if (group && (entities.length < group.minEntities || (group.maxEntities && entities.length > group.maxEntities))) {
      issues.push(model.groupMode === 'medium' ? 'Medium group pricing needs 5–10 entities.' : 'Large group pricing needs more than 10 entities.');
    }
    entities.forEach((entity, index) => {
      const name = entity.name?.trim() || `Entity ${index + 1}`;
      const profile = PROFILES.find(p => p.id === entity.profile);
      const payroll = grouped && entity.payroll === true;
      if (!profile && !payroll) { issues.push(`${name}: select a business type.`); }
      if (payroll) { payrollCount++; add(`${name} · payroll entity base`, group.payrollBase, undefined, { kind: 'base', row: group.row }); }
      else if (profile) { add(`${name} · ${profile.short}`, profile.base, undefined, { kind: 'base', row: profile.row }); }
      const requiresTurnover = grouped || !!profile?.turnoverRate;
      const provided = validTurnover(entity.turnover);
      if (requiresTurnover && !provided) issues.push(`${name}: enter annual turnover (zero is allowed).`);
      if (entity.turnover !== null && entity.turnover !== undefined && !provided) issues.push(`${name}: turnover must be a non-negative number.`);
      if (provided && profile && !payroll && entity.turnover >= profile.limit) {
        issues.push(`${name}: this category requires turnover below $${profile.limit.toLocaleString('en-AU')}. Choose the appropriate category.`);
      }
      if (grouped) {
        if (provided) groupTurnover += entity.turnover; else missingGroupTurnover = true;
      } else if (profile?.turnoverRate && provided) {
        add(`${name} · turnover adjustment (0.15%)`, entity.turnover * profile.turnoverRate, undefined, { kind: 'turnover', row: profile.row });
      }
    });
    if (group) {
      if (payrollCount > 0 && !model.groupPayrollConfirmed) issues.push('Confirm the workbook’s $4,000 group payroll base before using group pricing.');
      if (!missingGroupTurnover) {
        if (groupTurnover === 10000000) issues.push('The workbook leaves exactly $10 million of group turnover unpriced. Use per-entity pricing or confirm a revised group rule.');
        else if (model.groupMode === 'medium' && groupTurnover >= 10000000) issues.push('Medium group pricing requires group turnover below $10 million.');
        else if (model.groupMode === 'large' && groupTurnover <= 10000000) issues.push('Large group pricing requires group turnover above $10 million.');
        else add(`Group turnover adjustment (${(group.rate * 100).toFixed(2)}%)`, groupTurnover * group.rate, undefined, { kind: 'turnover', row: group.row });
      }
    }
  } else {
    if (!positiveCount(model.returns)) issues.push('Enter a whole number of tax returns from 1 to 10,000.');
    else add(`Individual tax return${model.returns > 1 ? 's' : ''}`, model.returns * INDIVIDUAL_BASE, undefined, { kind: 'base', quantity: model.returns, unitRate: INDIVIDUAL_BASE, row: 35 });
  }
  for (const service of SERVICES.filter(s => s.scope === model.mode)) {
    const selected = model.services?.[service.id];
    if (!selected) continue;
    if (!positiveCount(selected.quantity)) { issues.push(`${service.label}: enter a whole quantity from 1 to 10,000.`); continue; }
    let low, high;
    if (service.choices) {
      if (!service.choices.includes(selected.rate)) { issues.push('Depreciation schedule: choose $180 or $240 to resolve the conflicting workbook rates.'); continue; }
      low = high = selected.rate;
    } else {
      if (!['range', 'low', 'high'].includes(selected.choice)) { issues.push(`${service.label}: choose a valid fee level.`); continue; }
      low = selected.choice === 'high' ? service.high : service.low;
      high = selected.choice === 'low' ? service.low : service.high;
    }
    add(service.label, low * selected.quantity, high * selected.quantity, { kind: 'service', quantity: selected.quantity, unit: service.unit, unitLow: low, unitHigh: high, row: service.row });
  }
  const feeLow = lines.reduce((sum, line) => sum + line.low, 0);
  const feeHigh = lines.reduce((sum, line) => sum + line.high, 0);
  const gst = model.gst;
  if (!['unspecified', 'exclusive', 'inclusive', 'none'].includes(gst)) throw new Error('Choose a valid GST treatment.');
  if (gst === 'unspecified' && feeHigh > 0) issues.push('Choose how GST should be shown. The workbook does not specify GST treatment.');
  const taxLow = gst === 'exclusive' ? Math.round(feeLow / 10) : gst === 'inclusive' ? Math.round(feeLow / 11) : 0;
  const taxHigh = gst === 'exclusive' ? Math.round(feeHigh / 10) : gst === 'inclusive' ? Math.round(feeHigh / 11) : 0;
  const totalLow = feeLow + (gst === 'exclusive' ? taxLow : 0);
  const totalHigh = feeHigh + (gst === 'exclusive' ? taxHigh : 0);
  return { lines: lines.map(line => ({ ...line, low: money(line.low), high: money(line.high) })), issues: [...new Set(issues)], ready: issues.length === 0 && lines.length > 0, feeLow: money(feeLow), feeHigh: money(feeHigh), taxLow: money(taxLow), taxHigh: money(taxHigh), totalLow: money(totalLow), totalHigh: money(totalHigh) };
}

export function formatMoney(value) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 }).format(value);
}
export function formatRange(low, high) { return low === high ? formatMoney(low) : `${formatMoney(low)} – ${formatMoney(high)}`; }
export function quoteText(model, result = calculate(model)) {
  if (!result.ready) throw new Error('Complete the quote inputs before copying.');
  const out = ['FEE ESTIMATE', model.client?.trim() || 'Client quote', `Financial year ending 30 June ${model.year}`, '', model.mode === 'business' ? 'Financial statements and tax returns' : 'Individual tax returns', ''];
  for (const line of result.lines) out.push(`${line.label}${line.quantity ? ` (${line.quantity} × ${line.unit || 'return'})` : ''}: ${formatRange(line.low, line.high)}`);
  out.push('');
  if (model.gst === 'exclusive') out.push(`Fees excluding GST: ${formatRange(result.feeLow, result.feeHigh)}`, `GST (10%): ${formatRange(result.taxLow, result.taxHigh)}`, `Total including GST: ${formatRange(result.totalLow, result.totalHigh)}`);
  else if (model.gst === 'inclusive') out.push(`Total including GST: ${formatRange(result.totalLow, result.totalHigh)}`, `GST included: ${formatRange(result.taxLow, result.taxHigh)}`);
  else out.push(`Total: ${formatRange(result.totalLow, result.totalHigh)}`, 'No GST added as selected.');
  if (result.feeLow !== result.feeHigh) out.push('', 'The fee is a range because one or more selected services have a minimum and maximum price.');
  out.push('', 'Rates: uplifted Price List dated 28 September 2026.');
  return out.join('\n');
}

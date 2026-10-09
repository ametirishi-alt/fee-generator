import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculate, quoteText } from '../dist/calculator.mjs';
import { PROFILES, SERVICES } from '../dist/pricing.mjs';

const base = () => ({ mode: 'business', client: 'Test client', year: '2026', entities: [{ id: 1, name: 'Example Pty Ltd', profile: 'contractor', turnover: 500000, payroll: false }], returns: 1, services: {}, groupMode: 'per-entity', groupPayrollConfirmed: false, gst: 'exclusive' });
const item = (quantity = 1, choice = 'range', rate = null) => ({ quantity, choice, rate });

test('all business and service rates match the supplied uplifted Price List', () => {
  const cells = JSON.parse(readFileSync(new URL('./source-pricelist.json', import.meta.url), 'utf8'));
  for (const profile of PROFILES) assert.equal(profile.base, cells['D' + profile.row].value, profile.id);
  for (const service of SERVICES) {
    if (service.choices) {
      assert.equal(service.rawMinimum, cells['D' + service.row].value);
      assert.equal(service.rawMaximum, cells['F' + service.row].value);
    } else {
      assert.equal(service.low, cells['D' + service.row]?.value ?? cells['F' + service.row].value, service.id + ' lower');
      assert.equal(service.high, cells['F' + service.row].value, service.id + ' upper');
    }
  }
});

test('contractor base plus turnover and per-item quantities produce correct quote and GST', () => {
  const model = base();
  model.services = { div7a: item(), dividends: item(2), bank: item(2) };
  const result = calculate(model);
  // 3,000 + (500,000 × 0.15%) + 1,140 + (2 × 360) + (2 × 720)
  assert.equal(result.feeLow, 7050);
  assert.equal(result.feeHigh, 7050);
  assert.equal(result.taxLow, 705);
  assert.equal(result.totalLow, 7755);
  assert.equal(result.ready, true);
  assert.match(quoteText(model), /Total including GST: \$7,755/);
});

test('small business uses uplifted 4,800 base rather than older 4,000 sample', () => {
  const model = base();
  model.entities[0].profile = 'small-more';
  model.entities[0].turnover = 1200000;
  const result = calculate(model);
  assert.equal(result.feeLow, 6600);
  assert.equal(result.totalLow, 7260);
});

test('flat investment category excludes turnover adjustment and does not need entered turnover', () => {
  const model = base();
  model.entities[0].profile = 'investment-flat';
  model.entities[0].turnover = null;
  assert.equal(calculate(model).feeLow, 1800);
  assert.equal(calculate(model).ready, true);
});

test('two individual returns plus two rentals and investment income use individual rates', () => {
  const model = { ...base(), mode: 'individual', returns: 2, services: { rental: item(2), 'investment-income': item(), div7a: item() } };
  const result = calculate(model);
  assert.equal(result.feeLow, 1740); // 2 × 420 + 2 × 360 + 180, business add-on inactive
  assert.equal(result.totalLow, 1914);
  assert.equal(result.ready, true);
});

test('ranged services stay ranged and change to explicit selected endpoints', () => {
  const model = base();
  model.services = { payroll: item(2), 'bas-preparation': item(4) };
  let result = calculate(model);
  assert.equal(result.feeLow, 7110); // 3,750 + 720 + 2,640
  assert.equal(result.feeHigh, 10950); // 3,750 + 3,600 + 3,600
  assert.equal(result.totalLow, 7821);
  assert.equal(result.totalHigh, 12045);
  assert.equal(result.ready, true);
  model.services.payroll.choice = 'high';
  model.services['bas-preparation'].choice = 'low';
  result = calculate(model);
  assert.equal(result.feeLow, 9990);
  assert.equal(result.feeHigh, 9990);
});

test('conflicting depreciation rates require explicit choice, then multiply by quantity', () => {
  const model = { ...base(), mode: 'individual', services: { depreciation: item(2) } };
  let result = calculate(model);
  assert.equal(result.ready, false);
  assert.equal(result.feeLow, 420);
  assert.match(result.issues.join(' '), /choose \$180 or \$240/);
  model.services.depreciation.rate = 240;
  result = calculate(model);
  assert.equal(result.feeLow, 900);
  assert.equal(result.ready, true);
  model.services.depreciation.rate = 180;
  assert.equal(calculate(model).feeLow, 780);
});

test('medium group bases plus combined turnover adjustment are applied once', () => {
  const model = base();
  model.groupMode = 'medium'; model.groupPayrollConfirmed = true;
  model.entities = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: '', profile: 'investment', turnover: 500000, payroll: i === 0 }));
  const result = calculate(model);
  assert.equal(result.feeLow, 14950); // 4,000 + 4 × 1,800 + 2,500,000 × .0015
  assert.equal(result.lines.filter(line => line.kind === 'turnover').length, 1);
  assert.equal(result.ready, true);
  model.groupPayrollConfirmed = false;
  assert.equal(calculate(model).ready, false);
});

test('large group uses 0.10% turnover with more than ten entities', () => {
  const model = base(); model.groupMode = 'large'; model.groupPayrollConfirmed = true;
  model.entities = Array.from({ length: 11 }, (_, i) => ({ id: i + 1, name: '', profile: 'investment', turnover: 1000000, payroll: i === 0 }));
  const result = calculate(model);
  assert.equal(result.feeLow, 33000); // 4,000 + 10 × 1,800 + 11,000
  assert.equal(result.ready, true);
});

test('exact ten million group gap, wrong entity count and category boundaries remain explicit', () => {
  const model = base(); model.groupMode = 'medium'; model.groupPayrollConfirmed = true;
  model.entities = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: '', profile: '', turnover: 2000000, payroll: true }));
  assert.match(calculate(model).issues.join(' '), /exactly \$10 million/);
  model.entities = model.entities.slice(0, 4);
  assert.match(calculate(model).issues.join(' '), /5–10 entities/);
  const individualEntity = base(); individualEntity.entities[0].turnover = 2000000;
  assert.equal(calculate(individualEntity).ready, false);
  individualEntity.entities[0].turnover = 1999999.99;
  assert.equal(calculate(individualEntity).ready, true);
});

test('missing turnover differs from explicit zero, and invalid quantities do not form ready quotes', () => {
  const model = base(); model.entities[0].turnover = null;
  assert.equal(calculate(model).ready, false);
  assert.throws(() => quoteText(model), /Complete/);
  model.entities[0].turnover = 0;
  assert.equal(calculate(model).ready, true);
  assert.equal(calculate(model).feeLow, 3000);
  for (const quantity of [0, -1, 1.5, NaN, 10001]) {
    model.services = { rental: item(), bank: item(quantity) };
    assert.equal(calculate(model).ready, false);
  }
});

test('GST inclusive, exclusive, unspecified and no-added-GST outcomes are distinct', () => {
  const model = { ...base(), mode: 'individual', services: {} };
  assert.equal(calculate(model).totalLow, 462);
  model.gst = 'inclusive';
  assert.equal(calculate(model).totalLow, 420);
  assert.equal(calculate(model).taxLow, 38.18);
  model.gst = 'none';
  assert.equal(calculate(model).totalLow, 420);
  assert.equal(calculate(model).taxLow, 0);
  model.gst = 'unspecified';
  assert.equal(calculate(model).ready, false);
});

test('cents are rounded per line, totals and quote text stay in agreement', () => {
  const model = base(); model.entities[0].turnover = 123456.78;
  const result = calculate(model);
  assert.equal(result.feeLow, 3185.19);
  assert.equal(result.taxLow, 318.52);
  assert.equal(result.totalLow, 3503.71);
  assert.match(quoteText(model), /\$3,503.71/);
});

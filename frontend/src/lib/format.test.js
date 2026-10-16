import { describe, it, expect } from 'vitest';
import {
  formatLKR, benefitLabel, conditionsLabel, daysLabel, expiryInfo, timeAgo, initials,
} from './format';

describe('benefitLabel', () => {
  it('describes each offer type in plain words', () => {
    expect(benefitLabel({ offerType: 'percentage_discount', discountValue: 20 })).toBe('20% off');
    expect(benefitLabel({ offerType: 'cashback', discountValue: 10 })).toBe('10% cashback');
    expect(benefitLabel({ offerType: 'bogo' })).toBe('Buy 1 get 1');
    expect(benefitLabel({ offerType: 'instalment', providerType: 'bnpl' })).toBe('Pay in instalments');
    expect(benefitLabel({ offerType: 'instalment', providerType: 'bank' })).toBe('0% instalments');
    expect(benefitLabel({ offerType: 'percentage_discount', discountValue: 0 })).toBe('Special offer');
  });
});

describe('conditionsLabel', () => {
  it('lists minimum bill and cap, or nothing', () => {
    expect(conditionsLabel({ minSpend: 5000, maxDiscount: 2000 })).toBe(`Min. bill ${formatLKR(5000)} · Up to ${formatLKR(2000)} off`);
    expect(conditionsLabel({ minSpend: 0, maxDiscount: 0 })).toBe('');
  });
});

describe('daysLabel', () => {
  it('compresses weekday lists', () => {
    expect(daysLabel([])).toBe('Every day');
    expect(daysLabel(['Saturday', 'Sunday'])).toBe('Sat–Sun');
    expect(daysLabel(['Monday', 'Tuesday', 'Wednesday'])).toBe('Mon–Wed');
    expect(daysLabel(['Friday', 'Tuesday'])).toBe('Tue, Fri');
  });
});

describe('expiryInfo', () => {
  const now = new Date('2026-10-17T10:00:00Z');
  it('classifies end dates', () => {
    expect(expiryInfo(null, now).status).toBe('none');
    expect(expiryInfo('2026-10-16T00:00:00Z', now).status).toBe('expired');
    expect(expiryInfo('2026-10-17T00:00:00Z', now)).toEqual({ status: 'today', label: 'Ends today' });
    expect(expiryInfo('2026-10-20T00:00:00Z', now)).toEqual({ status: 'soon', label: '3 days left' });
    expect(expiryInfo('2026-12-31T00:00:00Z', now).status).toBe('ok');
  });
});

describe('small helpers', () => {
  it('timeAgo', () => {
    const now = new Date('2026-10-17T10:00:00Z');
    expect(timeAgo(null, now)).toBe('never');
    expect(timeAgo('2026-10-17T09:30:00Z', now)).toBe('30 min ago');
    expect(timeAgo('2026-10-17T05:00:00Z', now)).toBe('5 h ago');
  });
  it('initials', () => {
    expect(initials('Cargills Food City')).toBe('CF');
    expect(initials('Odel')).toBe('OD');
  });
});

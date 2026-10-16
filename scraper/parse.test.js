// Run with: npm test  (uses Node's built-in test runner — no extra dependencies)
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeText, parseDate, parseDescription, inferOfferType, inferCardType, promotionId,
  merchantFromTitle, inferCategory,
} = require('./parse');
const { findProvider, cleanProfileLabel } = require('./providers');

// Real subtitles copied from mypromo.lk listing pages (Oct 2026)
const LAUGFS = 'Get 20% off the total bill at LAUGFS Supermarket every Tuesday with Dialog Pay debit cards. Minimum bill Rs. 4, 000; maximum discount Rs. 2, 000. Valid until 27 October 2026.';
const GLOMARK = 'Get 30% off fresh bills at GLOMARK with Sampath credit cards or 20% off with Sampath debit cards every Sunday, in-store and online. Minimum bill Rs. 4, 000.';
const CARGILLS = 'Get 25% off dairy products at Cargills Food City with Nations Trust Bank Mastercard Credit Cards every Wednesday from 1 to 31 October 2026. Minimum bill LKR 6, 000; maximum savings LKR 2, 000. T&C apply.';

test('normalizeText repairs broken thousands separators and times', () => {
  assert.equal(normalizeText('Minimum bill Rs. 4, 000;  from 10. 00 am'), 'Minimum bill Rs. 4,000; from 10.00 am');
});

test('parseDate reads DD/MM/YYYY and rejects junk', () => {
  assert.equal(parseDate('31/10/2026').toISOString(), '2026-10-31T00:00:00.000Z');
  assert.equal(parseDate('soon'), null);
  assert.equal(parseDate(''), null);
});

test('parseDescription extracts spend limits, days and channel', () => {
  const d = parseDescription(LAUGFS);
  assert.equal(d.minSpend, 4000);
  assert.equal(d.maxDiscount, 2000);
  assert.deepEqual(d.validDays, ['Tuesday']);
  assert.equal(d.usageChannel, 'both');

  const g = parseDescription(GLOMARK);
  assert.equal(g.minSpend, 4000);
  assert.equal(g.maxDiscount, 0);
  assert.deepEqual(g.validDays, ['Sunday']);

  const c = parseDescription(CARGILLS);
  assert.equal(c.minSpend, 6000);
  assert.equal(c.maxDiscount, 2000);
  assert.deepEqual(c.validDays, ['Wednesday']);
});

test('parseDescription understands weekends and channels', () => {
  assert.deepEqual(parseDescription('10% off every weekend').validDays, ['Saturday', 'Sunday']);
  assert.deepEqual(parseDescription('every Tuesday and Friday').validDays, ['Tuesday', 'Friday']);
  assert.equal(parseDescription('Valid online only').usageChannel, 'online');
  assert.equal(parseDescription('Valid at all outlets').usageChannel, 'instore');
});

test('inferOfferType does not mistake 10%/20% for 0% instalments', () => {
  assert.deepEqual(inferOfferType('20% cashback with HNB'), { offerType: 'cashback', discountValue: 20 });
  assert.deepEqual(inferOfferType('0% instalment plans up to 24 months'), { offerType: 'instalment', discountValue: 0 });
  assert.deepEqual(inferOfferType('Pay in 3 with Koko'), { offerType: 'instalment', discountValue: 0 });
  assert.deepEqual(inferOfferType('15% OFF + 3 interest-free instalments'), { offerType: 'percentage_discount', discountValue: 15 });
  assert.deepEqual(inferOfferType('Buy 1 Get 1 Free pizza'), { offerType: 'bogo', discountValue: 0 });
  assert.deepEqual(inferOfferType('Rs. 1,000 off your first order'), { offerType: 'flat_discount', discountValue: 1000 });
});

test('inferCardType', () => {
  assert.equal(inferCardType(LAUGFS), 'debit');
  assert.equal(inferCardType(CARGILLS), 'credit');
  assert.equal(inferCardType(GLOMARK), 'both');
});

test('promotionId extracts the mypromo.lk offer id', () => {
  assert.equal(promotionId('/glomark/promotion/24895/30-off-fresh-bills'), '24895');
  assert.equal(promotionId('/glomark'), null);
});

test('findProvider maps name variants to one canonical provider', () => {
  assert.equal(findProvider('Hatton National Bank').name, 'HNB');
  assert.equal(findProvider('10% off with HNB credit cards').name, 'HNB');
  assert.equal(findProvider('Visit Peoples Bank profile').name, "People's Bank");
  assert.equal(findProvider("with People's Bank Credit Cards").name, "People's Bank");
  assert.equal(findProvider('DFCC Bank PLC').name, 'DFCC Bank');
  assert.equal(findProvider('Pay in 3 with Koko').type, 'bnpl');
  // whole-word matching: "boc" must not match inside another word
  assert.equal(findProvider('Bocconi Pizza'), null);
  // checked in order: first text with a match wins
  assert.equal(findProvider('LAUGFS Supermarket', 'with Dialog Pay debit cards').name, 'Dialog Pay');
});

test('cleanProfileLabel strips mypromo.lk link text', () => {
  assert.equal(cleanProfileLabel('Visit Sampath Bank profile'), 'Sampath Bank');
  assert.equal(cleanProfileLabel('Sampath Bank'), 'Sampath Bank');
});

test('merchantFromTitle finds the store on bank-card pages', () => {
  assert.equal(merchantFromTitle('15% Off at Teleseen with Commercial Bank Credit and Debit Cards'), 'Teleseen');
  assert.equal(merchantFromTitle('0% Installments for 36 Months at Takas.lk with Seylan Credit Cards'), 'Takas.lk');
  assert.equal(merchantFromTitle('0% Interest for 36 Months on Seylan Credit Card'), null);
});

test('inferCategory maps offer text to a shopping category', () => {
  assert.equal(inferCategory('25% Off Fresh Produce at Keells'), 'Groceries');
  assert.equal(inferCategory('20% Off KFC Dining'), 'Dining');
  assert.equal(inferCategory('0% Installments at Takas.lk'), 'Electronics');
  assert.equal(inferCategory('Up to 50% Off Medical Care'), 'Health');
  assert.equal(inferCategory('Something unrelated'), null);
});

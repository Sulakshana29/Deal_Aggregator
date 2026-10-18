const { buildDealQuery, liveFilter, startOfDay, QueryError, MAX_LIMIT } = require('./dealQuery');

const NOW = new Date('2026-10-16T15:30:00Z');

describe('liveFilter', () => {
  it('only shows active, unexpired, scraped offers by default', () => {
    const f = liveFilter({ now: NOW });
    expect(f.isActive).toBe(true);
    expect(f.source).toEqual({ $in: ['scraped'] });
    // an offer ending today is still valid today
    expect(f.$or).toEqual([{ validUntil: null }, { validUntil: { $gte: new Date('2026-10-16T00:00:00Z') } }]);
  });

  it('includes sample data only when explicitly enabled', () => {
    expect(liveFilter({ now: NOW, showSamples: true }).source).toEqual({ $in: ['scraped', 'sample'] });
  });
});

describe('startOfDay', () => {
  it('truncates to UTC midnight', () => {
    expect(startOfDay(NOW).toISOString()).toBe('2026-10-16T00:00:00.000Z');
  });
});

describe('buildDealQuery', () => {
  const conditions = (q) => buildDealQuery(q, { now: NOW }).match.$and;

  it('uses safe defaults', () => {
    const q = buildDealQuery({}, { now: NOW });
    expect(q.page).toBe(1);
    expect(q.limit).toBe(24);
    expect(q.sort).toEqual({ _sortExpiry: 1, discountValue: -1, _id: 1 });
    expect(q.match.$and).toHaveLength(1); // just the live filter
  });

  it('splits card offers from pay-later offers', () => {
    expect(conditions({ mode: 'paylater' })).toContainEqual({
      $or: [{ providerType: 'bnpl' }, { offerType: 'instalment' }],
    });
    expect(conditions({ mode: 'card' })).toContainEqual({
      providerType: { $ne: 'bnpl' }, offerType: { $ne: 'instalment' },
    });
  });

  it('treats "both" card offers as valid for credit and debit filters', () => {
    expect(conditions({ cardType: 'debit' })).toContainEqual({ cardType: { $in: ['debit', 'both'] } });
  });

  it('applies exact category and provider filters', () => {
    const c = conditions({ category: 'Dining', provider: 'HNB' });
    expect(c).toContainEqual({ category: 'Dining' });
    expect(c).toContainEqual({ bank: 'HNB' });
  });

  it('escapes search input so it is matched literally (no ReDoS)', () => {
    const search = conditions({ search: '(a+)+$' }).find((c) => c.$or && c.$or[0].brand);
    expect(search.$or[0].brand.$regex).toBe('\\(a\\+\\)\\+\\$');
  });

  it('ignores operator objects and arrays (NoSQL injection)', () => {
    const c = conditions({ category: { $ne: 'x' }, provider: ['HNB', 'BOC'] });
    expect(c).toHaveLength(1);
  });

  it('caps the page size', () => {
    expect(buildDealQuery({ limit: '5000' }).limit).toBe(MAX_LIMIT);
    expect(buildDealQuery({ page: '3', limit: '10' })).toMatchObject({ page: 3, limit: 10 });
  });

  it.each([
    [{ mode: 'all' }],
    [{ sort: 'price' }],
    [{ cardType: 'amex' }],
    [{ page: '0' }],
    [{ limit: '-1' }],
    [{ page: '2abc' }],
    [{ search: 'x'.repeat(101) }],
    [{ wallet: 'InvalidFormat' }],
  ])('rejects invalid input %o', (query) => {
    expect(() => buildDealQuery(query)).toThrow(QueryError);
  });

  it('filters by wallet cards', () => {
    const q = buildDealQuery({ wallet: 'HNB:credit,Commercial Bank:debit' }, { now: NOW });
    const orCondition = q.match.$and.find((c) => c.$or && c.$or[0].bank === 'HNB');
    expect(orCondition).toBeDefined();
    expect(orCondition.$or).toHaveLength(2);
    expect(orCondition.$or[0]).toEqual({ bank: 'HNB', cardType: { $in: ['credit', 'both'] } });
    expect(orCondition.$or[1]).toEqual({ bank: 'Commercial Bank', cardType: { $in: ['debit', 'both'] } });
  });

  it('filters by day=today', () => {
    const q = buildDealQuery({ day: 'today' }, { now: NOW });
    const dayCondition = q.match.$and.find((c) => c.$or && c.$or[0].validDays);
    expect(dayCondition).toBeDefined();
  });
});

describe('buildBestQuery', () => {
  const { buildBestQuery } = require('./dealQuery');

  it('requires brand or category', () => {
    expect(() => buildBestQuery({}, { now: NOW })).toThrow(QueryError);
  });

  it('builds query for brand with bill', () => {
    const q = buildBestQuery({ brand: 'Keells Super', bill: '5000' }, { now: NOW });
    expect(q.brand).toBe('Keells Super');
    expect(q.bill).toBe(5000);
    expect(q.match.$and).toContainEqual({ brand: 'Keells Super' });
  });

  it('rejects invalid bill amounts', () => {
    expect(() => buildBestQuery({ brand: 'Keells Super', bill: '-10' })).toThrow(QueryError);
    expect(() => buildBestQuery({ brand: 'Keells Super', bill: 'abc' })).toThrow(QueryError);
  });
});


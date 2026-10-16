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
  ])('rejects invalid input %o', (query) => {
    expect(() => buildDealQuery(query)).toThrow(QueryError);
  });
});

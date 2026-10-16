import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from './App';

const DEAL = {
  _id: 'abc123', brand: 'Keells Super', category: 'Groceries', bank: 'HNB', providerType: 'bank',
  discountText: '20% Off Weekend Groceries with HNB Credit Cards', offerType: 'percentage_discount',
  discountValue: 20, cardType: 'credit', validDays: ['Saturday', 'Sunday'], minSpend: 5000, maxDiscount: 2000,
  usageChannel: 'instore', validUntil: '2099-01-01T00:00:00Z', source: 'scraped',
};

const META = {
  categories: [{ name: 'Groceries', count: 1 }],
  providers: [{ name: 'HNB', type: 'bank', count: 1 }],
  modes: { card: 1, paylater: 0 },
  stats: { live: 1, providers: 1, brands: 1, endingSoon: 0, lastUpdated: new Date().toISOString() },
};

function mockApi() {
  global.fetch = vi.fn((url) => {
    const body = String(url).startsWith('/api/deals/meta')
      ? META
      : { items: [DEAL], total: 1, page: 1, pages: 1, limit: 24 };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  });
}

describe('App', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    mockApi();
  });

  it('renders the brand and both offer modes', () => {
    render(<App />);
    expect(screen.getAllByText(/DealVault/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('tab', { name: /Card offers/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Pay later/i })).toBeInTheDocument();
  });

  it('shows offers from the API with a clear benefit', async () => {
    render(<App />);
    expect(await screen.findByText('Keells Super')).toBeInTheDocument();
    expect(screen.getByText('20% off')).toBeInTheDocument();
    expect(screen.getByText('Sat–Sun')).toBeInTheDocument();
  });

  it('asks the API for card offers by default, one page at a time', async () => {
    render(<App />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/deals\?mode=card.*&page=1&limit=24/), expect.anything()
    ));
  });
});

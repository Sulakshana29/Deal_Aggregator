import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from './App';

const DEAL = {
  _id: 'abc123',
  brand: 'Keells Super',
  category: 'Groceries',
  bank: 'HNB',
  providerType: 'bank',
  discountText: '20% Off Weekend Groceries with HNB Credit Cards',
  offerType: 'percentage_discount',
  discountValue: 20,
  cardType: 'credit',
  validDays: ['Saturday', 'Sunday'],
  minSpend: 5000,
  maxDiscount: 2000,
  usageChannel: 'instore',
  validUntil: '2099-01-01T00:00:00Z',
  source: 'scraped',
};

const META = {
  categories: [{ name: 'Groceries', count: 1 }],
  providers: [{ name: 'HNB', type: 'bank', count: 1 }],
  brands: [{ name: 'Keells Super', count: 1 }],
  today: 'Sunday',
  modes: { card: 1, paylater: 0 },
  stats: { live: 1, providers: 1, brands: 1, endingSoon: 0, lastUpdated: new Date().toISOString() },
};

function mockApi() {
  global.fetch = vi.fn((url) => {
    const urlStr = String(url);
    if (urlStr.startsWith('/api/deals/meta')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(META) });
    }
    if (urlStr.startsWith('/api/deals/best')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ brand: 'Keells Super', total: 1, items: [{ ...DEAL, calculation: { saving: 1000, reason: '20% off' } }] }),
      });
    }
    if (urlStr.startsWith('/api/status')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          status: 'healthy',
          driftGuard: { active: true },
          scraper: { offersFound: 1, pages: '1/1', completedAt: new Date().toISOString() },
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ items: [DEAL], total: 1, page: 1, pages: 1, limit: 24 }),
    });
  });
}

describe('App', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    localStorage.clear();
    mockApi();
  });

  it('renders the brand and wallet-first card recommender', async () => {
    render(<App />);
    expect(screen.getAllByText(/DealVault/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Smart Card Recommender/i)).toBeInTheDocument();
    expect(screen.getByText(/Which card saves you the most/i)).toBeInTheDocument();
    expect(await screen.findByText(/System Healthy/i)).toBeInTheDocument();
  });

  it('shows offers from the API with a clear benefit', async () => {
    render(<App />);
    expect(await screen.findByText('Keells Super')).toBeInTheDocument();
    expect(screen.getByText('20% off')).toBeInTheDocument();
    expect(screen.getByText('Sat–Sun')).toBeInTheDocument();
  });

  it('opens and manages the My Card Wallet modal', async () => {
    render(<App />);
    const walletBtns = screen.getAllByRole('button', { name: /wallet/i });
    fireEvent.click(walletBtns[0]);

    expect(await screen.findByText(/My Card Wallet/i)).toBeInTheDocument();
    expect(screen.getByText(/No cards added yet/i)).toBeInTheDocument();
  });

  it('fetches deals from the API for the initial page load', async () => {
    render(<App />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/^\/api\/deals\?.*page=1&limit=24/),
        expect.anything()
      );
    });
  });
});

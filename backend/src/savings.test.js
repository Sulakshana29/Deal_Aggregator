const { estimateSaving, checkWalletMatch, rankOffers, formatLKR } = require('./savings');

describe('savings.js', () => {
  describe('formatLKR', () => {
    it('formats numbers into readable rupees', () => {
      expect(formatLKR(5000)).toBe('Rs. 5,000');
      expect(formatLKR(1250.75)).toBe('Rs. 1,251');
    });
  });

  describe('estimateSaving', () => {
    const pctOffer = {
      offerType: 'percentage_discount',
      discountValue: 20,
      minSpend: 5000,
      maxDiscount: 2000,
    };

    it('calculates percentage discount capped at maxDiscount', () => {
      // 20% of 8,000 is 1,600 (under 2,000 cap)
      const res1 = estimateSaving(pctOffer, 8000);
      expect(res1.saving).toBe(1600);
      expect(res1.eligible).toBe(true);
      expect(res1.reason).toContain('saved Rs. 1,600 of max Rs. 2,000');

      // 20% of 15,000 is 3,000 (capped at 2,000)
      const res2 = estimateSaving(pctOffer, 15000);
      expect(res2.saving).toBe(2000);
      expect(res2.eligible).toBe(true);
      expect(res2.reason).toContain('capped at Rs. 2,000');
    });

    it('returns ineligible if bill is less than minSpend', () => {
      const res = estimateSaving(pctOffer, 4000);
      expect(res.eligible).toBe(false);
      expect(res.saving).toBe(0);
      expect(res.reason).toContain('Min. bill is Rs. 5,000 (add Rs. 1,000 to qualify)');
    });

    it('notes when cap is not stated', () => {
      const noCapOffer = {
        offerType: 'percentage_discount',
        discountValue: 15,
        minSpend: 0,
        maxDiscount: 0,
      };
      const res = estimateSaving(noCapOffer, 10000);
      expect(res.saving).toBe(1500);
      expect(res.reason).toContain('cap not stated');
    });

    it('handles flat discounts', () => {
      const flat = {
        offerType: 'flat_discount',
        discountValue: 500,
        minSpend: 2500,
      };
      const res = estimateSaving(flat, 3000);
      expect(res.saving).toBe(500);
      expect(res.eligible).toBe(true);

      const ineligible = estimateSaving(flat, 2000);
      expect(ineligible.saving).toBe(0);
      expect(ineligible.eligible).toBe(false);
    });

    it('treats instalments and bogo as perks', () => {
      const inst = { offerType: 'instalment' };
      const res = estimateSaving(inst, 10000);
      expect(res.isPerk).toBe(true);
      expect(res.saving).toBe(0);

      const bogo = { offerType: 'bogo' };
      const resBogo = estimateSaving(bogo, 5000);
      expect(resBogo.isPerk).toBe(true);
    });

    it('provides fallback ranking when bill is absent', () => {
      const res = estimateSaving(pctOffer, undefined);
      expect(res.saving).toBe(20);
      expect(res.eligible).toBe(true);
      expect(res.reason).toContain('Min. bill Rs. 5,000');
    });
  });

  describe('checkWalletMatch', () => {
    const wallet = [
      { bank: 'Commercial Bank', type: 'credit' },
      { bank: 'Sampath Bank', type: 'debit' },
    ];

    it('matches exact bank and card type', () => {
      const match = checkWalletMatch({ bank: 'Commercial Bank', cardType: 'credit' }, wallet);
      expect(match.inWallet).toBe(true);
      expect(match.matchedCard.bank).toBe('Commercial Bank');
    });

    it('matches when offer accepts both card types', () => {
      const match = checkWalletMatch({ bank: 'Sampath Bank', cardType: 'both' }, wallet);
      expect(match.inWallet).toBe(true);
    });

    it('does not match when card type differs', () => {
      const match = checkWalletMatch({ bank: 'Commercial Bank', cardType: 'debit' }, wallet);
      expect(match.inWallet).toBe(false);
    });

    it('does not match bank not in wallet', () => {
      const match = checkWalletMatch({ bank: 'HNB', cardType: 'credit' }, wallet);
      expect(match.inWallet).toBe(false);
    });
  });

  describe('rankOffers', () => {
    it('ranks wallet matches with higher savings first', () => {
      const wallet = [{ bank: 'Commercial Bank', type: 'credit' }];
      const offers = [
        { _id: '1', bank: 'HNB', cardType: 'credit', offerType: 'percentage_discount', discountValue: 30 },
        { _id: '2', bank: 'Commercial Bank', cardType: 'credit', offerType: 'percentage_discount', discountValue: 15 },
        { _id: '3', bank: 'Commercial Bank', cardType: 'credit', offerType: 'percentage_discount', discountValue: 20 },
      ];

      const ranked = rankOffers(offers, { bill: 10000, wallet });
      // Wallet cards (2 and 3) come before non-wallet card (1)
      // Between 2 and 3, 3 saves 2,000, 2 saves 1,500
      expect(ranked[0]._id).toBe('3');
      expect(ranked[1]._id).toBe('2');
      expect(ranked[2]._id).toBe('1');
    });
  });
});

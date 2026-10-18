/**
 * savings.js — estimates rupee savings and ranks offers for a given bill and wallet.
 * Pure functions only (no DB access), fully unit-testable.
 */

/**
 * Formats a number to LKR display (e.g. 5000 -> "Rs. 5,000")
 */
function formatLKR(amount) {
  return `Rs. ${Math.round(amount).toLocaleString('en-LK')}`;
}

/**
 * Calculates estimated rupee saving for a single offer against an optional bill amount.
 *
 * @param {Object} offer - Deal object
 * @param {number|undefined} bill - Bill amount in LKR (optional)
 * @returns {Object} {
 *   saving: number,        // Estimated saving in rupees (0 if doesn't qualify or perk)
 *   headline: string,      // Short headline (e.g. "20% off", "0% instalments")
 *   eligible: boolean,     // false if bill < minSpend
 *   reason: string,        // Explanatory breakdown text
 *   isPerk: boolean,       // true for bogo/instalment where exact rupee saving is not calculable
 * }
 */
function estimateSaving(offer, bill) {
  const { offerType, discountValue = 0, minSpend = 0, maxDiscount = 0 } = offer;

  // 1. Non-monetary / Perk offers (BOGO, Instalment)
  if (offerType === 'instalment') {
    return {
      saving: 0,
      headline: '0% instalments',
      eligible: bill ? (minSpend > 0 ? bill >= minSpend : true) : true,
      reason: minSpend > 0 && bill && bill < minSpend
        ? `Requires minimum spend of ${formatLKR(minSpend)}`
        : 'Convert transaction to 0% interest monthly instalments',
      isPerk: true,
    };
  }

  if (offerType === 'bogo') {
    return {
      saving: 0,
      headline: 'Buy 1 Get 1 Free',
      eligible: true,
      reason: 'Buy 1 Get 1 Free offer on eligible items',
      isPerk: true,
    };
  }

  // 2. If no bill was provided, rank by headline discount
  if (!bill || bill <= 0) {
    let headline = 'Special offer';
    if (offerType === 'percentage_discount') headline = discountValue > 0 ? `${discountValue}% off` : 'Discount';
    else if (offerType === 'cashback') headline = discountValue > 0 ? `${discountValue}% cashback` : 'Cashback';
    else if (offerType === 'flat_discount') headline = discountValue > 0 ? `${formatLKR(discountValue)} off` : 'Discount';

    let reason = 'Enter bill amount to calculate exact savings';
    const notes = [];
    if (minSpend > 0) notes.push(`Min. bill ${formatLKR(minSpend)}`);
    if (maxDiscount > 0) notes.push(`Max saving ${formatLKR(maxDiscount)}`);
    if (notes.length > 0) reason = notes.join(' · ');

    return {
      saving: discountValue, // Used for relative ranking when bill is absent
      headline,
      eligible: true,
      reason,
      isPerk: false,
    };
  }

  // 3. Bill provided: check minimum spend threshold
  if (minSpend > 0 && bill < minSpend) {
    const diff = minSpend - bill;
    return {
      saving: 0,
      headline: offerType === 'percentage_discount' ? `${discountValue}% off` : `${formatLKR(discountValue)} off`,
      eligible: false,
      reason: `Min. bill is ${formatLKR(minSpend)} (add ${formatLKR(diff)} to qualify)`,
      isPerk: false,
    };
  }

  // 4. Calculate savings
  let rawSaving = 0;
  if (offerType === 'percentage_discount' || offerType === 'cashback') {
    rawSaving = (bill * discountValue) / 100;
  } else if (offerType === 'flat_discount') {
    rawSaving = discountValue;
  }

  // Cap with maxDiscount if defined
  let saving = rawSaving;
  let capped = false;
  if (maxDiscount > 0 && rawSaving > maxDiscount) {
    saving = maxDiscount;
    capped = true;
  }

  let headline = `${Math.round(saving)} off`;
  if (offerType === 'percentage_discount') headline = `${discountValue}% off`;
  else if (offerType === 'cashback') headline = `${discountValue}% cashback`;
  else if (offerType === 'flat_discount') headline = `${formatLKR(discountValue)} off`;

  let reason = '';
  if (capped) {
    reason = `${discountValue}% off, capped at ${formatLKR(maxDiscount)} (saved ${formatLKR(saving)})`;
  } else if (maxDiscount > 0) {
    reason = `${discountValue}% off (saved ${formatLKR(saving)} of max ${formatLKR(maxDiscount)})`;
  } else if (offerType === 'percentage_discount' || offerType === 'cashback') {
    reason = `${discountValue}% off · ${formatLKR(saving)} saved (cap not stated)`;
  } else {
    reason = `Flat discount of ${formatLKR(saving)}`;
  }

  return {
    saving: Math.round(saving),
    headline,
    eligible: true,
    reason,
    isPerk: false,
  };
}

/**
 * Checks if a deal matches any card in user's wallet.
 * @param {Object} offer
 * @param {Array<{bank: string, type: string}>} wallet
 * @returns {{ inWallet: boolean, matchedCard: Object|null }}
 */
function checkWalletMatch(offer, wallet = []) {
  if (!wallet || wallet.length === 0) {
    return { inWallet: false, matchedCard: null };
  }
  const match = wallet.find((c) => {
    const bankMatches = c.bank.toLowerCase() === offer.bank.toLowerCase();
    const cardMatches = offer.cardType === 'both' || offer.cardType === c.type;
    return bankMatches && cardMatches;
  });

  return {
    inWallet: Boolean(match),
    matchedCard: match || null,
  };
}

/**
 * Ranks a list of offers for a specific store/category against bill and wallet.
 */
function rankOffers(offers, { bill, wallet = [] } = {}) {
  return offers
    .map((offer) => {
      const calculation = estimateSaving(offer, bill);
      const walletMatch = checkWalletMatch(offer, wallet);
      return {
        ...offer,
        calculation,
        walletMatch,
      };
    })
    .sort((a, b) => {
      // 1. Wallet card matches come first if wallet is provided
      if (wallet && wallet.length > 0) {
        if (a.walletMatch.inWallet && !b.walletMatch.inWallet) return -1;
        if (!a.walletMatch.inWallet && b.walletMatch.inWallet) return 1;
      }

      // 2. Eligible offers before ineligible
      if (a.calculation.eligible && !b.calculation.eligible) return -1;
      if (!a.calculation.eligible && b.calculation.eligible) return 1;

      // 3. Monetary savings higher rank
      if (a.calculation.saving !== b.calculation.saving) {
        return b.calculation.saving - a.calculation.saving;
      }

      // 4. Non-perks before perks if saving is 0
      if (!a.calculation.isPerk && b.calculation.isPerk) return -1;
      if (a.calculation.isPerk && !b.calculation.isPerk) return 1;

      // 5. Expiry soonest
      const aExp = a.validUntil ? new Date(a.validUntil).getTime() : Infinity;
      const bExp = b.validUntil ? new Date(b.validUntil).getTime() : Infinity;
      return aExp - bExp;
    });
}

module.exports = {
  estimateSaving,
  checkWalletMatch,
  rankOffers,
  formatLKR,
};

/**
 * providers.js — canonical directory of Sri Lankan card issuers and BNPL providers
 *
 * mypromo.lk (and humans) name the same provider many ways: "HNB",
 * "Hatton National Bank", "Visit HNB profile". Without a single canonical name
 * the frontend shows duplicate filters and can't tell bank card offers apart
 * from Buy-Now-Pay-Later plans. Every scraped offer is mapped through here.
 *
 * type: 'bank' = card issuer (discounts on credit/debit cards)
 *       'bnpl' = Buy Now Pay Later / pay-in-instalments provider
 *
 * Aliases are matched as whole words, longest first, so "NDB" never matches
 * inside another word and "Nations Trust Bank" wins over "Nations Trust".
 */

const PROVIDERS = [
  // ── Banks ──────────────────────────────────────────────────────────────────
  { name: 'Amana Bank',          type: 'bank', aliases: ['amana bank', 'amana'] },
  { name: 'Bank of Ceylon',      type: 'bank', aliases: ['bank of ceylon', 'boc'] },
  { name: 'Cargills Bank',       type: 'bank', aliases: ['cargills bank'] },
  { name: 'Commercial Bank',     type: 'bank', aliases: ['commercial bank of ceylon', 'commercial bank', 'combank'] },
  { name: 'DFCC Bank',           type: 'bank', aliases: ['dfcc bank plc', 'dfcc bank', 'dfcc'] },
  { name: 'HNB',                 type: 'bank', aliases: ['hatton national bank', 'hnb'] },
  { name: 'HSBC',                type: 'bank', aliases: ['hsbc'] },
  { name: 'Nations Trust Bank',  type: 'bank', aliases: ['nations trust bank', 'nations trust', 'ntb', 'american express', 'amex'] },
  { name: 'NDB Bank',            type: 'bank', aliases: ['national development bank', 'ndb bank', 'ndb'] },
  { name: 'NSB',                 type: 'bank', aliases: ['national savings bank', 'nsb'] },
  { name: 'Pan Asia Bank',       type: 'bank', aliases: ['pan asia banking corporation', 'pan asia bank', 'pabc'] },
  { name: "People's Bank",       type: 'bank', aliases: ["people's bank", 'peoples bank', 'people’s bank'] },
  { name: 'Sampath Bank',        type: 'bank', aliases: ['sampath bank', 'sampath'] },
  { name: 'Seylan Bank',         type: 'bank', aliases: ['seylan bank', 'seylan'] },
  { name: 'Standard Chartered',  type: 'bank', aliases: ['standard chartered'] },
  { name: 'Union Bank',          type: 'bank', aliases: ['union bank of colombo', 'union bank'] },
  // Digital wallets that issue their own debit cards behave like card issuers
  { name: 'Dialog Pay',          type: 'bank', aliases: ['dialog pay', 'genie'] },

  // ── Buy Now Pay Later ──────────────────────────────────────────────────────
  { name: 'Koko',                type: 'bnpl', aliases: ['koko'] },
  { name: 'Mintpay',             type: 'bnpl', aliases: ['mintpay', 'mint pay'] },
  { name: 'PayZy',               type: 'bnpl', aliases: ['payzy'] },
];

// Flatten to [alias, provider] pairs, longest alias first so the most specific wins
const ALIAS_INDEX = PROVIDERS
  .flatMap((p) => p.aliases.map((alias) => [alias, p]))
  .sort((a, b) => b[0].length - a[0].length);

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strips mypromo.lk link text like "Visit Sampath Bank profile" → "Sampath Bank".
 */
function cleanProfileLabel(label = '') {
  return label.replace(/^visit\s+/i, '').replace(/\s+profile$/i, '').trim();
}

/**
 * findProvider(...texts) — returns the first known provider mentioned in any of
 * the given texts (checked in order), or null.
 */
function findProvider(...texts) {
  for (const text of texts) {
    if (!text) continue;
    const haystack = text.toLowerCase();
    for (const [alias, provider] of ALIAS_INDEX) {
      if (new RegExp(`(^|[^a-z])${escapeRegex(alias)}([^a-z]|$)`).test(haystack)) {
        return provider;
      }
    }
  }
  return null;
}

module.exports = { PROVIDERS, findProvider, cleanProfileLabel };

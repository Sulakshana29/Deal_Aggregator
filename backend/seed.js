/**
 * seed.js — Populates the database with realistic Sri Lankan bank/BNPL deals.
 *
 * Run with: node seed.js
 *
 * Each deal now includes:
 *  - cardType       (credit / debit / both)
 *  - offerType      (percentage_discount / cashback / instalment / bogo / flat_discount)
 *  - discountValue  (number — % or LKR depending on offerType)
 *  - minSpend       (minimum LKR spend to qualify)
 *  - maxDiscount    (cap on saving in LKR — 0 = no cap)
 *  - usageChannel   (online / instore / both)
 *  - validDays      (empty = every day; ["Friday"] = Fridays only)
 *  - isStackable    (can this be combined with Koko/Mintpay?)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Deal = require('./src/models/Deal');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/deal-aggregator';

const deals = [

  // ══════════════════════════════════════════════════════════════
  //  KOKO — Buy Now Pay Later
  // ══════════════════════════════════════════════════════════════
  {
    brand: 'Odel',
    discountText: 'Split into 3 interest-free instalments with Koko — no hidden fees',
    bank: 'Koko',
    category: 'Fashion',
    cardType: 'both',
    cardTier: 'all',
    offerType: 'instalment',
    discountValue: 0,           // 0% interest
    minSpend: 2000,
    maxDiscount: 0,
    usageChannel: 'both',
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2025-12-31'),
    validDays: [],
    isStackable: false,
    source: 'manual',
  },
  {
    brand: 'Softlogic',
    discountText: '0% interest — pay for your electronics in 3 months via Koko',
    bank: 'Koko',
    category: 'Electronics',
    cardType: 'both',
    cardTier: 'all',
    offerType: 'instalment',
    discountValue: 0,
    minSpend: 5000,
    maxDiscount: 0,
    usageChannel: 'instore',
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2025-11-30'),
    validDays: [],
    isStackable: false,
    source: 'manual',
  },
  {
    brand: 'Spa Ceylon',
    discountText: 'Buy now, pay later in 3 equal instalments with Koko — zero interest',
    bank: 'Koko',
    category: 'Beauty',
    cardType: 'both',
    cardTier: 'all',
    offerType: 'instalment',
    discountValue: 0,
    minSpend: 1500,
    maxDiscount: 0,
    usageChannel: 'both',
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2025-10-31'),
    validDays: [],
    isStackable: false,
    source: 'manual',
  },

  // ══════════════════════════════════════════════════════════════
  //  MINTPAY — Buy Now Pay Later
  // ══════════════════════════════════════════════════════════════
  {
    brand: 'Abans',
    discountText: 'Pay for electronics in 6 easy instalments at 0% interest via Mintpay',
    bank: 'Mintpay',
    category: 'Electronics',
    cardType: 'both',
    cardTier: 'all',
    offerType: 'instalment',
    discountValue: 0,
    minSpend: 10000,
    maxDiscount: 0,
    usageChannel: 'instore',
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2025-12-31'),
    validDays: [],
    isStackable: false,
    source: 'manual',
  },
  {
    brand: 'Fashion Bug',
    discountText: 'Split your fashion purchase into 3 — zero interest with Mintpay',
    bank: 'Mintpay',
    category: 'Fashion',
    cardType: 'both',
    cardTier: 'all',
    offerType: 'instalment',
    discountValue: 0,
    minSpend: 3000,
    maxDiscount: 0,
    usageChannel: 'instore',
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2025-09-30'),
    validDays: [],
    isStackable: false,
    source: 'manual',
  },
  {
    brand: 'Keells Super',
    discountText: '10% cashback on grocery purchases above LKR 3,000 via Mintpay',
    bank: 'Mintpay',
    category: 'Groceries',
    cardType: 'both',
    cardTier: 'all',
    offerType: 'cashback',
    discountValue: 10,          // 10% cashback
    minSpend: 3000,
    maxDiscount: 500,           // max LKR 500 cashback
    usageChannel: 'instore',
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2025-08-31'),
    validDays: [],
    isStackable: false,
    source: 'manual',
  },

  // ══════════════════════════════════════════════════════════════
  //  HNB — Hatton National Bank
  // ══════════════════════════════════════════════════════════════
  {
    brand: 'Dominos Pizza',
    discountText: '25% off your order when paying with HNB Visa or Mastercard credit card',
    bank: 'HNB',
    category: 'Dining',
    cardType: 'credit',
    cardTier: 'all',
    offerType: 'percentage_discount',
    discountValue: 25,
    minSpend: 1000,
    maxDiscount: 1000,
    usageChannel: 'both',
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2025-09-30'),
    validDays: [],
    isStackable: true,          // can add Koko on top
    source: 'manual',
  },
  {
    brand: 'Dominos Pizza',
    discountText: '15% off your order when paying with HNB debit card',
    bank: 'HNB',
    category: 'Dining',
    cardType: 'debit',
    cardTier: 'all',
    offerType: 'percentage_discount',
    discountValue: 15,
    minSpend: 1000,
    maxDiscount: 750,
    usageChannel: 'both',
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2025-09-30'),
    validDays: [],
    isStackable: false,
    source: 'manual',
  },
  {
    brand: 'Cinnamon Hotels',
    discountText: '20% off room bookings with HNB credit card — online booking only',
    bank: 'HNB',
    category: 'Travel',
    cardType: 'credit',
    cardTier: 'all',
    offerType: 'percentage_discount',
    discountValue: 20,
    minSpend: 0,
    maxDiscount: 0,
    usageChannel: 'online',
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2025-12-31'),
    validDays: [],
    isStackable: false,
    source: 'manual',
  },
  {
    brand: 'Singer',
    discountText: 'Up to 36-month 0% instalment plan on all Singer products with HNB credit card',
    bank: 'HNB',
    category: 'Electronics',
    cardType: 'credit',
    cardTier: 'all',
    offerType: 'instalment',
    discountValue: 0,
    minSpend: 15000,
    maxDiscount: 0,
    usageChannel: 'instore',
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2026-03-31'),
    validDays: [],
    isStackable: false,
    source: 'manual',
  },

  // ══════════════════════════════════════════════════════════════
  //  COMMERCIAL BANK
  // ══════════════════════════════════════════════════════════════
  {
    brand: 'Laugfs Supermarket',
    discountText: '15% off total bill on Tuesdays for Commercial Bank card holders',
    bank: 'Commercial Bank',
    category: 'Groceries',
    cardType: 'both',
    cardTier: 'all',
    offerType: 'percentage_discount',
    discountValue: 15,
    minSpend: 0,
    maxDiscount: 1500,
    usageChannel: 'instore',
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2025-10-31'),
    validDays: ['Tuesday'],     // Tuesdays only
    isStackable: false,
    source: 'manual',
  },
  {
    brand: 'Pizza Hut',
    discountText: 'Buy 1 Get 1 Free on regular pizzas with Commercial Bank Mastercard credit card',
    bank: 'Commercial Bank',
    category: 'Dining',
    cardType: 'credit',
    cardTier: 'all',
    offerType: 'bogo',
    discountValue: 0,
    minSpend: 0,
    maxDiscount: 0,
    usageChannel: 'instore',
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2025-08-31'),
    validDays: [],
    isStackable: false,
    source: 'manual',
  },
  {
    brand: 'Brandix Retail',
    discountText: '20% off your total bill with ComBank credit or debit card — in-store',
    bank: 'Commercial Bank',
    category: 'Fashion',
    cardType: 'both',
    cardTier: 'all',
    offerType: 'percentage_discount',
    discountValue: 20,
    minSpend: 2500,
    maxDiscount: 2000,
    usageChannel: 'instore',
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2025-11-30'),
    validDays: [],
    isStackable: true,
    source: 'manual',
  },

  // ══════════════════════════════════════════════════════════════
  //  SAMPATH BANK
  // ══════════════════════════════════════════════════════════════
  {
    brand: 'KFC Sri Lanka',
    discountText: '30% off bucket meals every Friday with Sampath Visa credit card',
    bank: 'Sampath',
    category: 'Dining',
    cardType: 'credit',
    cardTier: 'all',
    offerType: 'percentage_discount',
    discountValue: 30,
    minSpend: 500,
    maxDiscount: 800,
    usageChannel: 'instore',
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2025-09-30'),
    validDays: ['Friday'],      // Fridays only
    isStackable: false,
    source: 'manual',
  },
  {
    brand: 'Dialog Axiata',
    discountText: 'LKR 500 off your monthly bill when paying by autopay with Sampath debit card',
    bank: 'Sampath',
    category: 'Utilities',
    cardType: 'debit',
    cardTier: 'all',
    offerType: 'flat_discount',
    discountValue: 500,         // LKR 500 flat
    minSpend: 0,
    maxDiscount: 500,
    usageChannel: 'online',
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2025-12-31'),
    validDays: [],
    isStackable: false,
    source: 'manual',
  },
  {
    brand: 'Teardrop Hotels',
    discountText: '25% off weekend getaways booked online — Sampath World Mastercard only',
    bank: 'Sampath',
    category: 'Travel',
    cardType: 'credit',
    cardTier: 'world',          // World Mastercard only
    offerType: 'percentage_discount',
    discountValue: 25,
    minSpend: 0,
    maxDiscount: 0,
    usageChannel: 'online',
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2025-10-31'),
    validDays: ['Saturday', 'Sunday'],
    isStackable: false,
    source: 'manual',
  },

  // ══════════════════════════════════════════════════════════════
  //  BOC — Bank of Ceylon
  // ══════════════════════════════════════════════════════════════
  {
    brand: 'Arpico Supercentre',
    discountText: '10% off groceries on weekends for BOC Visa card holders',
    bank: 'BOC',
    category: 'Groceries',
    cardType: 'both',
    cardTier: 'all',
    offerType: 'percentage_discount',
    discountValue: 10,
    minSpend: 1000,
    maxDiscount: 1000,
    usageChannel: 'instore',
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2025-09-30'),
    validDays: ['Saturday', 'Sunday'],
    isStackable: false,
    source: 'manual',
  },
  {
    brand: 'Hameedia',
    discountText: 'Up to 15% off menswear with BOC credit card — in-store only',
    bank: 'BOC',
    category: 'Fashion',
    cardType: 'credit',
    cardTier: 'all',
    offerType: 'percentage_discount',
    discountValue: 15,
    minSpend: 3000,
    maxDiscount: 2000,
    usageChannel: 'instore',
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2025-11-30'),
    validDays: [],
    isStackable: true,
    source: 'manual',
  },
  {
    brand: 'Cargills Food City',
    discountText: '12% off groceries every Wednesday with BOC debit card',
    bank: 'BOC',
    category: 'Groceries',
    cardType: 'debit',
    cardTier: 'all',
    offerType: 'percentage_discount',
    discountValue: 12,
    minSpend: 500,
    maxDiscount: 800,
    usageChannel: 'instore',
    validFrom: new Date('2025-01-01'),
    validUntil: new Date('2025-12-31'),
    validDays: ['Wednesday'],
    isStackable: false,
    source: 'manual',
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected');

    await Deal.deleteMany({});
    console.log('🗑️  Cleared existing deals');

    const inserted = await Deal.insertMany(deals);
    console.log(`🌱 Seeded ${inserted.length} deals successfully\n`);

    // Print a breakdown by bank and cardType for easy verification
    const banks      = [...new Set(deals.map((d) => d.bank))];
    const categories = [...new Set(deals.map((d) => d.category))];
    const creditCount = deals.filter((d) => d.cardType === 'credit').length;
    const debitCount  = deals.filter((d) => d.cardType === 'debit').length;
    const bothCount   = deals.filter((d) => d.cardType === 'both').length;

    console.log('📊 Summary:');
    console.log('   Banks covered :', banks.join(', '));
    console.log('   Categories    :', categories.join(', '));
    console.log(`   Card types    : ${creditCount} credit-only | ${debitCount} debit-only | ${bothCount} both`);
    console.log(`   Day-specific  : ${deals.filter((d) => d.validDays.length > 0).length} deals`);
    console.log(`   Stackable     : ${deals.filter((d) => d.isStackable).length} deals`);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

seed();

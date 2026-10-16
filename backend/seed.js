/**
 * seed.js — loads SAMPLE offers for local development.
 *
 * Run with: node seed.js   (or: docker compose exec backend node seed.js)
 *
 * Safety rules:
 *  - Every document is stored with source: 'sample'.
 *  - Only previous 'sample' documents are deleted — real scraped offers are never touched.
 *  - The API hides 'sample' offers unless SHOW_SAMPLE_DATA=true (set only in the
 *    local docker-compose.yml), so running this in production by mistake changes nothing
 *    users can see.
 *
 * Dates are relative to "now" so the sample data never goes stale.
 * For real data, run the scraper: docker compose --profile scraper run --rm scraper
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Deal = require('./src/models/Deal');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/deal-aggregator';

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n) => new Date(Date.now() + n * DAY);

const SAMPLE_DEALS = [
  // ── Card offers (bank discounts) ─────────────────────────────────────────
  {
    brand: 'Keells Super', category: 'Groceries', bank: 'HNB', providerType: 'bank',
    discountText: '20% Off Weekend Groceries with HNB Credit Cards',
    description: 'Get 20% off the total bill at Keells Super every Saturday and Sunday with HNB credit cards. Minimum bill Rs. 5,000; maximum discount Rs. 2,000.',
    cardType: 'credit', offerType: 'percentage_discount', discountValue: 20,
    minSpend: 5000, maxDiscount: 2000, usageChannel: 'instore', validDays: ['Saturday', 'Sunday'], validUntil: inDays(12),
  },
  {
    brand: 'Cargills Food City', category: 'Groceries', bank: 'Bank of Ceylon', providerType: 'bank',
    discountText: '25% Off Fresh Produce with BOC Cards',
    description: 'Get 25% off vegetables, fruits and seafood at Cargills Food City every Wednesday with Bank of Ceylon credit and debit cards. Minimum bill Rs. 4,000; maximum discount Rs. 1,500.',
    cardType: 'both', offerType: 'percentage_discount', discountValue: 25,
    minSpend: 4000, maxDiscount: 1500, usageChannel: 'instore', validDays: ['Wednesday'], validUntil: inDays(20),
  },
  {
    brand: 'Pizza Hut', category: 'Dining', bank: 'Commercial Bank', providerType: 'bank',
    discountText: 'Buy 1 Get 1 Free Large Pizzas with Commercial Bank Cards',
    description: 'Buy one large pizza and get one free every Tuesday with Commercial Bank credit cards, for dine-in and takeaway.',
    cardType: 'credit', offerType: 'bogo', discountValue: 0,
    minSpend: 0, maxDiscount: 0, usageChannel: 'instore', validDays: ['Tuesday'], validUntil: inDays(30),
  },
  {
    brand: 'Odel', category: 'Fashion', bank: 'Sampath Bank', providerType: 'bank',
    discountText: '30% Off Selected Fashion with Sampath Credit Cards',
    description: 'Get 30% off selected fashion items at Odel with Sampath Bank credit cards, in-store and online. Maximum discount Rs. 5,000.',
    cardType: 'credit', offerType: 'percentage_discount', discountValue: 30,
    minSpend: 0, maxDiscount: 5000, usageChannel: 'both', validDays: [], validUntil: inDays(4),
  },
  {
    brand: 'Daraz', category: 'Electronics', bank: 'Nations Trust Bank', providerType: 'bank',
    discountText: '10% Cashback on Electronics with Nations Trust Bank Cards',
    description: 'Get 10% cashback on electronics bought online at Daraz with Nations Trust Bank credit cards. Minimum spend Rs. 15,000; maximum cashback Rs. 3,000.',
    cardType: 'credit', offerType: 'cashback', discountValue: 10,
    minSpend: 15000, maxDiscount: 3000, usageChannel: 'online', validDays: [], validUntil: inDays(9),
  },
  {
    brand: 'Abans', category: 'Electronics', bank: 'HNB', providerType: 'bank',
    discountText: '0% Instalment Plans up to 24 Months with HNB Credit Cards',
    description: 'Spread the cost of home appliances at Abans over up to 24 months at 0% interest with HNB credit cards. Minimum transaction Rs. 25,000.',
    cardType: 'credit', offerType: 'instalment', discountValue: 0,
    minSpend: 25000, maxDiscount: 0, usageChannel: 'both', validDays: [], validUntil: inDays(45),
  },

  // ── Pay later (BNPL) ─────────────────────────────────────────────────────
  {
    brand: 'Crocodile', category: 'Fashion', bank: 'Koko', providerType: 'bnpl',
    discountText: 'Pay in 3 Interest-Free Instalments with Koko',
    description: 'Split your Crocodile purchase into 3 interest-free payments with Koko, online and in-store.',
    cardType: 'both', offerType: 'instalment', discountValue: 0,
    minSpend: 0, maxDiscount: 0, usageChannel: 'both', validDays: [], validUntil: null,
  },
  {
    brand: 'Kelly Felder', category: 'Fashion', bank: 'Mintpay', providerType: 'bnpl',
    discountText: '15% Off + Pay in 3 with Mintpay',
    description: 'Get 15% off and split the rest into 3 interest-free payments with Mintpay when shopping online at Kelly Felder.',
    cardType: 'both', offerType: 'percentage_discount', discountValue: 15,
    minSpend: 0, maxDiscount: 0, usageChannel: 'online', validDays: [], validUntil: inDays(14),
  },
  {
    brand: 'Singer Sri Lanka', category: 'Electronics', bank: 'Koko', providerType: 'bnpl',
    discountText: 'Pay in 3 with Koko on Gadgets',
    description: 'Buy phones and gadgets at Singer and pay in 3 interest-free instalments with Koko.',
    cardType: 'both', offerType: 'instalment', discountValue: 0,
    minSpend: 0, maxDiscount: 0, usageChannel: 'both', validDays: [], validUntil: inDays(25),
  },

  // ── An expired offer, to check the API hides it ──────────────────────────
  {
    brand: 'KFC Sri Lanka', category: 'Dining', bank: "People's Bank", providerType: 'bank',
    discountText: '20% Off Buckets with People\'s Bank Cards (expired sample)',
    description: 'This sample offer expired yesterday and must not appear in the API.',
    cardType: 'both', offerType: 'percentage_discount', discountValue: 20,
    minSpend: 0, maxDiscount: 0, usageChannel: 'instore', validDays: ['Friday'], validUntil: inDays(-1),
  },
].map((d) => ({ ...d, source: 'sample', isActive: true, lastVerified: new Date() }));

async function seed() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);

    const { deletedCount } = await Deal.deleteMany({ source: 'sample' });
    const inserted = await Deal.insertMany(SAMPLE_DEALS);
    console.log(`🌱 Replaced ${deletedCount} old sample offer(s) with ${inserted.length} new ones.`);
    console.log('   Real scraped offers were not touched.');
    console.log('   Sample offers are only visible when the API runs with SHOW_SAMPLE_DATA=true.');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seed();

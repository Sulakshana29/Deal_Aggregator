/**
 * brands.js — Sri Lankan Brand Recognition Dictionary
 *
 * Resolves clean store names from deal titles, raw merchant tags, or URL slugs.
 * Prevents "Unknown" brand names and accurately assigns categories.
 */

const SL_BRAND_DICTIONARY = [
  // Fashion & Apparel
  { name: 'Hameedia',           keywords: ['hameedia'],                     category: 'Fashion' },
  { name: 'Crocodile',          keywords: ['crocodile'],                    category: 'Fashion' },
  { name: 'Kelly Felder',       keywords: ['kelly felder', 'kellyfelder'],  category: 'Fashion' },
  { name: 'Redverse Buller',    keywords: ['redverse buller', 'redverse', 'buller'], category: 'Fashion' },
  { name: 'Scylla Zelus',       keywords: ['scylla zelus', 'scylla', 'zelus'],       category: 'Fashion' },
  { name: 'Under Armour',       keywords: ['under armour', 'underarmour'],  category: 'Fashion' },
  { name: 'Odel',               keywords: ['odel'],                         category: 'Fashion' },
  { name: 'Cool Planet',        keywords: ['cool planet', 'coolplanet'],    category: 'Fashion' },
  { name: 'Nolimit',            keywords: ['nolimit', 'no limit'],          category: 'Fashion' },
  { name: 'Fashion Bug',        keywords: ['fashion bug', 'fashionbug'],    category: 'Fashion' },
  { name: 'GFlock',             keywords: ['gflock'],                       category: 'Fashion' },
  { name: 'Cotton Collection',  keywords: ['cotton collection'],            category: 'Fashion' },
  { name: 'Spring & Summer',    keywords: ['spring & summer', 'spring and summer'], category: 'Fashion' },
  { name: 'Samanmal',           keywords: ['samanmal'],                     category: 'Fashion' },

  // Dining & Restaurants
  { name: 'Pizza Hut',          keywords: ['pizza hut', 'pizzahut'],        category: 'Dining' },
  { name: 'Dominos Pizza',      keywords: ['dominos', "domino's"],          category: 'Dining' },
  { name: 'KFC Sri Lanka',      keywords: ['kfc'],                          category: 'Dining' },
  { name: "McDonald's",         keywords: ['mcdonald', 'mcdonalds'],        category: 'Dining' },
  { name: 'Burger King',        keywords: ['burger king', 'burgerking'],    category: 'Dining' },
  { name: 'Popeyes Sri Lanka',  keywords: ['popeyes'],                      category: 'Dining' },
  { name: 'Isso',               keywords: ['isso'],                         category: 'Dining' },
  { name: 'Barista',            keywords: ['barista'],                      category: 'Dining' },
  { name: 'Java Lounge',        keywords: ['java lounge'],                  category: 'Dining' },
  { name: 'Chinese Dragon Cafe', keywords: ['chinese dragon'],              category: 'Dining' },

  // Groceries & Supermarkets
  { name: 'Cargills Food City', keywords: ['cargills', 'cargills food city'], category: 'Groceries' },
  { name: 'Keells Super',       keywords: ['keells'],                       category: 'Groceries' },
  { name: 'Arpico Supercentre', keywords: ['arpico'],                       category: 'Groceries' },
  { name: 'Spar Supermarket',   keywords: ['spar'],                         category: 'Groceries' },
  { name: 'Glomark',            keywords: ['glomark'],                      category: 'Groceries' },

  // Shopping Malls & Electronics
  { name: 'Havelock City Mall', keywords: ['havelock city mall', 'hcm'],    category: 'Fashion' },
  { name: 'One Galle Face',     keywords: ['one galle face', 'ogf'],        category: 'Fashion' },
  { name: 'Abans',              keywords: ['abans'],                        category: 'Electronics' },
  { name: 'Singer Sri Lanka',   keywords: ['singer'],                       category: 'Electronics' },
  { name: 'Softlogic',          keywords: ['softlogic'],                    category: 'Electronics' },
];

/**
 * detectBrand(title, rawBrand, urlPath)
 * Returns { brand: string, category: string|null }
 */
function detectBrand(title = '', rawBrand = '', urlPath = '') {
  const fullText = `${title} ${rawBrand} ${urlPath}`.toLowerCase();

  // 1. Check against our Sri Lankan Brand Dictionary
  for (const item of SL_BRAND_DICTIONARY) {
    for (const kw of item.keywords) {
      if (fullText.includes(kw)) {
        return {
          brand: item.name,
          category: item.category,
        };
      }
    }
  }

  // 2. If rawBrand is valid (not Unknown, not empty) clean and return it
  if (rawBrand && rawBrand !== 'Unknown' && rawBrand.trim() !== '') {
    return {
      brand: rawBrand.trim(),
      category: null,
    };
  }

  // 3. Otherwise couldn't reliably detect brand
  return {
    brand: 'Unknown',
    category: null,
  };
}

module.exports = {
  SL_BRAND_DICTIONARY,
  detectBrand,
};

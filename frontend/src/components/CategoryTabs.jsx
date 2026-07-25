/**
 * CategoryTabs.jsx
 *
 * Visual E-Commerce category selector with crisp icons.
 */
import React from 'react';

const CATEGORY_ICONS = {
  All:          '🏷️',
  Dining:       '🍕',
  Groceries:    '🛒',
  Fashion:      '👗',
  Electronics:  '💻',
  Beauty:       '💄',
  Travel:       '✈️',
  Utilities:    '⚡',
};

export default function CategoryTabs({ categories, selectedCategory, onSelectCategory }) {
  const allList = ['All', ...categories];

  return (
    <div className="category-tabs" role="tablist" aria-label="Deal categories">
      {allList.map((cat) => {
        const isSelected = (cat === 'All' && !selectedCategory) || selectedCategory === cat;
        const icon = CATEGORY_ICONS[cat] || '🏷️';

        return (
          <button
            key={cat}
            role="tab"
            aria-selected={isSelected}
            className={`category-tab ${isSelected ? 'category-tab--active' : ''}`}
            onClick={() => onSelectCategory(cat === 'All' ? '' : cat)}
          >
            <span className="category-tab__icon" aria-hidden="true">{icon}</span>
            <span className="category-tab__label">{cat}</span>
          </button>
        );
      })}
    </div>
  );
}

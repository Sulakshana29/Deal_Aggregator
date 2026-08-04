/**
 * Footer.jsx
 *
 * Professional multi-column E-Commerce footer.
 */
import React from 'react';

export default function Footer({ onBankClick, onCategoryClick }) {
  return (
    <footer className="footer">
      <div className="footer__container">
        <div className="footer__grid">
          {/* Col 1: Brand & Mission */}
          <div className="footer__col footer__col--brand">
            <div className="footer__logo">
              <span className="footer__logo-emoji">💳</span>
              <span className="footer__logo-text">DealVault LK</span>
            </div>
            <p className="footer__bio">
              Sri Lanka&apos;s premier unified aggregator for credit card discounts, debit promotions,
              and 0% interest Buy Now Pay Later (BNPL) offers.
            </p>
            <div className="footer__badges">
              <span className="footer__tech-badge">Live Scraper</span>
              <span className="footer__tech-badge">Normalized Schema v2</span>
              <span className="footer__tech-badge">DevSecOps Ready</span>
            </div>
          </div>

          {/* Col 2: Banks & BNPL */}
          <div className="footer__col">
            <h4 className="footer__heading">Banks &amp; BNPL</h4>
            <ul className="footer__links">
              <li><button onClick={() => onBankClick('Koko')}>Koko BNPL</button></li>
              <li><button onClick={() => onBankClick('Mintpay')}>Mintpay BNPL</button></li>
              <li><button onClick={() => onBankClick('HNB')}>Hatton National Bank (HNB)</button></li>
              <li><button onClick={() => onBankClick('Commercial Bank')}>Commercial Bank</button></li>
              <li><button onClick={() => onBankClick('Sampath')}>Sampath Bank</button></li>
              <li><button onClick={() => onBankClick('BOC')}>Bank of Ceylon (BOC)</button></li>
            </ul>
          </div>

          {/* Col 3: Categories */}
          <div className="footer__col">
            <h4 className="footer__heading">Categories</h4>
            <ul className="footer__links">
              <li><button onClick={() => onCategoryClick('Groceries')}>Groceries &amp; Supermarkets</button></li>
              <li><button onClick={() => onCategoryClick('Dining')}>Dining &amp; Restaurants</button></li>
              <li><button onClick={() => onCategoryClick('Fashion')}>Fashion &amp; Apparel</button></li>
              <li><button onClick={() => onCategoryClick('Electronics')}>Electronics &amp; Gadgets</button></li>
              <li><button onClick={() => onCategoryClick('Beauty')}>Beauty &amp; Wellness</button></li>
              <li><button onClick={() => onCategoryClick('Travel')}>Travel &amp; Hotels</button></li>
            </ul>
          </div>

          {/* Col 4: About & Disclaimer */}
          <div className="footer__col">
            <h4 className="footer__heading">Platform Info</h4>
            <p className="footer__text">
              Aggregated from public Sri Lankan banking and retail promotions. Always verify
              merchant terms &amp; conditions before checkout.
            </p>
            <div className="footer__verified-box">
              <span className="footer__verified-icon">🛡️</span>
              <span>Updated automatically via scheduled scraping pipelines.</span>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer__bottom">
          <p className="footer__copyright">
            &copy; {new Date().getFullYear()} DealVault LK. All rights reserved. Built for high-performance deal discovery.
          </p>
          <div className="footer__bottom-links">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>API Status: Online</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

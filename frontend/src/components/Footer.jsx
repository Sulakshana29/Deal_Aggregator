/**
 * Footer.jsx — data source attribution, honest disclaimer, and live system status.
 */
import { useEffect, useState } from 'react';
import { fetchStatus } from '../api';

export default function Footer() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchStatus(ctrl.signal)
      .then(setStatus)
      .catch(() => {
        // Silently keep default offline/idle state if API is unreachable
      });
    return () => ctrl.abort();
  }, []);

  const isHealthy = status?.status === 'healthy';
  const isDegraded = status?.status === 'degraded';
  const isDown = status?.status === 'database_unreachable';

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__status-bar" aria-label="System status">
          <div className="status-pill">
            <span
              className={`status-dot ${isDegraded ? 'status-dot--degraded' : isDown ? 'status-dot--error' : ''}`}
              aria-hidden="true"
            />
            <span>
              {isDegraded ? 'Scraper Degraded' : isDown ? 'Database Offline' : isHealthy ? 'System Healthy' : 'System Online'}
            </span>
          </div>

          <div className="footer__status-meta">
            {status?.scraper && (
              <span>
                Last Scraped: <strong>{new Date(status.scraper.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong> ({status.scraper.offersFound} offers, {status.scraper.pages} pages)
              </span>
            )}
            <span>
              Drift Guard: <strong>Active</strong>
            </span>
          </div>
        </div>

        <div>
          <p className="footer__brand">DealVault</p>
          <p className="footer__text">
            An open-source portfolio project. Offers are collected automatically from{' '}
            <a href="https://www.mypromo.lk" target="_blank" rel="noopener noreferrer">mypromo.lk</a>{' '}
            every 12 hours. DealVault is not affiliated with any bank, store or BNPL provider.
          </p>
        </div>
        <p className="footer__text footer__small">
          Always confirm an offer&apos;s terms with the merchant or bank before purchasing.
        </p>
      </div>
    </footer>
  );
}

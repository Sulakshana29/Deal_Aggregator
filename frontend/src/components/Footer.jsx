/**
 * Footer.jsx — data source attribution and an honest disclaimer.
 */
export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
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

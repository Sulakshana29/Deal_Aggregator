import { useState, useEffect, useRef } from 'react';
import Icon from './Icon';
import { makeCardId } from '../lib/wallet';

const FALLBACK_BANKS = [
  'Commercial Bank',
  'Sampath Bank',
  'HNB',
  'Nations Trust Bank',
  "People's Bank",
  'Bank of Ceylon',
  'Seylan Bank',
  'DFCC Bank',
  'Union Bank',
  'Pan Asia Bank',
  'NDB Bank',
  'Cargills Bank',
  'Amana Bank',
  'Standard Chartered',
  'HSBC',
];

export default function WalletModal({ isOpen, onClose, wallet, onSaveWallet, meta, onToast }) {
  const dialogRef = useRef(null);
  const [selectedBank, setSelectedBank] = useState('');
  const [cardType, setCardType] = useState('credit');

  const availableBanks = meta?.providers?.filter((p) => p.type === 'bank').map((p) => p.name) || FALLBACK_BANKS;
  const sortedBanks = Array.from(new Set([...availableBanks, ...FALLBACK_BANKS])).sort();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (typeof dialog.showModal === 'function' && !dialog.open) {
        dialog.showModal();
      } else {
        dialog.open = true;
      }
    } else if (dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.open = false;
      }
    }
  }, [isOpen]);

  const handleAddCard = (e) => {
    e.preventDefault();
    if (!selectedBank) return;

    const id = makeCardId(selectedBank, cardType);
    if (wallet.some((c) => c.id === id || (c.bank === selectedBank && c.type === cardType))) {
      onToast?.('This card is already in your wallet', 'error');
      return;
    }

    const updated = [...wallet, { id, bank: selectedBank, type: cardType }];
    onSaveWallet(updated);
    setSelectedBank('');
    onToast?.(`Added ${selectedBank} (${cardType})`, 'success');
  };

  const handleRemoveCard = (cardId) => {
    const updated = wallet.filter((c) => c.id !== cardId);
    onSaveWallet(updated);
    onToast?.('Card removed from wallet', 'success');
  };

  if (!isOpen) return <dialog ref={dialogRef} className="details" />;

  return (
    <dialog
      ref={dialogRef}
      className="details wallet-modal"
      onClose={onClose}
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
    >
      <div className="details__panel">
        <header className="details__head">
          <div className="brand__mark" aria-hidden="true">
            <Icon name="wallet" size={20} />
          </div>
          <div>
            <h2 className="details__title">My Card Wallet</h2>
            <p className="details__brand">Select the cards in your wallet to personalize deals & recommendations</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close wallet modal">
            <Icon name="x" />
          </button>
        </header>

        {/* List of cards currently in wallet */}
        <section className="wallet-list">
          <h3 className="wallet-section-title">
            Cards in Wallet ({wallet.length})
          </h3>
          {wallet.length === 0 ? (
            <div className="wallet-empty">
              <Icon name="card" size={24} />
              <p>No cards added yet. Add your bank cards below to filter offers instantly!</p>
            </div>
          ) : (
            <div className="wallet-cards-grid">
              {wallet.map((c) => (
                <div key={c.id} className="wallet-card-chip">
                  <div className="wallet-card-chip__info">
                    <span className="wallet-card-chip__bank">{c.bank}</span>
                    <span className={`badge badge--card-type badge--${c.type}`}>{c.type}</span>
                  </div>
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm wallet-card-chip__delete"
                    onClick={() => handleRemoveCard(c.id)}
                    aria-label={`Remove ${c.bank} ${c.type} card`}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Add a new card form */}
        <form className="wallet-add-form" onSubmit={handleAddCard}>
          <h3 className="wallet-section-title">Add a Card</h3>
          <div className="wallet-add-row">
            <label className="select">
              <span className="select__label"><Icon name="bank" size={14} /> Bank</span>
              <select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
                required
              >
                <option value="">Select your bank...</option>
                {sortedBanks.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </label>

            <label className="select">
              <span className="select__label"><Icon name="card" size={14} /> Card Type</span>
              <select value={cardType} onChange={(e) => setCardType(e.target.value)}>
                <option value="credit">Credit Card</option>
                <option value="debit">Debit Card</option>
              </select>
            </label>

            <button type="submit" className="btn btn--primary wallet-add-btn" disabled={!selectedBank}>
              <Icon name="plus" size={16} /> Add Card
            </button>
          </div>
        </form>

        <p className="details__note">
          <Icon name="info" size={15} />
          Your cards stay private in your browser&apos;s local storage. We never ask for card numbers or CVVs.
        </p>
      </div>
    </dialog>
  );
}

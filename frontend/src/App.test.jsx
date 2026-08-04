import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, it, expect } from 'vitest';
import App from './App';

// We mock the API call that the App makes on mount
global.fetch = () =>
  Promise.resolve({
    json: () => Promise.resolve([]),
  });

describe('App Component', () => {
  it('renders the navbar brand', () => {
    render(<App />);
    const brandElements = screen.getAllByText(/DealVault/i);
    expect(brandElements.length).toBeGreaterThan(0);
  });
});

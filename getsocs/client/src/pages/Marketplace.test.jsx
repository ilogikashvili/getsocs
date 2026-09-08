import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Marketplace from './Marketplace';
import { getProducts } from '../services/productService';

jest.mock('../services/productService', () => ({ getProducts: jest.fn() }));
jest.mock('./marketplaceShared', () => ({
  extractProductList: response => response?.data?.data || response?.data || [],
  ListingCard: ({ item }) => <article data-testid="listing-card">{item.title}</article>
}));
jest.mock('../components/marketplace/FilterPanel', () => function FilterPanel() { return <div data-testid="filter-panel" />; });

describe('Marketplace', () => {
  beforeEach(() => jest.clearAllMocks());

  test('shows loading then renders API listings', async () => {
    let resolve;
    getProducts.mockReturnValue(new Promise(r => { resolve = r; }));
    render(<Marketplace />);
    expect(screen.getByText('Loading listings')).toBeInTheDocument();
    resolve({ data: { data: [
      { id: 'p1', title: 'First account', price: 100, createdAt: '2026-01-02' },
      { id: 'p2', title: 'Second account', price: 80, createdAt: '2026-01-01' }
    ] } });
    await waitFor(() => expect(screen.getAllByTestId('listing-card')).toHaveLength(2));
    expect(screen.getByText('2 listings')).toBeInTheDocument();
  });

  test('shows a useful API failure state', async () => {
    getProducts.mockRejectedValue(new Error('network down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<Marketplace />);
    await waitFor(() => expect(screen.getByText('Something went wrong')).toBeInTheDocument());
    expect(screen.getByText('Unable to load listings right now.')).toBeInTheDocument();
    spy.mockRestore();
  });

  test('does not update state after unmount while an API request is still pending', async () => {
    let resolve;
    getProducts.mockReturnValue(new Promise(r => { resolve = r; }));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = render(<Marketplace />);
    unmount();
    resolve({ data: { data: [{ id: 'late', title: 'Late result' }] } });
    await Promise.resolve();
    expect(errorSpy.mock.calls.some(args => args.join(' ').includes("state update on an unmounted component"))).toBe(false);
    errorSpy.mockRestore();
  });
});

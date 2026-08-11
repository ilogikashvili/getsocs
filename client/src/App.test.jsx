import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Cart from './pages/Cart';
import Home from './pages/Home';
import { getProducts } from './services/productService';

jest.mock('./services/productService', () => ({
  getProducts: jest.fn(),
  buyProduct: jest.fn()
}));

test('renders cart data from the products API', async () => {
  getProducts.mockResolvedValue({
    data: {
      data: [{ id: 1, title: 'Demo account', price: 150, platform: 'Instagram', images: [] }]
    }
  });

  render(
    <MemoryRouter>
      <Cart />
    </MemoryRouter>
  );

  expect(await screen.findByRole('heading', { name: /your cart/i })).toBeInTheDocument();
  expect(await screen.findByText(/Demo account/i)).toBeInTheDocument();
});

test('filters listings by a minimum and maximum price range', async () => {
  getProducts.mockResolvedValue({
    data: {
      data: [
        { id: 1, title: 'Budget account', price: 50, platform: 'Instagram', topic: 'Gaming', followers: 1000, monetized: false },
        { id: 2, title: 'Premium account', price: 120, platform: 'Instagram', topic: 'Gaming', followers: 1000, monetized: true }
      ]
    }
  });

  render(
    <MemoryRouter>
      <AuthProvider>
        <Home />
      </AuthProvider>
    </MemoryRouter>
  );

  expect(await screen.findByText(/Budget account/i)).toBeInTheDocument();
  expect(await screen.findByText(/Premium account/i)).toBeInTheDocument();

  const minInput = screen.getByLabelText(/minimum price/i, { selector: 'input' });
  const maxInput = screen.getByLabelText(/maximum price/i, { selector: 'input' });

  await userEvent.clear(minInput);
  await userEvent.type(minInput, '80');
  await userEvent.clear(maxInput);
  await userEvent.type(maxInput, '100');

  await waitFor(() => expect(screen.queryByText(/Budget account/i)).not.toBeInTheDocument());
  expect(screen.queryByText(/Premium account/i)).not.toBeInTheDocument();
});

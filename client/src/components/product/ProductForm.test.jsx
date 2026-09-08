import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('../../services/productService', () => ({
  createProduct: vi.fn(),
  lookupYoutubeChannel: vi.fn()
}));
vi.mock('../../services/metaService', () => ({
  getMeta: vi.fn().mockResolvedValue({ data: { data: { platforms: ['YouTube', 'Telegram', 'TikTok'] } } })
}));
vi.mock('../../utils/photoValidation', () => ({
  PHOTO_CONSTRAINTS: { MAX_SIZE_MB: 8, MAX_SIZE_BYTES: 8 * 1024 * 1024, MIN_WIDTH: 200, MIN_HEIGHT: 200 },
  // Files named with "bad" are rejected, everything else passes - lets the
  // test control validation outcomes without relying on jsdom to actually
  // decode image bytes (it can't - Image never fires onload in jsdom).
  validatePhoto: vi.fn((file) => {
    if (file.name.includes('bad')) {
      return Promise.resolve({ valid: false, errors: [`Image width too small: 100px (minimum: 200px)`] });
    }
    return Promise.resolve({ valid: true, errors: [], dimensions: { width: 800, height: 600 } });
  })
}));

import ProductForm from './ProductForm';

function makeFile(name, type = 'image/jpeg', size = 1024) {
  const file = new File([new Uint8Array(size)], name, { type });
  return file;
}

describe('ProductForm - real photo validation integration', () => {
  it('accepts valid images and shows the correct selected count', async () => {
    render(<ProductForm />);
    const input = document.querySelector('input[type="file"]');
    const files = [makeFile('good1.jpg'), makeFile('good2.jpg'), makeFile('good3.jpg')];

    fireEvent.change(input, { target: { files } });

    await waitFor(() => {
      expect(screen.getByText('3 files selected')).toBeTruthy();
    });
    expect(document.querySelectorAll('.image-preview-card').length).toBe(3);
  });

  it('rejects invalid images (too small) and shows the specific error, without adding them to the list', async () => {
    render(<ProductForm />);
    const input = document.querySelector('input[type="file"]');
    const files = [makeFile('bad-tiny.jpg'), makeFile('good1.jpg')];

    fireEvent.change(input, { target: { files } });

    await waitFor(() => {
      expect(screen.getByText(/bad-tiny\.jpg/)).toBeTruthy();
    });
    expect(screen.getByText(/too small/i)).toBeTruthy();
    // Only the good file should have been accepted into the list
    expect(document.querySelectorAll('.image-preview-card').length).toBe(1);
  });

  it('caps selection at 7 images total and shows a clear message', async () => {
    render(<ProductForm />);
    const input = document.querySelector('input[type="file"]');
    const files = Array.from({ length: 9 }, (_, i) => makeFile(`good${i}.jpg`));

    fireEvent.change(input, { target: { files } });

    await waitFor(() => {
      expect(document.querySelectorAll('.image-preview-card').length).toBe(7);
    });
    expect(screen.getByText(/maximum of 7 images/i)).toBeTruthy();
  });

  it('shows "Checking images…" while validation is in progress', async () => {
    render(<ProductForm />);
    const input = document.querySelector('input[type="file"]');
    const files = [makeFile('good1.jpg')];

    fireEvent.change(input, { target: { files } });
    // Immediately after firing change, validation (async) should be in flight
    expect(screen.getByText('Checking images…')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('1 file selected')).toBeTruthy();
    });
  });

  it('blocks submission with a clear error when fewer than 3 images are attached', async () => {
    render(<ProductForm />);
    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Test listing' } });
    fireEvent.change(screen.getByPlaceholderText('Price'), { target: { value: '25' } });

    const submitBtn = document.querySelector('.upload-submit-btn');
    await act(async () => { fireEvent.click(submitBtn); });

    expect(screen.getByText('Please attach at least 3 images.')).toBeTruthy();
  });
});

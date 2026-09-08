import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

jest.mock('../../services/productService', () => ({
  __esModule: true,
  createProduct: jest.fn(),
  lookupYoutubeChannel: jest.fn()
}));
jest.mock('../../services/metaService', () => {
  const getMeta = jest.fn(() => Promise.resolve({ data: { data: { platforms: ['YouTube', 'Telegram', 'TikTok'] } } }));
  return {
    __esModule: true,
    getMeta
  };
});
let originalFileReader;
let originalImage;
let originalURL;

beforeAll(() => {
  originalFileReader = global.FileReader;
  originalImage = global.Image;
  originalURL = global.URL;

  global.URL = {
    createObjectURL: jest.fn(() => 'blob:mock'),
    revokeObjectURL: jest.fn()
  };

  global.FileReader = class {
    constructor() {
      this.onload = null;
      this.onerror = null;
    }

    readAsDataURL(file) {
      global.__lastPhotoValidationFile = file;
      setTimeout(() => {
        if (typeof this.onload === 'function') {
          this.onload({ target: { result: `data:image/jpeg;base64,${file.name}` } });
        }
      }, 0);
    }
  };

  global.Image = class {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this.width = 0;
      this.height = 0;
    }

    set src(_src) {
      const file = global.__lastPhotoValidationFile;
      const isBad = file?.name?.includes('bad');
      this.width = isBad ? 100 : 800;
      this.height = isBad ? 100 : 600;
      setTimeout(() => {
        if (typeof this.onload === 'function') {
          this.onload();
        }
      }, 0);
    }
  };
});

afterAll(() => {
  global.FileReader = originalFileReader;
  global.Image = originalImage;
  global.URL = originalURL;
});

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

// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Prevent real network calls during tests by mocking the axios instance
// Preserve named exports from the real module (e.g. `getApiBaseUrl`) while
// replacing the default axios instance with stubs to avoid real HTTP calls.
jest.mock('./api/axios', () => {
	const actual = jest.requireActual('./api/axios');
	return {
		__esModule: true,
		...actual,
		default: {
			...(actual.default || {}),
			get: jest.fn(() => Promise.resolve({ data: { data: [] } })),
			post: jest.fn(() => Promise.resolve({ data: {} })),
			put: jest.fn(() => Promise.resolve({ data: {} })),
			delete: jest.fn(() => Promise.resolve({ data: {} })),
			defaults: (actual.default && actual.default.defaults) || { headers: { common: {} } },
			interceptors: { response: { use: jest.fn() } },
			setAuthToken: jest.fn()
		}
	};
});

import { expect, test } from 'vitest';
import { validateProductionApiUrl } from '../config/production.js';

test('production accepts a configured HTTPS API URL', () => {
  expect(() => validateProductionApiUrl('https://backend.example.invalid/api')).not.toThrow();
});
test('production rejects missing, localhost, insecure or credential-bearing API configuration', () => {
  for (const url of [undefined, '', 'http://localhost:3000/api', 'https://localhost/api', 'https://127.0.0.1/api', 'http://backend.example.invalid/api',
    'https://key:secret@backend.example.invalid/api', 'https://backend.example.invalid', 'https://backend.example.invalid/api?token=secret']) {
    expect(() => validateProductionApiUrl(url)).toThrow(/VITE_API_BASE_URL/);
  }
});

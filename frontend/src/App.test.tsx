import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';
import './i18n/index';

test('renders storefront header on root path', () => {
  render(<App />);
  expect(screen.getByRole('banner')).toBeInTheDocument();
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders storefront header on root path', () => {
  render(<App />);
  expect(screen.getByLabelText('Fashion Store home')).toBeInTheDocument();
});

import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithI18n } from '../../test-utils/renderWithI18n';
import Pagination from './Pagination';

describe('Pagination', () => {
  it('does not render when totalPages <= 1', () => {
    const { container } = renderWithI18n(
      <Pagination currentPage={1} totalPages={1} onPageChange={jest.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders page buttons when totalPages > 1', () => {
    renderWithI18n(<Pagination currentPage={1} totalPages={3} onPageChange={jest.fn()} />);
    expect(screen.getByLabelText('Page 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Page 3')).toBeInTheDocument();
  });

  it('calls onPageChange with correct page on next click', () => {
    const onChange = jest.fn();
    renderWithI18n(<Pagination currentPage={1} totalPages={5} onPageChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange with correct page on previous click', () => {
    const onChange = jest.fn();
    renderWithI18n(<Pagination currentPage={3} totalPages={5} onPageChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Previous page'));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('disables previous button on first page', () => {
    renderWithI18n(<Pagination currentPage={1} totalPages={5} onPageChange={jest.fn()} />);
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
  });

  it('disables next button on last page', () => {
    renderWithI18n(<Pagination currentPage={5} totalPages={5} onPageChange={jest.fn()} />);
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });
});

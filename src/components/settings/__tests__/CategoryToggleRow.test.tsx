/**
 * CategoryToggleRow Component Tests
 *
 * Story: BL-022.2
 * ACs: 5, 8, 10
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryToggleRow } from '../CategoryToggleRow';

describe('CategoryToggleRow', () => {
  const defaultProps = {
    categoryName: 'Proposals',
    description: 'New proposals created, proposal updates',
    emailEnabled: true,
    inAppEnabled: true,
    onEmailChange: vi.fn(),
    onInAppChange: vi.fn(),
  };

  it('should render category name and description', () => {
    render(<CategoryToggleRow {...defaultProps} />);

    expect(screen.getByText('Proposals')).toBeInTheDocument();
    expect(screen.getByText('New proposals created, proposal updates')).toBeInTheDocument();
  });

  it('should render email and in-app toggle switches', () => {
    render(<CategoryToggleRow {...defaultProps} />);

    const emailToggle = screen.getByTestId('email-toggle-proposals');
    const inAppToggle = screen.getByTestId('inapp-toggle-proposals');

    expect(emailToggle).toBeInTheDocument();
    expect(inAppToggle).toBeInTheDocument();
  });

  it('should call onEmailChange when email toggle is clicked', () => {
    const onEmailChange = vi.fn();
    render(<CategoryToggleRow {...defaultProps} onEmailChange={onEmailChange} />);

    const emailToggle = screen.getByTestId('email-toggle-proposals');
    fireEvent.click(emailToggle);

    expect(onEmailChange).toHaveBeenCalledWith(false);
  });

  it('should call onInAppChange when in-app toggle is clicked', () => {
    const onInAppChange = vi.fn();
    render(<CategoryToggleRow {...defaultProps} onInAppChange={onInAppChange} />);

    const inAppToggle = screen.getByTestId('inapp-toggle-proposals');
    fireEvent.click(inAppToggle);

    expect(onInAppChange).toHaveBeenCalledWith(false);
  });

  it('should apply disabled styling to email toggle when emailDisabled is true', () => {
    render(<CategoryToggleRow {...defaultProps} emailDisabled={true} />);

    const emailToggle = screen.getByTestId('email-toggle-proposals');
    expect(emailToggle).toBeDisabled();
    expect(emailToggle).toHaveAttribute('title', 'Email notifications are disabled');
  });

  it('should render data-testid attributes correctly', () => {
    render(<CategoryToggleRow {...defaultProps} />);

    expect(screen.getByTestId('category-row-proposals')).toBeInTheDocument();
    expect(screen.getByTestId('email-toggle-proposals')).toBeInTheDocument();
    expect(screen.getByTestId('inapp-toggle-proposals')).toBeInTheDocument();
  });

  it('should render icon when provided', () => {
    render(
      <CategoryToggleRow
        {...defaultProps}
        icon={<span data-testid="test-icon">icon</span>}
      />
    );

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });
});

/**
 * StepPromptInput Component Tests
 *
 * Tests for the prompt input step of the proposal wizard.
 *
 * Story: 9-1-1-think-tank-proposal-creation
 * AC: 2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { StepPromptInput } from './components/StepPromptInput';

describe('StepPromptInput', () => {
  const mockOnNext = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the prompt input form', () => {
    render(<StepPromptInput onNext={mockOnNext} />);

    expect(screen.getByText('Describe Your Project')).toBeInTheDocument();
    expect(screen.getByLabelText(/Project Description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument();
  });

  it('should show character count', async () => {
    const user = userEvent.setup();
    render(<StepPromptInput onNext={mockOnNext} />);

    const textarea = screen.getByLabelText(/Project Description/i);
    await user.type(textarea, 'Hello World');

    expect(screen.getByText(/11 \/ 2000/)).toBeInTheDocument();
  });

  it('should disable submit button when prompt is too short', () => {
    render(<StepPromptInput onNext={mockOnNext} />);

    const submitButton = screen.getByRole('button', { name: /Continue/i });
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when prompt meets minimum length', async () => {
    const user = userEvent.setup();
    render(<StepPromptInput onNext={mockOnNext} />);

    const textarea = screen.getByLabelText(/Project Description/i);
    const validPrompt = 'A'.repeat(50); // Minimum 50 characters
    await user.type(textarea, validPrompt);

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /Continue/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('should show error message when prompt is too short', async () => {
    const user = userEvent.setup();
    render(<StepPromptInput onNext={mockOnNext} />);

    const textarea = screen.getByLabelText(/Project Description/i);
    await user.type(textarea, 'Short prompt');
    // Trigger validation by blurring
    fireEvent.blur(textarea);

    await waitFor(() => {
      expect(screen.getByText(/minimum 50 characters/i)).toBeInTheDocument();
    });
  });

  it('should call onNext with prompt value on submit', async () => {
    const user = userEvent.setup();
    render(<StepPromptInput onNext={mockOnNext} />);

    const textarea = screen.getByLabelText(/Project Description/i);
    const validPrompt =
      'This is a valid prompt that meets the minimum character requirement for the proposal description.';
    await user.type(textarea, validPrompt);

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /Continue/i });
      expect(submitButton).not.toBeDisabled();
    });

    const submitButton = screen.getByRole('button', { name: /Continue/i });
    await user.click(submitButton);

    expect(mockOnNext).toHaveBeenCalledWith(validPrompt);
  });

  it('should render Back button when onBack is provided', () => {
    render(<StepPromptInput onNext={mockOnNext} onBack={mockOnBack} />);

    expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();
  });

  it('should call onBack when Back button is clicked', async () => {
    const user = userEvent.setup();
    render(<StepPromptInput onNext={mockOnNext} onBack={mockOnBack} />);

    const backButton = screen.getByRole('button', { name: /Back/i });
    await user.click(backButton);

    expect(mockOnBack).toHaveBeenCalled();
  });

  it('should use initial value when provided', () => {
    const initialValue = 'This is an initial prompt value that was previously entered by the user.';
    render(<StepPromptInput initialValue={initialValue} onNext={mockOnNext} />);

    const textarea = screen.getByLabelText(/Project Description/i);
    expect(textarea).toHaveValue(initialValue);
  });
});

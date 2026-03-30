import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FillBar } from '../fill-bar';

describe('FillBar', () => {
  const defaultProps = {
    onFill: vi.fn(),
    isLoading: false,
    result: null,
  };

  it('renders fill button', () => {
    render(<FillBar {...defaultProps} />);
    expect(screen.getByRole('button', { name: /fill/i })).toBeInTheDocument();
  });

  it('calls onFill when clicked', async () => {
    const user = userEvent.setup();
    const handleFill = vi.fn();
    render(<FillBar {...defaultProps} onFill={handleFill} />);

    await user.click(screen.getByRole('button', { name: /fill/i }));
    expect(handleFill).toHaveBeenCalledTimes(1);
  });
});

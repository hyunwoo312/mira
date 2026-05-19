import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FillBar } from '../fill-bar';
import { createFailedFillResult } from '@/lib/fill-result';

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

  it('renders structured fill failures', () => {
    render(
      <FillBar
        {...defaultProps}
        result={createFailedFillResult('restricted-page')}
        error="Chrome blocked the page"
      />,
    );

    expect(screen.getByText('Unsupported page')).toBeInTheDocument();
    expect(
      screen.getByText('Chrome does not allow extensions to fill this kind of page.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Try a regular job application page instead.')).toBeInTheDocument();
  });

  it('does not allow fill failures to open details', async () => {
    const user = userEvent.setup();
    render(<FillBar {...defaultProps} result={createFailedFillResult('no-form-detected')} />);

    const summary = screen.getByRole('button', { name: /no application form found/i });
    expect(summary).toBeDisabled();
    expect(summary).not.toHaveAttribute('aria-controls');

    await user.click(summary);
    expect(screen.queryByText(/fill details/i)).not.toBeInTheDocument();
  });
});

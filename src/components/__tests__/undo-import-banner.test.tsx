import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UndoImportBanner } from '../undo-import-banner';

describe('UndoImportBanner', () => {
  it('renders nothing when inactive', () => {
    render(<UndoImportBanner active={false} onUndo={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders the status when active', () => {
    render(<UndoImportBanner active={true} onUndo={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Profile pre-filled from resume/i)).toBeInTheDocument();
  });

  it('calls onUndo when Undo is clicked', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    render(<UndoImportBanner active={true} onUndo={onUndo} onDismiss={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /undo/i }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when X is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<UndoImportBanner active={true} onUndo={vi.fn()} onDismiss={onDismiss} />);
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

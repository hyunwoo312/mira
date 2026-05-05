import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyStatePrompt } from '../empty-state-prompt';

describe('EmptyStatePrompt', () => {
  it('renders nothing when closed', () => {
    render(<EmptyStatePrompt open={false} onDismiss={vi.fn()} onImportResume={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders both call-to-action buttons and the privacy hint', () => {
    render(<EmptyStatePrompt open={true} onDismiss={vi.fn()} onImportResume={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Import from resume/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Fill manually$/i })).toBeInTheDocument();
    expect(screen.getByText(/PDF resumes only/i)).toBeInTheDocument();
  });

  it('Fill manually triggers onDismiss', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<EmptyStatePrompt open={true} onDismiss={onDismiss} onImportResume={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /^Fill manually$/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('Import button triggers onImportResume but does NOT dismiss', async () => {
    const user = userEvent.setup();
    const onImportResume = vi.fn();
    const onDismiss = vi.fn();
    render(<EmptyStatePrompt open={true} onDismiss={onDismiss} onImportResume={onImportResume} />);
    await user.click(screen.getByRole('button', { name: /Import from resume/i }));
    expect(onImportResume).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('X button triggers onDismiss', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<EmptyStatePrompt open={true} onDismiss={onDismiss} onImportResume={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /^Dismiss$/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('ESC triggers onDismiss', () => {
    const onDismiss = vi.fn();
    render(<EmptyStatePrompt open={true} onDismiss={onDismiss} onImportResume={vi.fn()} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

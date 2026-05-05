import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportReviewModal } from '../import-review-modal';
import { DEFAULT_PROFILE } from '@/lib/schema';
import type { ImportPayload } from '@/lib/import/types';

function makePayload(overrides?: Partial<ImportPayload>): ImportPayload {
  return {
    source: 'resume-pdf',
    fileName: 'my-resume.pdf',
    fileSize: 1024,
    fields: {
      firstName: 'Avery',
      lastName: 'Chen',
      email: 'avery@example.com',
      phone: '555-0100',
      skills: ['React', 'Go'],
    },
    file: new File([new Uint8Array([0]).buffer as ArrayBuffer], 'my-resume.pdf', {
      type: 'application/pdf',
    }),
    ...overrides,
  };
}

describe('ImportReviewModal', () => {
  it('renders nothing when closed', () => {
    render(
      <ImportReviewModal
        open={false}
        onClose={vi.fn()}
        payload={makePayload()}
        currentProfile={DEFAULT_PROFILE}
        activePresetId="p1"
        onCommit={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the file name and field count', () => {
    render(
      <ImportReviewModal
        open={true}
        onClose={vi.fn()}
        payload={makePayload()}
        currentProfile={DEFAULT_PROFILE}
        activePresetId="p1"
        onCommit={vi.fn()}
      />,
    );
    expect(screen.getByText(/my-resume\.pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/5 fields found/i)).toBeInTheDocument();
  });

  it('shows an empty-state message when no fields were parsed', () => {
    render(
      <ImportReviewModal
        open={true}
        onClose={vi.fn()}
        payload={makePayload({ fields: {} })}
        currentProfile={DEFAULT_PROFILE}
        activePresetId="p1"
        onCommit={vi.fn()}
      />,
    );
    expect(screen.getByText(/No profile fields were found/i)).toBeInTheDocument();
  });

  it('defaults to skip-conflicts mode', () => {
    render(
      <ImportReviewModal
        open={true}
        onClose={vi.fn()}
        payload={makePayload()}
        currentProfile={DEFAULT_PROFILE}
        activePresetId="p1"
        onCommit={vi.fn()}
      />,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onCommit with selected mode and the active preset as target', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <ImportReviewModal
        open={true}
        onClose={onClose}
        payload={makePayload()}
        currentProfile={DEFAULT_PROFILE}
        activePresetId="p1"
        onCommit={onCommit}
      />,
    );

    await user.click(screen.getByRole('radio', { name: /Overwrite all/i }));
    await user.click(screen.getByRole('button', { name: /Save to profile/i }));

    expect(onCommit).toHaveBeenCalledWith({
      mode: 'overwrite-all',
      target: { kind: 'existing', presetId: 'p1' },
    });
  });

  it('marks conflicting fields with strikethrough on overwrite-all', async () => {
    const user = userEvent.setup();
    render(
      <ImportReviewModal
        open={true}
        onClose={vi.fn()}
        payload={makePayload({
          fields: { firstName: 'New', email: 'new@x.com' },
        })}
        currentProfile={{
          ...DEFAULT_PROFILE,
          firstName: 'Existing',
          email: '',
        }}
        activePresetId="p1"
        onCommit={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('radio', { name: /Overwrite all/i }));
    const existing = screen.getByText('Existing');
    expect(existing).toBeInTheDocument();
    expect(existing).toHaveClass('line-through');
  });

  it('ESC closes the modal', () => {
    const onClose = vi.fn();
    render(
      <ImportReviewModal
        open={true}
        onClose={onClose}
        payload={makePayload()}
        currentProfile={DEFAULT_PROFILE}
        activePresetId="p1"
        onCommit={vi.fn()}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

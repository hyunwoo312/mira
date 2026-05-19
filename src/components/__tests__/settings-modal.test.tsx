import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsModal } from '../settings-modal';

vi.mock('@/hooks/use-settings', () => ({
  useSettings: () => ({
    settings: {
      hideOverlay: false,
      overlayDismissMs: 8000,
      skipEeo: false,
      skipSalary: false,
      saveApplications: true,
      mlDisabled: false,
      verboseLogging: false,
    },
    update: vi.fn(),
    reset: vi.fn(),
  }),
}));

describe('SettingsModal', () => {
  const storage: Record<string, unknown> = {};

  beforeEach(() => {
    for (const key of Object.keys(storage)) delete storage[key];
    Object.assign(storage, {
      mira_fill_feedback: [
        {
          fieldLabel: 'Email',
          status: 'failed',
          pageUrl: 'https://example.com/apply',
          timestamp: '2026-05-19T12:00:00.000Z',
        },
      ],
    });
    vi.stubGlobal('chrome', {
      ...((globalThis as unknown as { chrome?: typeof chrome }).chrome ?? {}),
      runtime: {
        getManifest: () => ({ version: '0.3.0' }),
      },
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: storage[key] })),
        },
      },
    });
  });

  it('renders the version line in the header', () => {
    render(<SettingsModal open={true} onClose={vi.fn()} />);
    expect(screen.getByText(/^v0\.3\.0$/i)).toBeInTheDocument();
  });

  it('does not render the modal when closed', () => {
    render(<SettingsModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByText(/^v0\.3\.0$/i)).not.toBeInTheDocument();
  });

  it('renders the local feedback copy action', () => {
    render(<SettingsModal open={true} onClose={vi.fn()} />);

    expect(screen.getByText('Copy local feedback')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy local feedback/i })).toBeInTheDocument();
  });
});

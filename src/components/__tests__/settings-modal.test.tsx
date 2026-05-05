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
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      ...((globalThis as unknown as { chrome?: typeof chrome }).chrome ?? {}),
      runtime: {
        getManifest: () => ({ version: '0.3.0' }),
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
});

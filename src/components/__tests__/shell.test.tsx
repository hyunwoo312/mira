import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { Shell } from '../shell';
import { PROFILE_SECTIONS } from '@/types/profile';

// Mock heavy hooks to isolate component rendering
vi.mock('@/hooks/use-profile', async () => {
  const { useForm } = await import('react-hook-form');
  const { DEFAULT_PROFILE } = await import('@/lib/schema');
  return {
    useProfile: () => {
      const form = useForm({ defaultValues: DEFAULT_PROFILE });
      return {
        form,
        isLoaded: true,
        lastSaved: 0,
        presets: [{ id: '1', name: 'Default' }],
        activePresetId: '1',
        saveNow: vi.fn(),
        switchPreset: vi.fn(),
        addNewPreset: vi.fn(),
        removePreset: vi.fn(),
        rename: vi.fn(),
        exportAllData: vi.fn(),
        importData: vi.fn(),
        deleteAllData: vi.fn(),
      };
    },
  };
});

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    toggle: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-fill', () => ({
  useFill: () => ({
    isLoading: false,
    result: null,
    logs: [],
    pageUrl: '',
    fill: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-scrollspy', () => ({
  useScrollspy: () => ({
    activeSection: 'personal',
    containerRef: { current: null },
    scrollToSection: vi.fn(),
  }),
}));

describe('Shell', () => {
  it('renders profile-section tabs after loading', async () => {
    render(<Shell />);
    await waitFor(() => {
      // Two top-level Profile/Tracker tabs in BottomNav are scoped out by aria-label.
      const sectionTabs = screen
        .getAllByRole('tab')
        .filter((el) => el.closest('[aria-label="Side panel views"]') === null);
      expect(sectionTabs).toHaveLength(PROFILE_SECTIONS.length);
    });
  });

  it('renders top-level Profile and Tracker tabs', async () => {
    render(<Shell />);
    await waitFor(() => {
      const nav = screen.getByRole('tablist', { name: 'Side panel views' });
      const tabs = within(nav).getAllByRole('tab');
      expect(tabs).toHaveLength(2);
      expect(tabs[0]).toHaveTextContent(/profile/i);
      expect(tabs[1]).toHaveTextContent(/tracker/i);
    });
  });

  it('renders fill button', async () => {
    render(<Shell />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /fill/i })).toBeInTheDocument();
    });
  });

  it('renders section titles', async () => {
    render(<Shell />);
    await waitFor(() => {
      // "Personal" appears in both tab and section heading
      expect(screen.getAllByText('Personal').length).toBeGreaterThanOrEqual(1);
      // "Portfolio &" only appears in the section heading, not the tab
      expect(screen.getByText('Portfolio &')).toBeInTheDocument();
    });
  });
});

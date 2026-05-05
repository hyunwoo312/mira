import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BottomNav } from '../bottom-nav';

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn(), toggle: vi.fn() }),
}));

describe('BottomNav', () => {
  beforeEach(() => {
    vi.spyOn(chrome.storage.local, 'get').mockImplementation(
      () => Promise.resolve({}) as Promise<never>,
    );
    vi.spyOn(chrome.storage.local.onChanged, 'addListener').mockImplementation(() => {});
    vi.spyOn(chrome.storage.local.onChanged, 'removeListener').mockImplementation(() => {});
  });

  it('renders Profile and Tracker tabs', () => {
    render(<BottomNav activeTab="profile" onTabChange={vi.fn()} />);
    const nav = screen.getByRole('tablist', { name: 'Side panel views' });
    const tabs = within(nav).getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveTextContent(/profile/i);
    expect(tabs[1]).toHaveTextContent(/tracker/i);
  });

  it('marks the active tab via aria-selected', () => {
    render(<BottomNav activeTab="tracker" onTabChange={vi.fn()} />);
    const nav = screen.getByRole('tablist', { name: 'Side panel views' });
    const [profileTab, trackerTab] = within(nav).getAllByRole('tab');
    expect(profileTab).toHaveAttribute('aria-selected', 'false');
    expect(trackerTab).toHaveAttribute('aria-selected', 'true');
  });

  it('calls onTabChange when a tab is clicked', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<BottomNav activeTab="profile" onTabChange={onTabChange} />);
    const nav = screen.getByRole('tablist', { name: 'Side panel views' });
    await user.click(within(nav).getByRole('tab', { name: /tracker/i }));
    expect(onTabChange).toHaveBeenCalledWith('tracker');
  });

  it('renders the utility-icon cluster', () => {
    render(<BottomNav activeTab="profile" onTabChange={vi.fn()} />);
    expect(screen.getByLabelText('Rate this extension')).toBeInTheDocument();
    expect(screen.getByLabelText('Buy me a coffee')).toBeInTheDocument();
    expect(screen.getByLabelText('Changelog')).toBeInTheDocument();
    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });
});

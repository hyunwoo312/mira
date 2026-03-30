import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { TabBar } from '../tab-bar';
import { PROFILE_SECTIONS } from '@/types/profile';
import { DEFAULT_PROFILE } from '@/lib/schema';

function Wrapper({ children }: { children: React.ReactNode }) {
  const form = useForm({ defaultValues: DEFAULT_PROFILE });
  return <FormProvider {...form}>{children}</FormProvider>;
}

describe('TabBar', () => {
  const defaultProps = {
    activeSection: 'personal' as const,
    onTabClick: vi.fn(),
  };

  it('renders all section tabs', () => {
    render(
      <Wrapper>
        <TabBar {...defaultProps} />
      </Wrapper>,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(PROFILE_SECTIONS.length);
  });

  it('calls onTabClick with section id', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <Wrapper>
        <TabBar {...defaultProps} onTabClick={handleClick} />
      </Wrapper>,
    );

    await user.click(screen.getByText('Work'));
    expect(handleClick).toHaveBeenCalledWith('work');
  });
});

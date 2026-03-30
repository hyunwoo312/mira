import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Section } from '../section';

describe('Section', () => {
  it('renders title', () => {
    render(
      <Section id="personal" title="Personal" titleBold="Information.">
        <div>Content</div>
      </Section>,
    );
    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('Information.')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <Section id="personal" title="Personal" titleBold="Information.">
        <div>Child content</div>
      </Section>,
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('sets data-section attribute', () => {
    render(
      <Section id="work" title="Work" titleBold="Experience.">
        <div>Work content</div>
      </Section>,
    );
    const section = screen.getByText('Work').closest('[data-section]');
    expect(section).toHaveAttribute('data-section', 'work');
  });
});

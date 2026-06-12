import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App smoke', () => {
  it('renders the title screen with both game modes', () => {
    render(createElement(App));
    expect(screen.getByText('New game')).toBeInTheDocument();
    expect(screen.getByText('Play with friends')).toBeInTheDocument();
  });
});

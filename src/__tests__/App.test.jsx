import { describe, it, expect, vi } from 'vitest'

// Mock mapbox-gl since jsdom can't run WebGL
vi.mock('mapbox-gl', () => ({
  default: {
    Map: vi.fn(),
    NavigationControl: vi.fn(),
    supported: () => true,
  },
}))

// Mock react-map-gl components
vi.mock('react-map-gl', () => ({
  default: ({ children, ...props }) => <div data-testid="map" {...props}>{children}</div>,
  Source: ({ children }) => <div>{children}</div>,
  Layer: () => null,
  Popup: () => null,
}))

import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(screen.getByTestId('map')).toBeTruthy()
  })

  it('renders theme switcher buttons', () => {
    const { container } = render(<App />)
    const buttons = container.querySelectorAll('.theme-btn')
    expect(buttons.length).toBe(4)
  })

  it('renders line legend', () => {
    const { container } = render(<App />)
    const legend = container.querySelector('.line-legend')
    expect(legend).toBeTruthy()
  })
})

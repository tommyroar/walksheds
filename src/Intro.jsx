import { useState, useEffect, useRef, useCallback } from 'react'
import { markIntroSeen } from './introState'

/**
 * Intro walkthrough — fully user-paced. Every step shows Next and Exit
 * buttons; no timed transitions.
 */
export default function Intro({ controls, onClose }) {
  const [stepIdx, setStepIdx] = useState(0)
  const ranOnEnterRef = useRef(-1)

  const close = useCallback(() => {
    markIntroSeen()
    onClose()
  }, [onClose])

  const next = useCallback(() => {
    setStepIdx((i) => i + 1)
  }, [])

  const steps = [
    {
      title: 'Welcome to Walksheds',
      body: 'See how far you can walk from each Link Light Rail station. Take a quick tour?',
      primaryLabel: 'Start tour',
    },
    {
      title: 'Westlake Station',
      body: 'The center of the Link network. The colored area shows everywhere you can walk in 5 minutes.',
      onEnter: () => {
        controls.setEnabledWalksheds(new Set([5]))
        controls.selectByName('Westlake Station')
      },
    },
    {
      title: '10 minutes on foot',
      body: 'Comfortable for an errand or coffee run.',
      onEnter: () => controls.setEnabledWalksheds(new Set([5, 10])),
    },
    {
      title: '15 minutes on foot',
      body: 'Your full neighborhood reach — roughly three-quarters of a mile.',
      onEnter: () => controls.setEnabledWalksheds(new Set([5, 10, 15])),
    },
    {
      title: 'Move along the line',
      body: 'Swipe, scroll horizontally, or use the arrow keys to step between stations.',
      onEnter: () => controls.selectByName('Symphony Station'),
    },
    {
      title: 'Back to Westlake',
      body: 'You can move freely between any connected stations.',
      onEnter: () => controls.selectByName('Westlake Station'),
    },
    {
      title: 'Your turn',
      body: 'Tap any station on the map to explore its walkshed.',
      primaryLabel: 'Got it',
      isFinal: true,
      onEnter: () => controls.flyToOverview(),
    },
  ]

  const step = steps[stepIdx]
  const isFirst = stepIdx === 0
  const isFinal = !!step.isFinal

  // Run side effects when entering a step (idempotent per index)
  useEffect(() => {
    if (ranOnEnterRef.current === stepIdx) return
    ranOnEnterRef.current = stepIdx
    step.onEnter?.()
  }, [stepIdx, step])

  return (
    <div className="intro-overlay" role="dialog" aria-live="polite">
      <div className="intro-card">
        <div className="intro-progress">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`intro-progress-dot ${i === stepIdx ? 'active' : ''} ${i < stepIdx ? 'done' : ''}`}
            />
          ))}
        </div>
        <h2 className="intro-title">{step.title}</h2>
        {step.body && <p className="intro-body">{step.body}</p>}
        <div className="intro-actions">
          <button type="button" className="intro-btn intro-btn-secondary" onClick={close}>
            {isFirst ? 'Skip' : 'Exit'}
          </button>
          <button
            type="button"
            className="intro-btn intro-btn-primary"
            onClick={isFinal ? close : next}
          >
            {step.primaryLabel || 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

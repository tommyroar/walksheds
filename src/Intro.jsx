import { useState, useEffect, useRef, useCallback } from 'react'
import { markIntroSeen } from './introState'

/**
 * Intro walkthrough animation. Drives the parent app via the `controls` prop
 * to demonstrate station selection, walkshed layers, and station navigation.
 *
 * Steps auto-advance after `duration` ms. The user can skip at any time.
 */
export default function Intro({ controls, onClose }) {
  const [stepIdx, setStepIdx] = useState(0)
  const ranOnEnterRef = useRef(-1)

  const close = useCallback(() => {
    markIntroSeen()
    onClose()
  }, [onClose])

  const steps = [
    {
      title: 'Welcome to Walksheds',
      body: 'See how far you can walk from each Link Light Rail station. Take a 30-second tour?',
      duration: null, // wait for explicit Start
      primary: { label: 'Start tour', action: () => setStepIdx(1) },
      secondary: { label: 'Skip', action: close },
    },
    {
      title: 'Westlake Station',
      body: 'This is Westlake — the center of the Link network. The colored areas around a station show how far you can walk in 5, 10, or 15 minutes.',
      duration: 4500,
      onEnter: () => {
        controls.setEnabledWalksheds(new Set())
        controls.selectByName('Westlake Station')
      },
    },
    {
      title: '5 minutes on foot',
      body: 'Your immediate block — about a quarter mile.',
      duration: 2800,
      onEnter: () => controls.setEnabledWalksheds(new Set([5])),
    },
    {
      title: '10 minutes on foot',
      body: 'Comfortable for an errand or coffee run.',
      duration: 2800,
      onEnter: () => controls.setEnabledWalksheds(new Set([5, 10])),
    },
    {
      title: '15 minutes on foot',
      body: 'Your full neighborhood reach — roughly three-quarters of a mile.',
      duration: 3000,
      onEnter: () => controls.setEnabledWalksheds(new Set([5, 10, 15])),
    },
    {
      title: 'Move along the line',
      body: 'Swipe, scroll horizontally, or use the arrow keys to step between stations.',
      duration: 3200,
      onEnter: () => controls.selectByName('Symphony Station'),
    },
    {
      title: 'Back to Westlake',
      body: '',
      duration: 2200,
      onEnter: () => controls.selectByName('Westlake Station'),
    },
    {
      title: 'Your turn',
      body: 'Tap any station on the map to explore its walkshed.',
      duration: null,
      onEnter: () => controls.flyToOverview(),
      primary: { label: 'Got it', action: close },
    },
  ]

  const step = steps[stepIdx]

  // Run side effects when entering a step (idempotent per index)
  useEffect(() => {
    if (ranOnEnterRef.current === stepIdx) return
    ranOnEnterRef.current = stepIdx
    step.onEnter?.()
  }, [stepIdx, step])

  // Auto-advance after duration
  useEffect(() => {
    if (step.duration == null) return
    const t = setTimeout(() => {
      setStepIdx((i) => (i + 1 < steps.length ? i + 1 : i))
    }, step.duration)
    return () => clearTimeout(t)
  }, [stepIdx, step.duration, steps.length])

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
          {step.secondary && (
            <button type="button" className="intro-btn intro-btn-secondary" onClick={step.secondary.action}>
              {step.secondary.label}
            </button>
          )}
          {step.primary ? (
            <button type="button" className="intro-btn intro-btn-primary" onClick={step.primary.action}>
              {step.primary.label}
            </button>
          ) : (
            <button type="button" className="intro-btn intro-btn-secondary" onClick={close}>
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

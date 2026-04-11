import { useState, useEffect, useRef, useCallback } from 'react'
import { markIntroSeen } from './introState'

/**
 * Intro walkthrough animation. Drives the parent app via the `controls` prop
 * to demonstrate station selection, walkshed layers, and station navigation.
 *
 * Steps auto-advance after `duration` ms once any `waitFor` predicate is true.
 * The user can skip at any time.
 */
export default function Intro({ controls, walkshedsReady, onClose }) {
  const [stepIdx, setStepIdx] = useState(0)
  const ranOnEnterRef = useRef(-1)

  const close = useCallback(() => {
    markIntroSeen()
    onClose()
  }, [onClose])

  const steps = [
    {
      title: 'Welcome to Walksheds',
      body: 'See how far you can walk from each Link Light Rail station. Take a quick tour?',
      primary: { label: 'Start tour', action: () => setStepIdx(1) },
      secondary: { label: 'Skip', action: close },
    },
    {
      title: 'Westlake Station',
      body: 'The center of the Link network. The colored area shows everywhere you can walk in 5 minutes.',
      duration: 3000,
      waitForWalksheds: true,
      onEnter: () => {
        // Pre-select walkshed=5 so the layer renders the moment the fetch resolves
        controls.setEnabledWalksheds(new Set([5]))
        controls.selectByName('Westlake Station')
      },
    },
    {
      title: '10 minutes on foot',
      body: 'Comfortable for an errand or coffee run.',
      duration: 2500,
      onEnter: () => controls.setEnabledWalksheds(new Set([5, 10])),
    },
    {
      title: '15 minutes on foot',
      body: 'Your full neighborhood reach — roughly three-quarters of a mile.',
      duration: 2500,
      onEnter: () => controls.setEnabledWalksheds(new Set([5, 10, 15])),
    },
    {
      title: 'Move along the line',
      body: 'Swipe, scroll horizontally, or use the arrow keys to step between stations.',
      duration: 2500,
      onEnter: () => controls.selectByName('Symphony Station'),
    },
    {
      title: 'Back to Westlake',
      body: '',
      duration: 1800,
      onEnter: () => controls.selectByName('Westlake Station'),
    },
    {
      title: 'Your turn',
      body: 'Tap any station on the map to explore its walkshed.',
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

  // Auto-advance after duration. If the step is waiting on walkshed data,
  // delay arming the normal timer until walkshedsReady becomes true; meanwhile
  // a longer fallback timer guarantees the intro can't get permastuck if a
  // fetch fails.
  useEffect(() => {
    if (step.duration == null) return
    const advance = () => setStepIdx((i) => (i + 1 < steps.length ? i + 1 : i))
    if (step.waitForWalksheds && !walkshedsReady) {
      const fallback = setTimeout(advance, 8000)
      return () => clearTimeout(fallback)
    }
    const t = setTimeout(advance, step.duration)
    return () => clearTimeout(t)
  }, [stepIdx, step.duration, step.waitForWalksheds, walkshedsReady, steps.length])

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

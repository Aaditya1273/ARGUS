'use client'

import { useRef, useCallback, useState } from 'react'

interface MagneticState {
  rotateX: number
  rotateY: number
  shimmerAngle: number
  hue: number
}

/**
 * useMagneticTilt – Precise 3D rotation following cursor position.
 * Returns ref to attach to any element + style to spread onto it.
 * 
 * Usage:
 *   const { ref, style } = useMagneticTilt(12) // max 12deg tilt
 *   <div ref={ref} style={style} />
 */
export function useMagneticTilt(maxDeg = 10) {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({})

  const handleMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    const rotateY = x * maxDeg
    const rotateX = -y * maxDeg
    setStyle({ transform: `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)` })
  }, [maxDeg])

  const handleLeave = useCallback(() => {
    setStyle({ transform: 'perspective(800px) rotateX(0deg) rotateY(0deg)', transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' })
  }, [])

  return { ref, handlers: { onMouseMove: handleMove, onMouseLeave: handleLeave }, style }
}

/**
 * useShimmer – Holographic conic-gradient sweep that follows cursor.
 * Updates --shimmer-angle CSS custom property on the element.
 * 
 * Usage:
 *   const shimmerRef = useShimmer()
 *   <div ref={shimmerRef} className="shimmer-card" />
 */
export function useShimmer() {
  const ref = useRef<HTMLDivElement>(null)

  const handleMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    const angle = Math.atan2(y - 0.5, x - 0.5) * (180 / Math.PI) + 90
    el.style.setProperty('--shimmer-angle', `${angle}deg`)
  }, [])

  return { ref, handlers: { onMouseMove: handleMove } }
}

/**
 * useIridescent – HSL hue tracking cursor position.
 * Updates --iridescent-hue on the element.
 * 
 * Usage:
 *   const iriRef = useIridescent()
 *   <div ref={iriRef} className="iridescent-edge" />
 */
export function useIridescent() {
  const ref = useRef<HTMLDivElement>(null)

  const handleMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const hue = 200 + x * 120 // 200° to 320° range
    el.style.setProperty('--iridescent-hue', `${hue}`)
  }, [])

  return { ref, handlers: { onMouseMove: handleMove } }
}

/**
 * useRipple – Creates a ripple burst from click position.
 * Returns ref + handler to attach to any element.
 * 
 * Usage:
 *   const { ref, handleClick } = useRipple()
 *   <div ref={ref} onClick={handleClick} className="ripple-container" />
 */
export function useRipple() {
  const ref = useRef<HTMLDivElement>(null)

  const handleClick = useCallback((e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const ripple = document.createElement('span')
    ripple.className = 'ripple'
    ripple.style.left = `${x}px`
    ripple.style.top = `${y}px`
    ripple.style.width = '20px'
    ripple.style.height = '20px'
    ripple.style.marginLeft = '-10px'
    ripple.style.marginTop = '-10px'
    el.appendChild(ripple)
    ripple.addEventListener('animationend', () => ripple.remove())
  }, [])

  return { ref, handleClick }
}

/**
 * calculateDepthStyle – Returns translateZ transforms for parallax layers.
 * 
 * Usage:
 *   const depth = calculateDepthStyle(mouseX, mouseY, 20)
 *   // depth.icon => { transform: 'translateX(-2px) translateY(3px)' }
 */
export function calculateDepthStyle(
  mouseX: number,
  mouseY: number,
  intensity = 15
): Record<string, React.CSSProperties> {
  return {
    bg:     { transform: `translate(${mouseX * -intensity * 0.3}px, ${mouseY * -intensity * 0.3}px)` },
    icon:   { transform: `translate(${mouseX * intensity * 0.5}px, ${mouseY * intensity * 0.5}px)` },
    title:  { transform: `translate(${mouseX * intensity * 0.3}px, ${mouseY * intensity * 0.3}px)` },
    desc:   { transform: `translate(${mouseX * intensity * 0.1}px, ${mouseY * intensity * 0.1}px)` },
  }
}

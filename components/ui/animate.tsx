'use client'

import { motion } from 'framer-motion'

export function FadeIn({
  children, delay = 0, duration = 0.4, className,
}: {
  children: React.ReactNode; delay?: number; duration?: number; className?: string
}) {
  return (
    <motion.div
      initial={{ y: 8 }}
      animate={{ y: 0 }}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function ScaleIn({
  children, delay = 0, className,
}: {
  children: React.ReactNode; delay?: number; className?: string
}) {
  return (
    <motion.div
      initial={{ scale: 0.97 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

const slideDirections = {
  bottom: { y: 20, x: 0 },
  top:    { y: -20, x: 0 },
  left:   { x: -20, y: 0 },
  right:  { x: 20, y: 0 },
}

export function SlideIn({
  children, from = 'bottom', delay = 0, className,
}: {
  children: React.ReactNode; from?: keyof typeof slideDirections; delay?: number; className?: string
}) {
  return (
    <motion.div
      initial={{ ...slideDirections[from] }}
      animate={{ x: 0, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function Stagger({
  children, staggerDelay = 0.08, className,
}: {
  children: React.ReactNode; staggerDelay?: number; className?: string
}) {
  return (
    // Children animate themselves on mount, so items loaded or added later never stay hidden
    <motion.div
      variants={{ show: { transition: { staggerChildren: staggerDelay } } }}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children, className,
}: {
  children: React.ReactNode; className?: string
}) {
  return (
    <motion.div
      variants={{
        hidden: { y: 16 },
        show: { y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
      }}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function HoverLift({
  children, className,
}: {
  children: React.ReactNode; className?: string
}) {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: 'var(--shadow-lg)' }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function PressScale({
  children, className,
}: {
  children: React.ReactNode; className?: string
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function SkeletonPulse({ className }: { className?: string }) {
  return (
    <motion.div
      animate={{ opacity: [0.4, 1, 0.4] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      className={`rounded-md bg-muted ${className ?? ''}`}
    />
  )
}

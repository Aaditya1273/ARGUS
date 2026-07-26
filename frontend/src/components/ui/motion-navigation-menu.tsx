"use client"

import * as React from "react"
import { cva } from "class-variance-authority"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type Spring = {
  type: "spring"
  stiffness?: number
  damping?: number
  bounce: number
}

type ContentRecord = {
  children: React.ReactNode
  className?: string
  innerClassName?: string
}

type MotionNavigationMenuContextValue = {
  activeValue: string
  direction: number
  spring: Spring
  viewport: boolean
  viewportX: number | null
  openValue: (value: string) => void
  closeMenu: () => void
  registerContent: (value: string, content: ContentRecord) => () => void
  updateViewportPosition: () => void
}

type MotionNavigationMenuItemContextValue = {
  value?: string
}

const MotionNavigationMenuContext =
  React.createContext<MotionNavigationMenuContextValue | null>(null)

const MotionNavigationMenuItemContext =
  React.createContext<MotionNavigationMenuItemContextValue | null>(null)

const contentVariants = {
  initial: (direction: number) => ({ x: `${100 * direction}%`, opacity: 0 }),
  active: { x: "0%", opacity: 1 },
  exit: (direction: number) => ({ x: `${-100 * direction}%`, opacity: 0 }),
}

type MotionNavigationMenuProps = Omit<
  React.ComponentPropsWithRef<"nav">,
  "onValueChange"
> & {
  viewport?: boolean
  viewportClassName?: string
  springBounce?: number
  springStiffness?: number
  springDamping?: number
  value?: string
  onValueChange?: (value: string) => void
}

function MotionNavigationMenu({
  className,
  children,
  viewport = true,
  viewportClassName,
  springBounce = 0,
  springStiffness = 350,
  springDamping = 32,
  value,
  onValueChange,
  onPointerLeave,
  onKeyDown,
  ref,
  ...props
}: MotionNavigationMenuProps) {
  const rootRef = React.useRef<HTMLElement | null>(null)
  const frameRef = React.useRef<number | null>(null)
  const lastActiveValueRef = React.useRef(value ?? "")
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = React.useState("")
  const [direction, setDirection] = React.useState(1)
  const [viewportX, setViewportX] = React.useState<number | null>(null)
  const [contentByValue, setContentByValue] = React.useState<
    Record<string, ContentRecord>
  >({})

  const activeValue = value ?? internalValue

  const spring = React.useMemo(
    () => ({
      type: "spring" as const,
      bounce: springBounce,
      stiffness: springStiffness,
      damping: springDamping,
    }),
    [springBounce, springStiffness, springDamping],
  )

  const getItemValues = React.useCallback(() => {
    const root = rootRef.current
    if (!root) return []
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        '[data-slot="navigation-menu-item"][data-value]',
      ),
      (item) => item.dataset.value ?? "",
    ).filter(Boolean)
  }, [])

  const updateViewportPosition = React.useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      const root = rootRef.current
      if (!root) return
      const rootRect = root.getBoundingClientRect()
      const activeTrigger = root.querySelector<HTMLElement>(
        '[data-slot="navigation-menu-trigger"][data-state="open"]',
      )
      if (!activeTrigger) {
        setViewportX(rootRect.width / 2)
        return
      }
      const triggerRect = activeTrigger.getBoundingClientRect()
      const idealX = triggerRect.left - rootRect.left + triggerRect.width / 2
      const viewportEl = root.querySelector<HTMLElement>(
        '[data-slot="navigation-menu-viewport"]',
      )
      const contentWidth = viewportEl ? viewportEl.offsetWidth : 0
      const half = contentWidth / 2

      if (contentWidth > 0) {
        let boundary: DOMRect | null = null
        let ancestor = root.parentElement
        while (ancestor && ancestor !== document.body) {
          const style = window.getComputedStyle(ancestor)
          const overflow = style.overflow + style.overflowX
          if (/hidden|clip|scroll|auto/.test(overflow)) {
            boundary = ancestor.getBoundingClientRect()
            break
          }
          ancestor = ancestor.parentElement
        }
        if (!boundary) {
          boundary = document.documentElement.getBoundingClientRect()
        }
        const margin = 8
        const dropLeft = rootRect.left + idealX - half
        const dropRight = rootRect.left + idealX + half
        let adjustment = 0
        if (dropLeft < boundary.left + margin) {
          adjustment = boundary.left + margin - dropLeft
        } else if (dropRight > boundary.right - margin) {
          adjustment = boundary.right - margin - dropRight
        }
        setViewportX(idealX + adjustment)
      } else {
        setViewportX(idealX)
      }
    })
  }, [])

  const setRootRef = React.useCallback(
    (node: HTMLElement | null) => {
      rootRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )

  const setActiveValue = React.useCallback(
    (nextValue: string) => {
      if (!isControlled) setInternalValue(nextValue)
      onValueChange?.(nextValue)
    },
    [isControlled, onValueChange],
  )

  const openValue = React.useCallback(
    (nextValue: string) => {
      if (!nextValue || nextValue === lastActiveValueRef.current) return
      const itemValues = getItemValues()
      const previousIndex = itemValues.indexOf(lastActiveValueRef.current)
      const nextIndex = itemValues.indexOf(nextValue)
      if (previousIndex !== -1 && nextIndex !== -1) {
        setDirection(nextIndex > previousIndex ? 1 : -1)
      }
      lastActiveValueRef.current = nextValue
      setActiveValue(nextValue)
      updateViewportPosition()
    },
    [getItemValues, setActiveValue, updateViewportPosition],
  )

  const closeMenu = React.useCallback(() => {
    lastActiveValueRef.current = ""
    setActiveValue("")
    updateViewportPosition()
  }, [setActiveValue, updateViewportPosition])

  const registerContent = React.useCallback(
    (value: string, content: ContentRecord) => {
      setContentByValue((current) => {
        const previous = current[value]
        if (
          previous?.children === content.children &&
          previous?.className === content.className &&
          previous?.innerClassName === content.innerClassName
        ) {
          return current
        }
        return { ...current, [value]: content }
      })
      return () => {
        setContentByValue((current) => {
          if (!current[value]) return current
          const next = { ...current }
          delete next[value]
          return next
        })
      }
    },
    [],
  )

  React.useEffect(() => {
    if (value === undefined) return
    if (!value) {
      lastActiveValueRef.current = ""
      return
    }
    openValue(value)
  }, [openValue, value])

  React.useLayoutEffect(() => {
    updateViewportPosition()
  }, [activeValue, updateViewportPosition])

  React.useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || typeof ResizeObserver === "undefined") {
      return () => {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      }
    }
    const observer = new ResizeObserver(updateViewportPosition)
    observer.observe(root)
    return () => {
      observer.disconnect()
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [updateViewportPosition])

  React.useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        closeMenu()
      }
    }
    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [closeMenu])

  const contextValue = React.useMemo(
    () => ({
      activeValue,
      direction,
      spring,
      viewport,
      viewportX,
      openValue,
      closeMenu,
      registerContent,
      updateViewportPosition,
    }),
    [
      activeValue, closeMenu, direction, openValue,
      registerContent, spring, updateViewportPosition,
      viewport, viewportX,
    ],
  )

  return (
    <MotionNavigationMenuContext.Provider value={contextValue}>
      <nav
        ref={setRootRef}
        data-slot="navigation-menu"
        data-viewport={viewport}
        className={cn(
          "group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
          className,
        )}
        onPointerLeave={(event) => {
          onPointerLeave?.(event)
          closeMenu()
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.key === "Escape") closeMenu()
        }}
        {...props}
      >
        {children}
        {viewport && (
          <MotionNavigationMenuViewport
            className={viewportClassName}
            contentByValue={contentByValue}
          />
        )}
      </nav>
    </MotionNavigationMenuContext.Provider>
  )
}

function MotionNavigationMenuList({
  className,
  ...props
}: React.ComponentPropsWithRef<"ul">) {
  return (
    <ul
      data-slot="navigation-menu-list"
      className={cn(
        "group relative z-10 flex flex-1 list-none items-center justify-center gap-1",
        className,
      )}
      {...props}
    />
  )
}

function MotionNavigationMenuItem({
  className,
  value,
  ...props
}: React.ComponentPropsWithRef<"li"> & {
  value?: string
}) {
  const itemContextValue = React.useMemo(() => ({ value }), [value])
  return (
    <MotionNavigationMenuItemContext.Provider value={itemContextValue}>
      <li
        data-slot="navigation-menu-item"
        data-value={value}
        className={cn("relative", className)}
        {...props}
      />
    </MotionNavigationMenuItemContext.Provider>
  )
}

const motionNavigationMenuTriggerStyle = cva(
  "group inline-flex h-9 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium transition-colors",
)

function MotionNavigationMenuTrigger({
  className,
  children,
  onPointerEnter,
  onFocus,
  onClick,
  ...props
}: React.ComponentPropsWithRef<"button">) {
  const context = React.useContext(MotionNavigationMenuContext)
  const itemContext = React.useContext(MotionNavigationMenuItemContext)
  const value = itemContext?.value
  const isOpen = !!value && context?.activeValue === value

  return (
    <button
      type="button"
      data-slot="navigation-menu-trigger"
      data-state={isOpen ? "open" : "closed"}
      aria-expanded={isOpen}
      className={cn(motionNavigationMenuTriggerStyle(), "group relative", className)}
      onPointerEnter={(event) => {
        onPointerEnter?.(event)
        if (value) context?.openValue(value)
      }}
      onFocus={(event) => {
        onFocus?.(event)
        if (value) context?.openValue(value)
      }}
      onClick={(event) => {
        onClick?.(event)
        if (value) context?.openValue(value)
      }}
      {...props}
    >
      {children}{" "}
      <motion.span
        aria-hidden="true"
        animate={{ rotate: isOpen ? 180 : 0, y: isOpen ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="relative top-0 ml-1.5 inline-flex"
      >
        <ChevronDownIcon className="size-3.5 stroke-2.5" aria-hidden="true" />
      </motion.span>
      {/* Orange accent line — appears on hover and stays open when active */}
      <span
        aria-hidden="true"
        className="absolute -bottom-px left-1/2 -translate-x-1/2 h-[2px] rounded-full bg-[#FF6B00] origin-center transition-all duration-200 ease-out scale-x-0 group-hover:scale-x-100 group-data-[state=open]:scale-x-100"
        style={{ width: 'calc(100% - 24px)' }}
      />
    </button>
  )
}

function MotionNavigationMenuContent({
  className,
  innerClassName,
  children,
}: React.ComponentPropsWithRef<"div"> & {
  innerClassName?: string
}) {
  const context = React.useContext(MotionNavigationMenuContext)
  const itemContext = React.useContext(MotionNavigationMenuItemContext)
  const value = itemContext?.value
  const isOpen = !!value && context?.activeValue === value

  React.useLayoutEffect(() => {
    if (!context || !value || !context.viewport) return
    return context.registerContent(value, {
      children,
      className,
      innerClassName,
    })
  }, [children, className, context, innerClassName, value])

  if (!context || !value || context.viewport) return null

  return (
    <AnimatePresence initial={false} custom={context.direction}>
      {isOpen && (
        <motion.div
          data-slot="navigation-menu-content"
          key={value}
          custom={context.direction}
          variants={contentVariants}
          initial="initial"
          animate="active"
          exit="exit"
          transition={context.spring}
          className={cn(
            "bg-white/95 backdrop-blur-xl text-gray-900 absolute top-full left-0 z-50 mt-1.5 rounded-xl border border-gray-200/80 shadow-[0_8px_32px_rgba(0,0,0,0.08)] p-2 pr-2.5",
            className,
          )}
        >
          <div className={cn("relative z-10", innerClassName)}>
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function MotionNavigationMenuViewport({
  className,
  contentByValue,
}: React.ComponentPropsWithRef<"div"> & {
  contentByValue?: Record<string, ContentRecord>
}) {
  const context = React.useContext(MotionNavigationMenuContext)
  const measureRef = React.useRef<HTMLDivElement | null>(null)
  const [size, setSize] = React.useState({ width: 0, height: 0 })
  const [lastSize, setLastSize] = React.useState({ width: 0, height: 0 })
  const activeContent =
    context?.activeValue && contentByValue
      ? contentByValue[context.activeValue]
      : undefined

  React.useLayoutEffect(() => {
    const node = measureRef.current
    if (!node || !activeContent) return
    const updateSize = () => {
      const rect = node.getBoundingClientRect()
      const nextSize = { width: rect.width, height: rect.height }
      setSize(nextSize)
      if (nextSize.width > 0 || nextSize.height > 0) setLastSize(nextSize)
      context?.updateViewportPosition()
    }
    updateSize()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(updateSize)
    observer.observe(node)
    return () => observer.disconnect()
  }, [activeContent, context])

  const width = size.width > 0 ? size.width : lastSize.width
  const height = size.height > 0 ? size.height : lastSize.height

  return (
    <motion.div
      className="absolute top-full isolate z-50 flex -translate-x-1/2 justify-center"
      initial={false}
      animate={{ left: context?.viewportX ?? "50%" }}
      transition={context?.spring}
    >
      <motion.div
        data-slot="navigation-menu-viewport"
        initial={false}
        animate={{
          width: activeContent ? width : 0,
          height: activeContent ? height : 0,
          opacity: activeContent ? 1 : 0,
          scale: activeContent ? 1 : 0.95,
        }}
        transition={context?.spring}
        className={cn(
          "bg-white/95 backdrop-blur-xl text-gray-900 relative mt-1.5 overflow-hidden rounded-xl border border-gray-200/80 shadow-[0_8px_32px_rgba(0,0,0,0.08)]",
          className,
        )}
      >
        <AnimatePresence mode="popLayout" initial={false} custom={context?.direction ?? 1}>
          {activeContent && context?.activeValue && (
            <motion.div
              data-slot="navigation-menu-content"
              key={context.activeValue}
              custom={context.direction}
              variants={contentVariants}
              initial="initial"
              animate="active"
              exit="exit"
              transition={context.spring}
              className={cn("p-2 pr-2.5", activeContent.className)}
            >
              <div className={cn("relative z-10", activeContent.innerClassName)}>
                {activeContent.children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div
        ref={measureRef}
        aria-hidden="true"
        data-slot="navigation-menu-measure"
        className="pointer-events-none invisible absolute top-1.5 left-0 w-max"
      >
        {activeContent && (
          <div className={cn("p-2 pr-2.5", activeContent.className)}>
            <div className={cn("relative z-10", activeContent.innerClassName)}>
              {activeContent.children}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function MotionNavigationMenuLink({
  className,
  ...props
}: React.ComponentPropsWithRef<"a">) {
  return (
    <a
      data-slot="navigation-menu-link"
      className={cn(
        "flex flex-col gap-1 rounded-lg p-2.5 text-sm transition-all duration-150 outline-none hover:bg-orange-light [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

function MotionNavigationMenuIndicator({
  className,
  ...props
}: React.ComponentPropsWithRef<"div">) {
  return (
    <div
      data-slot="navigation-menu-indicator"
      className={cn(
        "pointer-events-none top-full z-1 flex h-1.5 items-end justify-center overflow-hidden",
        className,
      )}
      {...props}
    >
      <div className="bg-gray-200 relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm shadow-md" />
    </div>
  )
}

export {
  MotionNavigationMenu,
  MotionNavigationMenuList,
  MotionNavigationMenuItem,
  MotionNavigationMenuContent,
  MotionNavigationMenuTrigger,
  MotionNavigationMenuLink,
  MotionNavigationMenuViewport,
  MotionNavigationMenuIndicator,
  motionNavigationMenuTriggerStyle,
}

export default MotionNavigationMenu

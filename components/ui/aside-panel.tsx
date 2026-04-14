import { ArrowLeft, MoreVertical, X } from 'lucide-react';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { ScrollArea } from './scroll-area';

// Types
interface AsideContentItem {
    id: string;
    title: string;
    subtitle?: string;
    actions?: ReactNode;
    content: ReactNode;
}

interface AsidePanelContextType {
    push: (item: AsideContentItem) => void;
    pop: () => void;
    replace: (item: AsideContentItem) => void;
    clear: () => void;
    canGoBack: boolean;
    currentItem: AsideContentItem | null;
}

const AsidePanelContext = createContext<AsidePanelContextType | null>(null);

export const useAsidePanel = () => {
    const context = useContext(AsidePanelContext);
    if (!context) {
        throw new Error('useAsidePanel must be used within an AsidePanel');
    }
    return context;
};

// Props
interface AsidePanelProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    actions?: ReactNode;
    showBackButton?: boolean;
    onBack?: () => void;
    children: ReactNode;
    className?: string;
    width?: string;
    layout?: AsidePanelLayout;
    /**
     * Optional stable identifier emitted as `data-section` on the panel
     * root. Used as a targeting hook for Custom CSS (Settings → Appearance).
     */
    dataSection?: string;
    disableInitialInlineAnimation?: boolean;
    onInlineAnimationStateChange?: InlinePanelAnimationStateChange;
}

interface AsidePanelHeaderProps {
    title: string;
    subtitle?: string;
    actions?: ReactNode;
    onBack?: () => void;
    onClose: () => void;
    showBackButton?: boolean;
}

// Header Component
export const AsidePanelHeader: React.FC<AsidePanelHeaderProps> = ({
    title,
    subtitle,
    actions,
    onBack,
    onClose,
    showBackButton = false,
}) => {
    return (
        <div className="px-4 py-3 flex items-center justify-between border-b border-border/60 app-no-drag shrink-0">
            <div className="flex items-center gap-2 min-w-0">
                {showBackButton && onBack && (
                    <button
                        onClick={onBack}
                        className="p-1 hover:bg-muted rounded-md transition-colors cursor-pointer shrink-0"
                    >
                        <ArrowLeft size={18} />
                    </button>
                )}
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold truncate">{title}</h3>
                    {subtitle && (
                        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                {actions}
                <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-muted rounded-md transition-colors cursor-pointer"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
};

// Content Component (wraps children with scroll)
export const AsidePanelContent: React.FC<{ children: ReactNode; className?: string }> = ({
    children,
    className,
}) => {
    return (
        <ScrollArea className={cn("flex-1 min-w-0 [&>[data-radix-scroll-area-viewport]>div]:!block [&>[data-radix-scroll-area-viewport]>div]:!min-w-0", className)}>
            <div className="p-4 space-y-4 min-w-0 overflow-hidden">
                {children}
            </div>
        </ScrollArea>
    );
};

// Footer Component
export const AsidePanelFooter: React.FC<{ children: ReactNode; className?: string }> = ({
    children,
    className,
}) => {
    return (
        <div className={cn("px-4 py-3 border-t border-border/60 shrink-0", className)}>
            {children}
        </div>
    );
};

// Action Menu Component (for the ... button)
interface AsideActionMenuProps {
    children: ReactNode;
}

export const AsideActionMenu: React.FC<AsideActionMenuProps> = ({ children }) => {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className="p-1.5 hover:bg-muted rounded-md transition-colors cursor-pointer">
                    <MoreVertical size={18} />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-1" align="end">
                {children}
            </PopoverContent>
        </Popover>
    );
};

// Action Menu Item
export const AsideActionMenuItem: React.FC<{
    icon?: ReactNode;
    children: ReactNode;
    onClick?: () => void;
    variant?: 'default' | 'destructive';
}> = ({ icon, children, onClick, variant = 'default' }) => {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors cursor-pointer",
                variant === 'destructive'
                    ? "text-destructive hover:bg-destructive/10"
                    : "hover:bg-muted"
            )}
        >
            {icon}
            {children}
        </button>
    );
};

// Main Panel Component with Stack Support
interface AsidePanelStackProps {
    open: boolean;
    onClose: () => void;
    initialItem: AsideContentItem;
    className?: string;
    width?: string;
    layout?: AsidePanelLayout;
    /**
     * Optional stable identifier emitted as `data-section` on the panel
     * root. Used as a targeting hook for Custom CSS.
     */
    dataSection?: string;
    disableInitialInlineAnimation?: boolean;
    onInlineAnimationStateChange?: InlinePanelAnimationStateChange;
}

export type AsidePanelLayout = 'overlay' | 'inline';
export const INLINE_ASIDE_PANEL_ANIMATION_MS = 1100;
export const DEFAULT_INLINE_ASIDE_PANEL_WIDTH_PX = 380;
export type InlinePanelAnimationState = 'opening' | 'open' | 'closing' | 'closed';
export type InlinePanelAnimationStateChange = (state: InlinePanelAnimationState) => void;

const INLINE_PANEL_TRANSITION_FALLBACK_MS = INLINE_ASIDE_PANEL_ANIMATION_MS + 80;
const INLINE_PANEL_CLOSE_UNMOUNT_DELAY_MS = 180;

const useInlinePanelPresence = (
    open: boolean,
    layout: AsidePanelLayout,
    disableInitialInlineAnimation = false,
    onInlineAnimationStateChange?: InlinePanelAnimationStateChange,
) => {
    const isInline = layout === 'inline';
    const [isMounted, setIsMounted] = useState(open);
    const [inlinePhase, setInlinePhase] = useState<InlinePanelAnimationState>(() => {
        if (!isInline) {
            return open ? 'open' : 'closed';
        }
        return open ? (disableInitialInlineAnimation ? 'open' : 'opening') : 'closed';
    });
    const isMountedRef = useRef(isMounted);
    const inlinePhaseRef = useRef(inlinePhase);
    const openRef = useRef(false);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const visualRef = useRef<HTMLDivElement | null>(null);
    const visualTransitionFallbackTimeoutRef = useRef<number | null>(null);
    const closeUnmountTimeoutRef = useRef<number | null>(null);
    const lastReportedStateRef = useRef<InlinePanelAnimationState | null>(null);

    const clearVisualTransitionFallback = useCallback(() => {
        if (visualTransitionFallbackTimeoutRef.current !== null) {
            window.clearTimeout(visualTransitionFallbackTimeoutRef.current);
            visualTransitionFallbackTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        isMountedRef.current = isMounted;
    }, [isMounted]);

    useEffect(() => {
        inlinePhaseRef.current = inlinePhase;
    }, [inlinePhase]);

    const clearCloseUnmountDelay = useCallback(() => {
        if (closeUnmountTimeoutRef.current !== null) {
            window.clearTimeout(closeUnmountTimeoutRef.current);
            closeUnmountTimeoutRef.current = null;
        }
    }, []);

    const emitState = useCallback((state: InlinePanelAnimationState) => {
        if (lastReportedStateRef.current === state) {
            return;
        }
        lastReportedStateRef.current = state;
        onInlineAnimationStateChange?.(state);
    }, [onInlineAnimationStateChange]);

    const finishInlineTransition = useCallback((nextState: 'open' | 'closed') => {
        clearVisualTransitionFallback();
        if (nextState === 'open') {
            clearCloseUnmountDelay();
            setInlinePhase('open');
            emitState('open');
            return;
        }

        setInlinePhase('closed');
        emitState('closed');
        clearCloseUnmountDelay();
        closeUnmountTimeoutRef.current = window.setTimeout(() => {
            setIsMounted(false);
            closeUnmountTimeoutRef.current = null;
        }, INLINE_PANEL_CLOSE_UNMOUNT_DELAY_MS);
    }, [clearCloseUnmountDelay, clearVisualTransitionFallback, emitState]);

    useEffect(() => {
        const wasOpen = openRef.current;
        openRef.current = open;

        if (!isInline) {
            clearCloseUnmountDelay();
            setIsMounted(open);
            setInlinePhase(open ? 'open' : 'closed');
            emitState(open ? 'open' : 'closed');
            return;
        }

        let frameId: number | null = null;

        if (open) {
            clearCloseUnmountDelay();
            setIsMounted(true);
            if (
                disableInitialInlineAnimation ||
                (wasOpen && inlinePhaseRef.current === 'open')
            ) {
                setInlinePhase('open');
                emitState('open');
                return;
            }
            setInlinePhase('opening');
            emitState('opening');
            frameId = window.requestAnimationFrame(() => {
                setInlinePhase('open');
                clearVisualTransitionFallback();
                visualTransitionFallbackTimeoutRef.current = window.setTimeout(() => {
                    finishInlineTransition('open');
                }, INLINE_PANEL_TRANSITION_FALLBACK_MS);
            });
        } else if (isMountedRef.current) {
            setInlinePhase('closing');
            emitState('closing');
            clearVisualTransitionFallback();
            visualTransitionFallbackTimeoutRef.current = window.setTimeout(() => {
                finishInlineTransition('closed');
            }, INLINE_PANEL_TRANSITION_FALLBACK_MS);
        }

        return () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }
        };
    }, [
        clearCloseUnmountDelay,
        clearVisualTransitionFallback,
        disableInitialInlineAnimation,
        emitState,
        finishInlineTransition,
        isInline,
        open,
    ]);

    useEffect(() => {
        if (!isInline) {
            return;
        }

        const panelEl = panelRef.current;
        if (!panelEl || !isMounted) {
            return;
        }

        const handleTransitionEnd = (event: TransitionEvent) => {
            if (
                event.target !== panelEl ||
                event.propertyName !== 'width'
            ) {
                return;
            }

            finishInlineTransition(open ? 'open' : 'closed');
        };

        panelEl.addEventListener('transitionend', handleTransitionEnd);
        return () => {
            panelEl.removeEventListener('transitionend', handleTransitionEnd);
        };
    }, [finishInlineTransition, isInline, isMounted, open]);

    useEffect(() => () => {
        clearVisualTransitionFallback();
        clearCloseUnmountDelay();
    }, [clearCloseUnmountDelay, clearVisualTransitionFallback]);

    return {
        isMounted: isInline ? isMounted : open,
        dataState: isInline ? (inlinePhase === 'open' ? 'open' : 'closed') : undefined,
        inlinePhase: isInline ? inlinePhase : (open ? 'open' : 'closed'),
        panelRef,
        visualRef,
    };
};

const resolveInlineWidth = (width: string) => {
    const arbitraryWidthMatch = width.match(/w-\[(.+)\]/);
    if (arbitraryWidthMatch) {
        return arbitraryWidthMatch[1];
    }

    switch (width) {
        case 'w-full':
            return '100%';
        case 'w-screen':
            return '100vw';
        default:
            return `${DEFAULT_INLINE_ASIDE_PANEL_WIDTH_PX}px`;
    }
};

export const AsidePanelStack: React.FC<AsidePanelStackProps> = ({
    open,
    onClose,
    initialItem,
    className,
    width = 'w-[380px]',
    layout = 'overlay',
    dataSection,
    disableInitialInlineAnimation = false,
    onInlineAnimationStateChange,
}) => {
    const [stack, setStack] = useState<AsideContentItem[]>([initialItem]);
    const { isMounted, dataState, inlinePhase, panelRef, visualRef } = useInlinePanelPresence(
        open,
        layout,
        disableInitialInlineAnimation,
        onInlineAnimationStateChange,
    );

    const push = useCallback((item: AsideContentItem) => {
        setStack(prev => [...prev, item]);
    }, []);

    const pop = useCallback(() => {
        setStack(prev => {
            if (prev.length > 1) {
                return prev.slice(0, -1);
            }
            return prev;
        });
    }, []);

    const replace = useCallback((item: AsideContentItem) => {
        setStack([item]);
    }, []);

    const clear = useCallback(() => {
        setStack([initialItem]);
    }, [initialItem]);

    const currentItem = stack[stack.length - 1];
    const canGoBack = stack.length > 1;
    const inlineWidth = useMemo(() => resolveInlineWidth(width), [width]);
    const rootInlineStyle = layout === 'inline'
        ? ({
            ['--aside-inline-width' as string]: inlineWidth,
        } as React.CSSProperties)
        : undefined;
    const contentInlineStyle = layout === 'inline'
        ? ({
            width: inlineWidth,
            minWidth: inlineWidth,
        } as React.CSSProperties)
        : undefined;

    // Reset stack when panel closes/opens
    React.useEffect(() => {
        if (open) {
            setStack([initialItem]);
        }
    }, [open, initialItem]);

    if (!isMounted) return null;

    return (
        <AsidePanelContext.Provider value={{ push, pop, replace, clear, canGoBack, currentItem }}>
            <div className={cn(
                layout === 'inline'
                    ? "relative split-panel shrink-0 h-full min-h-0 max-w-full z-30 flex flex-col app-no-drag overflow-hidden"
                    : "absolute right-0 top-0 bottom-0 max-w-full border-l border-border/60 bg-background z-30 flex flex-col app-no-drag overflow-hidden",
                layout === 'overlay' && width,
                className
            )}
            ref={panelRef}
            style={rootInlineStyle}
            data-section={dataSection}
            data-state={dataState}
                data-inline-phase={layout === 'inline' ? inlinePhase : undefined}
                aria-hidden={layout === 'inline' ? !open : undefined}>
                <div
                    ref={visualRef}
                    className={cn(
                        "h-full min-h-0 flex flex-col",
                        layout === 'inline' && "overflow-hidden split-panel-visual border-l border-border/60 bg-background shadow-[-10px_0_20px_-12px_hsl(var(--foreground)/0.22)]"
                    )}
                    style={contentInlineStyle}
                >
                    <AsidePanelHeader
                        title={currentItem.title}
                        subtitle={currentItem.subtitle}
                        actions={currentItem.actions}
                        onBack={canGoBack ? pop : undefined}
                        onClose={onClose}
                        showBackButton={canGoBack}
                    />
                    {currentItem.content}
                </div>
            </div>
        </AsidePanelContext.Provider>
    );
};

// Simple Panel Component (no stack)
export const AsidePanel: React.FC<AsidePanelProps> = ({
    open,
    onClose,
    title,
    subtitle,
    actions,
    showBackButton,
    onBack,
    children,
    className,
    width = 'w-[380px]',
    layout = 'overlay',
    dataSection,
    disableInitialInlineAnimation = false,
    onInlineAnimationStateChange,
}) => {
    const { isMounted, dataState, inlinePhase, panelRef, visualRef } = useInlinePanelPresence(
        open,
        layout,
        disableInitialInlineAnimation,
        onInlineAnimationStateChange,
    );

    if (!isMounted) return null;

    const inlineWidth = resolveInlineWidth(width);
    const rootInlineStyle = layout === 'inline'
        ? ({
            ['--aside-inline-width' as string]: inlineWidth,
        } as React.CSSProperties)
        : undefined;
    const contentInlineStyle = layout === 'inline'
        ? ({
            width: inlineWidth,
            minWidth: inlineWidth,
        } as React.CSSProperties)
        : undefined;

    return (
        <div className={cn(
            layout === 'inline'
                ? "relative split-panel shrink-0 h-full min-h-0 max-w-full z-30 flex flex-col app-no-drag overflow-hidden"
                : "absolute right-0 top-0 bottom-0 max-w-full border-l border-border/60 bg-background z-30 flex flex-col app-no-drag overflow-hidden",
            layout === 'overlay' && width,
            className
        )}
        ref={panelRef}
        style={rootInlineStyle}
        data-section={dataSection}
        data-state={dataState}
        data-inline-phase={layout === 'inline' ? inlinePhase : undefined}
        aria-hidden={layout === 'inline' ? !open : undefined}>
            <div
                ref={visualRef}
                className={cn(
                    "h-full min-h-0 flex flex-col",
                    layout === 'inline' && "overflow-hidden split-panel-visual border-l border-border/60 bg-background shadow-[-10px_0_20px_-12px_hsl(var(--foreground)/0.22)]"
                )}
                style={contentInlineStyle}
            >
                {title && (
                    <AsidePanelHeader
                        title={title}
                        subtitle={subtitle}
                        actions={actions}
                        onClose={onClose}
                        showBackButton={showBackButton}
                        onBack={onBack}
                    />
                )}
                {children}
            </div>
        </div>
    );
};

export default AsidePanel;

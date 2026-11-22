import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useId,
    useRef,
    useState,
} from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmDialogContext = createContext(null);

const DEFAULTS = {
    title: 'Confirm delete',
    message: 'Are you sure you want to delete this? This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    tone: 'danger', // danger | warning | primary
};

const TONE_CLASSES = {
    danger: 'bg-danger-600 hover:bg-danger-700 focus-visible:ring-danger-500',
    warning: 'bg-warning-600 hover:bg-warning-700 focus-visible:ring-warning-500',
    primary: 'bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-500',
};

export function ConfirmDialogProvider({ children }) {
    const [options, setOptions] = useState(null);
    const resolverRef = useRef(null);
    const confirmBtnRef = useRef(null);
    const titleId = useId();
    const messageId = useId();

    const confirm = useCallback((opts = {}) => {
        return new Promise((resolve) => {
            // Resolve any previous pending confirm as cancelled
            if (resolverRef.current) {
                resolverRef.current(false);
            }
            resolverRef.current = resolve;
            setOptions({
                title: opts.title ?? DEFAULTS.title,
                message: opts.message ?? DEFAULTS.message,
                confirmLabel: opts.confirmLabel ?? DEFAULTS.confirmLabel,
                cancelLabel: opts.cancelLabel ?? DEFAULTS.cancelLabel,
                tone: opts.tone ?? DEFAULTS.tone,
            });
        });
    }, []);

    const settle = useCallback((result) => {
        const resolve = resolverRef.current;
        resolverRef.current = null;
        setOptions(null);
        resolve?.(result);
    }, []);

    useEffect(() => {
        if (!options) return undefined;

        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                settle(false);
            }
        };
        document.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // Focus primary action for keyboard users
        const t = window.setTimeout(() => confirmBtnRef.current?.focus(), 0);

        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
            window.clearTimeout(t);
        };
    }, [options, settle]);

    return (
        <ConfirmDialogContext.Provider value={{ confirm }}>
            {children}
            {options && (
                <div
                    className="fixed inset-0 z-[90] flex items-center justify-center p-4 print:hidden"
                    role="presentation"
                >
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1px]"
                        aria-label="Dismiss dialog"
                        onClick={() => settle(false)}
                    />
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        aria-describedby={messageId}
                        className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-lg animate-slide-up"
                    >
                        <div className="flex gap-3">
                            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger-600">
                                <AlertTriangle size={20} aria-hidden />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h2
                                    id={titleId}
                                    className="text-lg font-bold text-gray-900"
                                >
                                    {options.title}
                                </h2>
                                <p
                                    id={messageId}
                                    className="mt-1.5 text-sm text-gray-600 leading-relaxed"
                                >
                                    {options.message}
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => settle(false)}
                            >
                                {options.cancelLabel}
                            </button>
                            <button
                                ref={confirmBtnRef}
                                type="button"
                                className={`btn text-white ${TONE_CLASSES[options.tone] || TONE_CLASSES.danger}`}
                                onClick={() => settle(true)}
                            >
                                {options.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmDialogContext.Provider>
    );
}

export function useConfirm() {
    const ctx = useContext(ConfirmDialogContext);
    if (!ctx) {
        throw new Error('useConfirm must be used within ConfirmDialogProvider');
    }
    return ctx.confirm;
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

function parseISODate(value) {
    if (!value || typeof value !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const date = new Date(y, mo, d);
    if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
    return date;
}

function toISODate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDisplay(value) {
    const date = parseISODate(value);
    if (!date) return '';
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildCalendarDays(viewDate) {
    const first = startOfMonth(viewDate);
    const startPad = first.getDay();
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < startPad; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) {
        cells.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), d));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
}

function sameDay(a, b) {
    return (
        a &&
        b &&
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

/**
 * Lightweight date field.
 * value / onChange use ISO strings: "YYYY-MM-DD" (same as <input type="date">).
 */
export default function DateField({
    value = '',
    onChange,
    className = '',
    placeholder = 'Select date',
    disabled = false,
    id,
    name,
    min,
    max,
}) {
    const rootRef = useRef(null);
    const [open, setOpen] = useState(false);
    const selected = useMemo(() => parseISODate(value), [value]);
    const minDate = useMemo(() => parseISODate(min), [min]);
    const maxDate = useMemo(() => parseISODate(max), [max]);

    const [viewDate, setViewDate] = useState(() => startOfMonth(selected || new Date()));

    useEffect(() => {
        if (selected) setViewDate(startOfMonth(selected));
    }, [selected]);

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e) => {
            if (!rootRef.current?.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const days = useMemo(() => buildCalendarDays(viewDate), [viewDate]);
    const today = useMemo(() => {
        const n = new Date();
        return new Date(n.getFullYear(), n.getMonth(), n.getDate());
    }, []);

    const isDisabledDay = (date) => {
        if (!date) return true;
        if (minDate && date < minDate) return true;
        if (maxDate && date > maxDate) return true;
        return false;
    };

    const pick = (date) => {
        if (isDisabledDay(date)) return;
        onChange?.(toISODate(date));
        setOpen(false);
    };

    const display = formatDisplay(value) || placeholder;

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            <button
                type="button"
                id={id}
                name={name}
                disabled={disabled}
                onClick={() => !disabled && setOpen((v) => !v)}
                className={`box-border w-full h-[38px] border border-gray-300 rounded-input bg-white px-3 text-left inline-flex items-center gap-2 text-sm leading-none
                    outline-none
                    focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500
                    disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed
                    ${open ? 'ring-2 ring-brand-500/40 border-brand-500' : ''}`}
            >
                <CalendarIcon size={14} className="text-gray-500 shrink-0" />
                <span className={`flex-1 truncate leading-none ${value ? 'text-gray-900' : 'text-gray-400'}`}>
                    {display}
                </span>
            </button>

            {open && (
                <div className="absolute z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white shadow-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                        <button
                            type="button"
                            className="p-1 rounded hover:bg-gray-100"
                            onClick={() =>
                                setViewDate(
                                    new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1)
                                )
                            }
                            aria-label="Previous month"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <div className="text-sm font-semibold">
                            {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
                        </div>
                        <button
                            type="button"
                            className="p-1 rounded hover:bg-gray-100"
                            onClick={() =>
                                setViewDate(
                                    new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)
                                )
                            }
                            aria-label="Next month"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-1">
                        {WEEKDAYS.map((d) => (
                            <div
                                key={d}
                                className="text-[10px] font-semibold text-gray-500 text-center py-1"
                            >
                                {d}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {days.map((date, idx) => {
                            if (!date) {
                                return <div key={`e-${idx}`} className="h-8" />;
                            }
                            const disabledDay = isDisabledDay(date);
                            const isSelected = sameDay(date, selected);
                            const isToday = sameDay(date, today);
                            return (
                                <button
                                    key={toISODate(date)}
                                    type="button"
                                    disabled={disabledDay}
                                    onClick={() => pick(date)}
                                    className={`h-8 rounded text-sm ${
                                        isSelected
                                            ? 'bg-blue-600 text-white font-semibold'
                                            : isToday
                                              ? 'border border-blue-400 text-blue-700 font-medium'
                                              : 'hover:bg-gray-100 text-gray-800'
                                    } ${disabledDay ? 'opacity-30 cursor-not-allowed hover:bg-transparent' : ''}`}
                                >
                                    {date.getDate()}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t">
                        <button
                            type="button"
                            className="text-xs font-semibold text-gray-600 hover:underline"
                            onClick={() => {
                                onChange?.('');
                                setOpen(false);
                            }}
                        >
                            Clear
                        </button>
                        <button
                            type="button"
                            className="text-xs font-semibold text-blue-700 hover:underline"
                            onClick={() => pick(today)}
                            disabled={isDisabledDay(today)}
                        >
                            Today
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

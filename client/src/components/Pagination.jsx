export default function Pagination({
    page,
    totalPages,
    total,
    pageSize,
    onPageChange,
    disabled = false,
}) {
    if (!totalPages || totalPages < 1) return null;

    const canPrev = page > 1;
    const canNext = page < totalPages;

    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);

    // Compact page window around current
    const windowSize = 5;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    const pages = [];
    for (let p = start; p <= end; p += 1) pages.push(p);

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 print:hidden">
            <p className="text-sm text-gray-500">
                Showing <span className="font-semibold text-gray-700">{from}</span>
                –<span className="font-semibold text-gray-700">{to}</span> of{' '}
                <span className="font-semibold text-gray-700">{total}</span>
            </p>
            <div className="flex flex-wrap items-center gap-1">
                <button
                    type="button"
                    className="btn btn-secondary px-3 py-1.5 text-sm cursor-pointer disabled:cursor-not-allowed"
                    disabled={disabled || !canPrev}
                    onClick={() => onPageChange(page - 1)}
                >
                    Prev
                </button>
                {start > 1 && (
                    <>
                        <PageBtn
                            page={1}
                            current={page}
                            disabled={disabled}
                            onPageChange={onPageChange}
                        />
                        {start > 2 && (
                            <span className="px-1 text-gray-400 text-sm">…</span>
                        )}
                    </>
                )}
                {pages.map((p) => (
                    <PageBtn
                        key={p}
                        page={p}
                        current={page}
                        disabled={disabled}
                        onPageChange={onPageChange}
                    />
                ))}
                {end < totalPages && (
                    <>
                        {end < totalPages - 1 && (
                            <span className="px-1 text-gray-400 text-sm">…</span>
                        )}
                        <PageBtn
                            page={totalPages}
                            current={page}
                            disabled={disabled}
                            onPageChange={onPageChange}
                        />
                    </>
                )}
                <button
                    type="button"
                    className="btn btn-secondary px-3 py-1.5 text-sm cursor-pointer disabled:cursor-not-allowed"
                    disabled={disabled || !canNext}
                    onClick={() => onPageChange(page + 1)}
                >
                    Next
                </button>
            </div>
        </div>
    );
}

function PageBtn({ page, current, onPageChange, disabled }) {
    const active = page === current;
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onPageChange(page)}
            className={`min-w-9 px-2.5 py-1.5 text-sm rounded-md border font-medium cursor-pointer ${
                active
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            {page}
        </button>
    );
}

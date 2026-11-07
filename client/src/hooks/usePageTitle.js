// src/hooks/usePageTitle.js
import { useEffect } from 'react';

const APP_NAME = 'AMK Labs';

export default function usePageTitle(title) {
    useEffect(() => {
        const previous = document.title;
        document.title = title ? `${title} — ${APP_NAME}` : APP_NAME;
        return () => {
            // optional: restore on unmount (usually unnecessary with route changes)
            document.title = previous;
        };
    }, [title]);
}
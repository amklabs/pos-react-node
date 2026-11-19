// src/hooks/usePageTitle.js
import { useEffect } from 'react';
import { STORE_NAME } from '../constants/store.js';

export default function usePageTitle(title) {
    useEffect(() => {
        const previous = document.title;
        document.title = title ? `${title} — ${STORE_NAME}` : STORE_NAME;
        return () => {
            // optional: restore on unmount (usually unnecessary with route changes)
            document.title = previous;
        };
    }, [title]);
}
"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * A hook that works like useState but persists the value to localStorage.
 * On mount, it reads from localStorage; if a valid stored value exists, it uses that.
 * On every state change, it writes to localStorage.
 *
 * @param key - The localStorage key
 * @param defaultValue - The default value if nothing is stored
 * @param validValues - Optional array of valid values to validate against
 */
export function usePersistedState<T extends string>(
    key: string,
    defaultValue: T,
    validValues?: T[]
): [T, (value: T | ((prev: T) => T)) => void] {
    const [value, setValue] = useState<T>(defaultValue);
    const [hydrated, setHydrated] = useState(false);

    // Read from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(key);
            if (stored !== null) {
                // If validValues provided, check that stored value is valid
                if (validValues) {
                    if (validValues.includes(stored as T)) {
                        setValue(stored as T);
                    }
                    // else: invalid stored value, keep default
                } else {
                    setValue(stored as T);
                }
            }
        } catch {
            // localStorage unavailable (SSR, private browsing, etc.)
        }
        setHydrated(true);
    }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

    // Persist to localStorage on change (skip initial default)
    useEffect(() => {
        if (hydrated) {
            try {
                localStorage.setItem(key, value);
            } catch {
                // localStorage unavailable
            }
        }
    }, [key, value, hydrated]);

    const setPersistedValue = useCallback(
        (newValue: T | ((prev: T) => T)) => {
            setValue(newValue);
        },
        []
    );

    return [value, setPersistedValue];
}

"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
    onAuthStateChanged,
    signInWithPopup,
    signOut as firebaseSignOut,
    type User,
} from "firebase/auth";
import { getFirebaseAuth, googleProvider, isFirebaseConfigured } from "@/lib/firebase";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    firebaseReady: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signInWithGoogle: async () => {},
    signOut: async () => {},
    firebaseReady: false,
});

export function useAuth() {
    return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [firebaseReady, setFirebaseReady] = useState(false);

    useEffect(() => {
        if (!isFirebaseConfigured()) {
            // Firebase not configured — skip auth entirely
            setLoading(false);
            return;
        }

        const auth = getFirebaseAuth();
        if (!auth) {
            setLoading(false);
            return;
        }

        setFirebaseReady(true);
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const signInWithGoogle = async () => {
        const auth = getFirebaseAuth();
        if (!auth) return;
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (err) {
            console.error("Google sign-in failed:", err);
        }
    };

    const signOutFn = async () => {
        const auth = getFirebaseAuth();
        if (!auth) return;
        try {
            await firebaseSignOut(auth);
        } catch (err) {
            console.error("Sign-out failed:", err);
        }
    };

    return (
        <AuthContext.Provider
            value={{ user, loading, signInWithGoogle, signOut: signOutFn, firebaseReady }}
        >
            {children}
        </AuthContext.Provider>
    );
}

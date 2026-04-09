"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
    onAuthStateChanged,
    signInWithPopup,
    signOut as firebaseSignOut,
    type User,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signInWithGoogle: async () => {},
    signOut: async () => {},
});

export function useAuth() {
    return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const signInWithGoogle = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (err) {
            console.error("Google sign-in failed:", err);
        }
    };

    const signOutFn = async () => {
        try {
            await firebaseSignOut(auth);
        } catch (err) {
            console.error("Sign-out failed:", err);
        }
    };

    return (
        <AuthContext.Provider
            value={{ user, loading, signInWithGoogle, signOut: signOutFn }}
        >
            {children}
        </AuthContext.Provider>
    );
}

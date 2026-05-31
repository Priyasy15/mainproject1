"use client"

import { useEffect, useState } from "react"
import { auth } from "./firebase"
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth"
import type { User } from "@/types"

const COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F"
]

const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)]

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || "Anonymous",
          email: firebaseUser.email || "",
          color: getRandomColor(),
          photoURL: firebaseUser.photoURL || undefined,
        })
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  } catch (error: unknown) {
    const firebaseError = error as { code?: string }
    if (firebaseError.code === "auth/cancelled-popup-request") {
      return // ignore, user just clicked twice
    }
    console.error("Sign in error:", error)
  }
}

  const logout = async () => {
    await signOut(auth)
  }

  return { user, loading, signInWithGoogle, logout }
}
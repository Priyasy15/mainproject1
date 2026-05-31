"use client"

import { useAuth } from "@/lib/useAuth"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { db } from "@/lib/firebase"
import { collection, addDoc, onSnapshot, query, where, orderBy } from "firebase/firestore"
import type { Sheet } from "@/types"

export default function Dashboard() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/")
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return

    const q = query(
      collection(db, "sheets"),
      where("createdBy", "==", user.uid),
      orderBy("updatedAt", "desc")
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Sheet[]
      setSheets(data)
    })

    return () => unsubscribe()
  }, [user])

  const createSheet = async () => {
    if (!user) return
    setCreating(true)
    const doc = await addDoc(collection(db, "sheets"), {
      title: "Untitled Sheet",
      createdBy: user.uid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      cells: {},
    })
    router.push(`/sheet/${doc.id}`)
    setCreating(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📊</span>
          <h1 className="text-xl font-bold text-gray-800">CollabSheets</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {user?.photoURL && (
              <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full" />
            )}
            <span className="text-sm text-gray-600">{user?.displayName}</span>
          </div>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded px-3 py-1"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-700">My Sheets</h2>
          <button
            onClick={createSheet}
            disabled={creating}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
          >
            {creating ? "Creating..." : "+ New Sheet"}
          </button>
        </div>

        {sheets.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-4">📄</p>
            <p>No sheets yet. Create your first one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {sheets.map((sheet) => (
              <div
                key={sheet.id}
                onClick={() => router.push(`/sheet/${sheet.id}`)}
                className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-md transition"
              >
                <p className="font-semibold text-gray-800 mb-1">{sheet.title}</p>
                <p className="text-xs text-gray-400">
                  Last modified: {new Date(sheet.updatedAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
"use client"

import { useAuth } from "@/lib/useAuth"
import { useRouter, useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { db } from "@/lib/firebase"
import { doc, onSnapshot, updateDoc, setDoc, collection } from "firebase/firestore"
import type { Sheet, CellData, Presence } from "@/types"

const COLS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T']
const ROWS = Array.from({ length: 50 }, (_, i) => i + 1)

export default function SheetPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const sheetId = params.id as string

  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [selectedCell, setSelectedCell] = useState<string>("A1")
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>("")
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved")
  const [presence, setPresence] = useState<Presence[]>([])

  // redirect if not logged in
  useEffect(() => {
    if (!loading && !user) router.push("/")
  }, [user, loading, router])

  // load sheet data
  useEffect(() => {
    if (!sheetId) return
    const unsubscribe = onSnapshot(doc(db, "sheets", sheetId), (snap) => {
      if (snap.exists()) {
        setSheet({ id: snap.id, ...snap.data() } as Sheet)
      }
    })
    return () => unsubscribe()
  }, [sheetId])

  // update my presence
  useEffect(() => {
    if (!user || !sheetId) return
    const presenceRef = doc(db, "sheets", sheetId, "presence", user.uid)
    const updatePresence = async () => {
      await setDoc(presenceRef, {
        uid: user.uid,
        displayName: user.displayName,
        color: user.color,
        selectedCell,
        lastSeen: Date.now(),
      })
    }
    updatePresence()
  }, [user, sheetId, selectedCell])

  // listen to presence of others
  useEffect(() => {
    if (!sheetId) return
    const presenceCol = collection(db, "sheets", sheetId, "presence")
    const unsubscribe = onSnapshot(presenceCol, (snap) => {
      const now = Date.now()
      const active = snap.docs
        .map((d) => d.data() as Presence)
        .filter((p: Presence) => now - p.lastSeen < 30000)
      setPresence(active)
    })
    return () => unsubscribe()
  }, [sheetId])

  const getCellValue = (cellId: string): string => {
    if (!sheet?.cells[cellId]) return ""
    return sheet.cells[cellId].value || ""
  }

  const saveCell = async (cellId: string, value: string) => {
    if (!sheetId) return
    setSaveStatus("saving")
    const cellData: CellData = { value }
    await updateDoc(doc(db, "sheets", sheetId), {
      [`cells.${cellId}`]: cellData,
      updatedAt: Date.now(),
    })
    setSaveStatus("saved")
  }

  const handleCellClick = (cellId: string) => {
    if (editingCell && editingCell !== cellId) {
      saveCell(editingCell, editValue)
      setEditingCell(null)
    }
    setSelectedCell(cellId)
  }

  const handleCellDoubleClick = (cellId: string) => {
    setEditingCell(cellId)
    setEditValue(getCellValue(cellId))
  }

  const handleKeyDown = (e: React.KeyboardEvent, cellId: string) => {
    const col = cellId[0]
    const row = parseInt(cellId.slice(1))
    const colIndex = COLS.indexOf(col)

    if (e.key === "Enter") {
      e.preventDefault()
      saveCell(cellId, editValue)
      setEditingCell(null)
      const nextRow = Math.min(row + 1, ROWS.length)
      setSelectedCell(`${col}${nextRow}`)
    } else if (e.key === "Escape") {
      setEditingCell(null)
      setEditValue("")
    } else if (e.key === "Tab") {
      e.preventDefault()
      saveCell(cellId, editValue)
      setEditingCell(null)
      const nextCol = COLS[Math.min(colIndex + 1, COLS.length - 1)]
      setSelectedCell(`${nextCol}${row}`)
    }
  }

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (editingCell) return
    const col = selectedCell[0]
    const row = parseInt(selectedCell.slice(1))
    const colIndex = COLS.indexOf(col)

    if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedCell(`${col}${Math.max(row - 1, 1)}`)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedCell(`${col}${Math.min(row + 1, ROWS.length)}`)
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      setSelectedCell(`${COLS[Math.max(colIndex - 1, 0)]}${row}`)
    } else if (e.key === "ArrowRight") {
      e.preventDefault()
      setSelectedCell(`${COLS[Math.min(colIndex + 1, COLS.length - 1)]}${row}`)
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault()
      setEditingCell(selectedCell)
      setEditValue(getCellValue(selectedCell))
    }
  }

  if (loading || !sheet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-lg">Loading sheet...</p>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-screen bg-white focus:outline-none"
      onKeyDown={handleGridKeyDown}
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-gray-500 hover:text-gray-700 text-sm border border-gray-200 rounded px-2 py-1 hover:bg-gray-50"
          >
            ← Back
          </button>
          <span className="text-lg font-semibold text-gray-800">{sheet.title}</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Save status */}
          <span className={`text-xs font-medium ${saveStatus === "saving" ? "text-orange-500" : "text-green-600"}`}>
            {saveStatus === "saving" ? "⏳ Saving..." : "✅ Saved"}
          </span>

          {/* Presence avatars */}
          <div className="flex items-center gap-1">
            {presence.map((p) => (
              <div
                key={p.uid}
                title={p.displayName}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow"
                style={{ backgroundColor: p.color }}
              >
                {p.displayName[0].toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Formula bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-gray-50">
        <span className="text-sm text-gray-600 font-medium w-14 text-center bg-white border border-gray-300 rounded px-2 py-1">
          {selectedCell}
        </span>
        <div className="w-px h-5 bg-gray-300" />
        <input
          className="flex-1 text-sm border border-gray-300 rounded px-3 py-1 outline-none focus:border-blue-400 bg-white"
          value={editingCell ? editValue : getCellValue(selectedCell)}
          onChange={(e) => {
            if (editingCell) setEditValue(e.target.value)
          }}
          onFocus={() => {
            if (!editingCell) {
              setEditingCell(selectedCell)
              setEditValue(getCellValue(selectedCell))
            }
          }}
          onKeyDown={(e) => {
            if (editingCell) handleKeyDown(e, editingCell)
          }}
          placeholder="Enter value or formula"
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <table
          className="border-collapse"
          style={{ tableLayout: "fixed", width: "max-content" }}
        >
          <thead>
            <tr>
              {/* Corner cell */}
              <th
                className="bg-gray-100 border border-gray-300 sticky top-0 left-0 z-20"
                style={{ width: "50px", minWidth: "50px" }}
              />
              {COLS.map((col) => (
                <th
                  key={col}
                  className="bg-gray-100 border border-gray-300 text-center text-gray-600 font-medium py-1 sticky top-0 z-10 select-none text-sm"
                  style={{ width: "120px", minWidth: "120px" }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row}>
                {/* Row number */}
                <td
                  className="bg-gray-100 border border-gray-300 text-center text-gray-500 text-xs py-1 sticky left-0 z-10 select-none"
                  style={{ width: "50px", minWidth: "50px" }}
                >
                  {row}
                </td>
                {COLS.map((col) => {
                  const cellId = `${col}${row}`
                  const isSelected = selectedCell === cellId
                  const isEditing = editingCell === cellId
                  const presenceUser = presence.find(
                    (p) => p.selectedCell === cellId && p.uid !== user?.uid
                  )

                  return (
                    <td
                      key={cellId}
                      className={`border border-gray-200 p-0 relative cursor-cell ${
                        isSelected
                          ? "outline outline-2 outline-blue-500 z-10"
                          : "hover:bg-blue-50"
                      }`}
                      style={{
                        width: "120px",
                        minWidth: "120px",
                        backgroundColor: presenceUser
                          ? `${presenceUser.color}22`
                          : undefined,
                      }}
                      onClick={() => handleCellClick(cellId)}
                      onDoubleClick={() => handleCellDoubleClick(cellId)}
                    >
                      {/* Presence indicator */}
                      {presenceUser && (
                        <div
                          className="absolute top-0 right-0 text-white text-xs px-1 rounded-bl z-20 leading-4"
                          style={{ backgroundColor: presenceUser.color }}
                        >
                          {presenceUser.displayName[0].toUpperCase()}
                        </div>
                      )}

                      {/* Cell content */}
                      {isEditing ? (
                        <input
                          autoFocus
                          className="w-full h-full px-2 py-1 outline-none border-none text-sm bg-white"
                          style={{ minHeight: "28px" }}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, cellId)}
                          onBlur={() => {
                            saveCell(cellId, editValue)
                            setEditingCell(null)
                          }}
                        />
                      ) : (
                        <div
                          className="px-2 py-1 text-sm text-gray-800 truncate"
                          style={{ minHeight: "28px", width: "120px" }}
                        >
                          {getCellValue(cellId)}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
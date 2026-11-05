'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

/** Confirm-then-delete for a meeting. Its action items are kept (unlinked from the meeting). */
export function DeleteMeetingButton({ meetingId, title, onDeleted, iconOnly = false }: { meetingId: string; title: string; onDeleted: () => void; iconOnly?: boolean }) {
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, { method: 'DELETE' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(d?.error ?? 'Failed to delete meeting'); return }
      toast.success('Meeting deleted')
      onDeleted()
    } catch (e) {
      console.error('Delete meeting failed', e)
      toast.error('Failed to delete meeting')
    } finally { setBusy(false) }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {iconOnly ? (
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-600" aria-label={`Delete ${title}`} onClick={(e) => e.stopPropagation()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" className="text-red-600 hover:text-red-700"><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
          <AlertDialogDescription>The meeting and its notes are removed permanently. Its action items are kept and stay on the Action Items page.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={remove} disabled={busy} className="bg-red-600 hover:bg-red-700 text-white">{busy ? 'Deleting…' : 'Delete meeting'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

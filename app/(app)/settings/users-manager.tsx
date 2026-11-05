'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserCog, UserPlus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { defaultAccess, type AccessMap } from '@/lib/access'

interface Section { key: keyof AccessMap; label: string }
interface Role { id: string; name: string }
interface UserRow {
  id: string; name: string; email: string; roleId: string; roleName: string; isActive: boolean
  permissions: Record<string, boolean> | null; access: AccessMap
}
interface FormState {
  id?: string; name: string; email: string; password: string; roleId: string; isActive: boolean
  useDefaults: boolean; access: AccessMap
}

export function UsersManager({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<UserRow | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to load users'); return }
      setUsers(data.users); setRoles(data.roles); setSections(data.sections)
    } catch (e) { console.error(e); toast.error('Failed to load users') } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const roleName = (roleId: string) => roles.find(r => r.id === roleId)?.name ?? ''

  const openNew = () => {
    const pm = roles.find(r => r.name !== 'Admin') ?? roles[0]
    setForm({ name: '', email: '', password: '', roleId: pm?.id ?? '', isActive: true, useDefaults: true, access: defaultAccess(pm?.name) })
  }
  const openEdit = (u: UserRow) => setForm({
    id: u.id, name: u.name, email: u.email, password: '', roleId: u.roleId, isActive: u.isActive,
    useDefaults: !u.permissions, access: { ...u.access },
  })

  const setRole = (roleId: string) => setForm(f => f && ({ ...f, roleId, access: f.useDefaults ? defaultAccess(roleName(roleId)) : f.access }))
  const setDefaults = (useDefaults: boolean) => setForm(f => f && ({ ...f, useDefaults, access: useDefaults ? defaultAccess(roleName(f.roleId)) : f.access }))
  const toggleSection = (key: keyof AccessMap, v: boolean) => setForm(f => f && ({ ...f, useDefaults: false, access: { ...f.access, [key]: v } }))

  const save = async () => {
    if (!form) return
    if (!form.name.trim() || !form.email.trim()) { toast.error('Name and email are required'); return }
    if (!form.id && form.password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (form.id && form.password && form.password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        id: form.id, name: form.name, email: form.email, roleId: form.roleId, isActive: form.isActive,
        ...(form.password ? { password: form.password } : {}),
        ...(form.useDefaults ? { resetPermissions: true } : { permissions: form.access }),
      }
      const res = await fetch('/api/admin/users', { method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error ?? 'Failed to save user'); return }
      toast.success(form.id ? 'User updated' : 'User added')
      setForm(null)
      load()
    } catch { toast.error('Failed to save user') } finally { setSaving(false) }
  }

  const quickToggleActive = async (u: UserRow, isActive: boolean) => {
    const res = await fetch('/api/admin/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, isActive }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(data.error ?? 'Failed to update'); return }
    toast.success(isActive ? `${u.name} activated` : `${u.name} deactivated — they can no longer sign in`)
    load()
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    const res = await fetch(`/api/admin/users?id=${encodeURIComponent(toDelete.id)}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) toast.error(data.error ?? 'Failed to delete user')
    else { toast.success(`${toDelete.name} deleted`); load() }
    setToDelete(null)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2"><UserCog className="h-4 w-4 text-primary" />Users &amp; Access</CardTitle>
        <Button size="sm" onClick={openNew}><UserPlus className="h-4 w-4 mr-1" />Add User</Button>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground py-6 text-center">Loading users…</p> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id} className={u.isActive ? '' : 'opacity-60'}>
                    <TableCell>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{u.roleName}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {sections.filter(s => u.access[s.key]).map(s => <Badge key={s.key} variant="outline" className="text-[10px] font-normal">{s.label.replace(' (system config)', '')}</Badge>)}
                        {u.permissions && <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100">Custom</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch checked={u.isActive} disabled={u.id === currentUserId} onCheckedChange={(v) => quickToggleActive(u, v)} aria-label="Active" />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(u)} aria-label={`Edit ${u.name}`}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" disabled={u.id === currentUserId} onClick={() => setToDelete(u)} aria-label={`Delete ${u.name}`}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!form} onOpenChange={(o) => { if (!o) setForm(null) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Edit User' : 'Add User'}</DialogTitle>
            <DialogDescription>Role sets the default access; tick or untick sections to customize this person.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-1">
                  <Label>Role</Label>
                  <Select value={form.roleId} onValueChange={setRole}>
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{form.id ? 'New password (optional)' : 'Password'}</Label>
                  <Input type="password" autoComplete="new-password" value={form.password} placeholder={form.id ? 'Leave blank to keep' : 'Min 8 characters'} onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                <Label htmlFor="u-active">Active (can sign in)</Label>
                <Switch id="u-active" checked={form.isActive} disabled={form.id === currentUserId} onCheckedChange={v => setForm({ ...form, isActive: v })} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Section access</Label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox checked={form.useDefaults} onCheckedChange={v => setDefaults(v === true)} />Use role defaults
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sections.map(s => (
                    <label key={s.key} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={form.access[s.key]}
                        disabled={s.key === 'users' && roleName(form.roleId) === 'Admin'}
                        onCheckedChange={v => toggleSection(s.key, v === true)}
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Admins always keep Users &amp; Access. Uploading files requires Import Data.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their action items become unassigned and their history is kept. To only block sign-in, switch them to inactive instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

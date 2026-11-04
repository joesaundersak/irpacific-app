'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserPlus, Mail, Lock, User } from 'lucide-react'
import { toast } from 'sonner'

export function SignupForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: email.toLowerCase(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? 'Signup failed')
        return
      }
      const result = await signIn('credentials', {
        email: email.toLowerCase(),
        password,
        redirect: false,
      })
      if (result?.error) {
        toast.error('Account created but could not sign in. Please log in.')
        router.push('/login')
      } else {
        router.replace('/dashboard')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 hero-gradient">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-xl p-8" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <div className="flex flex-col items-center mb-8">
            <div className="relative h-16 w-48 mb-4">
              <Image src="/IR-Logo-Green.png" alt="IR Pacific" fill className="object-contain" priority />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Create Account</h1>
            <p className="text-sm text-muted-foreground mt-1">Join the IR Pacific team</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="pl-10" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" required minLength={6} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              <UserPlus className="mr-2 h-4 w-4" />
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>
          <p className="text-xs text-center text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

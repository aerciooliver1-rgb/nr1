'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function Home() {
  const { currentUser, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (currentUser) {
      router.replace('/dashboard')
    } else {
      router.replace('/login')
    }
  }, [currentUser, loading, router])

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-accent border-t-transparent" />
    </div>
  )
}

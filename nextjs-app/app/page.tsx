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
    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner" />
    </div>
  )
}

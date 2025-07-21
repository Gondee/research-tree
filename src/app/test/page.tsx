'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function TestPage() {
  const { data: session, status } = useSession()

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Session Test Page</h1>
      
      <div className="space-y-4">
        <div className="p-4 border rounded">
          <p className="font-semibold">Session Status:</p>
          <pre className="bg-gray-100 p-2 rounded mt-2">
            {status}
          </pre>
        </div>

        <div className="p-4 border rounded">
          <p className="font-semibold">Session Data:</p>
          <pre className="bg-gray-100 p-2 rounded mt-2 overflow-auto">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>

        <div className="flex gap-4">
          <Link href="/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
          <Link href="/auth/login">
            <Button variant="outline">Go to Login</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
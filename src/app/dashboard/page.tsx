'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Plus, 
  Search, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Loader2,
  TreePine,
  LogOut
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { formatDate } from '@/lib/utils'

interface Session {
  id: string
  name: string
  description?: string
  status: string
  createdAt: string
  updatedAt: string
  _count: {
    nodes: number
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return // Do nothing while loading
    
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    } else if (status === 'authenticated') {
      loadSessions()
    }
  }, [status, router])

  const loadSessions = async () => {
    try {
      const res = await fetch('/api/sessions')
      if (res.ok) {
        const data = await res.json()
        setSessions(data)
      }
    } catch (error) {
      console.error('Failed to load sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'archived':
        return <XCircle className="h-4 w-4 text-gray-500" />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TreePine className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">Research Tree</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {session?.user?.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold">Your Research Sessions</h2>
              <p className="text-muted-foreground mt-1">
                Create and manage your hierarchical research projects
              </p>
            </div>
            <Link href="/dashboard/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Research
              </Button>
            </Link>
          </div>

          {/* Sessions Grid */}
          {sessions.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No research sessions yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start your first research project to see it here
                </p>
                <Link href="/dashboard/new">
                  <Button>Create Your First Research</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sessions.map((session) => (
                <Link key={session.id} href={`/dashboard/session/${session.id}`}>
                  <Card className="hover:shadow-lg transition-all hover:border-primary cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <CardTitle className="line-clamp-1">
                            {session.name}
                          </CardTitle>
                          <CardDescription className="line-clamp-2">
                            {session.description || 'No description'}
                          </CardDescription>
                        </div>
                        {getStatusIcon(session.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{session._count.nodes} nodes</span>
                        <span>{formatDate(session.updatedAt)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
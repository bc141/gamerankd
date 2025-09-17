"use client"

import { useState, useEffect } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'
import { waitForSession } from '@/lib/waitForSession'
import { Play, UserPlus, TrendingUp, Plus } from 'lucide-react'

interface Game {
  id: string
  name: string
  cover_url: string
}

interface User {
  id: string
  username: string
  display_name: string
  avatar_url: string
}

export default function SidebarTestPage() {
  const [games, setGames] = useState<Game[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const sb = supabaseBrowser()
        const session = await waitForSession(sb)

        // Load games for Continue Playing
        const { data: gamesData, error: gamesError } = await sb
          .from('games')
          .select('id, name, cover_url')
          .order('created_at', { ascending: false })
          .limit(5)

        if (gamesError) {
          console.error('Error loading games:', gamesError)
        }

        // Load users for Who to Follow
        const { data: usersData, error: usersError } = await sb
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .neq('id', session?.user?.id) // Exclude current user
          .limit(3)

        if (usersError) {
          console.error('Error loading users:', usersError)
        }

        setGames(gamesData || [])
        setUsers(usersData || [])
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const handleFollow = (userId: string) => {
    console.log('Follow user:', userId)
    // TODO: Implement follow functionality
  }

  const handlePlayGame = (gameId: string) => {
    console.log('Play game:', gameId)
    // TODO: Implement game play functionality
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-foreground mb-8">Sidebar Test - Loading...</h1>
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-6 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 bg-muted rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-md mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Sidebar Test</h1>
          <p className="text-muted-foreground">Testing sidebar components with real backend data</p>
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm text-foreground">
              <strong>Games loaded:</strong> {games.length}
            </p>
            <p className="text-sm text-foreground">
              <strong>Users loaded:</strong> {users.length}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Continue Playing */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Play className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Continue Playing</h2>
            </div>

            <div className="space-y-4">
              {games.length > 0 ? (
                games.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => handlePlayGame(game.id)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <img
                      src={game.cover_url}
                      alt={`${game.name} cover`}
                      className="w-12 h-12 rounded-lg object-cover border border-border"
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <h3 className="font-medium text-foreground text-sm truncate">{game.name}</h3>
                      <p className="text-xs text-muted-foreground">Recently played</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm">No games found</p>
                </div>
              )}
            </div>
          </div>

          {/* Who to Follow */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Who to Follow</h2>
            </div>

            <div className="space-y-4">
              {users.length > 0 ? (
                users.map((user) => (
                  <div key={user.id} className="flex items-center gap-3">
                    <img
                      src={user.avatar_url || '/avatar-placeholder.svg'}
                      alt={`${user.display_name} avatar`}
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground text-sm truncate">
                        {user.display_name || user.username}
                      </h3>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                    <button
                      onClick={() => handleFollow(user.id)}
                      className="px-3 py-1 text-xs font-medium text-primary border border-primary rounded-full hover:bg-primary/10 transition-colors"
                    >
                      Follow
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm">No users found</p>
                </div>
              )}
            </div>
          </div>

          {/* Trending Topics */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Trending</h2>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground text-sm">#Gaming</p>
                  <p className="text-xs text-muted-foreground">1.2K posts</p>
                </div>
                <Plus className="w-4 h-4 text-muted-foreground" />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground text-sm">#NewGame</p>
                  <p className="text-xs text-muted-foreground">856 posts</p>
                </div>
                <Plus className="w-4 h-4 text-muted-foreground" />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground text-sm">#Streaming</p>
                  <p className="text-xs text-muted-foreground">432 posts</p>
                </div>
                <Plus className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

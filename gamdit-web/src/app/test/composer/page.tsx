"use client"

import { useState, useEffect } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'
import { waitForSession } from '@/lib/waitForSession'
import { ImageIcon, Gamepad2, Send } from 'lucide-react'

interface Game {
  id: string
  name: string
  cover_url: string
}

export default function ComposerTestPage() {
  const [content, setContent] = useState('')
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [showGameSelector, setShowGameSelector] = useState(false)
  const [userAvatar, setUserAvatar] = useState('/avatar-placeholder.svg')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const sb = supabaseBrowser()
        const session = await waitForSession(sb)
        
        if (session?.user) {
          setUserAvatar(session.user.user_metadata?.avatar_url || '/avatar-placeholder.svg')
        }

        // Load games for selection
        const { data: gamesData, error: gamesError } = await sb
          .from('games')
          .select('id, name, cover_url')
          .order('created_at', { ascending: false })
          .limit(10)

        if (gamesError) {
          console.error('Error loading games:', gamesError)
        }

        setGames(gamesData || [])
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const handlePost = async () => {
    if (!content.trim()) return

    try {
      const sb = supabaseBrowser()
      const session = await waitForSession(sb)
      
      if (!session?.user) {
        console.error('No user session')
        return
      }

      // Create post
      const { data, error } = await sb
        .from('posts')
        .insert({
          user_id: session.user.id,
          body: content,
          game_id: selectedGame?.id || null,
        })
        .select()

      if (error) {
        console.error('Error creating post:', error)
        return
      }

      console.log('Post created:', data)
      
      // Reset form
      setContent('')
      setSelectedGame(null)
      
      // Show success message
      alert('Post created successfully!')
    } catch (error) {
      console.error('Error creating post:', error)
      alert('Error creating post')
    }
  }

  const handleSelectGame = (game: Game) => {
    setSelectedGame(game)
    setShowGameSelector(false)
  }

  const handleRemoveGame = () => {
    setSelectedGame(null)
  }

  const handleAddImage = () => {
    console.log('Add image - not implemented yet')
    alert('Image upload not implemented yet')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-foreground mb-8">Composer Test - Loading...</h1>
          <div className="bg-card border border-border rounded-xl p-6 animate-pulse">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-muted rounded-full"></div>
              <div className="flex-1">
                <div className="h-20 bg-muted rounded mb-4"></div>
                <div className="flex justify-between">
                  <div className="flex gap-2">
                    <div className="w-8 h-8 bg-muted rounded"></div>
                    <div className="w-8 h-8 bg-muted rounded"></div>
                  </div>
                  <div className="w-16 h-8 bg-muted rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Composer Test</h1>
          <p className="text-muted-foreground">Testing post composer with real backend integration</p>
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm text-foreground">
              <strong>Available games:</strong> {games.length}
            </p>
            <p className="text-sm text-foreground">
              <strong>Selected game:</strong> {selectedGame ? selectedGame.name : 'None'}
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex gap-4">
            <img 
              src={userAvatar} 
              alt="Your avatar" 
              className="w-10 h-10 rounded-full flex-shrink-0" 
            />
            
            <div className="flex-1">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's happening in your game?"
                className="w-full bg-transparent text-foreground placeholder:text-muted-foreground resize-none border-none outline-none text-lg min-h-[100px]"
                rows={4}
              />

              {/* Selected Game Display */}
              {selectedGame && (
                <div className="mt-3 p-3 bg-muted rounded-lg border border-border flex items-center gap-3">
                  <img
                    src={selectedGame.cover_url}
                    alt={selectedGame.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground text-sm">{selectedGame.name}</h4>
                    <p className="text-xs text-muted-foreground">Game</p>
                  </div>
                  <button
                    onClick={handleRemoveGame}
                    className="p-1 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Remove game"
                  >
                    ×
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <button 
                    className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                    onClick={handleAddImage}
                    aria-label="Add image"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  
                  <button 
                    className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                    onClick={() => setShowGameSelector(true)}
                    aria-label="Add game"
                  >
                    <Gamepad2 className="w-5 h-5" />
                  </button>
                </div>

                <button
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!content.trim()}
                  onClick={handlePost}
                >
                  <Send className="w-4 h-4 mr-2 inline" />
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Game Selector Modal */}
        {showGameSelector && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Select a Game</h3>
                <button
                  onClick={() => setShowGameSelector(false)}
                  className="p-1 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-2">
                {games.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => handleSelectGame(game)}
                    className="w-full p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors flex items-center gap-3"
                  >
                    <img
                      src={game.cover_url}
                      alt={game.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div className="flex-1 text-left">
                      <h4 className="font-medium text-foreground text-sm">{game.name}</h4>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

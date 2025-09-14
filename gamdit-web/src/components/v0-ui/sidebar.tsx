import { Button } from './button'
import { Play, UserPlus, TrendingUp } from "lucide-react"

export interface Game {
  id: string
  name: string
  cover_url: string
}

export interface User {
  id: string
  username: string
  display_name: string
  avatar_url: string
}

interface SidebarProps {
  games: Game[]
  users: User[]
  onFollow: (userId: string) => void
  onPlayGame: (gameId: string) => void
}

export function Sidebar({ 
  games, 
  users, 
  onFollow, 
  onPlayGame
}: SidebarProps) {
  return (
    <div className="space-y-6">
      {/* Continue Playing */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Play className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Continue Playing</h2>
        </div>

        <div className="space-y-4">
          {games.map((game) => (
            <button
              key={game.id}
              onClick={() => onPlayGame(game.id)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <img
                src={game.cover_url || "/placeholder.svg"}
                alt={`${game.name} cover`}
                className="w-12 h-12 rounded-lg object-cover border border-border"
              />
              <div className="flex-1 min-w-0 text-left">
                <h3 className="font-medium text-foreground text-sm truncate">{game.name}</h3>
                <p className="text-xs text-muted-foreground">Recently played</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Who to Follow */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Who to Follow</h2>
        </div>

        <div className="space-y-4">
          {users.map((user) => (
            <div key={user.id} className="flex items-center gap-3">
              <img
                src={user.avatar_url || "/avatar-placeholder.svg"}
                alt={`${user.display_name} avatar`}
                className="w-8 h-8 rounded-full"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground text-sm truncate">{user.display_name || user.username}</h3>
                <p className="text-xs text-muted-foreground">@{user.username}</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs bg-transparent"
                onClick={() => onFollow(user.id)}
              >
                Follow
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Trending */}
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
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground text-sm">#NewGame</p>
              <p className="text-xs text-muted-foreground">856 posts</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

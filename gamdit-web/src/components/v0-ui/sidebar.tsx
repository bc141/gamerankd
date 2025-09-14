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
    <div className="sidebar">
      {/* Continue Playing */}
      <div className="sidebar-card">
        <div className="sidebar-header">
          <Play className="w-4 h-4 text-primary" />
          <h2 className="sidebar-title">Continue Playing</h2>
        </div>

        <div className="space-y-2">
          {games.map((game) => (
            <button
              key={game.id}
              onClick={() => onPlayGame(game.id)}
              className="sidebar-item"
              type="button"
            >
              <img
                src={game.cover_url || "/placeholder.svg"}
                alt={`${game.name} cover`}
                className="sidebar-item-image"
              />
              <div className="sidebar-item-info">
                <h3 className="sidebar-item-title">{game.name}</h3>
                <p className="sidebar-item-subtitle">Recently played</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Who to Follow */}
      <div className="sidebar-card">
        <div className="sidebar-header">
          <UserPlus className="w-4 h-4 text-primary" />
          <h2 className="sidebar-title">Who to Follow</h2>
        </div>

        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="sidebar-item">
              <img
                src={user.avatar_url || "/avatar-placeholder.svg"}
                alt={`${user.display_name} avatar`}
                className="sidebar-item-image"
              />
              <div className="sidebar-item-info">
                <h3 className="sidebar-item-title">{user.display_name || user.username}</h3>
                <p className="sidebar-item-subtitle">@{user.username}</p>
              </div>
              <button 
                className="sidebar-follow-button"
                onClick={() => onFollow(user.id)}
                type="button"
              >
                Follow
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Trending */}
      <div className="sidebar-card">
        <div className="sidebar-header">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="sidebar-title">Trending</h2>
        </div>

        <div className="space-y-2">
          <div className="sidebar-item">
            <div className="sidebar-item-info">
              <p className="sidebar-item-title">#Gaming</p>
              <p className="sidebar-item-subtitle">1.2K posts</p>
            </div>
          </div>
          
          <div className="sidebar-item">
            <div className="sidebar-item-info">
              <p className="sidebar-item-title">#NewGame</p>
              <p className="sidebar-item-subtitle">856 posts</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

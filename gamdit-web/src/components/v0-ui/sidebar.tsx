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
  onGameClick: (gameId: string) => void
  onUserClick: (userId: string) => void
  followedUsers?: Set<string>
}

export function Sidebar({ 
  games, 
  users, 
  onFollow, 
  onPlayGame,
  onGameClick,
  onUserClick,
  followedUsers = new Set()
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
              onClick={() => onGameClick(game.id)}
              className="sidebar-item"
              type="button"
              aria-label={`View ${game.name} details`}
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
          {users.map((user) => {
            const isFollowing = followedUsers.has(user.id);
            return (
              <div key={user.id} className="sidebar-item">
                <button
                  onClick={() => onUserClick(user.id)}
                  className="flex items-center gap-3 flex-1 min-w-0"
                  type="button"
                  aria-label={`View ${user.display_name || user.username} profile`}
                >
                  <img
                    src={user.avatar_url || "/avatar-placeholder.svg"}
                    alt={`${user.display_name || user.username} avatar`}
                    className="sidebar-item-image"
                  />
                  <div className="sidebar-item-info">
                    <h3 className="sidebar-item-title">{user.display_name || user.username}</h3>
                    <p className="sidebar-item-subtitle">@{user.username}</p>
                  </div>
                </button>
                <button
                  onClick={() => onFollow(user.id)}
                  className={`sidebar-follow-button ${isFollowing ? 'following' : ''}`}
                  type="button"
                  aria-label={`${isFollowing ? 'Unfollow' : 'Follow'} ${user.display_name || user.username}`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            );
          })}
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

import { Button } from './button'
import { Play, UserPlus, TrendingUp } from "lucide-react"

export interface ContinuePlayingGame {
  id: string
  title: string
  cover: string
  progress: string
}

export interface WhoToFollowUser {
  id: string
  avatar: string
  displayName: string
  handle: string
  isFollowing: boolean
}

interface SidebarProps {
  continuePlayingGames: ContinuePlayingGame[]
  whoToFollow: WhoToFollowUser[]
  onGameClick: (gameId: string) => void
  onFollowUser: (userId: string) => void
  onSeeAllGames: () => void
  onSeeAllUsers: () => void
}

export function Sidebar({ 
  continuePlayingGames, 
  whoToFollow, 
  onGameClick, 
  onFollowUser,
  onSeeAllGames,
  onSeeAllUsers
}: SidebarProps) {
  return (
    <div className="space-y-6">
      {/* Continue Playing */}
      <div className="bg-sidebar border border-sidebar-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 text-sidebar-accent" />
            <h2 className="font-semibold text-sidebar-foreground">Continue Playing</h2>
          </div>
          <button 
            onClick={onSeeAllGames}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            See all
          </button>
        </div>

        <div className="space-y-4">
          {continuePlayingGames.map((game) => (
            <div key={game.id} className="flex items-center gap-3">
              <img
                src={game.cover || "/placeholder.svg"}
                alt={`${game.title} cover`}
                className="w-12 h-12 rounded-lg object-cover border border-sidebar-border"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sidebar-foreground text-sm truncate">{game.title}</h3>
                <p className="text-xs text-muted-foreground">{game.progress}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Who to Follow */}
      <div className="bg-sidebar border border-sidebar-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-sidebar-accent" />
            <h2 className="font-semibold text-sidebar-foreground">Who to Follow</h2>
          </div>
          <button 
            onClick={onSeeAllUsers}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            See all
          </button>
        </div>

        <div className="space-y-4">
          {whoToFollow.map((user) => (
            <div key={user.id} className="flex items-center gap-3">
              <img
                src={user.avatar || "/avatar-placeholder.svg"}
                alt={`${user.displayName} avatar`}
                className="w-8 h-8 rounded-full"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sidebar-foreground text-sm truncate">{user.displayName}</h3>
                <p className="text-xs text-muted-foreground">{user.handle}</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs bg-transparent"
                onClick={() => onFollowUser(user.id)}
              >
                Follow
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Trending */}
      <div className="bg-sidebar border border-sidebar-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-sidebar-accent" />
          <h2 className="font-semibold text-sidebar-foreground">Trending</h2>
        </div>

        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">No trending topics yet</p>
          <p className="text-muted-foreground text-xs mt-1">Check back later!</p>
        </div>
      </div>
    </div>
  )
}

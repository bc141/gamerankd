import { Search, Bell, MessageCircle, User } from "lucide-react"
import { Button } from './button'

interface HeaderProps {
  onSearch: (query: string) => void
  onNotifications: () => void
  onMessages: () => void
  onProfile: () => void
  searchPlaceholder?: string
}

export function Header({ 
  onSearch, 
  onNotifications, 
  onMessages, 
  onProfile,
  searchPlaceholder = "Search games, players, posts..."
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
      <div className="max-w-[1240px] mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-foreground">Gamdit</h1>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md mx-8">
            <div className="relative" role="search">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input
                type="search"
                placeholder={searchPlaceholder}
                onChange={(e) => onSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-200"
              />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onNotifications} aria-label="Notifications">
              <Bell className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onMessages} aria-label="Messages">
              <MessageCircle className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onProfile} aria-label="Profile">
              <User className="w-5 h-5" />
            </Button>
          </nav>
        </div>
      </div>
    </header>
  )
}

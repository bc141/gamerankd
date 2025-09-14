"use client"

import { Button } from './button'
import { ImageIcon, Gamepad2 } from "lucide-react"

interface ComposerProps {
  content: string
  onContentChange: (content: string) => void
  onSubmit: () => void
  onAddImage: () => void
  onAddGame: () => void
  userAvatar?: string
  placeholder?: string
}

export function Composer({ 
  content, 
  onContentChange, 
  onSubmit, 
  onAddImage, 
  onAddGame,
  userAvatar = "/avatar-placeholder.svg",
  placeholder = "What's happening in your game?"
}: ComposerProps) {
  const isValid = content.trim().length > 0

  const handleSubmit = () => {
    if (isValid) {
      onSubmit()
    }
  }

  return (
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
            onChange={(e) => onContentChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground resize-none border-none outline-none text-lg min-h-[80px]"
            rows={3}
          />

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onAddImage} aria-label="Add image">
                <ImageIcon className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onAddGame} aria-label="Add game">
                <Gamepad2 className="w-5 h-5" />
              </Button>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!isValid}
              data-testid="composer-submit"
              className="transition-all duration-200"
            >
              Post
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState } from 'react'
import { Button } from './button'
import { ImageIcon, Gamepad2 } from "lucide-react"

interface ComposerProps {
  onPost: (content: string, gameId?: string) => void
  onAddImage: () => void
  onAddGame: () => void
  placeholder?: string
}

export function Composer({ 
  onPost, 
  onAddImage, 
  onAddGame,
  placeholder = "What's happening in your game?"
}: ComposerProps) {
  const [content, setContent] = useState('')
  const isValid = content.trim().length > 0

  const handleSubmit = () => {
    if (isValid) {
      onPost(content)
      setContent('')
    }
  }

  return (
    <div className="composer">
      <div className="composer-header">
        <img 
          src="/avatar-placeholder.svg" 
          alt="Your avatar" 
          className="composer-avatar" 
        />

        <div className="composer-content">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder}
            className="composer-textarea"
            rows={3}
          />

          <div className="composer-actions">
            <div className="composer-buttons">
              <button 
                className="composer-button" 
                onClick={onAddImage} 
                aria-label="Add image"
                type="button"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <button 
                className="composer-button" 
                onClick={onAddGame} 
                aria-label="Add game"
                type="button"
              >
                <Gamepad2 className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!isValid}
              data-testid="composer-submit"
              className="composer-submit"
              type="button"
            >
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

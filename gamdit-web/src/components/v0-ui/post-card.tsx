"use client"

import { useState } from "react"
import { Heart, MessageCircle, Share, MoreHorizontal } from "lucide-react"
import { Button } from './button'

export interface PostData {
  id: string
  user: {
    avatar: string
    displayName: string
    handle: string
  }
  timestamp: string
  content: string
  gameImage?: string
  likes: number
  comments: number
  shares: number
  isLiked: boolean
}

interface PostCardProps {
  post: PostData
  onLike: (postId: string) => void
  onComment: (postId: string) => void
  onShare: (postId: string) => void
  onMore: (postId: string) => void
}

export function PostCard({ post, onLike, onComment, onShare, onMore }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.isLiked)
  const [likeCount, setLikeCount] = useState(post.likes)

  const handleLike = () => {
    setIsLiked(!isLiked)
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1))
    onLike(post.id)
  }

  return (
    <article className="bg-card border border-border rounded-xl p-6 transition-all duration-200 hover:border-border/80">
      <div className="flex gap-4">
        <img
          src={post.user.avatar || "/avatar-placeholder.svg"}
          alt={`${post.user.displayName} avatar`}
          className="w-10 h-10 rounded-full flex-shrink-0"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-foreground">{post.user.displayName}</h3>
            <span className="text-muted-foreground text-sm">{post.user.handle}</span>
            <span className="text-muted-foreground text-sm">·</span>
            <time className="text-muted-foreground text-sm">{post.timestamp}</time>

            <Button variant="ghost" size="icon" className="ml-auto" onClick={() => onMore(post.id)} aria-label="More options">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-foreground mb-4 leading-relaxed">{post.content}</p>

          {post.gameImage && (
            <div className="mb-4">
              <img
                src={post.gameImage || "/placeholder.svg"}
                alt="Game screenshot"
                className="rounded-lg max-w-full h-auto border border-border"
              />
            </div>
          )}

          <div className="flex items-center gap-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              data-testid="like-button"
              className={`gap-2 min-h-[44px] transition-colors duration-200 ${
                isLiked ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={`${isLiked ? "Unlike" : "Like"} post`}
            >
              <Heart className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} />
              <span className="text-sm">{likeCount}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onComment(post.id)}
              data-testid="comment-button"
              className="gap-2 text-muted-foreground hover:text-foreground min-h-[44px] transition-colors duration-200"
              aria-label="Comment on post"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm">{post.comments}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onShare(post.id)}
              data-testid="share-button"
              className="gap-2 text-muted-foreground hover:text-foreground min-h-[44px] transition-colors duration-200"
              aria-label="Share post"
            >
              <Share className="w-4 h-4" />
              <span className="text-sm">{post.shares}</span>
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
}

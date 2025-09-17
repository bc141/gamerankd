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
    <article className="post-card">
      <div className="post-header">
        <img
          src={post.user.avatar || "/avatar-placeholder.svg"}
          alt={`${post.user.displayName} avatar`}
          className="post-avatar"
        />

        <div className="post-info">
          <div className="post-user">
            <h3 className="post-name">{post.user.displayName}</h3>
            <span className="post-handle">{post.user.handle}</span>
            <span className="post-time">· {post.timestamp}</span>

            <button 
              className="post-more" 
              onClick={() => onMore(post.id)} 
              aria-label="More options"
              type="button"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          <p className="post-content">{post.content}</p>

          {post.gameImage && (
            <div className="post-media-container">
              <img
                src={post.gameImage || "/placeholder.svg"}
                alt="Game screenshot"
                className="post-media"
              />
            </div>
          )}

          <div className="post-actions">
            <button
              onClick={handleLike}
              data-testid="like-button"
              className={`post-action ${isLiked ? "liked" : ""}`}
              aria-label={`${isLiked ? "Unlike" : "Like"} post`}
              type="button"
            >
              <Heart className={isLiked ? "fill-current" : ""} />
              <span>{likeCount}</span>
            </button>

            <button
              onClick={() => onComment(post.id)}
              data-testid="comment-button"
              className="post-action"
              aria-label="Comment on post"
              type="button"
            >
              <MessageCircle />
              <span>{post.comments}</span>
            </button>

            <button
              onClick={() => onShare(post.id)}
              data-testid="share-button"
              className="post-action"
              aria-label="Share post"
              type="button"
            >
              <Share />
              <span>{post.shares}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

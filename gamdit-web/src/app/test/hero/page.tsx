"use client"

import { useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'

export default function HeroTestPage() {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Hero Test</h1>
          <p className="text-muted-foreground">Testing hero component variations</p>
        </div>

        <div className="space-y-8">
          {/* Hero Variation 1: Gradient Background */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Gradient Background</h2>
            <div
              className="relative overflow-hidden rounded-xl p-8 text-center"
              style={{
                background: `linear-gradient(135deg, #7a00ff 0%, #2f3bff 100%)`,
              }}
            >
              <div className="relative z-10">
                <h3 className="text-2xl font-bold text-white mb-2">
                  Welcome to Gamdit
                </h3>
                <p className="text-white/90 mb-6 max-w-md mx-auto">
                  Connect with fellow gamers, share your achievements, and discover new games.
                </p>
                <button
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                >
                  Get Started
                  <ArrowRight className={`w-4 h-4 transition-transform ${isHovered ? 'translate-x-1' : ''}`} />
                </button>
              </div>
              <div className="absolute inset-0 bg-black/10" />
            </div>
          </div>

          {/* Hero Variation 2: Card Style */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Card Style</h2>
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">
                Start Your Gaming Journey
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Join thousands of gamers sharing their experiences, reviews, and favorite moments.
              </p>
              <button className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
                Join Community
              </button>
            </div>
          </div>

          {/* Hero Variation 3: Minimal */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Minimal</h2>
            <div className="text-center py-12">
              <h3 className="text-3xl font-bold text-foreground mb-4">
                Your Gaming Community Awaits
              </h3>
              <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
                Share your gaming experiences, connect with like-minded players, and discover your next favorite game.
              </p>
              <div className="flex gap-4 justify-center">
                <button className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
                  Get Started
                </button>
                <button className="px-6 py-3 border border-border text-foreground rounded-lg font-medium hover:bg-muted transition-colors">
                  Learn More
                </button>
              </div>
            </div>
          </div>

          {/* Hero Variation 4: Split Layout */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Split Layout</h2>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="grid md:grid-cols-2 gap-0">
                <div className="p-8">
                  <h3 className="text-2xl font-bold text-foreground mb-4">
                    Connect. Share. Discover.
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Join the ultimate gaming community where every achievement matters and every story counts.
                  </p>
                  <button className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
                    Start Now
                  </button>
                </div>
                <div className="bg-muted/50 p-8 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-10 h-10 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">Visual element placeholder</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

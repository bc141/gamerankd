"use client"

interface FeedTabsProps {
  activeTab: "following" | "for-you"
  onTabChange: (tab: "following" | "for-you") => void
}

export function FeedTabs({ activeTab, onTabChange }: FeedTabsProps) {
  return (
    <div role="tablist" className="feed-tabs">
      <button
        role="tab"
        aria-selected={activeTab === "following"}
        data-testid="following-tab"
        onClick={() => onTabChange("following")}
        className={activeTab === "following" ? "active" : ""}
      >
        Following
      </button>
      <button
        role="tab"
        aria-selected={activeTab === "for-you"}
        data-testid="for-you-tab"
        onClick={() => onTabChange("for-you")}
        className={activeTab === "for-you" ? "active" : ""}
      >
        For You
      </button>
    </div>
  )
}

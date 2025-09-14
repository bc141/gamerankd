"use client"

interface FeedTabsProps {
  activeTab: "following" | "for-you"
  onTabChange: (tab: "following" | "for-you") => void
}

export function FeedTabs({ activeTab, onTabChange }: FeedTabsProps) {
  return (
    <div role="tablist" className="flex bg-card rounded-lg p-1 border border-border">
      <button
        role="tab"
        aria-selected={activeTab === "following"}
        data-testid="following-tab"
        onClick={() => onTabChange("following")}
        className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 min-h-[44px] ${
          activeTab === "following"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
      >
        Following
      </button>
      <button
        role="tab"
        aria-selected={activeTab === "for-you"}
        data-testid="for-you-tab"
        onClick={() => onTabChange("for-you")}
        className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 min-h-[44px] ${
          activeTab === "for-you"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
      >
        For You
      </button>
    </div>
  )
}

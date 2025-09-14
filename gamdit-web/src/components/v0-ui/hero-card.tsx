import { Button } from './button'

interface HeroCardProps {
  title: string
  subtitle?: string
  ctaText: string
  onCtaClick: () => void
}

export function HeroCard({ title, subtitle, ctaText, onCtaClick }: HeroCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl p-8 text-center"
      style={{
        background: `linear-gradient(135deg, var(--brand-gradient-start) 0%, var(--brand-gradient-end) 100%)`,
      }}
    >
      <div className="relative z-10">
        <h2 className="text-2xl font-bold text-white mb-4">{title}</h2>
        {subtitle && (
          <p className="text-white/90 mb-4 text-sm">{subtitle}</p>
        )}
        <Button
          size="lg"
          onClick={onCtaClick}
          className="bg-black/80 hover:bg-black/90 text-white border-black/50 backdrop-blur-sm transition-all duration-200"
        >
          {ctaText}
        </Button>
      </div>

      {/* Subtle overlay pattern */}
      <div className="absolute inset-0 bg-black/10" />
    </div>
  )
}

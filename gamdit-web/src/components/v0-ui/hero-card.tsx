import { Button } from './button'

interface HeroCardProps {
  title: string
  description?: string
  buttonText: string
  onButtonClick: () => void
}

export function HeroCard({ title, description, buttonText, onButtonClick }: HeroCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl p-8 text-center"
      style={{
        background: `linear-gradient(135deg, var(--brand-gradient-start) 0%, var(--brand-gradient-end) 100%)`,
      }}
    >
      <div className="relative z-10">
        <h2 className="text-2xl font-bold text-white mb-4">{title}</h2>
        {description && (
          <p className="text-white/90 mb-4 text-sm">{description}</p>
        )}
        <Button
          size="lg"
          onClick={onButtonClick}
          className="bg-black/80 hover:bg-black/90 text-white border-black/50 backdrop-blur-sm transition-all duration-200"
        >
          {buttonText}
        </Button>
      </div>

      {/* Subtle overlay pattern */}
      <div className="absolute inset-0 bg-black/10" />
    </div>
  )
}

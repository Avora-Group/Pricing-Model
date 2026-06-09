interface PlaceholderPageProps {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">{title}</h1>
        <p className="text-[var(--text-tertiary)]">{description}</p>
      </div>
    </div>
  )
}

'use client'

export interface SensitivityParam {
  key: string
  label: string
  unit: string
  defaultInterval: number
}

export const SENSITIVITY_PARAMS: SensitivityParam[] = [
  { key: 'mgh', label: 'MGH', unit: 'BH', defaultInterval: 10 },
  { key: 'cycleRatio', label: 'Cycle Ratio', unit: '', defaultInterval: 0.25 },
  { key: 'acmiRate', label: 'ACMI Rate', unit: '€/BH', defaultInterval: 100 },
]

interface ParameterPickerProps {
  selected: string
  onChange: (key: string) => void
}

export function ParameterPicker({ selected, onChange }: ParameterPickerProps) {
  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor="sensitivity-param"
        className="text-sm font-medium"
        style={{ color: 'var(--ink-2)' }}
      >
        Parameter
      </label>
      <select
        id="sensitivity-param"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="av-input"
      >
        {SENSITIVITY_PARAMS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  )
}

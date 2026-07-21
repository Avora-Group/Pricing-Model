import { LineDetailPopover } from 'nextjs-project'

/* The popover positions itself `fixed` at the given cursor point; the
 * transformed wrapper contains it inside the preview cell (a transformed
 * ancestor becomes the containing block for fixed-position children). */
function Contain({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ transform: 'translate(0,0)', position: 'relative', width: 360, height: 330 }}>
      {children}
    </div>
  )
}

/** Crew cost build-up with per-line formulas and parameter footer. */
export function CrewBreakdown() {
  return (
    <Contain>
      <LineDetailPopover
        title="Crew"
        monthLabel="Per month"
        cursor={{ x: 4, y: 4 }}
        items={[
          { label: 'Pilot Salary', value: 43491, formula: '10,873 × 4 sets' },
          { label: 'Cabin Crew Salary', value: 23103 },
          { label: 'Uniform', value: 901 },
          { label: 'Training', value: 3884 },
          { label: 'Pilot Per Diem', value: 47840, formula: '11,960 × 4 sets' },
          { label: 'Cabin Crew Per Diem', value: 39480 },
          { label: 'Accom & Travel', value: 1229 },
        ]}
        params={[
          { label: 'Sets', value: 4, decimals: 0 },
          { label: 'BH', value: 350, decimals: 0 },
          { label: 'FH', value: 292, decimals: 0 },
        ]}
      />
    </Contain>
  )
}

/** Compact variant — no formulas, no parameter footer. */
export function SimpleBreakdown() {
  return (
    <Contain>
      <LineDetailPopover
        title="Maint. Reserves — Fixed"
        monthLabel="JUL"
        cursor={{ x: 4, y: 4 }}
        items={[
          { label: '6-Year Check', value: 41250 },
          { label: '12-Year Check', value: 30416 },
          { label: 'Landing Gear', value: 5833 },
        ]}
      />
    </Contain>
  )
}

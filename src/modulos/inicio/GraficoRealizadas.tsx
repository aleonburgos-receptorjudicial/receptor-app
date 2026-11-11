// Gráfico pequeño: causas realizadas por mes (últimos 6 meses). Una sola serie: el título la nombra.
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'

export interface MesRealizadas {
  mes: string
  realizadas: number
}

function Detalle({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null
  const n = (payload[0].payload as MesRealizadas).realizadas
  return (
    <div className="rounded-lg border border-borde bg-superficie px-3 py-2 text-sm shadow-lg">
      <p className="font-bold">{label}</p>
      <p className="cifra">{n === 1 ? '1 causa realizada' : `${n} causas realizadas`}</p>
    </div>
  )
}

export default function GraficoRealizadas({ datos }: { datos: MesRealizadas[] }) {
  const total = datos.reduce((s, d) => s + d.realizadas, 0)
  return (
    <div className="h-48 w-full" role="img" aria-label={`Causas realizadas por mes, últimos 6 meses: ${datos.map((d) => `${d.mes} ${d.realizadas}`).join(', ')}.`}>
      {total === 0 ? (
        <p className="flex h-full items-center justify-center text-tenue">Aún no hay causas realizadas en los últimos 6 meses.</p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 16, right: 4, bottom: 0, left: 4 }} barCategoryGap="30%">
            <XAxis dataKey="mes" tick={{ fill: 'var(--tenue)', fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'var(--borde)' }} />
            <YAxis allowDecimals={false} tick={{ fill: 'var(--tenue)', fontSize: 12 }} tickLine={false} axisLine={false} width={28} />
            <Tooltip content={Detalle} cursor={{ fill: 'var(--petroleo-suave)' }} />
            <Bar dataKey="realizadas" name="Realizadas" fill="var(--serie-pagado)" radius={[4, 4, 0, 0]} isAnimationActive={false} label={{ position: 'top', fill: 'var(--tinta)', fontSize: 12 }} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

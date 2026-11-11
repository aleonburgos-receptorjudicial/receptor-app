// Gráfico de emisión mensual: por cada mes, lo ya cobrado y lo que falta por cobrar de las boletas emitidas.
// Barras apiladas con leyenda, detalle al pasar el mouse o tocar, y opción de verlo como tabla.
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { numeroCL, pesos } from '../../utilidades/formato'

export interface MesEmision {
  mes: string
  pagado: number
  porCobrar: number
  cantidad: number
}

/** Montos cortos para el eje: "$350 mil", "$1,2 M" */
const corto = (v: number) => (v >= 1_000_000 ? `$${(v / 1_000_000).toLocaleString('es-CL', { maximumFractionDigits: 1 })} M` : v >= 1000 ? `$${numeroCL(Math.round(v / 1000))} mil` : `$${v}`)

function Detalle({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null
  const fila = payload[0].payload as MesEmision
  return (
    <div className="rounded-lg border border-borde bg-superficie px-3 py-2 text-sm shadow-lg">
      <p className="font-bold">{label}</p>
      <p className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-sm bg-serie-pagado" aria-hidden="true" /> Cobrado <span className="ml-auto pl-3 font-bold cifra">{pesos(fila.pagado)}</span>
      </p>
      <p className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-sm bg-serie-cobrar" aria-hidden="true" /> Por cobrar <span className="ml-auto pl-3 font-bold cifra">{pesos(fila.porCobrar)}</span>
      </p>
      <p className="mt-1 text-tenue">{fila.cantidad === 1 ? '1 boleta emitida' : `${fila.cantidad} boletas emitidas`}</p>
    </div>
  )
}

export default function GraficoEmision({ datos }: { datos: MesEmision[] }) {
  const [tabla, setTabla] = useState(false)
  const hayDatos = datos.some((d) => d.pagado + d.porCobrar > 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap gap-4 text-sm" aria-label="Leyenda">
          <li className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-serie-pagado" aria-hidden="true" /> Cobrado
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-serie-cobrar" aria-hidden="true" /> Por cobrar
          </li>
        </ul>
        <button type="button" className="min-h-10 rounded-md px-2 text-sm font-bold text-petroleo hover:bg-petroleo-suave" onClick={() => setTabla((t) => !t)}>
          {tabla ? 'Ver gráfico' : 'Ver como tabla'}
        </button>
      </div>
      {!hayDatos ? (
        <p className="py-8 text-center text-tenue">Aún no hay boletas vigentes en los últimos 12 meses.</p>
      ) : tabla ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-tenue">
              <tr>
                <th className="py-1 pr-3">Mes</th>
                <th className="py-1 pr-3 text-right">Cobrado</th>
                <th className="py-1 pr-3 text-right">Por cobrar</th>
                <th className="py-1 text-right">Boletas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {datos.map((d) => (
                <tr key={d.mes}>
                  <td className="py-1 pr-3">{d.mes}</td>
                  <td className="py-1 pr-3 text-right cifra">{pesos(d.pagado)}</td>
                  <td className="py-1 pr-3 text-right cifra">{pesos(d.porCobrar)}</td>
                  <td className="py-1 text-right cifra">{d.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-64 w-full" role="img" aria-label="Gráfico de emisión mensual: cobrado y por cobrar de los últimos 12 meses. Use «Ver como tabla» para leer los montos.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="25%">
              <CartesianGrid vertical={false} stroke="var(--borde)" strokeDasharray="0" />
              <XAxis dataKey="mes" tick={{ fill: 'var(--tenue)', fontSize: 12 }} tickLine={false} axisLine={{ stroke: 'var(--borde)' }} interval="preserveStartEnd" />
              <YAxis tickFormatter={corto} tick={{ fill: 'var(--tenue)', fontSize: 12 }} tickLine={false} axisLine={false} width={84} allowDecimals={false} tickCount={5} />
              <Tooltip content={Detalle} cursor={{ fill: 'var(--petroleo-suave)' }} />
              <Bar dataKey="pagado" name="Cobrado" stackId="a" fill="var(--serie-pagado)" stroke="var(--superficie)" strokeWidth={2} isAnimationActive={false} />
              <Bar dataKey="porCobrar" name="Por cobrar" stackId="a" fill="var(--serie-cobrar)" stroke="var(--superficie)" strokeWidth={2} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

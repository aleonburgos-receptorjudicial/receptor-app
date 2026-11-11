// Resumen por cliente: cuántas causas tiene cada estudio pendientes, atrasadas y realizadas.
import type { Ajustes, Causa, Cliente } from '../../db/tipos'
import { Boton } from '../../compartido/Controles'
import { Ventana } from '../../compartido/Ventana'
import { hoyISO } from '../../utilidades/formato'
import { causaAtrasada } from './prioridad'

interface Fila {
  id: number | 'sin'
  nombre: string
  pendientes: number
  atrasadas: number
  realizadas: number
  otras: number
}

export function resumirPorCliente(causas: Causa[], clientes: Cliente[], umbrales: Ajustes['umbralesCausas']): Fila[] {
  const hoy = hoyISO()
  const filas = new Map<number | 'sin', Fila>()
  const nombre = new Map(clientes.map((c) => [c.id!, c.nombre]))
  for (const c of causas) {
    const id = c.clienteId && nombre.has(c.clienteId) ? c.clienteId : 'sin'
    const f = filas.get(id) ?? { id, nombre: id === 'sin' ? 'Sin cliente' : nombre.get(id)!, pendientes: 0, atrasadas: 0, realizadas: 0, otras: 0 }
    if (c.estado === 'Pendiente') f.pendientes++
    else if (c.estado === 'Realizada') f.realizadas++
    else f.otras++
    if (causaAtrasada(c, umbrales, hoy)) f.atrasadas++
    filas.set(id, f)
  }
  return [...filas.values()].sort((a, b) => b.atrasadas - a.atrasadas || b.pendientes - a.pendientes || a.nombre.localeCompare(b.nombre, 'es'))
}

export function ResumenPorCliente({
  abierta,
  causas,
  clientes,
  ajustes,
  alCerrar,
  alElegir,
}: {
  abierta: boolean
  causas: Causa[]
  clientes: Cliente[]
  ajustes: Ajustes
  alCerrar: () => void
  alElegir: (id: number | 'sin') => void
}) {
  const filas = abierta ? resumirPorCliente(causas, clientes, ajustes.umbralesCausas) : []
  return (
    <Ventana abierta={abierta} titulo="Resumen por cliente" alCerrar={alCerrar} ancho="max-w-3xl" pie={<Boton onClick={alCerrar}>Cerrar</Boton>}>
      <p className="mb-3 text-tenue">Toque un cliente para ver solo sus causas.</p>
      <div className="overflow-x-auto rounded-lg border border-borde">
        <table className="w-full min-w-[30rem] text-left">
          <thead className="bg-papel text-tenue">
            <tr>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2 text-right">Pendientes</th>
              <th className="px-3 py-2 text-right">Atrasadas</th>
              <th className="px-3 py-2 text-right">Realizadas</th>
              <th className="px-3 py-2 text-right">Suspendidas o devueltas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {filas.map((f) => (
              <tr key={f.id} className="cursor-pointer hover:bg-petroleo-suave" onClick={() => alElegir(f.id)}>
                <td className="px-3 py-2">
                  <button type="button" className="text-left font-bold text-petroleo" onClick={() => alElegir(f.id)}>
                    {f.nombre}
                  </button>
                </td>
                <td className="px-3 py-2 text-right cifra">{f.pendientes}</td>
                <td className={`px-3 py-2 text-right cifra ${f.atrasadas ? 'font-bold text-rojo' : ''}`}>{f.atrasadas}</td>
                <td className="px-3 py-2 text-right cifra">{f.realizadas}</td>
                <td className="px-3 py-2 text-right cifra text-tenue">{f.otras}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Ventana>
  )
}

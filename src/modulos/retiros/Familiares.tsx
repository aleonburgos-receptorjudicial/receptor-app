// Familiares o relacionados del demandado: lista que se llena desde los informes o a mano.
import { useState } from 'react'
import type { Familiar } from '../../db/tipos'
import { Boton, Campo } from '../../compartido/Controles'
import { revisarRut } from '../../utilidades/rut'

export function Familiares({ lista, alCambiar }: { lista: Familiar[]; alCambiar: (l: Familiar[]) => void }) {
  const [nuevo, setNuevo] = useState<Familiar>({ nombre: '', relacion: '', rut: '' })
  const [error, setError] = useState<{ nombre?: string; rut?: string }>({})
  const [abierto, setAbierto] = useState(false)

  const agregar = () => {
    const nombre = nuevo.nombre.trim()
    const er: typeof error = {}
    if (!nombre) er.nombre = 'Escriba el nombre.'
    const rut = revisarRut(nuevo.rut)
    if (rut.error) er.rut = rut.error
    setError(er)
    if (Object.keys(er).length) return
    alCambiar([...lista, { nombre, relacion: nuevo.relacion?.trim() || undefined, rut: rut.valor }])
    setNuevo({ nombre: '', relacion: '', rut: '' })
    setAbierto(false)
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-borde p-4" aria-labelledby="titulo-familiares">
      <h3 id="titulo-familiares" className="font-serif text-lg font-bold">
        Familiares del demandado
      </h3>
      {lista.length === 0 ? (
        <p className="text-sm text-tenue">Sin familiares registrados. Se agregan solos al leer un informe PDF, o a mano.</p>
      ) : (
        <ul className="divide-y divide-borde rounded-lg border border-borde">
          {lista.map((f, i) => (
            <li key={`${f.nombre}-${i}`} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="font-bold">{f.nombre}</span>
                <span className="block text-sm text-tenue cifra">{[f.relacion, f.rut && `RUT ${f.rut}`].filter(Boolean).join(', ') || 'Sin parentesco ni RUT'}</span>
              </span>
              <Boton variante="discreto" className="min-h-10 py-1 text-rojo" aria-label={`Quitar a ${f.nombre}`} onClick={() => alCambiar(lista.filter((_, j) => j !== i))}>
                Quitar
              </Boton>
            </li>
          ))}
        </ul>
      )}
      {abierto ? (
        <div className="grid gap-3 rounded-lg bg-papel p-3 md:grid-cols-3">
          <Campo etiqueta="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))} error={error.nombre} autoFocus />
          <Campo etiqueta="Parentesco" value={nuevo.relacion ?? ''} onChange={(e) => setNuevo((n) => ({ ...n, relacion: e.target.value }))} placeholder="Madre, hermano…" />
          <Campo etiqueta="RUT" value={nuevo.rut ?? ''} onChange={(e) => setNuevo((n) => ({ ...n, rut: e.target.value }))} error={error.rut} placeholder="Opcional" />
          <div className="flex gap-2 md:col-span-3">
            <Boton onClick={agregar}>Agregar familiar</Boton>
            <Boton variante="secundario" onClick={() => setAbierto(false)}>
              Cancelar
            </Boton>
          </div>
        </div>
      ) : (
        <Boton variante="secundario" className="self-start" onClick={() => setAbierto(true)}>
          + Agregar familiar a mano
        </Boton>
      )}
    </section>
  )
}

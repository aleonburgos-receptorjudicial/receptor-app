// Ventana para unir clientes repetidos (ej. "Estudio Pérez" y "Estudio Perez Ltda.").
import { useEffect, useMemo, useState } from 'react'
import type { Cliente } from '../../db/tipos'
import { Boton } from '../../compartido/Controles'
import { useAviso, useConfirmar } from '../../compartido/Dialogos'
import { Ventana } from '../../compartido/Ventana'
import { plural } from '../../utilidades/formato'
import { contiene } from '../../utilidades/texto'
import { fusionarClientes, sugerirFusiones } from './servicioClientes'

export function FusionarClientes({ abierta, clientes, alCerrar }: { abierta: boolean; clientes: Cliente[]; alCerrar: () => void }) {
  const confirmar = useConfirmar()
  const avisar = useAviso()
  const [seleccion, setSeleccion] = useState<number[]>([])
  const [conservar, setConservar] = useState<number | null>(null)
  const [filtro, setFiltro] = useState('')

  const sugerencias = useMemo(() => sugerirFusiones(clientes), [clientes])

  useEffect(() => {
    if (abierta) {
      setSeleccion([])
      setConservar(null)
      setFiltro('')
    }
  }, [abierta])

  const elegirGrupo = (grupo: Cliente[]) => {
    setSeleccion(grupo.map((c) => c.id!))
    // Se propone conservar el nombre más completo
    const masLargo = [...grupo].sort((a, b) => b.nombre.length - a.nombre.length)[0]
    setConservar(masLargo.id!)
  }

  const alternar = (id: number) => {
    const nueva = seleccion.includes(id) ? seleccion.filter((x) => x !== id) : [...seleccion, id]
    setSeleccion(nueva)
    if (conservar === null || !nueva.includes(conservar)) setConservar(nueva[0] ?? null)
  }

  const fusionar = async () => {
    if (conservar === null || seleccion.length < 2) return
    const principal = clientes.find((c) => c.id === conservar)
    const otros = clientes.filter((c) => seleccion.includes(c.id!) && c.id !== conservar)
    const ok = await confirmar({
      titulo: 'Fusionar clientes',
      mensaje: (
        <>
          <p>
            Se conservará <strong>«{principal?.nombre}»</strong>.
          </p>
          <p className="mt-2">
            Se unirán y desaparecerán: {otros.map((o) => `«${o.nombre}»`).join(', ')}. Todas sus causas, retiros y boletas pasarán al cliente conservado.
          </p>
          <p className="mt-2 text-tenue">Esta acción no se puede deshacer.</p>
        </>
      ),
      textoConfirmar: 'Fusionar',
    })
    if (!ok) return
    try {
      await fusionarClientes(conservar, seleccion)
      avisar(`${plural(otros.length + 1, 'cliente', 'clientes')} unidos en «${principal?.nombre}»`)
      alCerrar()
    } catch {
      avisar('No se pudieron fusionar los clientes. Intente de nuevo.', 'error')
    }
  }

  const visibles = clientes.filter((c) => contiene(c.nombre, filtro) || contiene(c.rut, filtro))

  return (
    <Ventana
      abierta={abierta}
      titulo="Fusionar clientes"
      alCerrar={alCerrar}
      ancho="max-w-3xl"
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton onClick={fusionar} disabled={seleccion.length < 2 || conservar === null}>
            Fusionar {seleccion.length >= 2 ? plural(seleccion.length, 'cliente', 'clientes') : ''}
          </Boton>
        </>
      }
    >
      <p className="text-tenue">Marque los clientes que son el mismo y elija cuál nombre se conserva.</p>

      {sugerencias.length > 0 && (
        <div className="mt-4">
          <h3 className="font-bold">Posibles repetidos</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {sugerencias.map((g) => (
              <li key={g.map((c) => c.id).join('-')}>
                <button
                  type="button"
                  onClick={() => elegirGrupo(g)}
                  className="w-full rounded-lg border-2 border-borde px-4 py-3 text-left hover:border-petroleo"
                >
                  {g.map((c) => c.nombre).join('  /  ')}
                  <span className="mt-1 block text-sm font-bold text-petroleo">Seleccionar este grupo</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <label className="font-bold" htmlFor="filtro-fusion">
          Todos los clientes
        </label>
        <input
          id="filtro-fusion"
          className="mt-1 min-h-12 w-full rounded-lg border-2 border-borde bg-superficie px-3"
          placeholder="Buscar por nombre o RUT"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
        <ul className="mt-3 flex flex-col divide-y divide-borde rounded-lg border border-borde">
          {visibles.map((c) => {
            const marcado = seleccion.includes(c.id!)
            return (
              <li key={c.id} className={`flex flex-wrap items-center gap-3 px-3 py-2 ${marcado ? 'bg-petroleo-suave' : ''}`}>
                <label className="flex min-h-12 flex-1 cursor-pointer items-center gap-3">
                  <input type="checkbox" className="h-6 w-6 accent-[var(--petroleo)]" checked={marcado} onChange={() => alternar(c.id!)} />
                  <span>
                    {c.nombre}
                    {c.rut && <span className="block text-sm text-tenue">{c.rut}</span>}
                  </span>
                </label>
                {marcado && (
                  <label className="flex min-h-12 cursor-pointer items-center gap-2 text-sm font-bold">
                    <input
                      type="radio"
                      name="conservar"
                      className="h-5 w-5 accent-[var(--petroleo)]"
                      checked={conservar === c.id}
                      onChange={() => setConservar(c.id!)}
                    />
                    Conservar este nombre
                  </label>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </Ventana>
  )
}

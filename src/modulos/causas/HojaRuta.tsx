// Hoja de ruta del día: causas pendientes agrupadas por sector, las más urgentes primero.
import { useState } from 'react'
import type { Ajustes, Causa, Cliente } from '../../db/tipos'
import { Boton } from '../../compartido/Controles'
import { useAviso } from '../../compartido/Dialogos'
import { Ventana } from '../../compartido/Ventana'
import { fechaCL, hoyISO, plural } from '../../utilidades/formato'
import { normalizar } from '../../utilidades/texto'
import { EtiquetaPrioridad, MarcaUrgente } from './Etiquetas'
import { diasDesdeEncargo, prioridadCausa } from './prioridad'

const SIN_SECTOR = 'Sin sector'

export function agruparPorSector(causas: Causa[]): [string, Causa[]][] {
  const grupos = new Map<string, Causa[]>()
  for (const c of causas.filter((x) => x.estado === 'Pendiente')) {
    const sector = c.sector?.trim() || SIN_SECTOR
    // Se agrupan sin importar tildes ni mayúsculas
    const clave = [...grupos.keys()].find((k) => normalizar(k) === normalizar(sector)) ?? sector
    grupos.set(clave, [...(grupos.get(clave) ?? []), c])
  }
  for (const lista of grupos.values()) {
    // Urgentes primero, luego las más antiguas, luego por domicilio
    lista.sort((a, b) => Number(!!b.urgente) - Number(!!a.urgente) || a.fechaEncargo.localeCompare(b.fechaEncargo) || (a.domicilio ?? '').localeCompare(b.domicilio ?? ''))
  }
  return [...grupos.entries()].sort(([a], [b]) => (a === SIN_SECTOR ? 1 : b === SIN_SECTOR ? -1 : a.localeCompare(b, 'es')))
}

export function HojaRuta({
  abierta,
  causas,
  clientes,
  ajustes,
  alCerrar,
  alMarcar,
}: {
  abierta: boolean
  causas: Causa[]
  clientes: Cliente[]
  ajustes: Ajustes
  alCerrar: () => void
  alMarcar: (c: Causa) => void
}) {
  const avisar = useAviso()
  const [soloSector, setSoloSector] = useState('')
  const grupos = agruparPorSector(causas)
  const visibles = soloSector ? grupos.filter(([s]) => s === soloSector) : grupos
  const total = visibles.reduce((s, [, l]) => s + l.length, 0)
  const cliente = new Map(clientes.map((c) => [c.id, c.nombre]))
  const hoy = hoyISO()

  const copiar = async () => {
    const lineas = [`Hoja de ruta ${fechaCL(hoy)}`, '']
    for (const [sector, lista] of visibles) {
      lineas.push(`${sector.toUpperCase()} (${lista.length})`)
      lista.forEach((c, i) => {
        lineas.push(`${i + 1}. ${c.rol}${c.urgente ? ' [URGENTE]' : ''} — ${c.tipoDiligencia ?? 'Diligencia'}`)
        lineas.push(`   ${c.demandado ?? 'Demandado sin nombre'} · ${c.domicilio ?? 'Sin domicilio'}`)
      })
      lineas.push('')
    }
    const texto = lineas.join('\n')
    try {
      await navigator.clipboard.writeText(texto)
      avisar('Hoja de ruta copiada. Puede pegarla en WhatsApp o en un correo.')
    } catch {
      avisar('No se pudo copiar automáticamente. Use el botón Imprimir.', 'error')
    }
  }

  return (
    <Ventana
      abierta={abierta}
      titulo={`Hoja de ruta del ${fechaCL(hoy)}`}
      alCerrar={alCerrar}
      ancho="max-w-4xl"
      pie={
        <>
          <Boton variante="secundario" onClick={() => window.print()}>
            Imprimir
          </Boton>
          <Boton variante="secundario" onClick={copiar}>
            Copiar como texto
          </Boton>
          <Boton onClick={alCerrar}>Cerrar</Boton>
        </>
      }
    >
      {grupos.length === 0 ? (
        <p className="text-lg">No hay causas pendientes. Buen trabajo.</p>
      ) : (
        <div className="flex flex-col gap-6 hoja-ruta">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-bold">Sector</span>
              <select className="min-h-12 rounded-lg border-2 border-borde bg-superficie px-3" value={soloSector} onChange={(e) => setSoloSector(e.target.value)}>
                <option value="">Todos los sectores</option>
                {grupos.map(([s, l]) => (
                  <option key={s} value={s}>
                    {s} ({l.length})
                  </option>
                ))}
              </select>
            </label>
            <p className="font-bold text-tenue">{plural(total, 'causa pendiente', 'causas pendientes')}</p>
          </div>
          {visibles.map(([sector, lista]) => (
            <section key={sector}>
              <h3 className="mb-2 font-serif text-xl font-bold">
                {sector} <span className="font-sans text-base font-normal text-tenue">({lista.length})</span>
              </h3>
              <ol className="flex flex-col gap-2">
                {lista.map((c) => (
                  <li key={c.id} className="flex flex-col gap-2 rounded-lg border border-borde p-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-serif text-lg font-bold cifra">{c.rol}</span>
                        {c.urgente && <MarcaUrgente />}
                        <EtiquetaPrioridad nivel={prioridadCausa(c, ajustes.umbralesCausas, hoy)} dias={diasDesdeEncargo(c, hoy)} />
                      </p>
                      <p>{c.domicilio ?? <span className="text-tenue">Sin domicilio registrado</span>}</p>
                      <p className="text-tenue">
                        {c.tipoDiligencia ?? 'Diligencia'} · {c.demandado ?? 'Demandado sin nombre'}
                        {c.clienteId ? ` · ${cliente.get(c.clienteId) ?? ''}` : ''}
                      </p>
                    </div>
                    <Boton variante="secundario" className="no-imprimir shrink-0" onClick={() => alMarcar(c)}>
                      Marcar realizada
                    </Boton>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </Ventana>
  )
}

// Hoja de ruta del día: se eligen las diligencias pendientes que se harán (agrupadas por sector)
// y se genera el PDF para imprimir, con el formato de Mercedes (10 diligencias por hoja).
import { useState } from 'react'
import type { Ajustes, Causa, Cliente } from '../../db/tipos'
import { Boton, Campo } from '../../compartido/Controles'
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

const POR_HOJA = 10

/** Abre el PDF en una pestaña nueva (para imprimir) o lo descarga */
function entregarPdf(pdf: Blob, nombre: string, modo: 'abrir' | 'descargar') {
  const url = URL.createObjectURL(pdf)
  const enlace = document.createElement('a')
  enlace.href = url
  if (modo === 'descargar') enlace.download = nombre
  else {
    enlace.target = '_blank'
    enlace.rel = 'noopener'
  }
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000)
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
  const [fecha, setFecha] = useState(hoyISO())
  const [elegidas, setElegidas] = useState<number[]>([])
  const [generando, setGenerando] = useState(false)
  const grupos = agruparPorSector(causas)
  const visibles = soloSector ? grupos.filter(([s]) => s === soloSector) : grupos
  const total = visibles.reduce((s, [, l]) => s + l.length, 0)
  const cliente = new Map(clientes.map((c) => [c.id, c.nombre]))
  const hoy = hoyISO()
  // Se mantiene el orden de la lista (por sector, urgentes y más antiguas primero)
  const ordenadas = grupos.flatMap(([, l]) => l).filter((c) => elegidas.includes(c.id!))
  const hojas = Math.ceil(ordenadas.length / POR_HOJA)

  const alternar = (id: number) => setElegidas((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))
  const alternarSector = (lista: Causa[]) => {
    const ids = lista.map((c) => c.id!)
    const todas = ids.every((id) => elegidas.includes(id))
    setElegidas((e) => (todas ? e.filter((x) => !ids.includes(x)) : Array.from(new Set([...e, ...ids]))))
  }

  const generar = async (modo: 'abrir' | 'descargar') => {
    if (!ordenadas.length) return
    setGenerando(true)
    try {
      // El generador de PDF se carga solo cuando se usa
      const { generarHojaRuta } = await import('./hojaRutaPdf')
      const pdf = await generarHojaRuta(
        ordenadas.map((c) => ({ causa: c, solicitante: c.clienteId ? cliente.get(c.clienteId) : c.mandante })),
        fecha,
        ajustes.encabezadoHojaRuta,
      )
      entregarPdf(pdf, `Hoja de ruta ${fechaCL(fecha)}.pdf`, modo)
      avisar(`Hoja de ruta lista: ${plural(ordenadas.length, 'diligencia', 'diligencias')} en ${plural(hojas, 'hoja', 'hojas')}.`)
    } catch {
      avisar('No se pudo generar el PDF. Intente de nuevo.', 'error')
    } finally {
      setGenerando(false)
    }
  }

  const copiar = async () => {
    const lista = ordenadas.length ? ordenadas : visibles.flatMap(([, l]) => l)
    const lineas = [`Hoja de ruta ${fechaCL(fecha)}`, '']
    lista.forEach((c, i) => {
      lineas.push(`${i + 1}. ${c.rol}${c.urgente ? ' [URGENTE]' : ''}, ${c.tipoDiligencia ?? 'diligencia'}`)
      lineas.push(`   ${c.demandado ?? 'Demandado sin nombre'}, ${c.domicilio ?? 'sin domicilio'}${c.sector ? ` (${c.sector})` : ''}`)
    })
    try {
      await navigator.clipboard.writeText(lineas.join('\n'))
      avisar('Hoja de ruta copiada. Puede pegarla en WhatsApp o en un correo.')
    } catch {
      avisar('No se pudo copiar automáticamente. Use «Generar PDF».', 'error')
    }
  }

  return (
    <Ventana
      abierta={abierta}
      titulo="Hoja de ruta"
      alCerrar={alCerrar}
      ancho="max-w-4xl"
      pie={
        <>
          <Boton variante="secundario" onClick={copiar}>
            Copiar como texto
          </Boton>
          <Boton variante="secundario" onClick={() => generar('descargar')} disabled={!ordenadas.length || generando}>
            Descargar PDF
          </Boton>
          <Boton onClick={() => generar('abrir')} disabled={!ordenadas.length || generando}>
            {generando ? 'Generando…' : ordenadas.length ? `Generar PDF (${plural(hojas, 'hoja', 'hojas')})` : 'Generar PDF'}
          </Boton>
        </>
      }
    >
      {grupos.length === 0 ? (
        <p className="text-lg">No hay causas pendientes. Buen trabajo.</p>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="max-w-[70ch] text-tenue">
            Marque las diligencias que hará y genere el PDF para imprimir: 10 diligencias por hoja, con casillas para anotar hora y resultado en terreno.
          </p>
          <div className="grid gap-3 md:grid-cols-3 md:items-end">
            <Campo etiqueta="Fecha de la hoja de ruta" type="date" value={fecha} min={hoy} onChange={(e) => setFecha(e.target.value || hoy)} />
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
            <div className="flex flex-col gap-1 rounded-lg bg-petroleo-suave px-3 py-2" aria-live="polite">
              <span className="font-bold text-petroleo">{plural(ordenadas.length, 'diligencia elegida', 'diligencias elegidas')}</span>
              <span className="text-sm text-tenue">
                {ordenadas.length ? `${plural(hojas, 'hoja', 'hojas')} de 10 · ` : ''}
                {plural(total, 'pendiente', 'pendientes')} {soloSector ? 'en este sector' : 'en total'}
              </span>
            </div>
          </div>
          {elegidas.length > 0 && (
            <Boton variante="discreto" className="self-start" onClick={() => setElegidas([])}>
              Quitar todas las marcas
            </Boton>
          )}
          {visibles.map(([sector, lista]) => {
            const todas = lista.every((c) => elegidas.includes(c.id!))
            return (
              <section key={sector}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-serif text-xl font-bold">
                    {sector} <span className="font-sans text-base font-normal text-tenue">({lista.length})</span>
                  </h3>
                  <Boton variante="discreto" className="min-h-10 py-1" onClick={() => alternarSector(lista)}>
                    {todas ? 'Quitar las de este sector' : 'Elegir todas las de este sector'}
                  </Boton>
                </div>
                <ol className="flex flex-col gap-2">
                  {lista.map((c) => {
                    const marcada = elegidas.includes(c.id!)
                    return (
                      <li key={c.id} className={`flex flex-col gap-2 rounded-lg border-2 p-3 md:flex-row md:items-center md:justify-between ${marcada ? 'border-petroleo bg-petroleo-suave' : 'border-borde'}`}>
                        <label className="flex min-w-0 flex-1 cursor-pointer gap-3">
                          <input type="checkbox" className="mt-1 h-6 w-6 shrink-0 accent-[var(--petroleo)]" checked={marcada} onChange={() => alternar(c.id!)} aria-label={`Incluir ${c.rol} en la hoja de ruta`} />
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-serif text-lg font-bold cifra">{c.rol}</span>
                              {c.urgente && <MarcaUrgente />}
                              <EtiquetaPrioridad nivel={prioridadCausa(c, ajustes.umbralesCausas, hoy)} dias={diasDesdeEncargo(c, hoy)} />
                            </span>
                            <span className="block">{c.domicilio ?? <span className="text-tenue">Sin domicilio registrado</span>}</span>
                            <span className="block text-tenue">
                              {[c.tipoDiligencia ?? 'Diligencia', c.demandado ?? 'Demandado sin nombre', c.clienteId ? cliente.get(c.clienteId) : ''].filter(Boolean).join(', ')}
                            </span>
                          </span>
                        </label>
                        <Boton variante="secundario" className="shrink-0" onClick={() => alMarcar(c)}>
                          Marcar realizada
                        </Boton>
                      </li>
                    )
                  })}
                </ol>
              </section>
            )
          })}
        </div>
      )}
    </Ventana>
  )
}

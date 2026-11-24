// Importación masiva de retiros de vehículos desde Excel: elegir archivo → revisar vista previa → confirmar.
import { useEffect, useMemo, useState } from 'react'
import { db } from '../../../db/basedatos'
import { useAjustes } from '../../../db/ajustes'
import type { Cliente, Retiro } from '../../../db/tipos'
import { Boton, Selector } from '../../../compartido/Controles'
import { useAviso } from '../../../compartido/Dialogos'
import { Ventana } from '../../../compartido/Ventana'
import { fechaCL, hoyISO, plural } from '../../../utilidades/formato'
import { leerArchivo } from '../../causas/importar/leerExcel'
import { FormularioCliente } from '../../clientes/FormularioCliente'
import { analizarRetiros, detectarHojasRetiros, type AccionRetiro, type FilaRetiro, type HojaRetiros } from './analizarRetiros'
import { guardarRetirosImportados } from './guardarRetiros'
import { descargarPlantillaRetiros } from './plantillaRetiros'

type Filtro = 'todas' | AccionRetiro | 'avisos'

const ESTILO_ACCION: Record<AccionRetiro, string> = {
  nuevo: 'bg-verde-suave text-verde',
  actualizar: 'bg-amarillo-suave text-amarillo',
  omitir: 'bg-papel text-tenue border border-borde',
}

export function ImportarRetiros({ abierta, alCerrar }: { abierta: boolean; alCerrar: () => void }) {
  const ajustes = useAjustes()
  const avisar = useAviso()
  const [archivo, setArchivo] = useState<File | null>(null)
  const [hojas, setHojas] = useState<HojaRetiros[]>([])
  const [hojaNombre, setHojaNombre] = useState('')
  const [error, setError] = useState('')
  const [leyendo, setLeyendo] = useState(false)
  const [clienteLote, setClienteLote] = useState<number | undefined>()
  const [fechaRecepcion, setFechaRecepcion] = useState(hoyISO())
  const [filas, setFilas] = useState<FilaRetiro[]>([])
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [existentes, setExistentes] = useState<Retiro[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [nuevoCliente, setNuevoCliente] = useState(false)
  const [guardando, setGuardando] = useState(false)

  // Al abrir, se empieza de cero
  useEffect(() => {
    if (!abierta) return
    setArchivo(null)
    setHojas([])
    setError('')
    setFilas([])
    setFiltro('todas')
    setClienteLote(undefined)
    setFechaRecepcion(hoyISO())
  }, [abierta])

  const recargarBase = async () => {
    const [r, cl] = await Promise.all([db.retiros.toArray(), db.clientes.orderBy('nombre').toArray()])
    setExistentes(r)
    setClientes(cl)
  }

  const elegirArchivo = async (f: File | undefined) => {
    if (!f) return
    setArchivo(f)
    setError('')
    setHojas([])
    setFilas([])
    setLeyendo(true)
    try {
      const libro = await leerArchivo(f)
      const encontradas = detectarHojasRetiros(libro, ajustes.camposRetiro)
      await recargarBase()
      if (!encontradas.length) {
        setError('No se encontró ninguna hoja con una columna de ROL y filas con datos. Revise que el archivo tenga una fila de encabezados con «ROL» o «Causa ROL», o use la planilla modelo.')
        return
      }
      setHojas(encontradas)
      setHojaNombre(encontradas[0].nombre)
    } catch {
      setError('No se pudo leer el archivo. Verifique que sea una planilla Excel (.xlsx o .xls) y que no esté protegida con clave.')
    } finally {
      setLeyendo(false)
    }
  }

  const hoja = hojas.find((h) => h.nombre === hojaNombre)
  const sinColumnaCliente = !!hoja && hoja.mapa.clienteId === undefined
  const sinColumnaEncargo = !!hoja && hoja.mapa.fechaEncargo === undefined

  // Cada vez que cambian las opciones del lote, se vuelve a analizar
  useEffect(() => {
    if (!hoja) return
    setFilas(analizarRetiros(hoja, { clienteIdLote: clienteLote, fechaRecepcion }, existentes, clientes, ajustes))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoja, clienteLote, fechaRecepcion, existentes, clientes])

  const cuenta = useMemo(() => {
    const c = { nuevo: 0, actualizar: 0, omitir: 0, avisos: 0 }
    for (const f of filas) {
      c[f.accion]++
      if (f.avisos.length) c.avisos++
    }
    return c
  }, [filas])
  const visibles = filas.filter((f) => (filtro === 'todas' ? true : filtro === 'avisos' ? f.avisos.length > 0 : f.accion === filtro))
  const cambiarAccion = (numero: number, accion: AccionRetiro) => setFilas((fs) => fs.map((f) => (f.numero === numero ? { ...f, accion } : f)))
  const aGuardar = cuenta.nuevo + cuenta.actualizar

  const confirmar = async () => {
    setGuardando(true)
    try {
      const r = await guardarRetirosImportados(filas)
      const partes = [plural(r.nuevos, 'retiro nuevo', 'retiros nuevos')]
      if (r.actualizados) partes.push(plural(r.actualizados, 'actualizado', 'actualizados'))
      if (r.clientesCreados) partes.push(plural(r.clientesCreados, 'estudio creado', 'estudios creados'))
      avisar(`Importación lista: ${partes.join(', ')}.`)
      alCerrar()
    } catch {
      avisar('No se pudo completar la importación. No se guardó nada; intente de nuevo.', 'error')
    } finally {
      setGuardando(false)
    }
  }

  const etiqueta = (clave: string) => ajustes.camposRetiro.find((c) => c.clave === clave)?.etiqueta ?? (clave === '_familiares' ? 'Familiares del demandado' : clave)

  return (
    <>
      <Ventana
        abierta={abierta}
        titulo="Importar retiros desde Excel"
        alCerrar={alCerrar}
        ancho="max-w-6xl"
        pie={
          <>
            <Boton variante="secundario" onClick={alCerrar}>
              Cancelar
            </Boton>
            <Boton onClick={confirmar} disabled={!hoja || aGuardar === 0 || guardando}>
              {aGuardar ? `Guardar ${plural(aGuardar, 'retiro', 'retiros')}` : 'Guardar'}
            </Boton>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          {/* Paso 1: archivo */}
          <section className="flex flex-col gap-2">
            <h3 className="font-serif text-xl font-bold">1. Elija el archivo</h3>
            <p className="max-w-[70ch] text-tenue">
              Sirve una planilla con un retiro por fila: la planilla modelo, el Excel que exporta esta app o el que le mandan los estudios. La app reconoce sola las columnas (ROL, juzgado, patente, demandado, vencimiento…).
            </p>
            <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-petroleo bg-petroleo-suave px-4 py-3 text-center font-bold text-petroleo">
              {leyendo ? 'Leyendo archivo…' : archivo ? `Archivo: ${archivo.name} (toque para cambiar)` : 'Toque aquí para elegir el archivo Excel'}
              <input
                type="file"
                accept=".xlsx,.xls,.xlsm,.csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  // Se limpia para poder elegir el mismo archivo otra vez después de corregirlo
                  e.target.value = ''
                  elegirArchivo(f)
                }}
              />
            </label>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Boton variante="discreto" className="self-start" onClick={() => descargarPlantillaRetiros(ajustes.camposRetiro)}>
                Descargar planilla modelo
              </Boton>
              <span className="text-sm text-tenue">Excel con las columnas listas para llenar, un ejemplo y las instrucciones.</span>
            </div>
            {error && (
              <p className="rounded-lg border-l-4 border-rojo bg-rojo-suave p-3 font-bold" role="alert">
                {error}
              </p>
            )}
          </section>

          {hoja && (
            <>
              {/* Paso 2: opciones del lote */}
              <section className="flex flex-col gap-4">
                <h3 className="font-serif text-xl font-bold">2. Revise los datos del lote</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  {hojas.length > 1 && (
                    <Selector etiqueta="Hoja del archivo" value={hojaNombre} onChange={(e) => setHojaNombre(e.target.value)}>
                      {hojas.map((h) => (
                        <option key={h.nombre} value={h.nombre}>
                          {h.nombre} ({plural(h.filas.length, 'fila', 'filas')})
                        </option>
                      ))}
                    </Selector>
                  )}
                  {sinColumnaCliente && (
                    <div className="flex flex-col gap-1">
                      <Selector
                        etiqueta="Estudio jurídico de este lote"
                        value={clienteLote ?? ''}
                        onChange={(e) => setClienteLote(e.target.value ? Number(e.target.value) : undefined)}
                        ayuda="El archivo no trae columna de estudio. Puede dejarlo sin estudio."
                      >
                        <option value="">— Sin estudio —</option>
                        {clientes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </Selector>
                      <Boton variante="discreto" className="self-start" onClick={() => setNuevoCliente(true)}>
                        + Crear estudio nuevo
                      </Boton>
                    </div>
                  )}
                  {(sinColumnaEncargo || filas.some((f) => f.porDefecto.includes('fechaEncargo'))) && (
                    <label className="flex flex-col gap-1">
                      <span className="font-bold">Fecha en que llegó el encargo</span>
                      <input
                        type="date"
                        aria-label="Fecha en que llegó el encargo"
                        className="min-h-12 rounded-lg border-2 border-borde bg-superficie px-3"
                        value={fechaRecepcion}
                        max={hoyISO()}
                        onChange={(e) => setFechaRecepcion(e.target.value || hoyISO())}
                      />
                      <span className="text-sm text-tenue">Para las filas que no traen esa fecha.</span>
                    </label>
                  )}
                </div>
                <details className="rounded-lg border border-borde p-3">
                  <summary className="cursor-pointer font-bold">
                    Columnas reconocidas en la hoja «{hoja.nombre}» ({plural(Object.keys(hoja.mapa).length, 'columna', 'columnas')})
                  </summary>
                  <ul className="mt-2 grid gap-1 md:grid-cols-2">
                    {Object.entries(hoja.mapa).map(([clave, i]) => (
                      <li key={clave}>
                        <span className="text-tenue">{etiqueta(clave)}:</span> «{hoja.encabezados[i]}»
                      </li>
                    ))}
                  </ul>
                  {hoja.encabezados.some((h, i) => h && !Object.values(hoja.mapa).includes(i)) && (
                    <p className="mt-2 text-tenue">No se usan: {hoja.encabezados.filter((h, i) => h && !Object.values(hoja.mapa).includes(i)).join(', ')}</p>
                  )}
                </details>
              </section>

              {/* Paso 3: vista previa */}
              <section className="flex flex-col gap-3">
                <h3 className="font-serif text-xl font-bold">3. Vista previa</h3>
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar filas">
                  {(
                    [
                      ['todas', `Todas (${filas.length})`],
                      ['nuevo', `Nuevos (${cuenta.nuevo})`],
                      ['actualizar', `Se actualizan (${cuenta.actualizar})`],
                      ['omitir', `Se omiten (${cuenta.omitir})`],
                      ['avisos', `Con avisos (${cuenta.avisos})`],
                    ] as [Filtro, string][]
                  ).map(([f, t]) => (
                    <button
                      key={f}
                      type="button"
                      role="tab"
                      aria-selected={filtro === f}
                      onClick={() => setFiltro(f)}
                      className={`min-h-11 rounded-full border-2 px-4 font-bold ${filtro === f ? 'border-petroleo bg-petroleo text-sobre-petroleo' : 'border-borde text-tinta'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto rounded-lg border border-borde">
                  <table className="w-full min-w-[60rem] text-left">
                    <thead className="bg-papel text-tenue">
                      <tr>
                        <th className="px-3 py-2">Fila</th>
                        <th className="px-3 py-2">Qué hacer</th>
                        <th className="px-3 py-2">ROL y juzgado</th>
                        <th className="px-3 py-2">Vehículo</th>
                        <th className="px-3 py-2">Demandado</th>
                        <th className="px-3 py-2">Oficio</th>
                        <th className="px-3 py-2">Estudio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borde">
                      {visibles.map((f) => (
                        <tr key={f.numero} className={f.accion === 'omitir' ? 'text-tenue' : ''}>
                          <td className="px-3 py-2 align-top cifra">{f.numero}</td>
                          <td className="px-3 py-2 align-top">
                            <select
                              aria-label={`Qué hacer con la fila ${f.numero}`}
                              className={`min-h-10 rounded-md px-2 font-bold ${ESTILO_ACCION[f.accion]}`}
                              value={f.accion}
                              disabled={!!f.motivo && !f.motivo.startsWith('Repetido')}
                              onChange={(e) => cambiarAccion(f.numero, e.target.value as AccionRetiro)}
                            >
                              {!f.existenteId && <option value="nuevo">Agregar</option>}
                              {f.existenteId && <option value="actualizar">Actualizar el que ya tiene</option>}
                              {f.existenteId && <option value="nuevo">Agregar como otro retiro</option>}
                              <option value="omitir">Omitir</option>
                            </select>
                            {f.motivo && <p className="mt-1 max-w-56 text-sm font-bold text-rojo">{f.motivo}</p>}
                            {f.avisos.map((a) => (
                              <p key={a} className="mt-1 max-w-56 text-sm font-bold text-naranja">
                                {a}
                              </p>
                            ))}
                          </td>
                          <td className="px-3 py-2 align-top">
                            <span className="whitespace-nowrap font-serif font-bold cifra">{f.datos.rol || '—'}</span>
                            <span className="block max-w-56 text-sm">{f.datos.tribunal || <span className="text-tenue">Sin juzgado</span>}</span>
                          </td>
                          <td className="px-3 py-2 align-top">
                            <span className="font-bold cifra">{f.datos.patente ?? <span className="font-normal text-tenue">Sin patente</span>}</span>
                            <span className="block text-sm text-tenue">{[f.datos.marca, f.datos.modelo, f.datos.anio].filter(Boolean).join(' ')}</span>
                          </td>
                          <td className="px-3 py-2 align-top">
                            {f.datos.deudor ?? <span className="text-tenue">—</span>}
                            {f.datos.rutDeudor && <span className="block text-sm text-tenue cifra">{f.datos.rutDeudor}</span>}
                          </td>
                          <td className="px-3 py-2 align-top whitespace-nowrap text-sm cifra">
                            {f.datos.fechaEmision && <span className="block">Emitido {fechaCL(f.datos.fechaEmision)}</span>}
                            {f.datos.fechaVencimiento ? <span className="block font-bold">Vence {fechaCL(f.datos.fechaVencimiento)}</span> : <span className="block text-rojo">Sin vencimiento</span>}
                            <span className="block text-tenue">Encargo {fechaCL(f.datos.fechaEncargo)}</span>
                          </td>
                          <td className="px-3 py-2 align-top">
                            {f.nombreCliente ?? <span className="text-tenue">—</span>}
                            {f.nombreCliente && !f.datos.clienteId && f.accion !== 'omitir' && <span className="block text-sm text-petroleo">Se creará</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {visibles.length === 0 && <p className="p-4 text-tenue">No hay filas en este filtro.</p>}
                </div>
                <p className="text-sm text-tenue">
                  <span className={`rounded px-1 font-bold ${ESTILO_ACCION.nuevo}`}>Agregar</span> crea el retiro.{' '}
                  <span className={`rounded px-1 font-bold ${ESTILO_ACCION.actualizar}`}>Actualizar</span> completa el retiro que ya tiene (mismo ROL y patente); las celdas vacías no borran nada.{' '}
                  <span className="font-bold">Omitir</span> no guarda la fila. Puede cambiar la decisión en cada fila.
                </p>
              </section>
            </>
          )}
        </div>
      </Ventana>
      <FormularioCliente
        abierta={nuevoCliente}
        alCerrar={() => setNuevoCliente(false)}
        alGuardar={async (id) => {
          await recargarBase()
          setClienteLote(id)
        }}
      />
    </>
  )
}

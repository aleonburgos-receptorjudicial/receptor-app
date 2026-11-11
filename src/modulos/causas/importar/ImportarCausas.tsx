// Importación de causas desde Excel, en tres pasos: elegir archivo → revisar vista previa → confirmar.
import { useEffect, useMemo, useState } from 'react'
import type { WorkBook } from 'xlsx'
import { db } from '../../../db/basedatos'
import { useAjustes } from '../../../db/ajustes'
import type { Causa, Cliente } from '../../../db/tipos'
import { Boton, Casilla, Selector } from '../../../compartido/Controles'
import { useAviso } from '../../../compartido/Dialogos'
import { Ventana } from '../../../compartido/Ventana'
import { fechaCL, hoyISO, plural } from '../../../utilidades/formato'
import { FormularioCliente } from '../../clientes/FormularioCliente'
import { analizarFilas, type Accion, type FilaAnalizada } from './analizarFilas'
import { guardarImportacion, unirListas, type ListasLeidas } from './guardarImportacion'
import { celdaTexto, detectarHojas, leerArchivo, leerListas, NOMBRE_CAMPO, type CampoImportable, type HojaDetectada } from './leerExcel'

type Filtro = 'todas' | Accion | 'avisos'

const ESTILO_ACCION: Record<Accion, { texto: string; clase: string }> = {
  nueva: { texto: 'Nueva', clase: 'bg-verde-suave text-verde' },
  reencargo: { texto: 'Reencargo', clase: 'bg-amarillo-suave text-amarillo' },
  omitir: { texto: 'Se omite', clase: 'bg-papel text-tenue border border-borde' },
}

export function ImportarCausas({ abierta, alCerrar }: { abierta: boolean; alCerrar: () => void }) {
  const ajustes = useAjustes()
  const avisar = useAviso()
  const [archivo, setArchivo] = useState<File | null>(null)
  const [libro, setLibro] = useState<WorkBook | null>(null)
  const [hojas, setHojas] = useState<HojaDetectada[]>([])
  const [hojaNombre, setHojaNombre] = useState('')
  const [error, setError] = useState('')
  const [leyendo, setLeyendo] = useState(false)
  const [clienteLote, setClienteLote] = useState<number | undefined>()
  const [fechaRecepcion, setFechaRecepcion] = useState(hoyISO())
  const [tipoSinLetra, setTipoSinLetra] = useState('Exhorto')
  const [filas, setFilas] = useState<FilaAnalizada[]>([])
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [listas, setListas] = useState<ListasLeidas | null>(null)
  const [agregarListas, setAgregarListas] = useState(true)
  const [crearClientesLista, setCrearClientesLista] = useState(false)
  const [existentes, setExistentes] = useState<Causa[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [nuevoCliente, setNuevoCliente] = useState(false)
  const [guardando, setGuardando] = useState(false)

  // Al abrir, se empieza de cero
  useEffect(() => {
    if (!abierta) return
    setArchivo(null)
    setLibro(null)
    setHojas([])
    setError('')
    setFilas([])
    setFiltro('todas')
    setListas(null)
    setClienteLote(undefined)
    setFechaRecepcion(hoyISO())
  }, [abierta])

  const recargarBase = async () => {
    const [c, cl] = await Promise.all([db.causas.toArray(), db.clientes.orderBy('nombre').toArray()])
    setExistentes(c)
    setClientes(cl)
  }

  const elegirArchivo = async (f: File | undefined) => {
    if (!f) return
    setArchivo(f)
    setError('')
    setLeyendo(true)
    try {
      const lb = await leerArchivo(f)
      const encontradas = detectarHojas(lb)
      await recargarBase()
      if (!encontradas.length) {
        setError('No se encontró ninguna hoja con una columna de ROL. Revise que el archivo tenga una fila de encabezados con «ROL» o «Causa ROL».')
        setLibro(null)
        return
      }
      setLibro(lb)
      setHojas(encontradas)
      setHojaNombre(encontradas[0].nombre)
      setTipoSinLetra(encontradas[0].mapa.rolExhorto !== undefined ? 'Exhorto' : 'Civil')
      setListas(leerListas(lb))
    } catch {
      setError('No se pudo leer el archivo. Verifique que sea una planilla Excel (.xlsx o .xls) y que no esté protegida con clave.')
    } finally {
      setLeyendo(false)
    }
  }

  const hoja = hojas.find((h) => h.nombre === hojaNombre)
  const sinColumnaCliente = hoja && hoja.mapa.cliente === undefined
  const sinColumnaFecha = hoja && hoja.mapa.fechaEncargo === undefined
  // ¿Hay ROL escritos sin letra (ej. "662-2026" en vez de "E-662-2026")?
  const hayRolSinLetra =
    !!hoja &&
    hoja.filas.some((f) =>
      [hoja.mapa.rolExhorto, hoja.mapa.rol].some((i) => {
        const t = i === undefined ? undefined : celdaTexto(f[i])
        return !!t && !/^[A-Za-z]+\s*-/.test(t)
      }),
    )

  // Cada vez que cambian las opciones del lote, se vuelve a analizar
  useEffect(() => {
    if (!hoja) return
    const ajustesConListas = listas && agregarListas ? { ...ajustes, tiposDiligencia: unirListas(ajustes.tiposDiligencia, listas.diligencias) } : ajustes
    setFilas(analizarFilas(hoja, { tribunal: ajustes.tribunalPorDefecto, clienteIdLote: clienteLote, fechaRecepcion, tipoSinLetra }, existentes, clientes, ajustesConListas))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoja, clienteLote, fechaRecepcion, tipoSinLetra, existentes, clientes, listas, agregarListas])

  const cuenta = useMemo(() => {
    const c = { nueva: 0, reencargo: 0, omitir: 0, avisos: 0 }
    for (const f of filas) {
      c[f.accion]++
      if (f.avisos.length || f.demandadoDeObservaciones) c.avisos++
    }
    return c
  }, [filas])

  const visibles = filas.filter((f) => (filtro === 'todas' ? true : filtro === 'avisos' ? f.avisos.length > 0 || f.demandadoDeObservaciones : f.accion === filtro))

  const cambiarAccion = (numero: number, accion: Accion) => setFilas((fs) => fs.map((f) => (f.numero === numero ? { ...f, accion } : f)))

  const confirmar = async () => {
    setGuardando(true)
    try {
      const r = await guardarImportacion(filas, listas ? { datos: listas, agregarListas, crearClientesLista } : null)
      const partes = [plural(r.nuevas, 'causa nueva', 'causas nuevas'), plural(r.reencargos, 'reencargo', 'reencargos')]
      if (r.clientesCreados) partes.push(plural(r.clientesCreados, 'cliente creado', 'clientes creados'))
      avisar(`Importación lista: ${partes.join(', ')}.`)
      alCerrar()
    } catch {
      avisar('No se pudo completar la importación. No se guardó nada; intente de nuevo.', 'error')
    } finally {
      setGuardando(false)
    }
  }

  const aGuardar = cuenta.nueva + cuenta.reencargo
  const nuevasEnListas = listas
    ? {
        diligencias: unirListas(ajustes.tiposDiligencia, listas.diligencias).length - ajustes.tiposDiligencia.length,
        resultados: unirListas(ajustes.detallesResultado, listas.resultados).length - ajustes.detallesResultado.length,
        sectores: unirListas(ajustes.sectores, listas.sectores).length - ajustes.sectores.length,
      }
    : null

  return (
    <>
      <Ventana
        abierta={abierta}
        titulo="Importar causas desde Excel"
        alCerrar={alCerrar}
        ancho="max-w-6xl"
        pie={
          <>
            <Boton variante="secundario" onClick={alCerrar}>
              Cancelar
            </Boton>
            <Boton onClick={confirmar} disabled={!hoja || aGuardar === 0 || guardando}>
              {aGuardar ? `Guardar ${plural(aGuardar, 'causa', 'causas')}` : 'Guardar'}
            </Boton>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          {/* Paso 1: archivo */}
          <section className="flex flex-col gap-2">
            <h3 className="font-serif text-xl font-bold">1. Elija el archivo</h3>
            <p className="max-w-[70ch] text-tenue">
              Sirve su planilla «Control de Encargos» o el Excel que mandan los clientes con varios encargos. La app busca sola la hoja y la fila de encabezados.
            </p>
            <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-petroleo bg-petroleo-suave px-4 py-3 text-center font-bold text-petroleo">
              {leyendo ? 'Leyendo archivo…' : archivo ? `Archivo: ${archivo.name} (toque para cambiar)` : 'Toque aquí para elegir el archivo Excel'}
              <input type="file" accept=".xlsx,.xls,.xlsm,.csv" className="sr-only" onChange={(e) => elegirArchivo(e.target.files?.[0])} />
            </label>
            {error && (
              <p className="rounded-lg border-l-4 border-rojo bg-rojo-suave p-3 font-bold" role="alert">
                {error}
              </p>
            )}
          </section>

          {libro && hoja && (
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
                        etiqueta="Cliente de este lote"
                        value={clienteLote ?? ''}
                        onChange={(e) => setClienteLote(e.target.value ? Number(e.target.value) : undefined)}
                        ayuda="El archivo no trae columna de cliente."
                      >
                        <option value="">— Elija el cliente —</option>
                        {clientes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </Selector>
                      <Boton variante="discreto" className="self-start" onClick={() => setNuevoCliente(true)}>
                        + Crear cliente nuevo
                      </Boton>
                    </div>
                  )}
                  {(sinColumnaFecha || filas.some((f) => f.avisos.some((a) => a.startsWith('Sin fecha')))) && (
                    <label className="flex flex-col gap-1">
                      <span className="font-bold">Fecha de recepción</span>
                      <input type="date" className="min-h-12 rounded-lg border-2 border-borde bg-superficie px-3" value={fechaRecepcion} max={hoyISO()} onChange={(e) => setFechaRecepcion(e.target.value || hoyISO())} />
                      <span className="text-sm text-tenue">Para las filas que no traen fecha.</span>
                    </label>
                  )}
                  {hayRolSinLetra && (
                    <Selector etiqueta="Los ROL sin letra son" value={tipoSinLetra} onChange={(e) => setTipoSinLetra(e.target.value)} ayuda="El archivo trae el ROL sin la letra (E-, C-…).">
                      {ajustes.tiposCausa.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </Selector>
                  )}
                </div>
                {sinColumnaCliente && !clienteLote && (
                  <p className="rounded-lg border-l-4 border-naranja bg-naranja-suave p-3">Elija el cliente del lote; si no, las causas quedarán sin cliente.</p>
                )}
                <details className="rounded-lg border border-borde p-3">
                  <summary className="cursor-pointer font-bold">Columnas reconocidas en la hoja «{hoja.nombre}» (fila {hoja.filaEncabezado})</summary>
                  <ul className="mt-2 grid gap-1 md:grid-cols-2">
                    {(Object.entries(hoja.mapa) as [CampoImportable, number][]).map(([campo, i]) => (
                      <li key={campo}>
                        <span className="text-tenue">{NOMBRE_CAMPO[campo]}:</span> «{hoja.encabezados[i]}»
                      </li>
                    ))}
                  </ul>
                  {hoja.encabezados.some((h, i) => h && !Object.values(hoja.mapa).includes(i)) && (
                    <p className="mt-2 text-tenue">
                      No se usan: {hoja.encabezados.filter((h, i) => h && !Object.values(hoja.mapa).includes(i)).join(', ')}
                    </p>
                  )}
                </details>
                {listas && nuevasEnListas && (
                  <div className="rounded-lg border border-borde p-3">
                    <p className="font-bold">El archivo tiene una hoja «Listas».</p>
                    <Casilla
                      etiqueta="Agregar sus valores a mis listas"
                      ayuda={`${plural(nuevasEnListas.diligencias, 'tipo de diligencia nuevo', 'tipos de diligencia nuevos')}, ${plural(nuevasEnListas.resultados, 'detalle de resultado', 'detalles de resultado')}, ${plural(nuevasEnListas.sectores, 'sector', 'sectores')}`}
                      checked={agregarListas}
                      onChange={(e) => setAgregarListas(e.target.checked)}
                    />
                    {listas.clientes.length > 0 && (
                      <Casilla
                        etiqueta={`Crear también los ${listas.clientes.length} clientes de la lista`}
                        ayuda="Si no, solo se crean los clientes que aparecen en las causas importadas."
                        checked={crearClientesLista}
                        onChange={(e) => setCrearClientesLista(e.target.checked)}
                      />
                    )}
                  </div>
                )}
              </section>

              {/* Paso 3: vista previa */}
              <section className="flex flex-col gap-3">
                <h3 className="font-serif text-xl font-bold">3. Vista previa</h3>
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar filas">
                  {(
                    [
                      ['todas', `Todas (${filas.length})`],
                      ['nueva', `Nuevas (${cuenta.nueva})`],
                      ['reencargo', `Reencargos (${cuenta.reencargo})`],
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
                  <table className="w-full min-w-[56rem] text-left">
                    <thead className="bg-papel text-tenue">
                      <tr>
                        <th className="px-3 py-2">Fila</th>
                        <th className="px-3 py-2">Qué hacer</th>
                        <th className="px-3 py-2">ROL</th>
                        <th className="px-3 py-2">Encargo</th>
                        <th className="px-3 py-2">Cliente</th>
                        <th className="px-3 py-2">Demandado</th>
                        <th className="px-3 py-2">Diligencia</th>
                        <th className="px-3 py-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borde">
                      {visibles.map((f) => (
                        <tr key={f.numero} className={f.accion === 'omitir' ? 'text-tenue' : ''}>
                          <td className="px-3 py-2 align-top cifra">{f.numero}</td>
                          <td className="px-3 py-2 align-top">
                            <select
                              aria-label={`Qué hacer con la fila ${f.numero}`}
                              className={`min-h-10 rounded-md px-2 font-bold ${ESTILO_ACCION[f.accion].clase}`}
                              value={f.accion}
                              onChange={(e) => cambiarAccion(f.numero, e.target.value as Accion)}
                            >
                              <option value="nueva">Agregar como nueva</option>
                              {f.existenteId && <option value="reencargo">Actualizar (reencargo)</option>}
                              <option value="omitir">Omitir</option>
                            </select>
                            {f.motivo && <p className="mt-1 max-w-56 text-sm">{f.motivo}</p>}
                            {f.avisos.map((a) => (
                              <p key={a} className="mt-1 max-w-56 text-sm font-bold text-naranja">
                                {a}
                              </p>
                            ))}
                          </td>
                          <td className="px-3 py-2 align-top font-serif font-bold cifra whitespace-nowrap">
                            {f.datos.rol || '—'}
                            <span className="block font-sans text-sm font-normal text-tenue">{f.datos.tipoCausa}</span>
                          </td>
                          <td className="px-3 py-2 align-top cifra whitespace-nowrap">
                            {fechaCL(f.datos.fechaEncargo)}
                            {f.datos.urgente && <span className="block text-sm font-bold text-rojo">Urgente</span>}
                          </td>
                          <td className="px-3 py-2 align-top">
                            {f.nombreCliente ?? <span className="text-tenue">—</span>}
                            {f.nombreCliente && !f.datos.clienteId && f.accion === 'nueva' && <span className="block text-sm text-petroleo">Se creará</span>}
                          </td>
                          <td className="px-3 py-2 align-top">
                            {f.datos.demandado ?? <span className="text-tenue">—</span>}
                            {f.demandadoDeObservaciones && <span className="block text-sm font-bold text-petroleo">Tomado de las observaciones</span>}
                            {f.datos.rutDemandado && <span className="block text-sm text-tenue cifra">{f.datos.rutDemandado}</span>}
                          </td>
                          <td className="px-3 py-2 align-top">{f.datos.tipoDiligencia}</td>
                          <td className="px-3 py-2 align-top">
                            {f.datos.estado}
                            {f.datos.estampadoPjud && <span className="block text-sm text-tenue">Estampada</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {visibles.length === 0 && <p className="p-4 text-tenue">No hay filas en este filtro.</p>}
                </div>
                <p className="text-sm text-tenue">
                  <span className={`rounded px-1 font-bold ${ESTILO_ACCION.nueva.clase}`}>Nueva</span> se agrega ·{' '}
                  <span className={`rounded px-1 font-bold ${ESTILO_ACCION.reencargo.clase}`}>Reencargo</span> actualiza la fecha de la causa que ya tiene ·{' '}
                  <span className="font-bold">Se omite</span> no se guarda. Puede cambiar la decisión en cada fila.
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

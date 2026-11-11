// Importación de boletas desde archivos del SII: PDF de boletas y/o informe mensual de boletas emitidas.
// Siempre se muestra una vista previa; si la boleta ya existe (mismo N°), se actualiza en vez de duplicarla.
import { useEffect, useMemo, useState } from 'react'
import { ahoraISO, db } from '../../../db/basedatos'
import { useAjustes } from '../../../db/ajustes'
import { Boton, Casilla } from '../../../compartido/Controles'
import { useAviso } from '../../../compartido/Dialogos'
import { Ventana } from '../../../compartido/Ventana'
import { fechaCL, plural, pesos } from '../../../utilidades/formato'
import { normalizar } from '../../../utilidades/texto'
import { guardarBoleta } from '../servicioBoletas'
import { analizarBoletas, type AccionBoleta, type BoletaAnalizada } from './analizarBoletas'
import type { BoletaLeida } from './leerArchivosSii'

const ESTILO: Record<AccionBoleta, string> = {
  nueva: 'bg-verde-suave text-verde',
  actualizar: 'bg-amarillo-suave text-amarillo',
  omitir: 'bg-papel text-tenue border border-borde',
}

export function ImportarBoletas({ abierta, alCerrar }: { abierta: boolean; alCerrar: () => void }) {
  const ajustes = useAjustes()
  const avisar = useAviso()
  const [lecturas, setLecturas] = useState<BoletaLeida[]>([])
  const [errores, setErrores] = useState<string[]>([])
  const [leyendo, setLeyendo] = useState(false)
  const [filas, setFilas] = useState<BoletaAnalizada[]>([])
  const [crearClientes, setCrearClientes] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierta) return
    setLecturas([])
    setErrores([])
    setFilas([])
  }, [abierta])

  // Cada vez que cambian los archivos leídos, se compara con lo guardado
  useEffect(() => {
    if (!lecturas.length) return setFilas([])
    let vigente = true
    Promise.all([db.boletas.toArray(), db.clientes.toArray(), db.causas.toArray()]).then(([b, cl, ca]) => {
      if (vigente) setFilas(analizarBoletas(lecturas, b, cl, ca, ajustes))
    })
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecturas])

  // Recibe una copia de los archivos (el selector se vacía apenas se eligen)
  const elegir = async (lista: File[]) => {
    if (!lista.length) return
    setLeyendo(true)
    const { leerBoletaPdf, leerInformeSii } = await import('./leerArchivosSii')
    const nuevas: BoletaLeida[] = []
    const er: string[] = []
    for (const f of lista) {
      const nombre = f.name.toLowerCase()
      try {
        if (nombre.endsWith('.pdf')) nuevas.push(await leerBoletaPdf(f))
        else if (/\.(xls|xlsx|htm|html)$/.test(nombre)) {
          const filasInforme = await leerInformeSii(f)
          if (!filasInforme.length) er.push(`«${f.name}»: el informe no trae boletas.`)
          nuevas.push(...filasInforme)
        } else er.push(`«${f.name}»: use PDF de boletas o el informe del SII (.xls).`)
      } catch (e) {
        er.push(`«${f.name}»: ${e instanceof Error && e.message.includes('SII') ? e.message : 'no se pudo leer. Revise que sea una boleta o un informe del SII.'}`)
      }
    }
    setLecturas((l) => [...l, ...nuevas])
    setErrores(er)
    setLeyendo(false)
  }

  const cuenta = useMemo(() => {
    const c = { nueva: 0, actualizar: 0, omitir: 0 }
    filas.forEach((f) => c[f.accion]++)
    return c
  }, [filas])
  const aGuardar = cuenta.nueva + cuenta.actualizar
  const clientesNuevos = new Set(filas.filter((f) => f.clienteNuevo && f.accion !== 'omitir').map((f) => f.leida.rutCliente ?? normalizar(f.leida.nombreCliente))).size

  const confirmar = async () => {
    setGuardando(true)
    try {
      // Clientes nuevos (por RUT o nombre), creados una sola vez
      const creados = new Map<string, number>()
      if (crearClientes) {
        const ahora = ahoraISO()
        for (const f of filas) {
          if (!f.clienteNuevo || f.accion === 'omitir') continue
          const clave = f.leida.rutCliente ?? normalizar(f.leida.nombreCliente)
          if (creados.has(clave)) continue
          const id = (await db.clientes.add({ nombre: f.leida.nombreCliente ?? f.leida.rutCliente ?? 'Cliente', rut: f.leida.rutCliente, creado: ahora, actualizado: ahora })) as number
          creados.set(clave, id)
        }
      }
      for (const f of filas) {
        if (f.accion === 'omitir') continue
        const clave = f.leida.rutCliente ?? normalizar(f.leida.nombreCliente)
        const datos = { ...f.datos, clienteId: f.datos.clienteId ?? creados.get(clave) }
        await guardarBoleta(datos, f.accion === 'actualizar' ? f.existente?.id : undefined)
      }
      avisar(`Boletas importadas: ${plural(cuenta.nueva, 'nueva', 'nuevas')}, ${plural(cuenta.actualizar, 'actualizada', 'actualizadas')}.`)
      alCerrar()
    } catch {
      avisar('No se pudieron guardar las boletas. Intente de nuevo.', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Ventana
      abierta={abierta}
      titulo="Importar boletas del SII"
      alCerrar={alCerrar}
      ancho="max-w-6xl"
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton onClick={confirmar} disabled={!aGuardar || guardando}>
            {aGuardar ? `Guardar ${plural(aGuardar, 'boleta', 'boletas')}` : 'Guardar'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <p className="max-w-[70ch] text-tenue">
            Elija uno o varios archivos: los PDF de las boletas electrónicas y/o el informe mensual de boletas emitidas (.xls). Si una boleta ya está
            guardada, se actualiza (por ejemplo, si quedó anulada) en vez de duplicarse.
          </p>
          <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-petroleo bg-petroleo-suave px-4 py-3 text-center font-bold text-petroleo">
            {leyendo ? 'Leyendo archivos…' : lecturas.length ? 'Agregar más archivos' : 'Toque aquí para elegir los archivos del SII'}
            <input
              type="file"
              multiple
              accept=".pdf,.xls,.xlsx,.htm,.html,application/pdf"
              className="sr-only"
              onChange={(e) => {
                elegir([...(e.target.files ?? [])])
                e.target.value = ''
              }}
            />
          </label>
          {errores.map((e) => (
            <p key={e} className="rounded-lg border-l-4 border-rojo bg-rojo-suave p-2 font-bold" role="alert">
              {e}
            </p>
          ))}
        </section>

        {filas.length > 0 && (
          <section className="flex flex-col gap-3">
            <p className="font-bold">
              {plural(filas.length, 'boleta leída', 'boletas leídas')}: {plural(cuenta.nueva, 'nueva', 'nuevas')}, {plural(cuenta.actualizar, 'por actualizar', 'por actualizar')},{' '}
              {plural(cuenta.omitir, 'sin cambios', 'sin cambios')}.
            </p>
            {clientesNuevos > 0 && (
              <Casilla
                etiqueta={`Crear ${plural(clientesNuevos, 'cliente nuevo', 'clientes nuevos')} con su RUT`}
                ayuda="Si no, las boletas quedan con el nombre del cliente pero sin ficha."
                checked={crearClientes}
                onChange={(e) => setCrearClientes(e.target.checked)}
              />
            )}
            <div className="overflow-x-auto rounded-lg border border-borde">
              <table className="w-full min-w-[56rem] text-left">
                <thead className="bg-papel text-tenue">
                  <tr>
                    <th className="px-3 py-2">N°</th>
                    <th className="px-3 py-2">Qué hacer</th>
                    <th className="px-3 py-2">Emisión</th>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2 text-right">Bruto</th>
                    <th className="px-3 py-2 text-right">A cobrar</th>
                    <th className="px-3 py-2">Glosa y causas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borde">
                  {filas.map((f, i) => (
                    <tr key={f.leida.numero} className={f.accion === 'omitir' ? 'text-tenue' : ''}>
                      <td className="px-3 py-2 align-top font-bold cifra">
                        {f.leida.numero}
                        {f.leida.anulada && <span className="mt-1 block w-fit rounded bg-rojo px-1 text-sm text-papel">Anulada</span>}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <select
                          aria-label={`Qué hacer con la boleta ${f.leida.numero}`}
                          className={`min-h-10 rounded-md px-2 font-bold ${ESTILO[f.accion]}`}
                          value={f.accion}
                          onChange={(e) => setFilas((fs) => fs.map((x, j) => (j === i ? { ...x, accion: e.target.value as AccionBoleta } : x)))}
                        >
                          {f.existente ? <option value="actualizar">Actualizar</option> : <option value="nueva">Agregar</option>}
                          <option value="omitir">Omitir</option>
                        </select>
                        {f.existente && f.cambios.map((c) => <p key={c} className="mt-1 max-w-56 text-sm">{c}</p>)}
                        {f.avisos.map((a) => (
                          <p key={a} className="mt-1 max-w-56 text-sm font-bold text-naranja">
                            {a}
                          </p>
                        ))}
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap cifra">{fechaCL(f.datos.fechaEmision)}</td>
                      <td className="px-3 py-2 align-top">
                        {f.leida.nombreCliente ?? '—'}
                        {f.leida.rutCliente && <span className="block text-sm text-tenue cifra">{f.leida.rutCliente}</span>}
                      </td>
                      <td className="px-3 py-2 align-top text-right cifra">{pesos(f.leida.bruto)}</td>
                      <td className="px-3 py-2 align-top text-right cifra">
                        {pesos(f.datos.montoCobrar)}
                        <span className="block text-sm text-tenue">{f.datos.pagaRetencion === 'Cliente' ? 'Cliente retiene' : 'Usted retiene'}</span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        {f.leida.glosa ?? <span className="text-tenue">—</span>}
                        {f.causasPropuestas.length > 0 && (
                          <span className="block text-sm font-bold text-petroleo">Causa: {f.causasPropuestas.map((c) => c.rol).join(', ')}</span>
                        )}
                        <span className="block text-sm text-tenue break-all">{f.leida.archivo}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </Ventana>
  )
}

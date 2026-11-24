// Subir facturas en PDF: la app lee cada factura, muestra una vista previa y guarda los datos junto con el PDF.
import { useEffect, useMemo, useState } from 'react'
import { ahoraISO, db } from '../../../db/basedatos'
import { useAjustes } from '../../../db/ajustes'
import { Boton, Casilla } from '../../../compartido/Controles'
import { useAviso } from '../../../compartido/Dialogos'
import { Ventana } from '../../../compartido/Ventana'
import { fechaCL, plural, pesos } from '../../../utilidades/formato'
import { limpiarRut } from '../../../utilidades/rut'
import { normalizar } from '../../../utilidades/texto'
import { revisarArchivos } from '../../retiros/servicioArchivos'
import { guardarBoleta, guardarPdfFactura, validarFactura } from '../servicioBoletas'
import { agregarEmpresa } from '../servicioEmpresas'
import { analizarFacturas, datosDeFactura, type AccionFactura, type FacturaAnalizada } from './analizarFacturas'
import { leerFacturaPdf, type FacturaLeida } from './leerFactura'

const ESTILO: Record<AccionFactura, string> = {
  nueva: 'bg-verde-suave text-verde',
  actualizar: 'bg-amarillo-suave text-amarillo',
  omitir: 'bg-papel text-tenue border border-borde',
}

export function ImportarFacturas({ abierta, alCerrar }: { abierta: boolean; alCerrar: () => void }) {
  const ajustes = useAjustes()
  const avisar = useAviso()
  const [lecturas, setLecturas] = useState<{ archivo: File; leida: FacturaLeida }[]>([])
  const [errores, setErrores] = useState<string[]>([])
  const [leyendo, setLeyendo] = useState(false)
  const [filas, setFilas] = useState<FacturaAnalizada[]>([])
  const [crearClientes, setCrearClientes] = useState(true)
  /** Nombre que se le dará a cada empresa nueva (por RUT), editable antes de guardar */
  const [nombresEmpresa, setNombresEmpresa] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierta) return
    setLecturas([])
    setErrores([])
    setFilas([])
    setNombresEmpresa({})
  }, [abierta])

  // Cada vez que se agregan archivos, se compara con lo guardado
  useEffect(() => {
    if (!lecturas.length) return setFilas([])
    let vigente = true
    Promise.all([db.boletas.toArray(), db.clientes.toArray()]).then(([b, cl]) => {
      if (vigente) setFilas(analizarFacturas(lecturas, b, cl, ajustes.empresas))
    })
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecturas])

  const elegir = async (lista: File[]) => {
    if (!lista.length) return
    setLeyendo(true)
    const { validos, errores: er } = revisarArchivos(lista)
    const nuevas: { archivo: File; leida: FacturaLeida }[] = []
    for (const f of validos) {
      try {
        nuevas.push({ archivo: f, leida: await leerFacturaPdf(f, ajustes.empresas) })
      } catch (e) {
        er.push(`«${f.name}»: ${e instanceof Error && e.message ? e.message : 'no se pudo leer.'}`)
      }
    }
    setNombresEmpresa((n) => {
      const r = { ...n }
      for (const x of nuevas) if (x.leida.empresaRut && !r[limpiarRut(x.leida.empresaRut)]) r[limpiarRut(x.leida.empresaRut)] = x.leida.empresaNombre ?? ''
      return r
    })
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
  const activas = filas.filter((f) => f.accion !== 'omitir')
  const clientesNuevos = new Set(activas.filter((f) => !f.cliente && (f.leida.rutCliente || f.leida.nombreCliente)).map((f) => f.leida.rutCliente ?? normalizar(f.leida.nombreCliente))).size
  const empresasNuevas = [...new Map(activas.filter((f) => f.empresaNueva).map((f) => [limpiarRut(f.leida.empresaRut!), f.leida.empresaRut!])).entries()]
  const faltaNombreEmpresa = empresasNuevas.some(([clave]) => !nombresEmpresa[clave]?.trim())

  const confirmar = async () => {
    setGuardando(true)
    try {
      // 1. Empresas nuevas a «Mis empresas»
      for (const [clave, rut] of empresasNuevas) {
        const r = await agregarEmpresa(nombresEmpresa[clave] ?? '', rut)
        if (r.error) throw new Error(r.error)
      }
      // 2. Clientes nuevos (una sola vez por RUT o nombre)
      const creados = new Map<string, number>()
      const ahora = ahoraISO()
      for (const f of activas) {
        if (f.cliente || !crearClientes || !(f.leida.rutCliente || f.leida.nombreCliente)) continue
        const clave = f.leida.rutCliente ?? normalizar(f.leida.nombreCliente)
        if (creados.has(clave)) continue
        creados.set(clave, (await db.clientes.add({ nombre: f.leida.nombreCliente ?? f.leida.rutCliente ?? 'Cliente', rut: f.leida.rutCliente, creado: ahora, actualizado: ahora })) as number)
      }
      // 3. Facturas con su PDF
      for (const f of activas) {
        const clienteId = f.cliente?.id ?? creados.get(f.leida.rutCliente ?? normalizar(f.leida.nombreCliente))
        const nombreEmpresa = f.empresaNueva ? nombresEmpresa[limpiarRut(f.leida.empresaRut!)] : ajustes.empresas.find((e) => limpiarRut(e.rut) === limpiarRut(f.leida.empresaRut ?? ''))?.nombre
        const { datos } = validarFactura(datosDeFactura(f, clienteId, nombreEmpresa), f.leida.iva)
        const id = await guardarBoleta(datos, f.accion === 'actualizar' ? f.existente?.id : undefined)
        await guardarPdfFactura(id, f.archivo, f.archivo.name)
      }
      avisar(`Facturas guardadas: ${plural(cuenta.nueva, 'nueva', 'nuevas')}${cuenta.actualizar ? `, ${plural(cuenta.actualizar, 'actualizada', 'actualizadas')}` : ''}.`)
      alCerrar()
    } catch (e) {
      avisar(e instanceof Error && e.message.includes('RUT') ? e.message : 'No se pudieron guardar las facturas. Intente de nuevo.', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Ventana
      abierta={abierta}
      titulo="Subir facturas en PDF"
      alCerrar={alCerrar}
      ancho="max-w-6xl"
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton onClick={confirmar} disabled={!aGuardar || guardando || faltaNombreEmpresa}>
            {aGuardar ? `Guardar ${plural(aGuardar, 'factura', 'facturas')}` : 'Guardar'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <p className="max-w-[70ch] text-tenue">
            Elija uno o varios PDF de facturas emitidas por sus empresas. La app lee el N°, la fecha, el cliente y los montos con IVA, y guarda el PDF junto a cada factura. Todo
            queda en este equipo.
          </p>
          <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-petroleo bg-petroleo-suave px-4 py-3 text-center font-bold text-petroleo">
            {leyendo ? 'Leyendo facturas…' : lecturas.length ? 'Agregar más facturas' : 'Toque aquí para elegir los PDF de las facturas'}
            <input
              type="file"
              multiple
              accept="application/pdf,.pdf"
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
              {plural(filas.length, 'factura leída', 'facturas leídas')}: {plural(cuenta.nueva, 'nueva', 'nuevas')}, {plural(cuenta.actualizar, 'por actualizar', 'por actualizar')},{' '}
              {plural(cuenta.omitir, 'se omite', 'se omiten')}.
            </p>

            {empresasNuevas.length > 0 && (
              <div className="flex flex-col gap-3 rounded-lg border-l-4 border-petroleo bg-petroleo-suave p-3">
                <p className="font-bold">
                  {empresasNuevas.length === 1 ? 'Esta empresa se agregará a «Mis empresas»' : 'Estas empresas se agregarán a «Mis empresas»'}. Revise el nombre:
                </p>
                {empresasNuevas.map(([clave, rut]) => (
                  <label key={clave} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <span className="font-bold cifra sm:w-36">{rut}</span>
                    <input
                      aria-label={`Nombre de la empresa ${rut}`}
                      className="min-h-12 flex-1 rounded-lg border-2 border-borde bg-superficie px-3 focus:border-petroleo focus:outline-none"
                      value={nombresEmpresa[clave] ?? ''}
                      onChange={(e) => setNombresEmpresa((n) => ({ ...n, [clave]: e.target.value }))}
                      placeholder="Nombre de la empresa"
                    />
                  </label>
                ))}
                {faltaNombreEmpresa && <p className="text-sm font-bold text-rojo">Escriba el nombre de cada empresa para poder guardar.</p>}
              </div>
            )}

            {clientesNuevos > 0 && (
              <Casilla
                etiqueta={`Crear ${plural(clientesNuevos, 'cliente nuevo', 'clientes nuevos')} con su RUT`}
                ayuda="Si no, las facturas quedan con el nombre del cliente pero sin ficha."
                checked={crearClientes}
                onChange={(e) => setCrearClientes(e.target.checked)}
              />
            )}

            <div className="overflow-x-auto rounded-lg border border-borde">
              <table className="w-full min-w-[60rem] text-left">
                <thead className="bg-papel text-tenue">
                  <tr>
                    <th className="px-3 py-2">N°</th>
                    <th className="px-3 py-2">Qué hacer</th>
                    <th className="px-3 py-2">Empresa</th>
                    <th className="px-3 py-2">Emisión</th>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2 text-right">Neto</th>
                    <th className="px-3 py-2 text-right">IVA</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borde">
                  {filas.map((f, i) => (
                    <tr key={`${f.archivo.name}-${i}`} className={f.accion === 'omitir' ? 'text-tenue' : ''}>
                      <td className="px-3 py-2 align-top font-bold cifra">
                        {f.leida.numero}
                        {f.leida.exenta && <span className="mt-1 block w-fit rounded bg-papel px-1 text-sm font-normal">Exenta</span>}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <select
                          aria-label={`Qué hacer con la factura ${f.leida.numero}`}
                          className={`min-h-10 rounded-md px-2 font-bold ${ESTILO[f.accion]}`}
                          value={f.accion}
                          disabled={!f.leida.empresaRut}
                          onChange={(e) => setFilas((fs) => fs.map((x, j) => (j === i ? { ...x, accion: e.target.value as AccionFactura } : x)))}
                        >
                          {f.existente ? <option value="actualizar">Actualizar</option> : <option value="nueva">Agregar</option>}
                          <option value="omitir">Omitir</option>
                        </select>
                        {f.motivo && <p className="mt-1 max-w-60 text-sm">{f.motivo}</p>}
                        {f.avisos.map((a) => (
                          <p key={a} className="mt-1 max-w-60 text-sm font-bold text-naranja">
                            {a}
                          </p>
                        ))}
                        <p className="mt-1 max-w-60 text-sm text-tenue break-all">{f.archivo.name}</p>
                      </td>
                      <td className="px-3 py-2 align-top">
                        {(f.empresaNueva ? nombresEmpresa[limpiarRut(f.leida.empresaRut!)] : ajustes.empresas.find((e) => limpiarRut(e.rut) === limpiarRut(f.leida.empresaRut ?? ''))?.nombre) || '—'}
                        {f.leida.empresaRut && <span className="block text-sm text-tenue cifra">{f.leida.empresaRut}</span>}
                        {f.empresaNueva && <span className="block text-sm font-bold text-petroleo">Empresa nueva</span>}
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap cifra">{f.leida.fechaEmision ? fechaCL(f.leida.fechaEmision) : '—'}</td>
                      <td className="px-3 py-2 align-top">
                        {f.cliente?.nombre ?? f.leida.nombreCliente ?? '—'}
                        {f.leida.rutCliente && <span className="block text-sm text-tenue cifra">{f.leida.rutCliente}</span>}
                        {f.leida.glosa && <span className="mt-1 block max-w-64 text-sm text-tenue">{f.leida.glosa}</span>}
                      </td>
                      <td className="px-3 py-2 align-top text-right cifra">
                        {pesos(f.leida.neto)}
                        {f.leida.exento > 0 && <span className="block text-sm text-tenue">Exento {pesos(f.leida.exento)}</span>}
                      </td>
                      <td className="px-3 py-2 align-top text-right cifra">{pesos(f.leida.iva)}</td>
                      <td className="px-3 py-2 align-top text-right font-bold cifra">{pesos(f.leida.total)}</td>
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

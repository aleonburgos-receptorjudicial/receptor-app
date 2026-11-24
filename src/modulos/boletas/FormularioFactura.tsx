// Formulario de factura emitida por una de las empresas de la usuaria: datos, montos con IVA, PDF y pagos.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/basedatos'
import { useAjustes } from '../../db/ajustes'
import { TASA_IVA, type Boleta, type Pago } from '../../db/tipos'
import { AreaTexto, Boton, Campo, Selector } from '../../compartido/Controles'
import { useAviso } from '../../compartido/Dialogos'
import { Ventana } from '../../compartido/Ventana'
import { hoyISO, pesos } from '../../utilidades/formato'
import { FormularioCliente } from '../clientes/FormularioCliente'
import { abrirArchivo, revisarArchivos } from '../retiros/servicioArchivos'
import { calcularFactura } from './calculos'
import { PagosDocumento } from './PagosDocumento'
import { documentoRepetido, guardarBoleta, guardarPdfFactura, validarFactura, type DatosBoleta, type ErroresBoleta } from './servicioBoletas'
import { agregarEmpresa, buscarEmpresa } from './servicioEmpresas'

/** Siguiente N° de factura de una empresa */
async function siguienteNumero(empresaRut?: string): Promise<number> {
  if (!empresaRut) return 0
  const lista = await db.boletas.where('empresaRut').equals(empresaRut).toArray()
  return Math.max(0, ...lista.filter((b) => b.tipoDocumento === 'factura').map((b) => b.numero)) + 1
}

export function FormularioFactura({
  abierta,
  factura,
  alCerrar,
  alRegistrarPago,
}: {
  abierta: boolean
  factura?: Boleta
  alCerrar: () => void
  alRegistrarPago: (b: Boleta) => void
}) {
  const ajustes = useAjustes()
  const avisar = useAviso()
  const [d, setD] = useState<DatosBoleta | null>(null)
  const [errores, setErrores] = useState<ErroresBoleta>({})
  const [nuevoCliente, setNuevoCliente] = useState(false)
  const [nuevaEmpresa, setNuevaEmpresa] = useState<{ nombre: string; rut: string; error?: string } | null>(null)
  const [pdf, setPdf] = useState<File | null>(null)
  const [errorPdf, setErrorPdf] = useState('')

  const datos = useLiveQuery(async () => {
    const [clientes, pagos, archivo] = await Promise.all([
      db.clientes.orderBy('nombre').toArray(),
      factura?.id ? db.pagos.where('boletaId').equals(factura.id).toArray() : Promise.resolve([] as Pago[]),
      factura?.archivoId ? db.archivos.get(factura.archivoId) : Promise.resolve(undefined),
    ])
    return { clientes, pagos, archivo }
  }, [factura?.id, factura?.archivoId])

  useEffect(() => {
    if (!abierta) return
    setErrores({})
    setPdf(null)
    setErrorPdf('')
    setNuevaEmpresa(null)
    if (factura) {
      const { id: _i, creado: _c, actualizado: _a, ejemplo: _e, ...resto } = factura
      setD(resto)
    } else {
      // Con una sola empresa, queda elegida
      const empresa = ajustes.empresas.length === 1 ? ajustes.empresas[0] : undefined
      siguienteNumero(empresa?.rut).then((numero) =>
        setD({
          tipoDocumento: 'factura',
          empresaRut: empresa?.rut,
          empresaNombre: empresa?.nombre,
          numero,
          fechaEmision: hoyISO(),
          neto: 0,
          exento: 0,
          iva: 0,
          bruto: 0,
          porcentajeRetencion: 0,
          retencion: 0,
          liquido: 0,
          pagaRetencion: 'Cliente',
          montoCobrar: 0,
          estado: 'Pendiente',
          causaIds: [],
          origen: 'manual',
        }),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, factura])

  if (!d || !datos) return null

  const poner = <K extends keyof DatosBoleta>(k: K, v: DatosBoleta[K]) => {
    setD((x) => (x ? { ...x, [k]: v } : x))
    setErrores((e) => ({ ...e, [k]: undefined }))
  }
  const elegirEmpresa = async (rut: string) => {
    const e = buscarEmpresa(ajustes.empresas, rut)
    const numero = !factura && e ? await siguienteNumero(e.rut) : d.numero
    setD((x) => (x ? { ...x, empresaRut: e?.rut, empresaNombre: e?.nombre, numero } : x))
    setErrores((er) => ({ ...er, empresaRut: undefined }))
  }
  const guardarEmpresaNueva = async () => {
    if (!nuevaEmpresa) return
    const r = await agregarEmpresa(nuevaEmpresa.nombre, nuevaEmpresa.rut)
    if (r.error || !r.empresa) return setNuevaEmpresa({ ...nuevaEmpresa, error: r.error })
    const numero = !factura ? await siguienteNumero(r.empresa.rut) : d.numero
    setD((x) => (x ? { ...x, empresaRut: r.empresa!.rut, empresaNombre: r.empresa!.nombre, numero } : x))
    setErrores((er) => ({ ...er, empresaRut: undefined }))
    setNuevaEmpresa(null)
    avisar(`Empresa «${r.empresa.nombre}» agregada`)
  }
  const elegirCliente = (id?: number) => {
    const c = datos.clientes.find((x) => x.id === id)
    setD((x) => (x ? { ...x, clienteId: id, nombreCliente: c?.nombre ?? x.nombreCliente, rutCliente: c?.rut ?? x.rutCliente } : x))
    setErrores((e) => ({ ...e, clienteId: undefined }))
  }
  const elegirPdf = (f?: File) => {
    if (!f) return
    const { validos, errores: er } = revisarArchivos([f])
    setErrorPdf(er[0] ?? '')
    if (validos[0]) setPdf(validos[0])
  }

  const montos = calcularFactura(d.neto ?? 0, d.exento ?? 0)
  // Al editar una factura leída del PDF se conserva su IVA (puede diferir en $1 por redondeo)
  const ivaMostrado = factura?.iva !== undefined && factura.neto === montos.neto && Math.abs(factura.iva - montos.iva) <= 1 ? factura.iva : montos.iva
  const total = montos.neto + montos.exento + ivaMostrado

  const guardar = async () => {
    const { errores: er, datos: limpio } = validarFactura(d, ivaMostrado)
    if (!er.numero && !er.empresaRut && (await documentoRepetido(limpio, factura?.id))) er.numero = `Ya existe la factura N° ${limpio.numero} de esta empresa.`
    setErrores(er)
    if (Object.values(er).some(Boolean)) {
      avisar('Revise los campos marcados en rojo.', 'error')
      return
    }
    const id = await guardarBoleta(limpio, factura?.id)
    if (pdf) await guardarPdfFactura(id, pdf, pdf.name)
    avisar(factura ? 'Factura actualizada' : 'Factura guardada')
    alCerrar()
  }

  const empresaGuardada = d.empresaRut && !buscarEmpresa(ajustes.empresas, d.empresaRut)

  return (
    <>
      <Ventana
        abierta={abierta}
        titulo={factura ? `Factura N° ${factura.numero}` : 'Nueva factura'}
        alCerrar={alCerrar}
        ancho="max-w-4xl"
        pie={
          <>
            <Boton variante="secundario" onClick={alCerrar}>
              Cancelar
            </Boton>
            <Boton onClick={guardar}>{factura ? 'Guardar cambios' : 'Guardar factura'}</Boton>
          </>
        }
      >
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            guardar()
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2 md:col-span-2">
              <Selector
                etiqueta="Empresa que emite la factura"
                obligatorio
                value={d.empresaRut ?? ''}
                onChange={(e) => elegirEmpresa(e.target.value)}
                error={errores.empresaRut}
                ayuda={ajustes.empresas.length ? undefined : 'Agregue primero su empresa con su nombre y RUT.'}
              >
                <option value="">— Elija la empresa —</option>
                {empresaGuardada && <option value={d.empresaRut}>{d.empresaNombre ?? d.empresaRut}</option>}
                {ajustes.empresas.map((e) => (
                  <option key={e.rut} value={e.rut}>
                    {e.nombre} ({e.rut})
                  </option>
                ))}
              </Selector>
              {nuevaEmpresa ? (
                <div className="grid gap-3 rounded-lg border border-borde bg-papel p-3 md:grid-cols-[1fr_14rem_auto] md:items-end">
                  <Campo etiqueta="Nombre de la empresa" value={nuevaEmpresa.nombre} onChange={(e) => setNuevaEmpresa({ ...nuevaEmpresa, nombre: e.target.value, error: undefined })} />
                  <Campo etiqueta="RUT de la empresa" value={nuevaEmpresa.rut} onChange={(e) => setNuevaEmpresa({ ...nuevaEmpresa, rut: e.target.value, error: undefined })} placeholder="76.123.456-7" />
                  <div className="flex gap-2">
                    <Boton onClick={guardarEmpresaNueva}>Agregar</Boton>
                    <Boton variante="discreto" onClick={() => setNuevaEmpresa(null)}>
                      Cancelar
                    </Boton>
                  </div>
                  {nuevaEmpresa.error && (
                    <p className="text-sm font-bold text-rojo md:col-span-3" role="alert">
                      {nuevaEmpresa.error}
                    </p>
                  )}
                </div>
              ) : (
                <Boton variante="discreto" className="self-start" onClick={() => setNuevaEmpresa({ nombre: '', rut: '' })}>
                  + Agregar una empresa
                </Boton>
              )}
            </div>
            <Campo etiqueta="N° de factura (folio)" obligatorio type="number" inputMode="numeric" value={d.numero || ''} onChange={(e) => poner('numero', Number(e.target.value))} error={errores.numero} className="cifra" />
            <Campo etiqueta="Fecha de emisión" obligatorio type="date" max={hoyISO()} value={d.fechaEmision} onChange={(e) => poner('fechaEmision', e.target.value)} error={errores.fechaEmision} />
            <div className="flex flex-col gap-2">
              <Selector etiqueta="Cliente" obligatorio value={d.clienteId ?? ''} onChange={(e) => elegirCliente(e.target.value ? Number(e.target.value) : undefined)} error={errores.clienteId}>
                <option value="">{d.nombreCliente ? `${d.nombreCliente} (sin ficha)` : '— Elija el cliente —'}</option>
                {datos.clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Selector>
              <Boton variante="discreto" className="self-start" onClick={() => setNuevoCliente(true)}>
                + Crear cliente nuevo
              </Boton>
            </div>
            <Campo etiqueta="RUT del cliente" value={d.rutCliente ?? ''} onChange={(e) => poner('rutCliente', e.target.value)} error={errores.rutCliente} placeholder="77.888.999-0" />
            <div className="md:col-span-2">
              <AreaTexto etiqueta="Detalle" value={d.glosa ?? ''} onChange={(e) => poner('glosa', e.target.value)} rows={2} placeholder="Qué se facturó" />
            </div>
          </div>

          <fieldset className="grid gap-4 border-t border-borde pt-4 md:grid-cols-2">
            <legend className="pr-2 font-serif text-lg font-bold text-petroleo">Montos</legend>
            <Campo etiqueta="Monto neto" type="number" inputMode="numeric" min={0} value={d.neto || ''} onChange={(e) => poner('neto', Number(e.target.value))} error={errores.neto} ayuda={`Afecto a IVA (${TASA_IVA} %)`} className="cifra" />
            <Campo etiqueta="Monto exento" type="number" inputMode="numeric" min={0} value={d.exento || ''} onChange={(e) => poner('exento', Number(e.target.value))} error={errores.exento} ayuda="Solo si la factura tiene montos sin IVA" className="cifra" />
            <dl className="grid grid-cols-2 gap-2 rounded-lg bg-papel p-3 text-center sm:grid-cols-4 md:col-span-2">
              <div>
                <dt className="text-sm text-tenue">Neto</dt>
                <dd className="text-lg font-bold cifra">{pesos(montos.neto)}</dd>
              </div>
              <div>
                <dt className="text-sm text-tenue">IVA {TASA_IVA} %</dt>
                <dd className="text-lg font-bold cifra">{pesos(ivaMostrado)}</dd>
              </div>
              <div>
                <dt className="text-sm text-tenue">Exento</dt>
                <dd className="text-lg font-bold cifra">{pesos(montos.exento)}</dd>
              </div>
              <div>
                <dt className="text-sm text-tenue">Total a cobrar</dt>
                <dd className="text-lg font-bold text-petroleo cifra">{pesos(total)}</dd>
              </div>
            </dl>
          </fieldset>

          <fieldset className="flex flex-col gap-3 border-t border-borde pt-4">
            <legend className="pr-2 font-serif text-lg font-bold text-petroleo">PDF de la factura</legend>
            {(pdf || datos.archivo) && (
              <p>
                {pdf ? `Se guardará: ${pdf.name}` : `Guardado: ${datos.archivo!.nombre}`}
                {!pdf && datos.archivo && (
                  <Boton variante="discreto" className="ml-2 min-h-10 py-1" onClick={() => abrirArchivo(datos.archivo!)}>
                    Ver PDF
                  </Boton>
                )}
              </p>
            )}
            <label className="flex min-h-12 w-fit cursor-pointer items-center rounded-lg border-2 border-petroleo px-4 font-bold text-petroleo hover:bg-petroleo-suave">
              {pdf || datos.archivo ? 'Cambiar el PDF' : 'Adjuntar el PDF'}
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => {
                  elegirPdf(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
            {errorPdf && (
              <p className="text-sm font-bold text-rojo" role="alert">
                {errorPdf}
              </p>
            )}
            <p className="text-sm text-tenue">El PDF queda guardado solo en este equipo, junto a la factura.</p>
          </fieldset>

          <fieldset className="grid gap-4 border-t border-borde pt-4 md:grid-cols-2">
            <legend className="pr-2 font-serif text-lg font-bold text-petroleo">Estado</legend>
            <Selector etiqueta="Estado" value={d.estado} onChange={(e) => poner('estado', e.target.value as DatosBoleta['estado'])} ayuda="Al registrar pagos que cubren el total, pasa sola a «Pagada».">
              <option>Pendiente</option>
              <option>Pagada</option>
              <option>Anulada</option>
            </Selector>
            {d.estado === 'Anulada' && <Campo etiqueta="Fecha de anulación" type="date" value={d.fechaAnulacion ?? ''} onChange={(e) => poner('fechaAnulacion', e.target.value)} ayuda="Por ejemplo, la fecha de la nota de crédito." />}
            <div className="md:col-span-2">
              <AreaTexto etiqueta="Nota" value={d.nota ?? ''} onChange={(e) => poner('nota', e.target.value)} rows={2} />
            </div>
          </fieldset>
          <button type="submit" hidden />
        </form>

        {factura && <PagosDocumento documento={factura} pagos={datos.pagos} alRegistrarPago={alRegistrarPago} />}
      </Ventana>
      <FormularioCliente abierta={nuevoCliente} alCerrar={() => setNuevoCliente(false)} alGuardar={(id) => elegirCliente(id)} />
    </>
  )
}


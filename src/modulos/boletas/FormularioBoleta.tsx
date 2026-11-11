// Formulario de boleta de honorarios: datos, montos calculados, causas asociadas y pagos registrados.
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/basedatos'
import { useAjustes } from '../../db/ajustes'
import type { Boleta, Pago } from '../../db/tipos'
import { AreaTexto, Boton, Campo, Opciones, Selector } from '../../compartido/Controles'
import { useAviso, useConfirmar } from '../../compartido/Dialogos'
import { Ventana } from '../../compartido/Ventana'
import { fechaCL, hoyISO, pesos } from '../../utilidades/formato'
import { contiene } from '../../utilidades/texto'
import { FormularioCliente } from '../clientes/FormularioCliente'
import { calcularMontos, saldoBoleta, totalPagado } from './calculos'
import { boletaPorNumero, eliminarPago, guardarBoleta, validarBoleta, type DatosBoleta, type ErroresBoleta } from './servicioBoletas'

const QUIEN = { cliente: 'El cliente (se le cobra el líquido)', yo: 'Yo (se le cobra el bruto)' } as const

export function FormularioBoleta({
  abierta,
  boleta,
  alCerrar,
  alRegistrarPago,
}: {
  abierta: boolean
  boleta?: Boleta
  alCerrar: () => void
  alRegistrarPago: (b: Boleta) => void
}) {
  const ajustes = useAjustes()
  const avisar = useAviso()
  const confirmar = useConfirmar()
  const [d, setD] = useState<DatosBoleta | null>(null)
  const [errores, setErrores] = useState<ErroresBoleta>({})
  const [nuevoCliente, setNuevoCliente] = useState(false)
  const [buscaCausa, setBuscaCausa] = useState('')

  const datos = useLiveQuery(async () => {
    const [clientes, causas, pagos] = await Promise.all([
      db.clientes.orderBy('nombre').toArray(),
      db.causas.toArray(),
      boleta?.id ? db.pagos.where('boletaId').equals(boleta.id).toArray() : Promise.resolve([] as Pago[]),
    ])
    return { clientes, causas, pagos }
  }, [boleta?.id])

  useEffect(() => {
    if (!abierta) return
    setErrores({})
    setBuscaCausa('')
    if (boleta) {
      const { id: _i, creado: _c, actualizado: _a, ejemplo: _e, ...resto } = boleta
      setD(resto)
    } else {
      // Se propone el número siguiente al más alto guardado
      db.boletas
        .orderBy('numero')
        .last()
        .then((ultima) =>
          setD({
            numero: (ultima?.numero ?? 0) + 1,
            fechaEmision: hoyISO(),
            bruto: 0,
            porcentajeRetencion: ajustes.porcentajeRetencion,
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
  }, [abierta, boleta])

  const montos = useMemo(() => (d ? calcularMontos(Math.round(d.bruto || 0), d.porcentajeRetencion || 0, d.pagaRetencion) : null), [d])

  if (!d || !datos) return null

  const poner = <K extends keyof DatosBoleta>(k: K, v: DatosBoleta[K]) => {
    setD((x) => (x ? { ...x, [k]: v } : x))
    setErrores((e) => ({ ...e, [k]: undefined }))
  }

  const elegirCliente = (id?: number) => {
    const c = datos.clientes.find((x) => x.id === id)
    setD((x) => (x ? { ...x, clienteId: id, nombreCliente: c?.nombre ?? x.nombreCliente, rutCliente: c?.rut ?? x.rutCliente } : x))
    setErrores((e) => ({ ...e, clienteId: undefined }))
  }

  const guardar = async () => {
    const { errores: er, datos: limpio } = validarBoleta(d)
    if (!er.numero && (await boletaPorNumero(limpio.numero, boleta?.id))) er.numero = `Ya existe la boleta N° ${limpio.numero}.`
    setErrores(er)
    if (Object.values(er).some(Boolean)) {
      avisar('Revise los campos marcados en rojo.', 'error')
      return
    }
    await guardarBoleta(limpio, boleta?.id)
    avisar(boleta ? 'Boleta actualizada' : 'Boleta guardada')
    alCerrar()
  }

  const quitarPago = async (p: Pago) => {
    const ok = await confirmar({ titulo: 'Eliminar pago', mensaje: `¿Eliminar el pago de ${pesos(p.monto)} del ${fechaCL(p.fecha)}?`, textoConfirmar: 'Eliminar', peligro: true })
    if (!ok) return
    await eliminarPago(p.id!)
    avisar('Pago eliminado')
  }

  // Causas para asociar: primero las del mismo cliente
  const causas = datos.causas
    .filter((c) => (d.causaIds ?? []).includes(c.id!) || !buscaCausa || contiene(c.rol, buscaCausa) || contiene(c.demandado, buscaCausa))
    .sort((a, b) => Number((d.causaIds ?? []).includes(b.id!)) - Number((d.causaIds ?? []).includes(a.id!)) || Number(b.clienteId === d.clienteId) - Number(a.clienteId === d.clienteId) || b.fechaEncargo.localeCompare(a.fechaEncargo))
    .slice(0, 30)
  const pagado = boleta ? totalPagado(boleta, datos.pagos) : 0

  return (
    <>
      <Ventana
        abierta={abierta}
        titulo={boleta ? `Boleta N° ${boleta.numero}` : 'Nueva boleta de honorarios'}
        alCerrar={alCerrar}
        ancho="max-w-4xl"
        pie={
          <>
            <Boton variante="secundario" onClick={alCerrar}>
              Cancelar
            </Boton>
            <Boton onClick={guardar}>{boleta ? 'Guardar cambios' : 'Guardar boleta'}</Boton>
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
            <Campo etiqueta="N° de boleta" obligatorio type="number" inputMode="numeric" value={d.numero || ''} onChange={(e) => poner('numero', Number(e.target.value))} error={errores.numero} className="cifra" />
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
            <Campo etiqueta="RUT del cliente" value={d.rutCliente ?? ''} onChange={(e) => poner('rutCliente', e.target.value)} error={errores.rutCliente} placeholder="97.004.000-5" />
            <div className="md:col-span-2">
              <AreaTexto etiqueta="Glosa" value={d.glosa ?? ''} onChange={(e) => poner('glosa', e.target.value)} rows={2} placeholder="Ej.: 2 alzamientos E-492-2026" />
            </div>
          </div>

          <fieldset className="grid gap-4 border-t border-borde pt-4 md:grid-cols-2">
            <legend className="pr-2 font-serif text-lg font-bold text-petroleo">Montos</legend>
            <Campo etiqueta="Honorarios brutos" obligatorio type="number" inputMode="numeric" min={0} value={d.bruto || ''} onChange={(e) => poner('bruto', Number(e.target.value))} error={errores.bruto} ayuda={d.bruto ? pesos(d.bruto) : undefined} className="cifra" />
            <Campo etiqueta="% de retención" type="number" inputMode="decimal" step="0.01" value={d.porcentajeRetencion} onChange={(e) => poner('porcentajeRetencion', Number(e.target.value))} error={errores.porcentajeRetencion} ayuda={`Vigente en 2026: ${ajustes.porcentajeRetencion.toLocaleString('es-CL')} %`} />
            <div className="md:col-span-2">
              <Opciones
                etiqueta="¿Quién paga la retención?"
                opciones={[QUIEN.cliente, QUIEN.yo] as const}
                valor={d.pagaRetencion === 'Cliente' ? QUIEN.cliente : QUIEN.yo}
                alCambiar={(v) => poner('pagaRetencion', v === QUIEN.cliente ? 'Cliente' : 'Receptor')}
              />
            </div>
            {montos && (
              <dl className="grid grid-cols-3 gap-2 rounded-lg bg-papel p-3 text-center md:col-span-2">
                <div>
                  <dt className="text-sm text-tenue">Retención</dt>
                  <dd className="text-lg font-bold cifra">{pesos(montos.retencion)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-tenue">Líquido</dt>
                  <dd className="text-lg font-bold cifra">{pesos(montos.liquido)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-tenue">Monto a cobrar</dt>
                  <dd className="text-lg font-bold text-petroleo cifra">{pesos(montos.montoCobrar)}</dd>
                </div>
              </dl>
            )}
          </fieldset>

          <fieldset className="grid gap-4 border-t border-borde pt-4 md:grid-cols-2">
            <legend className="pr-2 font-serif text-lg font-bold text-petroleo">Estado</legend>
            <Selector etiqueta="Estado" value={d.estado} onChange={(e) => poner('estado', e.target.value as DatosBoleta['estado'])} ayuda="Al registrar pagos que cubren el total, pasa sola a «Pagada».">
              <option>Pendiente</option>
              <option>Pagada</option>
              <option>Anulada</option>
            </Selector>
            {d.estado === 'Anulada' && <Campo etiqueta="Fecha de anulación" type="date" value={d.fechaAnulacion ?? ''} onChange={(e) => poner('fechaAnulacion', e.target.value)} />}
            <div className="md:col-span-2">
              <AreaTexto etiqueta="Nota" value={d.nota ?? ''} onChange={(e) => poner('nota', e.target.value)} rows={2} />
            </div>
          </fieldset>
          <button type="submit" hidden />
        </form>

        {boleta && boleta.estado !== 'Anulada' && (
          <section className="mt-6 flex flex-col gap-3 rounded-xl border border-borde p-4" aria-labelledby="titulo-pagos">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="titulo-pagos" className="font-serif text-lg font-bold">
                Pagos
              </h3>
              {saldoBoleta(boleta, datos.pagos) > 0 && (
                <Boton variante="secundario" className="min-h-10 py-1" onClick={() => alRegistrarPago(boleta)}>
                  Registrar pago
                </Boton>
              )}
            </div>
            {datos.pagos.length === 0 ? (
              <p className="text-tenue">Sin pagos registrados.</p>
            ) : (
              <ul className="divide-y divide-borde">
                {datos.pagos
                  .sort((a, b) => a.fecha.localeCompare(b.fecha))
                  .map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
                      <span className="flex-1">
                        <span className="font-bold cifra">{pesos(p.monto)}</span> el <span className="cifra">{fechaCL(p.fecha)}</span>, {p.medio.toLowerCase()}
                        {p.nota && <span className="block text-sm text-tenue">{p.nota}</span>}
                      </span>
                      <Boton variante="discreto" className="min-h-10 py-1 text-rojo" onClick={() => quitarPago(p)}>
                        Eliminar pago
                      </Boton>
                    </li>
                  ))}
              </ul>
            )}
            <p className="text-sm text-tenue cifra">
              Pagado {pesos(pagado)} de {pesos(boleta.montoCobrar)}
              {saldoBoleta(boleta, datos.pagos) > 0 ? `; falta ${pesos(saldoBoleta(boleta, datos.pagos))}` : ''}
            </p>
          </section>
        )}

        <section className="mt-6 flex flex-col gap-3 rounded-xl border border-borde p-4" aria-labelledby="titulo-causas-boleta">
          <h3 id="titulo-causas-boleta" className="font-serif text-lg font-bold">
            Causas asociadas ({(d.causaIds ?? []).length})
          </h3>
          <input
            type="search"
            className="min-h-12 rounded-lg border-2 border-borde bg-superficie px-3 focus:border-petroleo focus:outline-none"
            placeholder="Buscar causa por ROL o demandado"
            aria-label="Buscar causa para asociar"
            value={buscaCausa}
            onChange={(e) => setBuscaCausa(e.target.value)}
          />
          {causas.length === 0 ? (
            <p className="text-tenue">No hay causas que coincidan.</p>
          ) : (
            <ul className="max-h-64 divide-y divide-borde overflow-y-auto rounded-lg border border-borde">
              {causas.map((c) => {
                const marcada = (d.causaIds ?? []).includes(c.id!)
                return (
                  <li key={c.id} className={marcada ? 'bg-petroleo-suave' : ''}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-1">
                      <input
                        type="checkbox"
                        className="h-6 w-6 accent-[var(--petroleo)]"
                        checked={marcada}
                        onChange={(e) => poner('causaIds', e.target.checked ? [...(d.causaIds ?? []), c.id!] : (d.causaIds ?? []).filter((x) => x !== c.id))}
                      />
                      <span>
                        <span className="font-serif font-bold cifra">{c.rol}</span>
                        <span className="block text-sm text-tenue">
                          {[c.tipoDiligencia, c.demandado, c.estado].filter(Boolean).join(', ')}
                          {c.boletaId && c.boletaId !== boleta?.id ? ' (ya tiene otra boleta)' : ''}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </Ventana>
      <FormularioCliente abierta={nuevoCliente} alCerrar={() => setNuevoCliente(false)} alGuardar={(id) => elegirCliente(id)} />
    </>
  )
}

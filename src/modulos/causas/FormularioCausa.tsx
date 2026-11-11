// Formulario para crear o editar una causa (civil, exhorto, etc.).
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/basedatos'
import { useAjustes } from '../../db/ajustes'
import { ESTADOS_CAUSA, ORIGENES, type Causa } from '../../db/tipos'
import { AreaTexto, Boton, Campo, CampoConLista, Casilla, Opciones, Selector } from '../../compartido/Controles'
import { useAviso } from '../../compartido/Dialogos'
import { Ventana } from '../../compartido/Ventana'
import { fechaCL, hoyISO } from '../../utilidades/formato'
import { FormularioCliente } from '../clientes/FormularioCliente'
import { buscarDuplicado, guardarCausa, validarCausa, type DatosCausa, type ErroresCausa } from './servicioCausas'

function causaVacia(tribunal: string): DatosCausa {
  return {
    rol: '',
    tipoCausa: 'Civil',
    tribunal,
    origen: 'Particular',
    fechaEncargo: hoyISO(),
    estado: 'Pendiente',
    estampadoPjud: false,
  }
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 border-t border-borde pt-4 md:grid-cols-2">
      <legend className="pr-2 font-serif text-lg font-bold text-petroleo">{titulo}</legend>
      {children}
    </fieldset>
  )
}

export function FormularioCausa({ abierta, causa, alCerrar }: { abierta: boolean; causa?: Causa; alCerrar: () => void }) {
  const ajustes = useAjustes()
  const avisar = useAviso()
  const [d, setD] = useState<DatosCausa>(causaVacia(ajustes.tribunalPorDefecto))
  const [errores, setErrores] = useState<ErroresCausa>({})
  const [duplicada, setDuplicada] = useState<Causa | null>(null)
  const [nuevoCliente, setNuevoCliente] = useState(false)
  const clientes = useLiveQuery(() => db.clientes.orderBy('nombre').toArray(), []) ?? []
  const boletas = useLiveQuery(() => db.boletas.where('estado').notEqual('Anulada').toArray(), []) ?? []

  useEffect(() => {
    if (!abierta) return
    if (causa) {
      const { id: _id, creado: _c, actualizado: _a, ejemplo: _e, ...resto } = causa
      setD(resto)
    } else {
      setD(causaVacia(ajustes.tribunalPorDefecto))
    }
    setErrores({})
    setDuplicada(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, causa])

  const poner = <K extends keyof DatosCausa>(campo: K, valor: DatosCausa[K]) => {
    setD((x) => ({ ...x, [campo]: valor }))
    setErrores((e) => ({ ...e, [campo]: undefined }))
    if (campo === 'rol' || campo === 'fechaEncargo' || campo === 'clienteId') setDuplicada(null)
  }
  const texto = (campo: keyof DatosCausa) => (e: { target: { value: string } }) => poner(campo, e.target.value as never)

  const guardar = async (aunqueDuplicada = false) => {
    const { errores: er, datos } = validarCausa(d)
    setErrores(er)
    if (Object.keys(er).length) {
      avisar('Revise los campos marcados en rojo.', 'error')
      return
    }
    if (!aunqueDuplicada) {
      const otra = await buscarDuplicado(datos, causa?.id)
      if (otra) {
        setDuplicada(otra)
        return
      }
    }
    await guardarCausa(datos, causa?.id)
    avisar(causa ? 'Causa actualizada' : 'Causa guardada')
    alCerrar()
  }

  return (
    <>
      <Ventana
        abierta={abierta}
        titulo={causa ? `Editar causa ${causa.rol.replace(/-/g, '\u2011')}` : 'Nueva causa'}
        alCerrar={alCerrar}
        ancho="max-w-4xl"
        pie={
          <>
            <Boton variante="secundario" onClick={alCerrar}>
              Cancelar
            </Boton>
            <Boton onClick={() => guardar(false)}>{causa ? 'Guardar cambios' : 'Guardar causa'}</Boton>
          </>
        }
      >
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            guardar(false)
          }}
        >
          <Grupo titulo="Causa">
            <Campo etiqueta="ROL" obligatorio value={d.rol} onChange={texto('rol')} error={errores.rol} placeholder="C-512-2026" autoFocus={!causa} className="font-serif text-lg cifra" />
            <Selector etiqueta="Tipo de causa" value={d.tipoCausa} onChange={texto('tipoCausa')}>
              {Array.from(new Set([...ajustes.tiposCausa, d.tipoCausa])).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Selector>
            <div className="md:col-span-2">
              <Campo etiqueta="Tribunal" obligatorio value={d.tribunal} onChange={texto('tribunal')} error={errores.tribunal} />
            </div>
            <Selector etiqueta="Origen del encargo" value={d.origen} onChange={texto('origen')}>
              {ORIGENES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Selector>
            <Campo etiqueta="Fecha de encargo" obligatorio type="date" value={d.fechaEncargo} max={hoyISO()} onChange={texto('fechaEncargo')} error={errores.fechaEncargo} />
          </Grupo>

          <Grupo titulo="Cliente">
            <div className="flex flex-col gap-2">
              <Selector etiqueta="Estudio jurídico" value={d.clienteId ?? ''} onChange={(e) => poner('clienteId', e.target.value ? Number(e.target.value) : undefined)}>
                <option value="">— Sin cliente —</option>
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
            <CampoConLista
              etiqueta="Mandante"
              opciones={ajustes.mandantes}
              value={d.mandante ?? ''}
              onChange={texto('mandante')}
              placeholder="Banco, cooperativa…"
              ayuda="Elija de la lista o escriba uno nuevo. La lista se edita en Clientes → Mandantes."
            />
          </Grupo>

          <Grupo titulo="Diligencia">
            <Campo etiqueta="Nombre del demandado" value={d.demandado ?? ''} onChange={texto('demandado')} />
            <Campo etiqueta="RUT del demandado" value={d.rutDemandado ?? ''} onChange={texto('rutDemandado')} error={errores.rutDemandado} placeholder="12.345.678-9" ayuda="Opcional. Se revisa el dígito verificador." />
            <div className="md:col-span-2">
              <Campo etiqueta="Domicilio de la diligencia" value={d.domicilio ?? ''} onChange={texto('domicilio')} />
            </div>
            <CampoConLista etiqueta="Sector" opciones={ajustes.sectores} value={d.sector ?? ''} onChange={texto('sector')} ayuda="Sirve para armar la hoja de ruta. Puede escribir uno nuevo." />
            <CampoConLista
              etiqueta="Tipo de diligencia"
              opciones={ajustes.tiposDiligencia}
              value={d.tipoDiligencia ?? ''}
              onChange={texto('tipoDiligencia')}
              ayuda="Elija de la lista o escriba uno nuevo: se agregará a la lista."
            />
            <div className="md:col-span-2">
              <Casilla etiqueta="Encargo urgente" checked={!!d.urgente} onChange={(e) => poner('urgente', e.target.checked || undefined)} />
            </div>
          </Grupo>

          <Grupo titulo="Estado y resultado">
            <Selector etiqueta="Estado" value={d.estado} onChange={texto('estado')} ayuda="Devuelta: el cliente retiró o cerró el encargo.">
              {ESTADOS_CAUSA.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </Selector>
            <Campo etiqueta="Fecha de diligencia" type="date" value={d.fechaDiligencia ?? ''} max={hoyISO()} onChange={texto('fechaDiligencia')} error={errores.fechaDiligencia} />
            {d.estado === 'Realizada' && (
              <>
                <Opciones etiqueta="Resultado" opciones={['Positiva', 'Negativa'] as const} valor={d.resultado} alCambiar={(v) => poner('resultado', v)} />
                <Selector etiqueta="Detalle del resultado" value={d.detalleResultado ?? ''} onChange={texto('detalleResultado')}>
                  <option value="">— Sin detalle —</option>
                  {Array.from(new Set([...ajustes.detallesResultado, ...(d.detalleResultado ? [d.detalleResultado] : [])])).map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </Selector>
                <Casilla etiqueta="Estampado subido al PJUD" checked={d.estampadoPjud} onChange={(e) => poner('estampadoPjud', e.target.checked)} />
                <Selector etiqueta="Boleta asociada" value={d.boletaId ?? ''} onChange={(e) => poner('boletaId', e.target.value ? Number(e.target.value) : undefined)}>
                  <option value="">— Sin boleta —</option>
                  {boletas
                    .sort((a, b) => b.numero - a.numero)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        N° {b.numero} · {fechaCL(b.fechaEmision)}
                        {b.nombreCliente ? ` · ${b.nombreCliente}` : ''}
                      </option>
                    ))}
                </Selector>
              </>
            )}
            <div className="md:col-span-2">
              <AreaTexto etiqueta="Observaciones" value={d.observaciones ?? ''} onChange={texto('observaciones')} rows={4} />
            </div>
            {d.reencargo && (
              <p className="text-tenue md:col-span-2">
                Reencargo. Fechas de encargo anteriores: {(d.fechasAnteriores ?? []).map(fechaCL).join(', ') || 'no registradas'}.
              </p>
            )}
          </Grupo>
          <button type="submit" hidden />
        </form>

        {duplicada && (
          <div className="mt-5 rounded-lg border-l-4 border-naranja bg-naranja-suave p-4" role="alert">
            <p className="font-bold">
              Ya existe la causa {duplicada.rol} con la misma fecha de encargo ({fechaCL(duplicada.fechaEncargo)}) y el mismo cliente.
            </p>
            <p className="mt-1">Probablemente es un duplicado. Si de verdad es otro encargo, puede guardarlo igual.</p>
            <Boton variante="secundario" className="mt-3" onClick={() => guardar(true)}>
              Guardar igual
            </Boton>
          </div>
        )}
      </Ventana>
      <FormularioCliente abierta={nuevoCliente} alCerrar={() => setNuevoCliente(false)} alGuardar={(id) => poner('clienteId', id)} />
    </>
  )
}

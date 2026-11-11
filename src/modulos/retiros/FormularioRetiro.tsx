// Formulario de retiro de vehículo. Se arma según los campos configurados en Configuración
// (orden, nombres, campos ocultos y campos personalizados).
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/basedatos'
import { useAjustes } from '../../db/ajustes'
import { ESTADOS_RETIRO, type CampoRetiro, type Retiro } from '../../db/tipos'
import { AreaTexto, Boton, Campo, CampoConLista, Casilla, Selector } from '../../compartido/Controles'
import { useAviso } from '../../compartido/Dialogos'
import { Ventana } from '../../compartido/Ventana'
import { diasEntre, fechaCL, hoyISO, plural, sumarDias } from '../../utilidades/formato'
import { formatearPatente, patenteValida } from '../../utilidades/patente'
import { FormularioCliente } from '../clientes/FormularioCliente'
import { AdjuntosRetiro } from './AdjuntosRetiro'
import { Placa } from './Piezas'
import { agregarArchivos } from './servicioArchivos'
import { buscarRetiroDuplicado, guardarRetiro, validarRetiro, valorCampo, type DatosRetiro, type ErroresRetiro, type ValorExtra } from './servicioRetiros'

// Los retiros suelen venir de otros tribunales: el tribunal parte vacío (con sugerencias)
function retiroVacio(): DatosRetiro {
  return { rol: '', tribunal: '', fechaEncargo: hoyISO(), fechaEmision: '', fechaVencimiento: '', estado: 'Pendiente' }
}

// Campos que ocupan todo el ancho del formulario
const ANCHOS = new Set(['tribunal', 'direccion', 'observaciones', 'clienteId', 'martilleroDireccion'])

/** Valores sin repetir y ordenados, para sugerir al escribir */
const sugerencias = (valores: (string | undefined)[]) =>
  Array.from(new Set(valores.map((v) => v?.trim()).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b, 'es'))

export function FormularioRetiro({ abierta, retiro, alCerrar }: { abierta: boolean; retiro?: Retiro; alCerrar: () => void }) {
  const ajustes = useAjustes()
  const avisar = useAviso()
  const [d, setD] = useState<DatosRetiro>(retiroVacio())
  const [errores, setErrores] = useState<ErroresRetiro>({})
  const [duplicado, setDuplicado] = useState<Retiro | null>(null)
  const [nuevoCliente, setNuevoCliente] = useState(false)
  const [pdfsPendientes, setPdfsPendientes] = useState<File[]>([])
  const clientes = useLiveQuery(() => db.clientes.orderBy('nombre').toArray(), []) ?? []
  // Tribunales y mandantes ya usados, para sugerirlos
  const usados = useLiveQuery(async () => {
    const [retiros, causas] = await Promise.all([db.retiros.toArray(), db.causas.toArray()])
    return {
      tribunales: sugerencias([...retiros.map((r) => r.tribunal), ajustes.tribunalPorDefecto]),
      mandantes: sugerencias([...ajustes.mandantes, ...retiros.map((r) => r.mandante), ...causas.map((c) => c.mandante)]),
    }
  }, [ajustes.tribunalPorDefecto, ajustes.mandantes]) ?? { tribunales: [], mandantes: [] }

  useEffect(() => {
    if (!abierta) return
    if (retiro) {
      const { id: _i, creado: _c, actualizado: _a, ejemplo: _e, ...resto } = retiro
      setD(resto)
    } else setD(retiroVacio())
    setErrores({})
    setDuplicado(null)
    setPdfsPendientes([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, retiro])

  const poner = (campo: CampoRetiro, valor: ValorExtra | undefined) => {
    setErrores((e) => ({ ...e, [campo.clave]: undefined }))
    // Con una vigencia habitual configurada, al poner la emisión se propone el vencimiento
    if (campo.clave === 'fechaEmision' && typeof valor === 'string' && valor && ajustes.vigenciaOficioDias) {
      const anterior = d.fechaEmision ? sumarDias(d.fechaEmision, ajustes.vigenciaOficioDias) : ''
      if (!d.fechaVencimiento || d.fechaVencimiento === anterior) {
        setD((x) => ({ ...x, fechaEmision: valor, fechaVencimiento: sumarDias(valor, ajustes.vigenciaOficioDias!) }))
        return
      }
    }
    if (campo.clave === 'rol' || campo.clave === 'patente') setDuplicado(null)
    if (campo.base) setD((x) => ({ ...x, [campo.clave]: valor ?? undefined }))
    else setD((x) => ({ ...x, extras: { ...(x.extras ?? {}), [campo.clave]: valor ?? null } }))
  }

  const guardar = async (aunqueDuplicado = false) => {
    const { errores: er, datos } = validarRetiro(d, ajustes.camposRetiro)
    setErrores(er)
    if (Object.values(er).some(Boolean)) {
      avisar('Revise los campos marcados en rojo.', 'error')
      return
    }
    if (!aunqueDuplicado && datos.patente) {
      const otro = await buscarRetiroDuplicado(datos, retiro?.id)
      if (otro) {
        setDuplicado(otro)
        return
      }
    }
    const id = await guardarRetiro(datos, retiro?.id)
    if (pdfsPendientes.length) await agregarArchivos(id, pdfsPendientes)
    avisar(retiro ? 'Retiro actualizado' : 'Retiro guardado')
    alCerrar()
  }

  const control = (c: CampoRetiro) => {
    const v = valorCampo(d, c)
    const error = errores[c.clave]
    const comun = { etiqueta: c.etiqueta, error, obligatorio: c.obligatorio }
    const texto = typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v)

    switch (c.clave) {
      case 'clienteId':
        return (
          <div className="flex flex-col gap-2">
            <Selector {...comun} value={texto} onChange={(e) => poner(c, e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">— Sin cliente —</option>
              {clientes.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.nombre}
                </option>
              ))}
            </Selector>
            <Boton variante="discreto" className="self-start" onClick={() => setNuevoCliente(true)}>
              + Crear cliente nuevo
            </Boton>
          </div>
        )
      case 'estado':
        return (
          <Selector {...comun} value={texto} onChange={(e) => poner(c, e.target.value)}>
            {ESTADOS_RETIRO.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </Selector>
        )
      case 'rol':
        return <Campo {...comun} value={texto} onChange={(e) => poner(c, e.target.value)} placeholder="C-512-2026" className="font-serif text-lg cifra" autoFocus={!retiro} />
      case 'patente':
        return (
          <div className="flex flex-col gap-2">
            <Campo
              {...comun}
              value={texto}
              onChange={(e) => poner(c, e.target.value.toUpperCase())}
              placeholder="BBBB12"
              autoCapitalize="characters"
              ayuda="Se revisa el formato chileno (autos y motos)."
              className="uppercase tracking-widest"
            />
            {texto && patenteValida(texto) && <Placa patente={formatearPatente(texto)} />}
          </div>
        )
      case 'rutDeudor':
        return <Campo {...comun} value={texto} onChange={(e) => poner(c, e.target.value)} placeholder="12.345.678-9" ayuda="Opcional. Se revisa el dígito verificador." />
      case 'observaciones':
        return <AreaTexto {...comun} value={texto} onChange={(e) => poner(c, e.target.value)} rows={4} />
      case 'horaRetiro':
        return <Campo {...comun} type="time" value={texto} onChange={(e) => poner(c, e.target.value)} />
      case 'fechaEmision':
        return <Campo {...comun} type="date" value={texto} max={hoyISO()} onChange={(e) => poner(c, e.target.value)} />
      case 'fechaVencimiento': {
        let ayuda: string | undefined
        if (texto) {
          const faltan = diasEntre(hoyISO(), texto)
          const vigencia = d.fechaEmision ? `Vigencia de ${plural(diasEntre(d.fechaEmision, texto), 'día', 'días')} desde la emisión. ` : ''
          ayuda = vigencia + (faltan < 0 ? 'Este oficio ya está vencido.' : faltan === 0 ? 'Vence hoy.' : `Faltan ${plural(faltan, 'día', 'días')}.`)
        } else if (ajustes.vigenciaOficioDias) ayuda = `Se propone solo al poner la fecha de emisión (${ajustes.vigenciaOficioDias} días).`
        return <Campo {...comun} type="date" value={texto} onChange={(e) => poner(c, e.target.value)} ayuda={ayuda} />
      }
      case 'tribunal':
        return <CampoConLista {...comun} opciones={usados.tribunales} value={texto} onChange={(e) => poner(c, e.target.value)} placeholder="Ej.: 1er Juzgado Civil de Concepción" />
      case 'mandante':
        return <CampoConLista {...comun} opciones={usados.mandantes} value={texto} onChange={(e) => poner(c, e.target.value)} placeholder="Ej.: BK, FORUM, TANNER" />
      case 'direccion':
        return <AreaTexto {...comun} value={texto} onChange={(e) => poner(c, e.target.value)} rows={3} placeholder="Un domicilio por línea, el más probable primero" />
      case 'martilleroTelefono':
        return <Campo {...comun} type="tel" inputMode="tel" value={texto} onChange={(e) => poner(c, e.target.value)} placeholder="+56 9 1234 5678" />
    }

    switch (c.tipo) {
      case 'fecha':
        return <Campo {...comun} type="date" value={texto} max={c.clave === 'fechaEncargo' || c.clave === 'fechaRetiro' ? hoyISO() : undefined} onChange={(e) => poner(c, e.target.value)} />
      case 'numero':
        return (
          <Campo
            {...comun}
            type="number"
            inputMode="numeric"
            value={texto}
            onChange={(e) => poner(c, e.target.value === '' ? undefined : Number(e.target.value))}
          />
        )
      case 'sino':
        return (
          <div className="flex flex-col justify-end">
            <Casilla etiqueta={c.etiqueta} checked={v === true} onChange={(e) => poner(c, e.target.checked)} />
            {error && <p className="text-sm font-bold text-rojo">{error}</p>}
          </div>
        )
      case 'lista':
        return (
          <Selector {...comun} value={texto} onChange={(e) => poner(c, e.target.value || undefined)}>
            <option value="">— Elija —</option>
            {(c.opciones ?? []).map((o) => (
              <option key={o}>{o}</option>
            ))}
            {texto && !(c.opciones ?? []).includes(texto) && <option>{texto}</option>}
          </Selector>
        )
      default:
        return <Campo {...comun} value={texto} onChange={(e) => poner(c, e.target.value)} />
    }
  }

  // Algunos campos solo se muestran cuando corresponden (el formulario queda más corto)
  const DATOS_DEL_RETIRO = new Set(['fechaRetiro', 'horaRetiro', 'lugarRetiro', 'custodio'])
  const corresponde = (c: CampoRetiro) => {
    if (DATOS_DEL_RETIRO.has(c.clave)) return d.estado === 'Retirado' || !!valorCampo(d, c)
    return true
  }
  const visibles = ajustes.camposRetiro.filter((c) => c.visible && corresponde(c))

  return (
    <>
      <Ventana
        abierta={abierta}
        titulo={retiro ? `Editar retiro ${retiro.rol.replace(/-/g, '‑')}` : 'Nuevo retiro de vehículo'}
        alCerrar={alCerrar}
        ancho="max-w-4xl"
        pie={
          <>
            <Boton variante="secundario" onClick={alCerrar}>
              Cancelar
            </Boton>
            <Boton onClick={() => guardar(false)}>{retiro ? 'Guardar cambios' : 'Guardar retiro'}</Boton>
          </>
        }
      >
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            guardar(false)
          }}
        >
          {visibles.map((c) => (
            <div key={c.clave} className={ANCHOS.has(c.clave) ? 'md:col-span-2' : ''}>
              {control(c)}
            </div>
          ))}
          <button type="submit" hidden />
        </form>
        <div className="mt-6">
          <AdjuntosRetiro retiroId={retiro?.id} pendientes={pdfsPendientes} alCambiarPendientes={setPdfsPendientes} />
        </div>
        <p className="mt-4 text-sm text-tenue">Puede agregar, renombrar, ordenar u ocultar campos de este formulario en Configuración.</p>

        {duplicado && (
          <div className="mt-5 rounded-lg border-l-4 border-naranja bg-naranja-suave p-4" role="alert">
            <p className="font-bold">
              Ya existe un retiro con el ROL {duplicado.rol} y la patente {duplicado.patente} (encargo {fechaCL(duplicado.fechaEncargo)}).
            </p>
            <p className="mt-1">Probablemente es un duplicado. Si de verdad es otro encargo, puede guardarlo igual.</p>
            <Boton variante="secundario" className="mt-3" onClick={() => guardar(true)}>
              Guardar igual
            </Boton>
          </div>
        )}
      </Ventana>
      <FormularioCliente
        abierta={nuevoCliente}
        alCerrar={() => setNuevoCliente(false)}
        alGuardar={(id) => setD((x) => ({ ...x, clienteId: id }))}
      />
    </>
  )
}

// Configuración. En la fase 1: apariencia y datos de ejemplo.
// Umbrales, listas, campos de retiros y respaldos se agregan en las fases siguientes.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { guardarAjustes, useAjustes } from '../../db/ajustes'
import { borrarDatosEjemplo, cargarDatosEjemplo, hayDatosEjemplo } from '../../db/ejemplo'
import { Boton, Campo, EncabezadoPagina, Seccion } from '../../compartido/Controles'
import { EditorCamposRetiro } from './EditorCamposRetiro'
import { EditorLista } from './EditorLista'
import { useAviso, useConfirmar } from '../../compartido/Dialogos'
import { IconoLuna } from '../../compartido/Iconos'

export function PaginaConfiguracion() {
  const ajustes = useAjustes()
  const confirmar = useConfirmar()
  const avisar = useAviso()
  const conEjemplo = useLiveQuery(hayDatosEjemplo, [])
  // Estado inmediato del interruptor (se guarda en la base y se sincroniza)
  const [oscuro, setOscuro] = useState(ajustes.modoOscuro)
  useEffect(() => setOscuro(ajustes.modoOscuro), [ajustes.modoOscuro])

  const cambiarModo = (valor: boolean) => {
    setOscuro(valor)
    document.documentElement.classList.toggle('oscuro', valor)
    guardarAjustes({ modoOscuro: valor })
  }

  // Plazos (días) para los colores de prioridad de las causas
  const [umbrales, setUmbrales] = useState(ajustes.umbralesCausas)
  const [errorUmbrales, setErrorUmbrales] = useState('')
  useEffect(() => setUmbrales(ajustes.umbralesCausas), [ajustes.umbralesCausas])
  const guardarUmbrales = async () => {
    const { reciente, media, alta } = umbrales
    if (![reciente, media, alta].every((n) => Number.isInteger(n) && n > 0)) {
      setErrorUmbrales('Escriba números enteros mayores que cero.')
      return
    }
    if (!(reciente < media && media < alta)) {
      setErrorUmbrales('Cada plazo debe ser mayor que el anterior (verde < amarillo < naranja).')
      return
    }
    setErrorUmbrales('')
    await guardarAjustes({ umbralesCausas: umbrales })
    avisar('Plazos de las causas guardados')
  }
  const numero = (campo: keyof typeof umbrales) => (e: { target: { value: string } }) =>
    setUmbrales((u) => ({ ...u, [campo]: Number(e.target.value) }))

  // Plazos (días restantes) para los colores de los retiros de vehículos
  const [umbRet, setUmbRet] = useState(ajustes.umbralesRetiros)
  const [errorRet, setErrorRet] = useState('')
  useEffect(() => setUmbRet(ajustes.umbralesRetiros), [ajustes.umbralesRetiros])
  const guardarUmbRet = async () => {
    const { verde, amarillo } = umbRet
    if (![verde, amarillo].every((n) => Number.isInteger(n) && n > 0)) return setErrorRet('Escriba números enteros mayores que cero.')
    if (!(amarillo <= verde)) return setErrorRet('El límite del amarillo debe ser menor o igual al del verde.')
    setErrorRet('')
    await guardarAjustes({ umbralesRetiros: umbRet })
    avisar('Plazos de los retiros guardados')
  }

  const cargar = async () => {
    await cargarDatosEjemplo()
    avisar('Datos de ejemplo cargados. Revise el módulo Clientes.')
  }

  const borrar = async () => {
    const ok = await confirmar({
      titulo: 'Borrar datos de ejemplo',
      mensaje: 'Se borrarán solo los clientes, causas y boletas de ejemplo. Sus datos reales no se tocan.',
      textoConfirmar: 'Borrar ejemplos',
      peligro: true,
    })
    if (!ok) return
    await borrarDatosEjemplo()
    avisar('Datos de ejemplo borrados')
  }

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina titulo="Configuración y respaldos" descripcion="Ajuste la app a su forma de trabajar." />

      <Seccion titulo="Apariencia">
        <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4">
          <span className="flex items-center gap-3 text-lg">
            <IconoLuna />
            <span>
              Modo oscuro
              <span className="block text-base text-tenue">Fondo oscuro, más cómodo de noche.</span>
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="h-7 w-7 accent-[var(--petroleo)]"
            checked={oscuro}
            onChange={(e) => cambiarModo(e.target.checked)}
          />
        </label>
      </Seccion>

      <Seccion titulo="Causas: colores según los días desde el encargo">
        <p className="mb-4 max-w-[65ch] text-tenue">
          Las causas no tienen vencimiento; el color avisa cuánto tiempo llevan pendientes. Las suspendidas y devueltas no cuentan.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <Campo etiqueta="Verde (reciente) hasta" type="number" min={1} inputMode="numeric" value={umbrales.reciente} onChange={numero('reciente')} ayuda="días" />
          <Campo etiqueta="Amarillo (media) hasta" type="number" min={1} inputMode="numeric" value={umbrales.media} onChange={numero('media')} ayuda="días" />
          <Campo etiqueta="Naranja (alta) hasta" type="number" min={1} inputMode="numeric" value={umbrales.alta} onChange={numero('alta')} ayuda={`días; sobre ${umbrales.alta || '…'} días es rojo y aparece como atrasada`} />
        </div>
        {errorUmbrales && <p className="mt-2 font-bold text-rojo" role="alert">{errorUmbrales}</p>}
        <Boton className="mt-4" onClick={guardarUmbrales}>
          Guardar plazos de causas
        </Boton>
      </Seccion>

      <Seccion titulo="Listas de las causas">
        <div className="grid gap-8 lg:grid-cols-2">
          <EditorLista
            titulo="Tipos de diligencia"
            ayuda="También se agregan solos cuando escribe uno nuevo en una causa o importa un Excel."
            valores={ajustes.tiposDiligencia}
            alGuardar={(v) => guardarAjustes({ tiposDiligencia: v })}
          />
          <EditorLista titulo="Detalles del resultado" valores={ajustes.detallesResultado} alGuardar={(v) => guardarAjustes({ detallesResultado: v })} />
          <EditorLista titulo="Sectores" ayuda="Se usan para agrupar la hoja de ruta del día." valores={ajustes.sectores} alGuardar={(v) => guardarAjustes({ sectores: v })} />
          <EditorLista titulo="Tipos de causa" valores={ajustes.tiposCausa} alGuardar={(v) => guardarAjustes({ tiposCausa: v })} />
        </div>
        <div className="mt-6 max-w-xl">
          <Campo
            etiqueta="Tribunal por defecto"
            key={ajustes.tribunalPorDefecto}
            defaultValue={ajustes.tribunalPorDefecto}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== ajustes.tribunalPorDefecto) {
                guardarAjustes({ tribunalPorDefecto: v })
                avisar('Tribunal por defecto guardado')
              }
            }}
            ayuda="Se pone solo en cada causa nueva y en las importaciones."
          />
        </div>
      </Seccion>

      <Seccion titulo="Retiros de vehículos: colores según los días que faltan">
        <p className="mb-4 max-w-[65ch] text-tenue">
          Verde: faltan más de {umbRet.verde || '…'} días. Amarillo: de {umbRet.amarillo || '…'} a {umbRet.verde || '…'} días. Naranja: de 0 a {(umbRet.amarillo || 1) - 1} días. Rojo: vencido.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Campo etiqueta="Verde si faltan más de" type="number" min={1} inputMode="numeric" value={umbRet.verde} onChange={(e) => setUmbRet((u) => ({ ...u, verde: Number(e.target.value) }))} ayuda="días" />
          <Campo etiqueta="Amarillo desde" type="number" min={1} inputMode="numeric" value={umbRet.amarillo} onChange={(e) => setUmbRet((u) => ({ ...u, amarillo: Number(e.target.value) }))} ayuda="días restantes; menos que eso es naranja" />
        </div>
        {errorRet && <p className="mt-2 font-bold text-rojo" role="alert">{errorRet}</p>}
        <div className="mt-4 max-w-md">
          <Campo
            etiqueta="Vigencia habitual del oficio (días)"
            type="number"
            min={1}
            inputMode="numeric"
            key={ajustes.vigenciaOficioDias ?? 'sin'}
            defaultValue={ajustes.vigenciaOficioDias ?? ''}
            placeholder="Sin vigencia habitual"
            ayuda="Opcional. Si la indica, al escribir la fecha de emisión se propone sola la fecha de vencimiento (puede cambiarla)."
            onBlur={(e) => {
              const n = e.target.value === '' ? undefined : Number(e.target.value)
              if (n !== undefined && (!Number.isInteger(n) || n < 1)) return setErrorRet('La vigencia debe ser un número entero de días.')
              if (n !== ajustes.vigenciaOficioDias) {
                guardarAjustes({ vigenciaOficioDias: n })
                avisar(n ? `Vigencia habitual: ${n} días` : 'Sin vigencia habitual')
              }
            }}
          />
        </div>
        <Boton className="mt-4" onClick={guardarUmbRet}>
          Guardar plazos de retiros
        </Boton>
      </Seccion>

      <Seccion titulo="Formulario de retiros de vehículos">
        <EditorCamposRetiro campos={ajustes.camposRetiro} />
      </Seccion>

      <Seccion titulo="Datos de ejemplo">
        <p className="max-w-[65ch] text-tenue">
          Cargue clientes, causas, retiros y boletas inventados para probar la app. Cuando termine, bórrelos con un botón: sus datos reales no se tocan.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Boton variante="secundario" onClick={cargar} disabled={conEjemplo === true}>
            Cargar datos de ejemplo
          </Boton>
          <Boton variante="peligro" onClick={borrar} disabled={!conEjemplo}>
            Borrar datos de ejemplo
          </Boton>
        </div>
        {conEjemplo && <p className="mt-3 font-bold text-petroleo">Hay datos de ejemplo cargados.</p>}
      </Seccion>

      <Seccion titulo="Próximamente">
        <p className="text-tenue">
          En las próximas fases se agregan aquí: los plazos de las boletas, los medios de pago y el respaldo completo de sus datos.
        </p>
      </Seccion>
    </div>
  )
}

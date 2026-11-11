// Editor de los campos del formulario de retiros de vehículos:
// agregar campos propios, renombrar, reordenar, ocultar y eliminar.
import { useState } from 'react'
import { guardarAjustes } from '../../db/ajustes'
import type { CampoRetiro, TipoCampo } from '../../db/tipos'
import { AreaTexto, Boton, Campo, Casilla, Selector } from '../../compartido/Controles'
import { useAviso, useConfirmar } from '../../compartido/Dialogos'
import { normalizar } from '../../utilidades/texto'

export const NOMBRE_TIPO: Record<TipoCampo, string> = {
  texto: 'Texto',
  fecha: 'Fecha',
  numero: 'Número',
  sino: 'Sí / No',
  lista: 'Lista de opciones',
}

/** Clave interna para un campo nuevo, a partir de su nombre ("N° de inventario" → "x_n_de_inventario_k3f9") */
function claveNueva(etiqueta: string): string {
  return `x_${normalizar(etiqueta).replace(/\s+/g, '_').slice(0, 30)}_${Date.now().toString(36).slice(-4)}`
}

const leerOpciones = (texto: string) =>
  Array.from(new Set(texto.split('\n').map((o) => o.trim()).filter(Boolean)))

export function EditorCamposRetiro({ campos }: { campos: CampoRetiro[] }) {
  const confirmar = useConfirmar()
  const avisar = useAviso()
  const [editando, setEditando] = useState<string | null>(null)
  const [etiqueta, setEtiqueta] = useState('')
  const [opciones, setOpciones] = useState('')
  const [nuevo, setNuevo] = useState({ etiqueta: '', tipo: 'texto' as TipoCampo, opciones: '', obligatorio: false })
  const [error, setError] = useState('')

  const guardar = (lista: CampoRetiro[]) => guardarAjustes({ camposRetiro: lista })
  const repetido = (nombre: string, excepto?: string) => campos.some((c) => c.clave !== excepto && normalizar(c.etiqueta) === normalizar(nombre))

  const mover = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= campos.length) return
    const copia = [...campos]
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
    guardar(copia)
  }

  const alternarVisible = (c: CampoRetiro) => guardar(campos.map((x) => (x.clave === c.clave ? { ...x, visible: !x.visible } : x)))

  const empezarEdicion = (c: CampoRetiro) => {
    setEditando(c.clave)
    setEtiqueta(c.etiqueta)
    setOpciones((c.opciones ?? []).join('\n'))
    setError('')
  }

  const guardarEdicion = (c: CampoRetiro) => {
    const t = etiqueta.trim()
    if (!t) return setError('Escriba el nombre del campo.')
    if (repetido(t, c.clave)) return setError(`Ya hay un campo llamado «${t}».`)
    const ops = leerOpciones(opciones)
    if (c.tipo === 'lista' && !c.base && ops.length === 0) return setError('Escriba al menos una opción.')
    guardar(campos.map((x) => (x.clave === c.clave ? { ...x, etiqueta: t, ...(c.tipo === 'lista' && !c.base ? { opciones: ops } : {}) } : x)))
    setEditando(null)
    setError('')
  }

  const eliminar = async (c: CampoRetiro) => {
    const ok = await confirmar({
      titulo: 'Eliminar campo',
      peligro: true,
      textoConfirmar: 'Eliminar campo',
      mensaje: (
        <>
          <p>
            ¿Eliminar el campo <strong>«{c.etiqueta}»</strong> del formulario?
          </p>
          <p className="mt-2">Los datos que ya escribió en ese campo quedan guardados en cada retiro, pero dejarán de mostrarse. Si solo quiere esconderlo por un tiempo, use «Ocultar».</p>
        </>
      ),
    })
    if (ok) {
      guardar(campos.filter((x) => x.clave !== c.clave))
      avisar(`Campo «${c.etiqueta}» eliminado`)
    }
  }

  const agregar = () => {
    const t = nuevo.etiqueta.trim()
    if (!t) return setError('Escriba el nombre del campo nuevo.')
    if (repetido(t)) return setError(`Ya hay un campo llamado «${t}».`)
    const ops = leerOpciones(nuevo.opciones)
    if (nuevo.tipo === 'lista' && ops.length === 0) return setError('Escriba las opciones de la lista, una por línea.')
    const campo: CampoRetiro = {
      clave: claveNueva(t),
      etiqueta: t,
      tipo: nuevo.tipo,
      visible: true,
      base: false,
      obligatorio: nuevo.obligatorio || undefined,
      ...(nuevo.tipo === 'lista' ? { opciones: ops } : {}),
    }
    guardar([...campos, campo])
    setNuevo({ etiqueta: '', tipo: 'texto', opciones: '', obligatorio: false })
    setError('')
    avisar(`Campo «${t}» agregado al formulario`)
  }

  const botonChico = 'flex h-10 min-w-10 items-center justify-center rounded-md px-2 text-tenue hover:bg-petroleo-suave disabled:opacity-30'

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[70ch] text-tenue">
        Así se verá el formulario de cada retiro, de arriba hacia abajo. Los campos de fábrica se pueden renombrar, mover u ocultar; los suyos también se
        pueden eliminar. ROL, fechas y estado siempre se muestran.
      </p>
      <ol className="divide-y divide-borde rounded-lg border border-borde">
        {campos.map((c, i) => (
          <li key={c.clave} className={`flex flex-col gap-2 px-3 py-2 md:flex-row md:items-center ${c.visible ? '' : 'bg-papel'}`}>
            {editando === c.clave ? (
              <div className="flex flex-1 flex-col gap-2">
                <Campo etiqueta="Nombre del campo" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} autoFocus />
                {c.tipo === 'lista' && !c.base && <AreaTexto etiqueta="Opciones (una por línea)" value={opciones} onChange={(e) => setOpciones(e.target.value)} />}
                <div className="flex gap-2">
                  <Boton onClick={() => guardarEdicion(c)}>Guardar</Boton>
                  <Boton variante="secundario" onClick={() => setEditando(null)}>
                    Cancelar
                  </Boton>
                </div>
              </div>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <span className={`font-bold ${c.visible ? '' : 'text-tenue line-through'}`}>{c.etiqueta}</span>
                  <span className="block text-sm text-tenue">
                    {NOMBRE_TIPO[c.tipo]}
                    {c.base ? ', de fábrica' : ', propio'}
                    {c.obligatorio ? ', obligatorio' : ''}
                    {!c.visible ? ', oculto' : ''}
                    {c.tipo === 'lista' && !c.base && c.opciones?.length ? `: ${c.opciones.join(', ')}` : ''}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <button type="button" className={botonChico} onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir ${c.etiqueta}`}>
                    ↑
                  </button>
                  <button type="button" className={botonChico} onClick={() => mover(i, 1)} disabled={i === campos.length - 1} aria-label={`Bajar ${c.etiqueta}`}>
                    ↓
                  </button>
                  <button type="button" className={`${botonChico} text-sm font-bold text-petroleo`} onClick={() => empezarEdicion(c)} aria-label={`Renombrar ${c.etiqueta}`}>
                    Renombrar
                  </button>
                  {!c.fijo && (
                    <button type="button" className={`${botonChico} text-sm font-bold text-petroleo`} onClick={() => alternarVisible(c)} aria-label={`${c.visible ? 'Ocultar' : 'Mostrar'} ${c.etiqueta}`}>
                      {c.visible ? 'Ocultar' : 'Mostrar'}
                    </button>
                  )}
                  {!c.base && (
                    <button type="button" className={`${botonChico} text-sm font-bold text-rojo`} onClick={() => eliminar(c)} aria-label={`Eliminar ${c.etiqueta}`}>
                      Eliminar
                    </button>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ol>

      <fieldset className="flex flex-col gap-3 rounded-lg border-2 border-dashed border-borde p-4">
        <legend className="px-1 font-bold">Agregar un campo propio</legend>
        <div className="grid gap-3 md:grid-cols-2">
          <Campo etiqueta="Nombre del campo" value={nuevo.etiqueta} onChange={(e) => setNuevo((n) => ({ ...n, etiqueta: e.target.value }))} placeholder="Ej.: N° de inventario, Grúa, Kilometraje" />
          <Selector etiqueta="Tipo de dato" value={nuevo.tipo} onChange={(e) => setNuevo((n) => ({ ...n, tipo: e.target.value as TipoCampo }))}>
            {(Object.keys(NOMBRE_TIPO) as TipoCampo[]).map((t) => (
              <option key={t} value={t}>
                {NOMBRE_TIPO[t]}
              </option>
            ))}
          </Selector>
          {nuevo.tipo === 'lista' && (
            <div className="md:col-span-2">
              <AreaTexto
                etiqueta="Opciones (una por línea)"
                value={nuevo.opciones}
                onChange={(e) => setNuevo((n) => ({ ...n, opciones: e.target.value }))}
                placeholder={'Buen estado\nCon daños\nSin llaves'}
              />
            </div>
          )}
        </div>
        <Casilla etiqueta="Obligatorio" ayuda="No se podrá guardar un retiro sin completar este campo." checked={nuevo.obligatorio} onChange={(e) => setNuevo((n) => ({ ...n, obligatorio: e.target.checked }))} />
        <Boton variante="secundario" className="self-start" onClick={agregar}>
          Agregar campo
        </Boton>
      </fieldset>
      {error && (
        <p className="font-bold text-rojo" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

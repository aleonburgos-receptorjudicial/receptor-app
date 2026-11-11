// Editor de una lista de valores (tipos de diligencia, sectores…): agregar, renombrar, ordenar y quitar.
import { useState } from 'react'
import { Boton } from '../../compartido/Controles'
import { useConfirmar } from '../../compartido/Dialogos'
import { normalizar } from '../../utilidades/texto'

export function EditorLista({
  titulo,
  ayuda,
  valores,
  alGuardar,
}: {
  titulo: string
  ayuda?: string
  valores: string[]
  alGuardar: (nuevos: string[]) => void
}) {
  const confirmar = useConfirmar()
  const [nuevo, setNuevo] = useState('')
  const [editando, setEditando] = useState<number | null>(null)
  const [textoEdicion, setTextoEdicion] = useState('')
  const [error, setError] = useState('')

  const repetido = (v: string, excepto?: number) => valores.some((x, i) => i !== excepto && normalizar(x) === normalizar(v))

  const agregar = () => {
    const v = nuevo.trim()
    if (!v) return
    if (repetido(v)) {
      setError(`«${v}» ya está en la lista.`)
      return
    }
    alGuardar([...valores, v])
    setNuevo('')
    setError('')
  }

  const guardarEdicion = (i: number) => {
    const v = textoEdicion.trim()
    if (!v) return
    if (repetido(v, i)) {
      setError(`«${v}» ya está en la lista.`)
      return
    }
    alGuardar(valores.map((x, j) => (j === i ? v : x)))
    setEditando(null)
    setError('')
  }

  const mover = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= valores.length) return
    const copia = [...valores]
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
    alGuardar(copia)
  }

  const quitar = async (i: number) => {
    const ok = await confirmar({
      titulo: 'Quitar de la lista',
      mensaje: `¿Quitar «${valores[i]}» de la lista? Los registros que ya lo usan no cambian.`,
      textoConfirmar: 'Quitar',
      peligro: true,
    })
    if (ok) alGuardar(valores.filter((_, j) => j !== i))
  }

  const botonChico = 'flex h-10 w-10 items-center justify-center rounded-md text-lg text-tenue hover:bg-petroleo-suave disabled:opacity-30'

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-bold">{titulo}</h3>
      {ayuda && <p className="text-sm text-tenue">{ayuda}</p>}
      <ul className="divide-y divide-borde rounded-lg border border-borde">
        {valores.map((v, i) => (
          <li key={`${v}-${i}`} className="flex items-center gap-1 px-2 py-1">
            {editando === i ? (
              <>
                <input
                  className="min-h-10 flex-1 rounded-md border-2 border-petroleo bg-superficie px-2"
                  value={textoEdicion}
                  autoFocus
                  aria-label={`Nuevo nombre para ${v}`}
                  onChange={(e) => setTextoEdicion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') guardarEdicion(i)
                    if (e.key === 'Escape') setEditando(null)
                  }}
                />
                <Boton className="min-h-10 px-3 py-1 text-sm" onClick={() => guardarEdicion(i)}>
                  Guardar
                </Boton>
              </>
            ) : (
              <>
                <span className="flex-1 py-1">{v}</span>
                <button type="button" className={botonChico} onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir ${v}`}>
                  ↑
                </button>
                <button type="button" className={botonChico} onClick={() => mover(i, 1)} disabled={i === valores.length - 1} aria-label={`Bajar ${v}`}>
                  ↓
                </button>
                <button
                  type="button"
                  className={`${botonChico} w-auto px-2 text-sm font-bold text-petroleo`}
                  onClick={() => {
                    setEditando(i)
                    setTextoEdicion(v)
                  }}
                >
                  Renombrar
                </button>
                <button type="button" className={`${botonChico} w-auto px-2 text-sm font-bold text-rojo`} onClick={() => quitar(i)}>
                  Quitar
                </button>
              </>
            )}
          </li>
        ))}
        {valores.length === 0 && <li className="px-3 py-2 text-tenue">La lista está vacía.</li>}
      </ul>
      <div className="flex gap-2">
        <input
          className="min-h-12 min-w-0 flex-1 rounded-lg border-2 border-borde bg-superficie px-3 focus:border-petroleo focus:outline-none"
          placeholder="Escriba un valor nuevo"
          aria-label={`Agregar a ${titulo}`}
          value={nuevo}
          onChange={(e) => {
            setNuevo(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
        />
        <Boton variante="secundario" onClick={agregar}>
          Agregar
        </Boton>
      </div>
      {error && <p className="text-sm font-bold text-rojo">{error}</p>}
    </div>
  )
}

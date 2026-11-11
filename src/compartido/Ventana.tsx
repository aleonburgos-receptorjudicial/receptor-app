// Ventana emergente (modal). En el celular ocupa toda la pantalla; en el computador aparece centrada.
import { useEffect, useRef, type ReactNode } from 'react'
import { IconoCerrar } from './Iconos'

export function Ventana({
  abierta,
  titulo,
  alCerrar,
  children,
  pie,
  ancho = 'max-w-2xl',
}: {
  abierta: boolean
  titulo: string
  alCerrar: () => void
  children: ReactNode
  pie?: ReactNode
  ancho?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    if (abierta && !dialogo.open) dialogo.showModal()
    if (!abierta && dialogo.open) dialogo.close()
  }, [abierta])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        alCerrar()
      }}
      className={`m-0 h-full max-h-none w-full max-w-none bg-superficie text-tinta backdrop:bg-black/50 md:m-auto md:h-auto md:max-h-[90vh] md:rounded-xl md:border md:border-borde ${ancho}`}
      aria-labelledby="titulo-ventana"
    >
      {abierta && (
        <div className="flex h-full flex-col md:max-h-[90vh]">
          <div className="flex items-center justify-between gap-3 border-b border-borde px-5 py-3">
            <h2 id="titulo-ventana" className="font-serif text-2xl font-bold">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={alCerrar}
              className="flex h-12 w-12 items-center justify-center rounded-lg text-tenue hover:bg-petroleo-suave"
              aria-label="Cerrar ventana"
            >
              <IconoCerrar />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {pie && <div className="flex flex-wrap justify-end gap-2 border-t border-borde px-5 py-3">{pie}</div>}
        </div>
      )}
    </dialog>
  )
}

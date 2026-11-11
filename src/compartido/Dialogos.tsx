// Confirmaciones ("¿Seguro que desea eliminar…?") y avisos breves ("Cliente guardado").
// Se usan desde cualquier pantalla con useConfirmar() y useAviso().
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Boton } from './Controles'
import { Ventana } from './Ventana'

interface OpcionesConfirmar {
  titulo: string
  mensaje: ReactNode
  textoConfirmar?: string
  peligro?: boolean
}

type TipoAviso = 'exito' | 'error' | 'info'
interface Aviso {
  id: number
  texto: string
  tipo: TipoAviso
}

const ContextoConfirmar = createContext<(o: OpcionesConfirmar) => Promise<boolean>>(async () => false)
const ContextoAviso = createContext<(texto: string, tipo?: TipoAviso) => void>(() => {})

export function ProveedorDialogos({ children }: { children: ReactNode }) {
  const [opciones, setOpciones] = useState<OpcionesConfirmar | null>(null)
  const resolver = useRef<(valor: boolean) => void>(() => {})
  const [avisos, setAvisos] = useState<Aviso[]>([])

  const confirmar = useCallback((o: OpcionesConfirmar) => {
    setOpciones(o)
    return new Promise<boolean>((res) => {
      resolver.current = res
    })
  }, [])

  const cerrar = (valor: boolean) => {
    resolver.current(valor)
    setOpciones(null)
  }

  const avisar = useCallback((texto: string, tipo: TipoAviso = 'exito') => {
    const id = Date.now() + Math.random()
    setAvisos((a) => [...a, { id, texto, tipo }])
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 4000)
  }, [])

  const coloresAviso: Record<TipoAviso, string> = {
    exito: 'border-verde bg-verde-suave',
    error: 'border-rojo bg-rojo-suave',
    info: 'border-petroleo bg-petroleo-suave',
  }

  return (
    <ContextoConfirmar.Provider value={confirmar}>
      <ContextoAviso.Provider value={avisar}>
        {children}
        <Ventana
          abierta={!!opciones}
          titulo={opciones?.titulo ?? ''}
          alCerrar={() => cerrar(false)}
          ancho="max-w-lg"
          pie={
            <>
              <Boton variante="secundario" onClick={() => cerrar(false)}>
                Cancelar
              </Boton>
              <Boton variante={opciones?.peligro ? 'peligro' : 'principal'} onClick={() => cerrar(true)}>
                {opciones?.textoConfirmar ?? 'Confirmar'}
              </Boton>
            </>
          }
        >
          <div className="text-lg">{opciones?.mensaje}</div>
        </Ventana>
        <div
          className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
          aria-live="polite"
        >
          {avisos.map((a) => (
            <div key={a.id} className={`pointer-events-auto max-w-md rounded-lg border-l-4 px-4 py-3 font-bold text-tinta shadow-lg ${coloresAviso[a.tipo]}`}>
              {a.texto}
            </div>
          ))}
        </div>
      </ContextoAviso.Provider>
    </ContextoConfirmar.Provider>
  )
}

export const useConfirmar = () => useContext(ContextoConfirmar)
export const useAviso = () => useContext(ContextoAviso)

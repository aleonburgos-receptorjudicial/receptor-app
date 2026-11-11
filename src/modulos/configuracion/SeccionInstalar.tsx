// Instalar la app en el equipo (pantalla de inicio del celular o escritorio del computador)
// y proteger los datos para que el navegador no los borre.
import { useEffect, useState } from 'react'
import { Boton, Seccion } from '../../compartido/Controles'
import { useAviso } from '../../compartido/Dialogos'

interface EventoInstalar extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// El navegador avisa una sola vez que la app se puede instalar: se guarda el aviso para usarlo al tocar el botón
let avisoInstalar: EventoInstalar | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    avisoInstalar = e as EventoInstalar
  })
}

const instalada = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
const esIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/** Pide al navegador que no borre los datos de la app (se llama al iniciar) */
export async function protegerDatos(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return null
  }
}

export function SeccionInstalar() {
  const avisar = useAviso()
  const [puede, setPuede] = useState(!!avisoInstalar)
  const [protegidos, setProtegidos] = useState<boolean | null>(null)

  useEffect(() => {
    const t = setInterval(() => setPuede(!!avisoInstalar), 1000)
    navigator.storage?.persisted?.().then(setProtegidos).catch(() => setProtegidos(null))
    return () => clearInterval(t)
  }, [])

  const instalar = async () => {
    if (!avisoInstalar) return
    await avisoInstalar.prompt()
    const { outcome } = await avisoInstalar.userChoice
    avisoInstalar = null
    setPuede(false)
    if (outcome === 'accepted') avisar('App instalada. Búsquela como «Receptor» en su pantalla de inicio.')
  }

  const proteger = async () => {
    const r = await protegerDatos()
    setProtegidos(r)
    avisar(r ? 'Datos protegidos' : 'El navegador no permitió proteger los datos; haga respaldos seguido.', r ? 'exito' : 'info')
  }

  return (
    <Seccion titulo="Instalar en este equipo">
      {instalada() ? (
        <p className="font-bold text-verde">La app ya está instalada en este equipo.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="max-w-[70ch] text-tenue">Al instalarla, la app queda como un ícono en la pantalla de inicio, se abre a pantalla completa y funciona sin internet.</p>
          {puede ? (
            <Boton className="self-start" onClick={instalar}>
              Instalar la app
            </Boton>
          ) : esIphone() ? (
            <p>
              En iPhone: abra esta página en <strong>Safari</strong>, toque el botón <strong>Compartir</strong> (cuadrado con flecha hacia arriba) y elija{' '}
              <strong>«Agregar a inicio»</strong>.
            </p>
          ) : (
            <p>
              En Android, abra el menú de Chrome (tres puntos) y elija <strong>«Instalar aplicación»</strong> o <strong>«Agregar a la pantalla principal»</strong>. En el computador, use el
              ícono de instalar que aparece en la barra de direcciones de Chrome o Edge.
            </p>
          )}
        </div>
      )}
      <div className="mt-4 border-t border-borde pt-4">
        <p>
          Protección de los datos:{' '}
          <strong className={protegidos ? 'text-verde' : 'text-naranja'}>{protegidos === null ? 'no disponible en este navegador' : protegidos ? 'activada' : 'sin activar'}</strong>
        </p>
        <p className="text-sm text-tenue">Pide al navegador que no borre los datos de la app cuando falta espacio. Igual conviene respaldar.</p>
        {protegidos === false && (
          <Boton variante="secundario" className="mt-2" onClick={proteger}>
            Proteger mis datos
          </Boton>
        )}
      </div>
    </Seccion>
  )
}

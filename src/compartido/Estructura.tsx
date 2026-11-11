// Estructura general: menú lateral en el computador y barra inferior en el celular.
import { NavLink, Outlet } from 'react-router-dom'
import type { ComponentType, SVGProps } from 'react'
import { IconoAjustes, IconoBoleta, IconoCausas, IconoClientes, IconoInicio, IconoVehiculo } from './Iconos'

interface ItemMenu {
  ruta: string
  texto: string
  textoCorto: string
  Icono: ComponentType<SVGProps<SVGSVGElement>>
}

export const MENU: ItemMenu[] = [
  { ruta: '/', texto: 'Inicio', textoCorto: 'Inicio', Icono: IconoInicio },
  { ruta: '/causas', texto: 'Causas', textoCorto: 'Causas', Icono: IconoCausas },
  { ruta: '/retiros', texto: 'Retiros de vehículos', textoCorto: 'Retiros', Icono: IconoVehiculo },
  { ruta: '/boletas', texto: 'Boletas de honorarios', textoCorto: 'Boletas', Icono: IconoBoleta },
  { ruta: '/clientes', texto: 'Clientes', textoCorto: 'Clientes', Icono: IconoClientes },
  { ruta: '/configuracion', texto: 'Configuración y respaldos', textoCorto: 'Ajustes', Icono: IconoAjustes },
]

export function Estructura() {
  return (
    <div className="min-h-dvh lg:flex">
      {/* Menú lateral (computador) */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-borde bg-superficie lg:flex lg:sticky lg:top-0 lg:h-dvh">
        <div className="border-b border-borde px-6 py-6">
          <p className="font-serif text-2xl font-bold leading-tight text-petroleo">Receptora Judicial</p>
          <p className="text-tenue">Curanilahue</p>
        </div>
        <nav aria-label="Menú principal" className="flex flex-col gap-1 p-3">
          {MENU.map(({ ruta, texto, Icono }) => (
            <NavLink
              key={ruta}
              to={ruta}
              end={ruta === '/'}
              className={({ isActive }) =>
                `flex min-h-12 items-center gap-3 rounded-lg px-4 py-2 text-lg ${
                  isActive ? 'bg-petroleo font-bold text-sobre-petroleo' : 'text-tinta hover:bg-petroleo-suave'
                }`
              }
            >
              <Icono />
              {texto}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Contenido */}
      <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 md:px-8 lg:pb-10 lg:pt-10">
        <Outlet />
      </main>

      {/* Barra inferior (celular y tablet) */}
      <nav
        aria-label="Menú principal"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-borde bg-superficie pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {MENU.map(({ ruta, textoCorto, Icono }) => (
          <NavLink
            key={ruta}
            to={ruta}
            end={ruta === '/'}
            className={({ isActive }) =>
              `flex min-h-16 flex-col items-center justify-center gap-0.5 text-[0.75rem] ${
                isActive ? 'font-bold text-petroleo' : 'text-tenue'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`flex h-8 w-12 items-center justify-center rounded-full ${isActive ? 'bg-petroleo-suave' : ''}`}>
                  <Icono />
                </span>
                {textoCorto}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

/** Pantalla provisoria para los módulos que se construyen en fases siguientes */
export function EnConstruccion({ titulo, fase }: { titulo: string; fase: number }) {
  return (
    <div>
      <h1 className="font-serif text-3xl font-bold md:text-4xl">{titulo}</h1>
      <div className="mt-6 rounded-xl border-2 border-dashed border-borde bg-superficie px-6 py-10 text-center">
        <p className="font-serif text-xl font-bold">Esta sección se construye en la fase {fase}</p>
        <p className="mt-2 text-tenue">Por ahora puede usar el módulo Clientes y la Configuración.</p>
      </div>
    </div>
  )
}

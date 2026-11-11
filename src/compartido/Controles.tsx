// Controles básicos de la interfaz: botones, campos de formulario, títulos y mensajes vacíos.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useId } from 'react'

type VarianteBoton = 'principal' | 'secundario' | 'peligro' | 'discreto'

const estilosBoton: Record<VarianteBoton, string> = {
  principal: 'bg-petroleo text-sobre-petroleo hover:bg-petroleo-hover border-transparent',
  secundario: 'bg-superficie text-petroleo border-petroleo hover:bg-petroleo-suave',
  peligro: 'bg-rojo text-papel border-transparent hover:opacity-90',
  discreto: 'bg-transparent text-petroleo border-transparent hover:bg-petroleo-suave',
}

export function Boton({
  variante = 'principal',
  icono,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBoton; icono?: ReactNode }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 px-4 py-2 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${estilosBoton[variante]} ${className}`}
      {...props}
    >
      {icono}
      {children}
    </button>
  )
}

const estiloEntrada =
  'w-full min-h-12 rounded-lg border-2 border-borde bg-superficie px-3 py-2 text-tinta placeholder:text-tenue focus:border-petroleo focus:outline-none'

interface EnvolturaCampo {
  etiqueta: string
  error?: string
  ayuda?: string
  obligatorio?: boolean
}

function Envoltura({ id, etiqueta, error, ayuda, obligatorio, children }: EnvolturaCampo & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-bold">
        {etiqueta}
        {obligatorio && <span className="text-rojo" aria-label="obligatorio"> *</span>}
      </label>
      {children}
      {ayuda && !error && <p className="text-sm text-tenue">{ayuda}</p>}
      {error && (
        <p className="text-sm font-bold text-rojo" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function Campo({ etiqueta, error, ayuda, obligatorio, className = '', ...props }: EnvolturaCampo & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <Envoltura id={id} etiqueta={etiqueta} error={error} ayuda={ayuda} obligatorio={obligatorio}>
      <input id={id} className={`${estiloEntrada} ${error ? 'border-rojo' : ''} ${className}`} aria-invalid={!!error} {...props} />
    </Envoltura>
  )
}

export function AreaTexto({ etiqueta, error, ayuda, obligatorio, ...props }: EnvolturaCampo & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <Envoltura id={id} etiqueta={etiqueta} error={error} ayuda={ayuda} obligatorio={obligatorio}>
      <textarea id={id} rows={3} className={`${estiloEntrada} ${error ? 'border-rojo' : ''}`} {...props} />
    </Envoltura>
  )
}

export function Selector({
  etiqueta,
  error,
  ayuda,
  obligatorio,
  children,
  ...props
}: EnvolturaCampo & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <Envoltura id={id} etiqueta={etiqueta} error={error} ayuda={ayuda} obligatorio={obligatorio}>
      <select id={id} className={`${estiloEntrada} ${error ? 'border-rojo' : ''}`} {...props}>
        {children}
      </select>
    </Envoltura>
  )
}

/** Título de cada pantalla, con espacio para botones a la derecha */
export function EncabezadoPagina({ titulo, descripcion, acciones }: { titulo: string; descripcion?: string; acciones?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h1 className="font-serif text-3xl font-bold text-tinta md:text-4xl">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-[65ch] text-tenue">{descripcion}</p>}
      </div>
      {acciones && <div className="flex min-w-0 flex-wrap gap-2 md:justify-end">{acciones}</div>}
    </header>
  )
}

/** Mensaje cuando una lista no tiene datos: explica qué hacer */
export function SinDatos({ titulo, texto, accion }: { titulo: string; texto: string; accion?: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-borde bg-superficie px-6 py-10 text-center">
      <p className="font-serif text-xl font-bold">{titulo}</p>
      <p className="mx-auto mt-2 max-w-[50ch] text-tenue">{texto}</p>
      {accion && <div className="mt-5 flex justify-center">{accion}</div>}
    </div>
  )
}

/** Recuadro de sección con título */
export function Seccion({ titulo, children, acciones }: { titulo: string; children: ReactNode; acciones?: ReactNode }) {
  return (
    <section className="rounded-xl border border-borde bg-superficie p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-xl font-bold">{titulo}</h2>
        {acciones}
      </div>
      {children}
    </section>
  )
}

/** Campo de texto con sugerencias de una lista; se puede escribir un valor nuevo */
export function CampoConLista({
  etiqueta,
  opciones,
  error,
  ayuda,
  obligatorio,
  ...props
}: EnvolturaCampo & InputHTMLAttributes<HTMLInputElement> & { opciones: string[] }) {
  const id = useId()
  const idLista = `${id}-lista`
  return (
    <Envoltura id={id} etiqueta={etiqueta} error={error} ayuda={ayuda} obligatorio={obligatorio}>
      <input id={id} list={idLista} autoComplete="off" className={`${estiloEntrada} ${error ? 'border-rojo' : ''}`} aria-invalid={!!error} {...props} />
      <datalist id={idLista}>
        {opciones.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </Envoltura>
  )
}

/** Casilla de verificación grande, fácil de tocar */
export function Casilla({ etiqueta, ayuda, ...props }: { etiqueta: string; ayuda?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3">
      <input type="checkbox" className="h-6 w-6 shrink-0 accent-[var(--petroleo)]" {...props} />
      <span>
        <span className="font-bold">{etiqueta}</span>
        {ayuda && <span className="block text-sm text-tenue">{ayuda}</span>}
      </span>
    </label>
  )
}

/** Grupo de botones para elegir una opción (ej. Positiva / Negativa) */
export function Opciones<T extends string>({
  etiqueta,
  opciones,
  valor,
  alCambiar,
  error,
}: {
  etiqueta: string
  opciones: readonly T[]
  valor: T | undefined
  alCambiar: (v: T) => void
  error?: string
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 font-bold">{etiqueta}</legend>
      <div className="flex flex-wrap gap-2">
        {opciones.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={valor === o}
            onClick={() => alCambiar(o)}
            className={`min-h-12 rounded-lg border-2 px-4 font-bold ${valor === o ? 'border-petroleo bg-petroleo text-sobre-petroleo' : 'border-borde bg-superficie text-tinta hover:border-petroleo'}`}
          >
            {o}
          </button>
        ))}
      </div>
      {error && (
        <p className="text-sm font-bold text-rojo" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}

// Íconos simples dibujados a mano (sin depender de internet).
import type { SVGProps } from 'react'

type Props = SVGProps<SVGSVGElement>

function Base({ children, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1.4em"
      height="1.4em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const IconoInicio = (p: Props) => (
  <Base {...p}><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /><path d="M10 20v-6h4v6" /></Base>
)
export const IconoCausas = (p: Props) => (
  <Base {...p}><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /><path d="M9 12h7M9 16h7" /></Base>
)
export const IconoVehiculo = (p: Props) => (
  <Base {...p}><path d="M4 16v-4l2-5h12l2 5v4" /><path d="M3 16h18v2H3z" /><circle cx="7.5" cy="18.5" r="1.5" /><circle cx="16.5" cy="18.5" r="1.5" /><path d="M6 12h12" /></Base>
)
export const IconoBoleta = (p: Props) => (
  <Base {...p}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></Base>
)
export const IconoClientes = (p: Props) => (
  <Base {...p}><path d="M3 21V8l9-5 9 5v13" /><path d="M7 21v-8M12 21v-8M17 21v-8" /><path d="M3 21h18" /></Base>
)
export const IconoAjustes = (p: Props) => (
  <Base {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></Base>
)
export const IconoMas = (p: Props) => (
  <Base {...p}><path d="M12 5v14M5 12h14" /></Base>
)
export const IconoBuscar = (p: Props) => (
  <Base {...p}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></Base>
)
export const IconoCerrar = (p: Props) => (
  <Base {...p}><path d="M6 6l12 12M18 6L6 18" /></Base>
)
export const IconoEditar = (p: Props) => (
  <Base {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13 7l4 4" /></Base>
)
export const IconoBasura = (p: Props) => (
  <Base {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Base>
)
export const IconoUnir = (p: Props) => (
  <Base {...p}><path d="M6 4v6a6 6 0 006 6h6" /><path d="M6 20v-4" /><path d="M15 13l3 3-3 3" /></Base>
)
export const IconoVolver = (p: Props) => (
  <Base {...p}><path d="M15 5l-7 7 7 7" /></Base>
)
export const IconoTelefono = (p: Props) => (
  <Base {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" /></Base>
)
export const IconoCorreo = (p: Props) => (
  <Base {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></Base>
)
export const IconoLuna = (p: Props) => (
  <Base {...p}><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" /></Base>
)

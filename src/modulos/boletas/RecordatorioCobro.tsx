// Recordatorio de cobro: texto listo para pegar en un correo, con las boletas impagas de un cliente.
import { useEffect, useMemo, useState } from 'react'
import { useAjustes } from '../../db/ajustes'
import type { Boleta, Cliente, Pago } from '../../db/tipos'
import { Boton } from '../../compartido/Controles'
import { useAviso } from '../../compartido/Dialogos'
import { Ventana } from '../../compartido/Ventana'
import { fechaCL, hoyISO, plural, pesos } from '../../utilidades/formato'
import { diasDesdeEmision, saldoBoleta } from './calculos'

export function textoRecordatorio(nombre: string, boletas: Boleta[], pagos: Pago[], firma: string, hoy = hoyISO()): string {
  const impagas = boletas.filter((b) => saldoBoleta(b, pagos) > 0).sort((a, b) => a.fechaEmision.localeCompare(b.fechaEmision))
  const total = impagas.reduce((s, b) => s + saldoBoleta(b, pagos), 0)
  const lineas = impagas.map((b) => {
    const saldo = saldoBoleta(b, pagos)
    const parcial = saldo < b.montoCobrar ? ` (saldo de un total de ${pesos(b.montoCobrar)})` : ''
    return `- Boleta N° ${b.numero}, emitida el ${fechaCL(b.fechaEmision)} (${plural(diasDesdeEmision(b, hoy), 'día', 'días')}): ${pesos(saldo)}${parcial}`
  })
  return [
    `Estimados ${nombre}:`,
    '',
    `Junto con saludar, les recuerdo que se encuentran pendientes de pago las siguientes boletas de honorarios:`,
    '',
    ...lineas,
    '',
    `Total pendiente: ${pesos(total)}.`,
    '',
    'Agradeceré gestionar el pago a la brevedad y confirmarlo por este medio. Si ya fue realizado, les pido por favor enviar el comprobante.',
    '',
    'Saludos cordiales,',
    firma,
  ].join('\n')
}

export function RecordatorioCobro({
  cliente,
  nombre,
  boletas,
  pagos,
  alCerrar,
}: {
  cliente?: Cliente
  nombre: string | null
  boletas: Boleta[]
  pagos: Pago[]
  alCerrar: () => void
}) {
  const ajustes = useAjustes()
  const avisar = useAviso()
  const original = useMemo(() => (nombre ? textoRecordatorio(nombre, boletas, pagos, ajustes.firmaCobro) : ''), [nombre, boletas, pagos, ajustes.firmaCobro])
  const [texto, setTexto] = useState(original)
  useEffect(() => setTexto(original), [original])

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto)
      avisar('Texto copiado. Péguelo en su correo.')
    } catch {
      avisar('No se pudo copiar automáticamente: seleccione el texto y cópielo.', 'error')
    }
  }
  const asunto = `Boletas de honorarios pendientes de pago`

  return (
    <Ventana
      abierta={!!nombre}
      titulo={`Recordatorio de cobro: ${nombre ?? ''}`}
      alCerrar={alCerrar}
      ancho="max-w-3xl"
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cerrar
          </Boton>
          {cliente?.correo && (
            <a
              className="inline-flex min-h-12 items-center rounded-lg border-2 border-petroleo px-4 font-bold text-petroleo hover:bg-petroleo-suave"
              href={`mailto:${cliente.correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`}
            >
              Abrir en el correo
            </a>
          )}
          <Boton onClick={copiar}>Copiar texto</Boton>
        </>
      }
    >
      <p className="mb-3 text-tenue">
        Puede modificar el texto antes de copiarlo.{cliente?.correo ? ` Correo del cliente: ${cliente.correo}.` : ' Este cliente no tiene correo en su ficha.'}
      </p>
      <label className="sr-only" htmlFor="texto-recordatorio">
        Texto del recordatorio
      </label>
      <textarea
        id="texto-recordatorio"
        className="min-h-80 w-full rounded-lg border-2 border-borde bg-superficie p-3 font-sans leading-relaxed focus:border-petroleo focus:outline-none"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
    </Ventana>
  )
}

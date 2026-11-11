// Registra un pago de una boleta: fecha, monto y medio de pago (puede ser un abono parcial).
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/basedatos'
import { useAjustes } from '../../db/ajustes'
import type { Boleta } from '../../db/tipos'
import { Boton, Campo, Selector } from '../../compartido/Controles'
import { useAviso } from '../../compartido/Dialogos'
import { Ventana } from '../../compartido/Ventana'
import { hoyISO, pesos } from '../../utilidades/formato'
import { saldoBoleta } from './calculos'
import { registrarPago } from './servicioBoletas'

export function RegistrarPago({ boleta, alCerrar }: { boleta: Boleta | null; alCerrar: () => void }) {
  const ajustes = useAjustes()
  const avisar = useAviso()
  const pagos = useLiveQuery(() => (boleta?.id ? db.pagos.where('boletaId').equals(boleta.id).toArray() : []), [boleta?.id]) ?? []
  const saldo = boleta ? saldoBoleta(boleta, pagos) : 0
  const [fecha, setFecha] = useState(hoyISO())
  const [monto, setMonto] = useState(0)
  const [medio, setMedio] = useState('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState<{ fecha?: string; monto?: string }>({})

  useEffect(() => {
    if (!boleta) return
    setFecha(hoyISO())
    setMedio(ajustes.mediosPago[0] ?? 'Transferencia')
    setNota('')
    setError({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boleta])
  useEffect(() => setMonto(saldo), [saldo])

  const guardar = async () => {
    const er: typeof error = {}
    if (!fecha) er.fecha = 'Indique la fecha del pago.'
    else if (fecha > hoyISO()) er.fecha = 'La fecha no puede ser posterior a hoy.'
    else if (boleta && fecha < boleta.fechaEmision) er.fecha = 'El pago no puede ser anterior a la emisión.'
    if (!Number.isFinite(monto) || monto <= 0) er.monto = 'Escriba el monto pagado.'
    setError(er)
    if (Object.keys(er).length || !boleta?.id) return
    await registrarPago({ boletaId: boleta.id, fecha, monto: Math.round(monto), medio, nota: nota.trim() || undefined })
    avisar(monto >= saldo ? `Boleta N° ${boleta.numero} pagada` : `Abono de ${pesos(monto)} registrado`)
    alCerrar()
  }

  return (
    <Ventana
      abierta={!!boleta}
      titulo={`Registrar pago, boleta N° ${boleta?.numero ?? ''}`}
      alCerrar={alCerrar}
      ancho="max-w-lg"
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton onClick={guardar}>Registrar pago</Boton>
        </>
      }
    >
      {boleta && (
        <div className="flex flex-col gap-4">
          <p className="text-tenue">
            {boleta.nombreCliente ?? 'Cliente'}: falta por cobrar <strong className="text-tinta cifra">{pesos(saldo)}</strong>
          </p>
          <Campo etiqueta="Fecha del pago" type="date" obligatorio max={hoyISO()} value={fecha} onChange={(e) => setFecha(e.target.value)} error={error.fecha} />
          <Campo
            etiqueta="Monto pagado"
            type="number"
            inputMode="numeric"
            obligatorio
            value={monto || ''}
            onChange={(e) => setMonto(Number(e.target.value))}
            error={error.monto}
            ayuda={monto && monto < saldo ? `Abono parcial: quedará pendiente ${pesos(saldo - monto)}` : monto ? pesos(monto) : undefined}
            className="cifra"
          />
          <Selector etiqueta="Medio de pago" value={medio} onChange={(e) => setMedio(e.target.value)}>
            {ajustes.mediosPago.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Selector>
          <Campo etiqueta="Nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Opcional: N° de transferencia, banco…" />
        </div>
      )}
    </Ventana>
  )
}

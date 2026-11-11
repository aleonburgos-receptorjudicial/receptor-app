// Registra en un solo paso que el vehículo fue retirado: fecha, hora y depósito o custodio.
import { useEffect, useState } from 'react'
import type { Retiro } from '../../db/tipos'
import { AreaTexto, Boton, Campo } from '../../compartido/Controles'
import { useAviso } from '../../compartido/Dialogos'
import { Ventana } from '../../compartido/Ventana'
import { hoyISO } from '../../utilidades/formato'
import { Placa } from './Piezas'
import { registrarRetiro } from './servicioRetiros'

export function RegistrarRetiro({ retiro, alCerrar }: { retiro: Retiro | null; alCerrar: () => void }) {
  const avisar = useAviso()
  const [fecha, setFecha] = useState(hoyISO())
  const [hora, setHora] = useState('')
  const [custodio, setCustodio] = useState('')
  const [obs, setObs] = useState('')
  const [error, setError] = useState<{ fecha?: string; hora?: string }>({})

  useEffect(() => {
    if (!retiro) return
    const ahora = new Date()
    setFecha(hoyISO())
    setHora(`${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`)
    setCustodio(retiro.custodio ?? '')
    setObs(retiro.observaciones ?? '')
    setError({})
  }, [retiro])

  const guardar = async () => {
    const er: typeof error = {}
    if (!fecha) er.fecha = 'Indique la fecha del retiro.'
    else if (fecha > hoyISO()) er.fecha = 'La fecha no puede ser posterior a hoy.'
    else if (retiro && fecha < retiro.fechaEncargo) er.fecha = 'La fecha no puede ser anterior al encargo.'
    if (hora && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(hora)) er.hora = 'Escriba la hora como 14:30.'
    setError(er)
    if (Object.keys(er).length || !retiro?.id) return
    await registrarRetiro(retiro.id, { fecha, hora, custodio, observaciones: obs })
    avisar(`Retiro registrado: ${retiro.patente ?? retiro.rol}`)
    alCerrar()
  }

  return (
    <Ventana
      abierta={!!retiro}
      titulo="Registrar retiro"
      alCerrar={alCerrar}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton onClick={guardar}>Registrar retiro</Boton>
        </>
      }
    >
      {retiro && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-4">
            <Placa patente={retiro.patente} grande />
            <p className="text-tenue">
              {[retiro.marca, retiro.modelo, retiro.anio, retiro.color].filter(Boolean).join(' ') || 'Vehículo'}
              <span className="block font-serif font-bold text-tinta cifra">ROL {retiro.rol}</span>
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo etiqueta="Fecha del retiro" type="date" obligatorio value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} error={error.fecha} />
            <Campo etiqueta="Hora del retiro" type="time" value={hora} onChange={(e) => setHora(e.target.value)} error={error.hora} />
          </div>
          <Campo etiqueta="Depósito o custodio" value={custodio} onChange={(e) => setCustodio(e.target.value)} placeholder="Nombre del depósito o del custodio" />
          <AreaTexto etiqueta="Observaciones" value={obs} onChange={(e) => setObs(e.target.value)} rows={4} />
        </div>
      )}
    </Ventana>
  )
}

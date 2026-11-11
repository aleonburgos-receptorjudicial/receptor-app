// Marca una causa como realizada pidiendo en un solo paso: fecha, resultado y observaciones.
import { useEffect, useState } from 'react'
import { useAjustes } from '../../db/ajustes'
import type { Causa, ResultadoDiligencia } from '../../db/tipos'
import { AreaTexto, Boton, Campo, Casilla, Opciones, Selector } from '../../compartido/Controles'
import { useAviso } from '../../compartido/Dialogos'
import { Ventana } from '../../compartido/Ventana'
import { hoyISO } from '../../utilidades/formato'
import { marcarRealizada } from './servicioCausas'

export function MarcarRealizada({ causa, alCerrar }: { causa: Causa | null; alCerrar: () => void }) {
  const ajustes = useAjustes()
  const avisar = useAviso()
  const [fecha, setFecha] = useState(hoyISO())
  const [resultado, setResultado] = useState<ResultadoDiligencia | undefined>()
  const [detalle, setDetalle] = useState('')
  const [obs, setObs] = useState('')
  const [estampado, setEstampado] = useState(false)
  const [error, setError] = useState<{ fecha?: string; resultado?: string }>({})

  useEffect(() => {
    if (!causa) return
    setFecha(hoyISO())
    setResultado(undefined)
    setDetalle('')
    setObs(causa.observaciones ?? '')
    setEstampado(causa.estampadoPjud)
    setError({})
  }, [causa])

  // Al elegir un detalle, se propone el resultado que corresponde
  const elegirDetalle = (v: string) => {
    setDetalle(v)
    const t = v.toLowerCase()
    if (t.includes('negativ') || t.includes('no se ubic')) setResultado('Negativa')
    else if (v && !resultado) setResultado('Positiva')
  }

  const guardar = async () => {
    const er: typeof error = {}
    if (!fecha) er.fecha = 'Indique la fecha de la diligencia.'
    else if (causa && fecha < causa.fechaEncargo) er.fecha = 'La fecha no puede ser anterior al encargo.'
    else if (fecha > hoyISO()) er.fecha = 'La fecha no puede ser posterior a hoy.'
    if (!resultado) er.resultado = 'Elija si la diligencia fue positiva o negativa.'
    setError(er)
    if (Object.keys(er).length || !causa?.id || !resultado) return
    await marcarRealizada(causa.id, { fechaDiligencia: fecha, resultado, detalleResultado: detalle, observaciones: obs, estampadoPjud: estampado })
    avisar(`Causa ${causa.rol} marcada como realizada`)
    alCerrar()
  }

  return (
    <Ventana
      abierta={!!causa}
      titulo={`Marcar realizada ${(causa?.rol ?? '').replace(/-/g, '\u2011')}`}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton onClick={guardar}>Marcar realizada</Boton>
        </>
      }
    >
      {causa && (
        <div className="flex flex-col gap-5">
          <p className="text-tenue">
            {causa.tipoDiligencia ?? 'Diligencia'}
            {causa.demandado ? ` a ${causa.demandado}` : ''}
            {causa.domicilio ? `, ${causa.domicilio}` : ''}
          </p>
          <Campo etiqueta="Fecha de la diligencia" type="date" obligatorio value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} error={error.fecha} />
          <Opciones etiqueta="Resultado" opciones={['Positiva', 'Negativa'] as const} valor={resultado} alCambiar={setResultado} error={error.resultado} />
          <Selector etiqueta="Detalle del resultado" value={detalle} onChange={(e) => elegirDetalle(e.target.value)}>
            <option value="">— Sin detalle —</option>
            {ajustes.detallesResultado.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Selector>
          <AreaTexto etiqueta="Observaciones" value={obs} onChange={(e) => setObs(e.target.value)} rows={4} />
          <Casilla etiqueta="Estampado ya subido al PJUD" checked={estampado} onChange={(e) => setEstampado(e.target.checked)} />
        </div>
      )}
    </Ventana>
  )
}

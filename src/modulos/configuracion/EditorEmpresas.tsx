// «Mis empresas»: empresas de la usuaria que emiten facturas (nombre y RUT).
import { useState } from 'react'
import { ahoraISO, db } from '../../db/basedatos'
import { guardarAjustes } from '../../db/ajustes'
import type { Empresa } from '../../db/tipos'
import { Boton, Campo } from '../../compartido/Controles'
import { useAviso, useConfirmar } from '../../compartido/Dialogos'
import { limpiarRut } from '../../utilidades/rut'
import { agregarEmpresa } from '../boletas/servicioEmpresas'

export function EditorEmpresas({ empresas }: { empresas: Empresa[] }) {
  const avisar = useAviso()
  const confirmar = useConfirmar()
  const [nombre, setNombre] = useState('')
  const [rut, setRut] = useState('')
  const [error, setError] = useState('')

  const agregar = async () => {
    const r = await agregarEmpresa(nombre, rut)
    if (r.error) return setError(r.error)
    setNombre('')
    setRut('')
    setError('')
    avisar(`Empresa «${r.empresa!.nombre}» agregada`)
  }
  // Al renombrar, las facturas de esa empresa también toman el nombre nuevo
  const renombrar = async (e: Empresa, nuevo: string) => {
    const n = nuevo.trim()
    if (!n || n === e.nombre) return
    await guardarAjustes({ empresas: empresas.map((x) => (x.rut === e.rut ? { ...x, nombre: n } : x)) })
    await db.boletas
      .where('empresaRut')
      .equals(e.rut)
      .modify({ empresaNombre: n, actualizado: ahoraISO() })
    avisar(`Empresa renombrada a «${n}»`)
  }
  const quitar = async (e: Empresa) => {
    const facturas = await db.boletas.filter((b) => b.tipoDocumento === 'factura' && limpiarRut(b.empresaRut ?? '') === limpiarRut(e.rut)).count()
    const ok = await confirmar({
      titulo: 'Quitar empresa',
      textoConfirmar: 'Quitar de la lista',
      peligro: true,
      mensaje: facturas
        ? `«${e.nombre}» tiene ${facturas} factura(s) guardada(s). Las facturas no se borran; solo deja de aparecer al crear facturas nuevas.`
        : `¿Quitar «${e.nombre}» de sus empresas?`,
    })
    if (!ok) return
    await guardarAjustes({ empresas: empresas.filter((x) => x.rut !== e.rut) })
    avisar('Empresa quitada de la lista')
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-serif text-lg font-bold">Mis empresas</h3>
      <p className="max-w-[65ch] text-tenue">Empresas suyas que emiten facturas. Aparecen al crear o subir una factura y en los filtros de «Boletas y facturas».</p>
      {empresas.length === 0 ? (
        <p className="text-tenue">Aún no hay empresas. También se agregan solas al subir el PDF de una factura.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borde rounded-lg border border-borde">
          {empresas.map((e) => (
            <li key={e.rut} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Campo etiqueta={`Nombre (RUT ${e.rut})`} key={e.nombre} defaultValue={e.nombre} onBlur={(ev) => renombrar(e, ev.target.value)} />
              </div>
              <Boton variante="discreto" className="text-rojo" onClick={() => quitar(e)}>
                Quitar
              </Boton>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 rounded-lg bg-papel p-3 md:grid-cols-[1fr_14rem_auto] md:items-end">
        <Campo etiqueta="Nombre de la empresa" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Campo etiqueta="RUT de la empresa" value={rut} onChange={(e) => setRut(e.target.value)} placeholder="76.123.456-7" />
        <Boton variante="secundario" onClick={agregar}>
          Agregar empresa
        </Boton>
        {error && (
          <p className="text-sm font-bold text-rojo md:col-span-3" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

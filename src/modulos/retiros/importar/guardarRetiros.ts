// Guarda los retiros que la usuaria confirmó en la vista previa de importación.
import { ahoraISO, db } from '../../../db/basedatos'
import { normalizar } from '../../../utilidades/texto'
import { recordarMandantes } from '../../clientes/servicioMandantes'
import { unirConExistente, type FilaRetiro } from './analizarRetiros'

export interface ResultadoRetiros {
  nuevos: number
  actualizados: number
  clientesCreados: number
}

export async function guardarRetirosImportados(filas: FilaRetiro[]): Promise<ResultadoRetiros> {
  const nuevos = filas.filter((f) => f.accion === 'nuevo')
  const actualizar = filas.filter((f) => f.accion === 'actualizar' && f.existenteId)
  const ahora = ahoraISO()
  let clientesCreados = 0

  // Todo o nada: si algo falla, no queda nada a medias
  await db.transaction('rw', db.retiros, db.clientes, async () => {
    // 1. Estudios jurídicos que todavía no existen
    const idPorNombre = new Map((await db.clientes.toArray()).map((c) => [normalizar(c.nombre), c.id!]))
    for (const f of [...nuevos, ...actualizar]) {
      const nombre = f.nombreCliente?.trim()
      if (f.datos.clienteId || !nombre || idPorNombre.has(normalizar(nombre))) continue
      idPorNombre.set(normalizar(nombre), (await db.clientes.add({ nombre, creado: ahora, actualizado: ahora })) as number)
      clientesCreados++
    }
    const conCliente = (f: FilaRetiro) => ({
      ...f.datos,
      clienteId: f.datos.clienteId ?? (f.nombreCliente ? idPorNombre.get(normalizar(f.nombreCliente)) : undefined),
    })

    // 2. Retiros nuevos
    await db.retiros.bulkAdd(nuevos.map((f) => ({ ...conCliente(f), creado: ahora, actualizado: ahora })))

    // 3. Retiros que ya existían: se completan con lo que trae el archivo
    for (const f of actualizar) {
      const anterior = await db.retiros.get(f.existenteId!)
      if (!anterior) continue
      await db.retiros.put({ ...unirConExistente(anterior, conCliente(f), f.porDefecto), id: anterior.id, creado: anterior.creado, actualizado: ahora, ejemplo: anterior.ejemplo })
    }
  })
  // Los mandantes nuevos quedan en la lista para escribirlos más rápido después
  await recordarMandantes(filas.filter((f) => f.accion !== 'omitir').map((f) => f.datos.mandante))
  return { nuevos: nuevos.length, actualizados: actualizar.length, clientesCreados }
}

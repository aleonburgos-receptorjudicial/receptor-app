// Base de datos local del navegador (IndexedDB), manejada con Dexie.
// Todos los datos quedan guardados en el propio equipo: no se envían a ningún servidor.
import Dexie, { type EntityTable } from 'dexie'
import type { Boleta, Causa, Cliente, FilaAjustes, Pago, Retiro } from './tipos'

export class BaseReceptora extends Dexie {
  clientes!: EntityTable<Cliente, 'id'>
  causas!: EntityTable<Causa, 'id'>
  retiros!: EntityTable<Retiro, 'id'>
  boletas!: EntityTable<Boleta, 'id'>
  pagos!: EntityTable<Pago, 'id'>
  ajustes!: EntityTable<FilaAjustes, 'clave'>

  constructor() {
    super('receptora-curanilahue')
    // Versión 1 del esquema. Solo se listan los campos por los que se busca u ordena.
    this.version(1).stores({
      clientes: '++id, nombre, rut, ejemplo',
      causas: '++id, rol, clienteId, estado, tipoCausa, fechaEncargo, boletaId, ejemplo',
      retiros: '++id, rol, clienteId, estado, fechaVencimiento, patente, ejemplo',
      boletas: '++id, &numero, clienteId, estado, fechaEmision, ejemplo',
      pagos: '++id, boletaId, fecha, ejemplo',
      ajustes: 'clave',
    })
  }
}

export const db = new BaseReceptora()

/** Fecha y hora actual en formato ISO, para los campos "creado" y "actualizado" */
export function ahoraISO(): string {
  return new Date().toISOString()
}

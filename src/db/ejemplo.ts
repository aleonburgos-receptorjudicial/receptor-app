// Datos de ejemplo (ficticios) para conocer la app. Todos llevan la marca "ejemplo: true"
// y se pueden borrar con un botón sin tocar los datos reales.
import { ahoraISO, db } from './basedatos'
import { TRIBUNAL_CURANILAHUE } from './ajustes'
import type { Boleta, Causa, Cliente, Pago, Retiro } from './tipos'
import { calcularDv, formatearRut } from '../utilidades/rut'
import { hoyISO, sumarDias } from '../utilidades/formato'

const rutFicticio = (cuerpo: string) => formatearRut(cuerpo + calcularDv(cuerpo))

export async function hayDatosEjemplo(): Promise<boolean> {
  const tablas = [db.clientes, db.causas, db.retiros, db.boletas, db.pagos] as const
  for (const t of tablas) {
    if ((await t.filter((r) => r.ejemplo === true).count()) > 0) return true
  }
  return false
}

export async function cargarDatosEjemplo(): Promise<void> {
  const ahora = ahoraISO()
  const hoy = hoyISO()
  const base = { creado: ahora, actualizado: ahora, ejemplo: true }

  await db.transaction('rw', [db.clientes, db.causas, db.retiros, db.boletas, db.pagos], async () => {
    const clientes: Cliente[] = [
      { ...base, nombre: 'Estudio Jurídico Pérez y Asociados', rut: rutFicticio('76543210'), contacto: 'Carolina Pérez', correo: 'cperez@ejemplo.cl', telefono: '+56 9 1111 2222' },
      { ...base, nombre: 'Estudio Perez Ltda.', contacto: 'Secretaría', notas: 'Probablemente es el mismo estudio que «Pérez y Asociados». Sirve para probar «Fusionar clientes».' },
      { ...base, nombre: 'Fuentes & Riquelme Abogados', rut: rutFicticio('77123456'), contacto: 'Jorge Riquelme', correo: 'cobranza@ejemplo.cl', telefono: '+56 41 222 3333' },
      { ...base, nombre: 'Cobranzas del Biobío SpA', rut: rutFicticio('76987654'), correo: 'encargos@ejemplo.cl' },
    ]
    const [perez, perez2, fuentes, biobio] = (await db.clientes.bulkAdd(clientes, { allKeys: true })) as number[]

    const causa = (c: Partial<Causa> & Pick<Causa, 'rol' | 'fechaEncargo'>): Causa => ({
      ...base,
      tipoCausa: 'Civil',
      tribunal: TRIBUNAL_CURANILAHUE,
      origen: 'Particular',
      estado: 'Pendiente',
      estampadoPjud: false,
      ...c,
    })
    await db.causas.bulkAdd([
      causa({ rol: 'C-512-2026', clienteId: perez, mandante: 'Banco Ficticio S.A.', demandado: 'Juan Soto Muñoz', rutDemandado: rutFicticio('12345678'), domicilio: 'Los Aromos 145, Curanilahue', sector: 'Centro', tipoDiligencia: 'Notificación personal', fechaEncargo: sumarDias(hoy, -12), urgente: true }),
      causa({ rol: 'C-498-2026', clienteId: perez, mandante: 'Banco Ficticio S.A.', demandado: 'María Fuentealba', domicilio: 'Pasaje 3 N° 22, Villa Los Ríos', sector: 'Villa Los Ríos', tipoDiligencia: 'Requerimiento de pago', fechaEncargo: sumarDias(hoy, -38) }),
      causa({ rol: 'C-311-2026', clienteId: perez2, demandado: 'Pedro Alarcón', domicilio: 'Camino a Plegarias km 2', sector: 'Plegarias', tipoDiligencia: 'Notificación art. 44', fechaEncargo: sumarDias(hoy, -72), reencargo: true, fechasAnteriores: [sumarDias(hoy, -120)] }),
      causa({ rol: 'C-280-2026', clienteId: fuentes, mandante: 'Comercial Ejemplo Ltda.', demandado: 'Rosa Henríquez', domicilio: 'O’Higgins 870, Curanilahue', sector: 'Centro', tipoDiligencia: 'Embargo', fechaEncargo: sumarDias(hoy, -50) }),
      causa({ rol: 'E-45-2026', tipoCausa: 'Exhorto', origen: 'Tribunal', clienteId: fuentes, demandado: 'Luis Vergara', domicilio: 'Calle Uno 12, Población Eleuterio Ramírez', sector: 'Eleuterio Ramírez', tipoDiligencia: 'Notificación personal', fechaEncargo: sumarDias(hoy, -20), estado: 'Realizada', fechaDiligencia: sumarDias(hoy, -15), resultado: 'Positiva', estampadoPjud: true }),
      causa({ rol: 'C-402-2026', clienteId: biobio, demandado: 'Carlos Muñoz Pino', domicilio: 'Los Copihues 55, Villa Los Ríos', sector: 'Villa Los Ríos', tipoDiligencia: 'Requerimiento de pago', fechaEncargo: sumarDias(hoy, -33), estado: 'Realizada', fechaDiligencia: sumarDias(hoy, -5), resultado: 'Negativa', detalleResultado: 'No se ubicó domicilio', estampadoPjud: false }),
      causa({ rol: 'E-77-2026', tipoCausa: 'Exhorto', clienteId: fuentes, demandado: 'Marta Sanhueza', domicilio: 'Pasaje Los Robles 9', tipoDiligencia: 'Notificación', fechaEncargo: sumarDias(hoy, -64), estado: 'Devuelta', observaciones: 'El cliente retiró el encargo.' }),
      causa({ rol: 'C-150-2026', clienteId: biobio, demandado: 'Ana Gutiérrez', domicilio: 'Sin domicilio conocido', tipoDiligencia: 'Búsqueda', fechaEncargo: sumarDias(hoy, -90), estado: 'Suspendida', observaciones: 'Suspendida a pedido del cliente.' }),
    ])

    const retiro = (r: Partial<Retiro> & Pick<Retiro, 'rol' | 'fechaEncargo' | 'fechaVencimiento'>): Retiro => ({
      ...base,
      tribunal: '1er Juzgado Civil de Concepción',
      estado: 'Pendiente',
      fechaEmision: sumarDias(r.fechaEncargo, -3),
      ...r,
    })
    await db.retiros.bulkAdd([
      retiro({ rol: 'E-610-2026', clienteId: fuentes, mandante: 'BK', martilleroNombre: 'Martillero de Prueba Uno', martilleroTelefono: '+56 9 3333 4444', martilleroDireccion: 'Barros Arana 100, Concepción', revisionTecnica: 'Planta de revisión de Lebu', permisoCirculacion: 'Municipalidad de Curanilahue', deudor: 'Jorge Lagos Pérez', rutDeudor: rutFicticio('15111222'), patente: 'BB·CD·12', marca: 'Chevrolet', modelo: 'Sail', anio: 2019, color: 'Gris', direccion: 'Los Aromos 210, Curanilahue\nCasa de un familiar en Villa Los Ríos', fechaEncargo: sumarDias(hoy, -40), fechaVencimiento: sumarDias(hoy, -2), estado: 'En búsqueda', fuerzaPublicaSolicitada: true, fechaFuerzaSolicitada: sumarDias(hoy, -20) }),
      retiro({ rol: 'E-622-2026', tribunal: '2º Juzgado Civil de Concepción', clienteId: perez, mandante: 'FORUM', martilleroNombre: 'Martillera de Prueba Dos', martilleroTelefono: '+56 41 255 6677', deudor: 'Patricia Rivas', patente: 'KL·PR·45', marca: 'Toyota', modelo: 'Yaris', anio: 2021, color: 'Blanco', direccion: 'Pasaje 7 N° 14, Villa Los Ríos', fechaEncargo: sumarDias(hoy, -25), fechaVencimiento: sumarDias(hoy, 5), fuerzaPublicaSolicitada: true, fechaFuerzaSolicitada: sumarDias(hoy, -10), fuerzaPublicaConcedida: true, fechaFuerzaConcedida: sumarDias(hoy, -3) }),
      retiro({ rol: 'E-640-2026', clienteId: biobio, mandante: 'TANNER', deudor: 'Hugo Tapia', patente: 'FX·12·34', marca: 'Nissan', modelo: 'V16', anio: 2010, color: 'Rojo', direccion: 'Camino a Plegarias km 4', fechaEncargo: sumarDias(hoy, -10), fechaVencimiento: sumarDias(hoy, 12) }),
      retiro({ rol: 'E-655-2026', clienteId: fuentes, deudor: 'Andrea Molina', patente: 'GH·JK·78', marca: 'Hyundai', modelo: 'Accent', anio: 2018, color: 'Azul', fechaEncargo: sumarDias(hoy, -5), fechaVencimiento: sumarDias(hoy, 40) }),
      retiro({ rol: 'E-590-2026', mandante: 'BK', clienteId: perez, deudor: 'Rodrigo Saavedra', patente: 'DR·TS·90', marca: 'Kia', modelo: 'Rio', anio: 2017, color: 'Negro', fechaEncargo: sumarDias(hoy, -60), fechaVencimiento: sumarDias(hoy, -15), estado: 'Retirado', fechaRetiro: sumarDias(hoy, -20), horaRetiro: '10:30', lugarRetiro: 'Calle Comercio 455, Curanilahue', custodio: 'Depósito Municipal de Curanilahue' }),
    ])

    const retencion = 15.25
    const boleta = (numero: number, clienteId: number, nombreCliente: string, bruto: number, dias: number, estado: Boleta['estado']): Boleta => {
      const montoRetencion = Math.round((bruto * retencion) / 100)
      return {
        ...base,
        numero,
        fechaEmision: sumarDias(hoy, -dias),
        clienteId,
        nombreCliente,
        glosa: 'Diligencias de notificación',
        bruto,
        porcentajeRetencion: retencion,
        retencion: montoRetencion,
        liquido: bruto - montoRetencion,
        pagaRetencion: 'Cliente',
        montoCobrar: bruto - montoRetencion,
        estado,
      }
    }
    const [b1, , b3] = (await db.boletas.bulkAdd(
      [
        boleta(9001, perez, clientes[0].nombre, 85000, 45, 'Pagada'),
        boleta(9002, perez, clientes[0].nombre, 60000, 20, 'Pendiente'),
        boleta(9003, fuentes, clientes[2].nombre, 120000, 70, 'Pagada'),
        boleta(9004, fuentes, clientes[2].nombre, 45000, 95, 'Pendiente'),
        boleta(9005, biobio, clientes[3].nombre, 30000, 10, 'Anulada'),
      ],
      { allKeys: true },
    )) as number[]

    const pagos: Pago[] = [
      { ...base, boletaId: b1, fecha: sumarDias(hoy, -25), monto: 72038, medio: 'Transferencia' },
      { ...base, boletaId: b3, fecha: sumarDias(hoy, -30), monto: 101700, medio: 'Transferencia' },
    ]
    await db.pagos.bulkAdd(pagos)
  })
}

/** Borra solo los registros marcados como ejemplo */
export async function borrarDatosEjemplo(): Promise<void> {
  await db.transaction('rw', [db.clientes, db.causas, db.retiros, db.boletas, db.pagos], async () => {
    // Si un dato real quedó vinculado a un cliente de ejemplo, se desvincula
    const idsEjemplo = (await db.clientes.filter((c) => c.ejemplo === true).primaryKeys()) as number[]
    if (idsEjemplo.length) {
      await db.causas.where('clienteId').anyOf(idsEjemplo).and((c) => !c.ejemplo).modify({ clienteId: undefined })
      await db.retiros.where('clienteId').anyOf(idsEjemplo).and((r) => !r.ejemplo).modify({ clienteId: undefined })
      await db.boletas.where('clienteId').anyOf(idsEjemplo).and((b) => !b.ejemplo).modify({ clienteId: undefined })
    }
    for (const t of [db.clientes, db.causas, db.retiros, db.boletas, db.pagos] as const) {
      await t.filter((r) => r.ejemplo === true).delete()
    }
  })
}

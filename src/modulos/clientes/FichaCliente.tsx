// Ficha de un cliente: sus datos, sus causas, retiros y boletas, lo adeudado y su tiempo promedio de pago.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../../db/basedatos'
import { useAjustes } from '../../db/ajustes'
import { Boton, Seccion, SinDatos } from '../../compartido/Controles'
import { useAviso, useConfirmar } from '../../compartido/Dialogos'
import { IconoBasura, IconoCorreo, IconoEditar, IconoTelefono, IconoVolver } from '../../compartido/Iconos'
import { fechaCL, plural, pesos } from '../../utilidades/formato'
import { saldoBoleta } from '../boletas/calculos'
import { FormularioCliente } from './FormularioCliente'
import { eliminarCliente, resumirCliente, vinculosCliente } from './servicioClientes'

export function FichaCliente() {
  const { id } = useParams()
  const clienteId = Number(id)
  const navegar = useNavigate()
  const confirmar = useConfirmar()
  const avisar = useAviso()
  const ajustes = useAjustes()
  const [editando, setEditando] = useState(false)

  const datos = useLiveQuery(async () => {
    const [cliente, causas, retiros, boletas, pagos] = await Promise.all([
      db.clientes.get(clienteId),
      db.causas.where('clienteId').equals(clienteId).toArray(),
      db.retiros.where('clienteId').equals(clienteId).toArray(),
      db.boletas.where('clienteId').equals(clienteId).toArray(),
      db.pagos.toArray(),
    ])
    return { cliente, causas, retiros, boletas, pagos }
  }, [clienteId])

  if (!datos) return <p className="text-tenue">Cargando…</p>
  const { cliente } = datos
  if (!cliente) {
    return (
      <SinDatos
        titulo="Este cliente no existe"
        texto="Puede que haya sido eliminado o fusionado con otro."
        accion={<Boton onClick={() => navegar('/clientes')}>Volver a Clientes</Boton>}
      />
    )
  }

  const resumen = resumirCliente(clienteId, datos, ajustes.umbralesCausas)
  const boletasVigentes = datos.boletas.filter((b) => b.estado !== 'Anulada')

  const eliminar = async () => {
    const v = await vinculosCliente(clienteId)
    const ok = await confirmar({
      titulo: 'Eliminar cliente',
      peligro: true,
      textoConfirmar: 'Eliminar',
      mensaje: (
        <>
          <p>
            ¿Seguro que desea eliminar a <strong>«{cliente.nombre}»</strong>?
          </p>
          {v.total > 0 && (
            <p className="mt-2">
              Tiene {plural(v.causas, 'causa', 'causas')}, {plural(v.retiros, 'retiro', 'retiros')} y {plural(v.boletas, 'boleta', 'boletas')}.
              Esos registros se conservan, pero quedarán sin cliente. Si es un cliente repetido, use mejor «Fusionar clientes».
            </p>
          )}
          <p className="mt-2 text-tenue">Esta acción no se puede deshacer.</p>
        </>
      ),
    })
    if (!ok) return
    await eliminarCliente(clienteId)
    avisar('Cliente eliminado')
    navegar('/clientes')
  }

  const indicadores = [
    { texto: 'Causas pendientes', valor: String(resumen.causasPendientes) },
    { texto: 'Causas atrasadas', valor: String(resumen.causasAtrasadas), alerta: resumen.causasAtrasadas > 0 },
    { texto: 'Causas realizadas', valor: String(resumen.causasRealizadas) },
    { texto: 'Retiros activos', valor: String(resumen.retirosActivos) },
    { texto: 'Adeudado', valor: pesos(resumen.adeudado), detalle: plural(resumen.boletasImpagas, 'boleta impaga', 'boletas impagas') },
    {
      texto: 'Tiempo promedio de pago',
      valor: resumen.promedioPago === null ? '—' : plural(resumen.promedioPago, 'día', 'días'),
      detalle: resumen.promedioPago === null ? 'Aún sin boletas pagadas' : undefined,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/clientes" className="inline-flex min-h-12 items-center gap-1 font-bold text-petroleo">
          <IconoVolver /> Clientes
        </Link>
        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold md:text-4xl">{cliente.nombre}</h1>
            {cliente.rut && <p className="mt-1 text-lg text-tenue cifra">RUT {cliente.rut}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Boton variante="secundario" icono={<IconoEditar />} onClick={() => setEditando(true)}>
              Editar
            </Boton>
            <Boton variante="discreto" className="text-rojo" icono={<IconoBasura />} onClick={eliminar}>
              Eliminar
            </Boton>
          </div>
        </div>
      </div>

      {/* Datos de contacto */}
      <div className="flex flex-col gap-2 text-lg md:flex-row md:flex-wrap md:gap-x-8">
        {cliente.contacto && <p>Contacto: {cliente.contacto}</p>}
        {cliente.telefono && (
          <a href={`tel:${cliente.telefono.replace(/\s/g, '')}`} className="inline-flex min-h-12 items-center gap-2 font-bold text-petroleo">
            <IconoTelefono /> {cliente.telefono}
          </a>
        )}
        {cliente.correo && (
          <a href={`mailto:${cliente.correo}`} className="inline-flex min-h-12 items-center gap-2 break-all font-bold text-petroleo">
            <IconoCorreo /> {cliente.correo}
          </a>
        )}
        {!cliente.contacto && !cliente.telefono && !cliente.correo && <p className="text-tenue">Sin datos de contacto. Use «Editar» para agregarlos.</p>}
      </div>
      {cliente.notas && <p className="whitespace-pre-line rounded-lg border-l-4 border-petroleo bg-petroleo-suave p-4">{cliente.notas}</p>}

      {/* Indicadores */}
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {indicadores.map((i) => (
          <div key={i.texto} className={`rounded-xl border p-4 ${i.alerta ? 'border-rojo bg-rojo-suave' : 'border-borde bg-superficie'}`}>
            <dt className="text-tenue">{i.texto}</dt>
            <dd className={`mt-1 text-2xl font-bold cifra ${i.alerta ? 'text-rojo' : ''}`}>{i.valor}</dd>
            {i.detalle && <dd className="text-sm text-tenue">{i.detalle}</dd>}
          </div>
        ))}
      </dl>

      <Seccion titulo={`Causas (${datos.causas.length})`}>
        {datos.causas.length === 0 ? (
          <p className="text-tenue">Este cliente aún no tiene causas registradas.</p>
        ) : (
          <ul className="divide-y divide-borde">
            {datos.causas
              .sort((a, b) => b.fechaEncargo.localeCompare(a.fechaEncargo))
              .map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                  <span>
                    <span className="font-serif text-lg font-bold cifra">ROL {c.rol}</span>
                    <span className="block text-tenue">
                      {c.tipoDiligencia ?? 'Diligencia'} · {c.demandado ?? 'Demandado sin nombre'}
                    </span>
                  </span>
                  <span className="text-right">
                    {c.estado}
                    <span className="block text-sm text-tenue">Encargo {fechaCL(c.fechaEncargo)}</span>
                  </span>
                </li>
              ))}
          </ul>
        )}
      </Seccion>

      <Seccion titulo={`Retiros de vehículos (${datos.retiros.length})`}>
        {datos.retiros.length === 0 ? (
          <p className="text-tenue">Este cliente aún no tiene retiros de vehículos.</p>
        ) : (
          <ul className="divide-y divide-borde">
            {datos.retiros.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                <span>
                  <span className="font-serif text-lg font-bold cifra">ROL {r.rol}</span>
                  <span className="block text-tenue">
                    {r.patente ?? 'Sin patente'} · {[r.marca, r.modelo].filter(Boolean).join(' ') || 'Vehículo'}
                  </span>
                </span>
                <span className="text-right">
                  {r.estado}
                  <span className="block text-sm text-tenue">Vence {fechaCL(r.fechaVencimiento)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion titulo={`Boletas vigentes (${boletasVigentes.length})`}>
        {boletasVigentes.length === 0 ? (
          <p className="text-tenue">Este cliente aún no tiene boletas de honorarios.</p>
        ) : (
          <ul className="divide-y divide-borde">
            {boletasVigentes
              .sort((a, b) => b.fechaEmision.localeCompare(a.fechaEmision))
              .map((b) => {
                const saldo = saldoBoleta(b, datos.pagos)
                return (
                  <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                    <span>
                      <span className="font-bold cifra">Boleta N° {b.numero}</span>
                      <span className="block text-tenue">Emitida {fechaCL(b.fechaEmision)}</span>
                    </span>
                    <span className="text-right cifra">
                      {pesos(b.montoCobrar)}
                      <span className={`block text-sm ${saldo > 0 ? 'font-bold text-naranja' : 'text-tenue'}`}>
                        {saldo > 0 ? `Por cobrar ${pesos(saldo)}` : b.estado}
                      </span>
                    </span>
                  </li>
                )
              })}
          </ul>
        )}
      </Seccion>

      <FormularioCliente abierta={editando} cliente={cliente} alCerrar={() => setEditando(false)} />
    </div>
  )
}

// Pagos registrados de una boleta o factura, con el saldo pendiente (se usa en ambos formularios).
import type { Boleta, Pago } from '../../db/tipos'
import { Boton } from '../../compartido/Controles'
import { useAviso, useConfirmar } from '../../compartido/Dialogos'
import { fechaCL, pesos } from '../../utilidades/formato'
import { saldoBoleta, totalPagado } from './calculos'
import { eliminarPago } from './servicioBoletas'

export function PagosDocumento({ documento, pagos, alRegistrarPago }: { documento: Boleta; pagos: Pago[]; alRegistrarPago: (b: Boleta) => void }) {
  const confirmar = useConfirmar()
  const avisar = useAviso()
  if (documento.estado === 'Anulada') return null
  const saldo = saldoBoleta(documento, pagos)

  const quitarPago = async (p: Pago) => {
    const ok = await confirmar({ titulo: 'Eliminar pago', mensaje: `¿Eliminar el pago de ${pesos(p.monto)} del ${fechaCL(p.fecha)}?`, textoConfirmar: 'Eliminar', peligro: true })
    if (!ok) return
    await eliminarPago(p.id!)
    avisar('Pago eliminado')
  }

  return (
    <section className="mt-6 flex flex-col gap-3 rounded-xl border border-borde p-4" aria-labelledby="titulo-pagos">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="titulo-pagos" className="font-serif text-lg font-bold">
          Pagos
        </h3>
        {saldo > 0 && (
          <Boton variante="secundario" className="min-h-10 py-1" onClick={() => alRegistrarPago(documento)}>
            Registrar pago
          </Boton>
        )}
      </div>
      {pagos.length === 0 ? (
        <p className="text-tenue">Sin pagos registrados.</p>
      ) : (
        <ul className="divide-y divide-borde">
          {[...pagos]
            .sort((a, b) => a.fecha.localeCompare(b.fecha))
            .map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="flex-1">
                  <span className="font-bold cifra">{pesos(p.monto)}</span> el <span className="cifra">{fechaCL(p.fecha)}</span>, {p.medio.toLowerCase()}
                  {p.nota && <span className="block text-sm text-tenue">{p.nota}</span>}
                </span>
                <Boton variante="discreto" className="min-h-10 py-1 text-rojo" onClick={() => quitarPago(p)}>
                  Eliminar pago
                </Boton>
              </li>
            ))}
        </ul>
      )}
      <p className="text-sm text-tenue cifra">
        Pagado {pesos(totalPagado(documento, pagos))} de {pesos(documento.montoCobrar)}
        {saldo > 0 ? `; falta ${pesos(saldo)}` : ''}
      </p>
    </section>
  )
}

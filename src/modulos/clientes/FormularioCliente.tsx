// Formulario para crear o editar un cliente / estudio jurídico.
import { useEffect, useState } from 'react'
import type { Cliente } from '../../db/tipos'
import { AreaTexto, Boton, Campo } from '../../compartido/Controles'
import { useAviso } from '../../compartido/Dialogos'
import { Ventana } from '../../compartido/Ventana'
import { buscarRepetido, guardarCliente, validarCliente, type DatosCliente } from './servicioClientes'

const VACIO: DatosCliente = { nombre: '', rut: '', contacto: '', correo: '', telefono: '', notas: '' }

export function FormularioCliente({
  abierta,
  cliente,
  nombreInicial,
  alCerrar,
  alGuardar,
}: {
  abierta: boolean
  cliente?: Cliente
  nombreInicial?: string
  alCerrar: () => void
  alGuardar?: (id: number) => void
}) {
  const avisar = useAviso()
  const [datos, setDatos] = useState<DatosCliente>(VACIO)
  const [errores, setErrores] = useState<Partial<Record<keyof DatosCliente, string>>>({})
  const [repetido, setRepetido] = useState<Cliente | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierta) return
    setDatos(cliente ? { ...VACIO, ...cliente } : { ...VACIO, nombre: nombreInicial ?? '' })
    setErrores({})
    setRepetido(null)
  }, [abierta, cliente, nombreInicial])

  const cambiar = (campo: keyof DatosCliente) => (e: { target: { value: string } }) => {
    setDatos((d) => ({ ...d, [campo]: e.target.value }))
    setErrores((er) => ({ ...er, [campo]: undefined }))
    if (campo === 'nombre' || campo === 'rut') setRepetido(null)
  }

  const guardar = async (aunqueRepetido = false) => {
    const { errores: er, datos: limpio } = validarCliente(datos)
    setErrores(er)
    if (Object.keys(er).length) return
    if (!aunqueRepetido) {
      const otro = await buscarRepetido(limpio, cliente?.id)
      if (otro) {
        setRepetido(otro)
        return
      }
    }
    setGuardando(true)
    try {
      const id = await guardarCliente(limpio, cliente?.id)
      avisar(cliente ? 'Cliente actualizado' : 'Cliente guardado')
      alGuardar?.(id)
      alCerrar()
    } catch {
      avisar('No se pudo guardar el cliente. Intente de nuevo.', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Ventana
      abierta={abierta}
      titulo={cliente ? 'Editar cliente' : 'Nuevo cliente'}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton onClick={() => guardar(false)} disabled={guardando}>
            {cliente ? 'Guardar cambios' : 'Guardar cliente'}
          </Boton>
        </>
      }
    >
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          guardar(false)
        }}
      >
        <div className="md:col-span-2">
          <Campo
            etiqueta="Nombre del cliente o estudio jurídico"
            obligatorio
            value={datos.nombre}
            onChange={cambiar('nombre')}
            error={errores.nombre}
            autoFocus
          />
        </div>
        <Campo
          etiqueta="RUT"
          value={datos.rut ?? ''}
          onChange={cambiar('rut')}
          error={errores.rut}
          placeholder="76.123.456-7"
          ayuda="Opcional. Se revisa el dígito verificador."
          inputMode="text"
        />
        <Campo etiqueta="Persona de contacto" value={datos.contacto ?? ''} onChange={cambiar('contacto')} />
        <Campo etiqueta="Correo" type="email" value={datos.correo ?? ''} onChange={cambiar('correo')} error={errores.correo} inputMode="email" />
        <Campo etiqueta="Teléfono" type="tel" value={datos.telefono ?? ''} onChange={cambiar('telefono')} placeholder="+56 9 1234 5678" inputMode="tel" />
        <div className="md:col-span-2">
          <AreaTexto etiqueta="Notas" value={datos.notas ?? ''} onChange={cambiar('notas')} />
        </div>
        <button type="submit" hidden />
      </form>

      {repetido && (
        <div className="mt-5 rounded-lg border-l-4 border-naranja bg-naranja-suave p-4" role="alert">
          <p className="font-bold">Ya existe un cliente parecido: «{repetido.nombre}»{repetido.rut ? ` (${repetido.rut})` : ''}.</p>
          <p className="mt-1">Si es el mismo, cancele y use el existente. Si es otro distinto, puede guardarlo igual.</p>
          <Boton variante="secundario" className="mt-3" onClick={() => guardar(true)}>
            Guardar igual
          </Boton>
        </div>
      )}
    </Ventana>
  )
}

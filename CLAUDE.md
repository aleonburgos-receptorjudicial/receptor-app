# Aplicaciones de la Receptora Judicial – Reglas del proyecto

Nombre visible de la app: **Receptor Judicial** (pestaña, menú y PWA). El nombre interno de la base de datos (`receptora-curanilahue`) NO se cambia.

Estas reglas se aplican a TODAS las aplicaciones que se creen en esta carpeta.

## Quién usa las apps
- Usuaria: Mercedes, receptora judicial en Curanilahue (Chile), sin conocimientos de programación.
- Explicar todo en lenguaje simple, sin tecnicismos. Si un término técnico es inevitable, explicarlo en una frase.

## Contexto de trabajo
- Realiza notificaciones y diligencias encargadas por:
  - el Juzgado / tribunal de Curanilahue,
  - particulares,
  - la Corte Suprema.
- Debe poder seguir el estado de cada diligencia: **pendiente**, **realizada**, **fallida**, **estampada en PJUD**.
- Debe controlar los **plazos** y el **cobro de honorarios** (incluidas boletas de honorarios).

## Idioma
- Todo en español de Chile: textos, botones, mensajes, avisos y errores.
- Fechas siempre en formato **DD-MM-AAAA**.
- Montos en pesos chilenos con separador de miles con punto (ej.: $45.000).

## Diseño
- Usar SIEMPRE la skill **frontend-design** antes de escribir cualquier código de interfaz.
- Estilo sobrio y profesional, fácil de leer.
- Letra grande, buen contraste, botones claros y grandes con texto descriptivo.
- Diseño adaptable: debe funcionar bien en **celular** y en **computador**.

## Tecnología (elegida por Mercedes para esta app)
- React + Vite + TypeScript, con Tailwind CSS v4.
- Datos en IndexedDB con Dexie.js (funciona sin internet).
- PWA instalable (manifest + service worker).
- SheetJS (xlsx) para Excel, pdf.js para PDF del SII, Recharts para gráficos.
- Navegación con HashRouter; la vista previa en claude.ai se compila con `VITE_ENRUTADOR=memoria` (MemoryRouter).
- Código ordenado por módulos en `src/modulos/`; `src/sincronizacion/` queda reservado para Supabase/Drive (no implementar aún).
- Comentarios del código en español.
- Fases: 1) base y Clientes ✅, 2) Causas ✅, 3) Retiros ✅, 4) Boletas, 5) Inicio, respaldos, PWA y pruebas finales.

## Datos
- Guardar la información (causas, notificaciones, plazos, honorarios) **localmente en el navegador**.
- Incluir siempre un botón visible para **exportar / respaldar** los datos (Excel o JSON) y otro para **importar / restaurar** un respaldo.
- Recordar a la usuaria, dentro de la app, que haga respaldos periódicos.

## Documentos y planillas
- Actas, certificados o informes: usar las skills **pdf** o **docx**.
- Exportar registros a planilla: usar la skill **xlsx**.

## Pruebas
- Antes de entregar una app, probarla con la skill **webapp-testing** y corregir los errores encontrados.

## Privacidad
- Los datos de causas y personas son **confidenciales**.
- No enviarlos a ningún servicio externo (sin analítica, sin servidores, sin APIs externas con datos de causas).
- Para pruebas, usar solo datos ficticios.

## Decisiones de la fase 2 (Causas)
- Estados: Pendiente / Realizada / Suspendida / Devuelta. La etapa (falta estampar, sin boleta, boleta emitida) se calcula.
- Solo se guardan datos del tribunal de Curanilahue: sin ROL ni tribunal de origen. Al importar, se usa "ROL EXHORTO" si es de Curanilahue; las filas de otros tribunales se omiten.
- Reencargo = mismo ROL y cliente con causa pendiente/suspendida y fecha más nueva: se actualiza la fecha y se guarda la anterior.
- SheetJS se instala desde cdn.sheetjs.com (entorno "receptor-app") y se carga solo al importar/exportar.

## Decisiones de la fase 3 (Retiros de vehículos)
- Campos pedidos por Mercedes: ROL, tribunal (sin valor por defecto), fecha del encargo (con días transcurridos), fecha de emisión y vencimiento del oficio (sin fechas de fuerza pública), vehículo, demandado y RUT, mandante, estudio, martillero (nombre, teléfono, dirección), revisión técnica, permiso de circulación, domicilios probables, observaciones. Al retirar: día, hora, lugar y depósito.
- Vigencia habitual del oficio (opcional, en Configuración) propone el vencimiento desde la emisión. Avisos arriba de la lista y etiquetas en cada retiro: «Oficio vencido», «Pedir renovación» (vence en `diasAvisoRenovacion` días o menos, 7 por defecto) y «Prioridad de búsqueda» (`diasPrioridadBusqueda` días o más desde el encargo, 10 por defecto), configurables en Ajustes.
- Campos del formulario configurables en `ajustes.camposRetiro` (orden, nombre, visible). Los de fábrica no se eliminan; ROL, fechas y estado no se ocultan (`fijo`). Los propios guardan su valor en `retiro.extras[clave]`.
- Solo los retiros "Pendiente" y "En búsqueda" tienen color y alertas. Colores: más de 15 días verde, 8 a 15 amarillo, 0 a 7 naranja, vencido rojo (configurable).
- La patente se valida con los formatos chilenos (auto nuevo/antiguo, moto nueva/antigua) y se muestra como placa "BB·BB·12".
- Informes PDF de los dealers: se adjuntan al retiro (tabla `archivos` de Dexie, versión 2) y se abren desde la lista o la tarjeta.
- "Leer informe" (formato DealerNET, `src/modulos/retiros/informe/`): pdf.js lee textos y dibuja la página para medir el color de cada estrella (llena/media/vacía). Ordena domicilios por contactabilidad + calidad (marca los de 6/10 o más), saca relacionados y avisa si el RUT no coincide. Lo elegido se agrega al formulario (domicilios probables primero, `retiro.familiares`) y el resumen se guarda en el archivo. Pruebas solo con un informe ficticio generado con reportlab.
- Mandantes: lista editable en Clientes → pestaña Mandantes (`ajustes.mandantes`). Renombrar corrige causas y retiros; renombrar a uno existente los une. Se recuerdan solos al escribirlos.

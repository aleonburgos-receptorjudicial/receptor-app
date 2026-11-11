# Aplicaciones de la Receptora Judicial – Reglas del proyecto

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
- Fases: 1) base y Clientes ✅, 2) Causas ✅, 3) Retiros, 4) Boletas, 5) Inicio, respaldos, PWA y pruebas finales.

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

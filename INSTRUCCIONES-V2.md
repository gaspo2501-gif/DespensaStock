# DespensaStock v2 — cómo publicarla sin perder datos

## Qué cambia y qué no

- **Se usan los mismos datos de Firebase.** No hay migración: la app nueva lee los productos, el stock, las ventas, los clientes, los fiados, las compras, los proveedores, los gastos y los cierres que ya tenés.
- **No se borra nada.** La app nueva nunca elimina registros: los anula o los archiva.
- **Al abrirse, la app no escribe nada.** Solo guarda cuando vos hacés una operación.
- Los campos nuevos (costo al momento de la venta, margen en cada ingreso, stock mínimo por producto, control de Mercado Pago en el cierre) se agregan sin tocar los registros viejos.

### Archivos modificados

- `src/App.tsx`, `src/main.tsx`: arrancan la interfaz nueva.
- `src/services/firebase/config.ts`: activa la caché en el equipo para vender sin internet.
- `index.html`: tipografías y zoom habilitado.
- `public/sw.js`: versión nueva (fuerza la actualización de la app instalada).
- `package.json`: se quitaron 6 dependencias que no se usaban (Gemini, express, dotenv, motion, tsx y @types/express).
- `firestore.rules`: reglas nuevas, se aplican a mano (ver paso 4).
- `.github/workflows/build-check.yml` (nuevo): compila en una rama aparte sin publicar.

### Carpetas nuevas

- `src/core`, `src/data`, `src/ui` y `src/styles`.

Las pantallas viejas (`src/pages`, `src/components`) quedan en el repositorio sin usarse. No hace falta borrarlas.

## Pasos

1. **Subí los archivos a una rama nueva, no a `main`.** En GitHub entrá a *Add file → Upload files* y arrastrá todo el contenido de la carpeta. Abajo elegí **"Create a new branch for this commit and start a pull request"** y poné de nombre `nueva-version`.
   - Asegurate de que se suba la carpeta `.github`. En algunas computadoras viene oculta.
2. **Esperá a que GitHub compile.** En la pestaña *Actions* aparece "Verificar compilación (sin publicar)". Si termina en verde, la versión compila. Si termina en rojo, no publiques: mandame el error.
3. **Publicá.** En el *pull request* tocá **Merge**. Eso pasa la versión a `main` y GitHub Pages la publica sola en uno o dos minutos.
4. **Apenas abras la versión nueva, antes de vender:**
   - Tocá **"Descargar copia de seguridad"** en el menú izquierdo (en el celular está en *Más*) y guardá el archivo en tu computadora. Es una copia de todos tus datos.
   - Revisá que estén tus productos, el stock, los clientes y los cierres.
   - En *Firebase Console → Firestore Database → Reglas*, pegá el contenido de `firestore.rules` y publicalo. Desde ahí nadie puede borrar datos desde afuera de la app.
5. **Si algo sale mal, volvé a la versión anterior.** En GitHub, entrá al *pull request* ya mergeado y tocá **Revert**, y después mergeá ese revert. La versión anterior vuelve a publicarse y lee los mismos datos.

## Cosas para revisar en el primer uso

- **Escaneo con la cámara** en el celular: no se pudo probar acá.
- **Venta sin internet:** cortá el wifi, hacé una venta y volvé a conectarte. La operación tiene que aparecer como "pendiente" y después subirse sola.
- **Caja → Registros sin sucursal:** si aparece este aviso, asigná cada registro a su sucursal.
- **Caja → Gastos:** los gastos viejos marcados "(supuesto)" no tenían guardado de dónde salió la plata. El gasto de $32.400 del pan aparece así: tocá **Corregir** y elegí *Efectivo de caja general*.

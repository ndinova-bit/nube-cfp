# NUBE · Asistente de conducción

Panel de conducción para los CFP (PWA instalable, solo lectura). Se conecta a la
plataforma educativa con el email y la contraseña de cada usuario; los datos que
ve cada persona dependen de su rol en la plataforma.

- `index.html`: la app.
- `core.js`: conexión con Supabase y cálculos.
- `sw.js` y `manifest.webmanifest`: instalación en el celular y uso sin conexión.

No contiene contraseñas ni datos de estudiantes. La clave incluida es la clave
pública (publishable) del proyecto; la seguridad la dan el login y las reglas de la base.

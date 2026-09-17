# 🚀 Azure DevOps Real-Time Notifier (Chrome Extension & Web Portal)

Extensión para navegador Chrome / Edge con portal web de control integrado para la monitorización en tiempo real de cambios de estado en **Historias de Usuario (HU)** y **Bugs** en Azure DevOps.

---

## ⚡ Característica Destacadas

1. **Notificaciones Flotantes en Tiempo Real**:
   - **Historias de Usuario (HU)**: Alerta flotante cuando una HU cambia de estado **Y** está asignada a tu usuario.
   - **Bugs - Caso 1 (Nuevo Bug)**: Alerta cuando se reporta un nuevo bug en estado `NEW` / `Nuevo` asignado o libre.
   - **Bugs - Caso 2 (Paso a QA)**: Alerta cuando un bug pasa a estado de control de calidad (`QA` / `In QA` / `Testing`).
   - **Bugs - Caso 3 (Reapertura)**: Alerta cuando un bug es reabierto (`REOPEN` / `Reopened`).

2. **Redirección Directa al Ítem**:
   - Al hacer clic en cualquier notificación flotante (nativa del sistema o toast in-page en la pestaña activa), el navegador abre automáticamente la pestaña exacta del Work Item en Azure DevOps:
     `https://dev.azure.com/{organizacion}/{proyecto}/_workitems/edit/{id}`

3. **Portal Web de Control & Mapeo Dinámico de Estados**:
   - Permite personalizar los nombres exactos de los estados (`New`, `In QA`, `Reopened`, etc.) para adaptarse a cualquier plantilla de proceso (Agile, Scrum, CMMI o Custom).
   - Incluye un **Simulador de Notificaciones en Vivo** para probar las alertas sin tener que esperar eventos reales de Azure DevOps.
   - Guarda un **Historial de Alertas** reciente con filtros interactivos.

---

## 🛠️ Instalación en el Navegador (Chrome / Edge / Brave)

1. Abre tu navegador y navega a: `chrome://extensions` (o `edge://extensions`).
2. Activa el **Modo de desarrollador** (Developer mode) en la esquina superior derecha.
3. Haz clic en el botón **Cargar descomprimida** (Load unpacked).
4. Selecciona la carpeta del proyecto:
   `c:\Users\yanmd\Desktop\state_news`
5. ¡Listo! Verás el icono de **ADO Notifier** en la barra de herramientas de tus extensiones.

---

## 🔑 Configuración Paso a Paso

1. Haz clic en el icono de la extensión en la barra de herramientas de Chrome y presiona el botón **Portal Completo** (o icono de engranaje ⚙️).
2. En la pestaña **Credenciales & Conexión**:
   - **Organización Azure DevOps**: El nombre de tu organización (ej: `mi-empresa`).
   - **Nombre del Proyecto**: Tu proyecto (ej: `Portal-Web`).
   - **Personal Access Token (PAT)**: Token de Azure DevOps con permisos de lectura de Work Items (`Work Items: Read`).
   - **Tu Usuario / Email**: Tu nombre o correo para filtrar las Historias de Usuario asignadas a ti.
   - **Intervalo de Verificación**: Tiempo entre búsquedas automáticas (1 a 15 minutos).
3. Presiona **Probar Conexión** para validar el token y la organización.
4. Presiona **Guardar Configuración**.

---

## 🧪 Cómo Probar las Notificaciones

1. Entra al **Portal de Configuración** de la extensión.
2. Ve a la pestaña **Simulador & Pruebas**.
3. Presiona cualquiera de los botones:
   - `⚡ Probar Notificación HU`
   - `⚡ Probar Bug Nuevo`
   - `⚡ Probar Bug en QA`
   - `⚡ Probar Bug Reabierto`
4. Verás aparecer inmediatamente la notificación flotante del sistema y la notificación Toast in-page. Al hacer clic en ella, te llevará directamente a Azure DevOps.

---

## 📁 Estructura del Proyecto

```
state_news/
├── manifest.json              # Configuración de Manifest V3
├── background/
│   └── service-worker.js      # Motor background, consultas WIQL y notificaciones
├── options/                   # Portal Web de Configuración
│   ├── options.html           # Interfaz principal del portal
│   ├── options.css            # Estilos dark mode & glassmorphism
│   └── options.js             # Lógica de conexión, pruebas e historial
├── popup/                     # Vista emergente rápida
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/                   # Notificaciones Toast flotantes in-page
│   ├── content-script.js
│   └── toast.css
└── assets/                    # Iconos e imagen visual
    ├── build-icons.js
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

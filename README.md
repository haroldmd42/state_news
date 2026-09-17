# 🚀 Azure DevOps Real-Time Notifier (Chrome & Edge Extension)

Extensión moderna para navegadores **Google Chrome**, **Microsoft Edge** y **Brave** basada en **Manifest V3**, diseñada para la monitorización en tiempo real de **Historias de Usuario (HU)** y **Bugs** en **Azure DevOps**.

Cuenta con un **Portal Web de Control** integrado, sonido de notificación personalizado, notificaciones flotantes in-page (*toasts*), alertas nativas del sistema operativo, simulador de eventos en vivo y mapeo dinámico de estados compatible con cualquier proceso (Agile, Scrum, CMMI o personalizado).

---

## ⚡ Características Principales

### 🔔 1. Notificaciones Flotantes en Tiempo Real
- **Nativas del Sistema Operativo**: Alertas flotantes del SO (Windows / macOS / Linux) que aparecen incluso cuando el navegador está minimizado.
- **Toasts In-Page**: Notificaciones flotantes animadas dentro de la pestaña activa del navegador con cierre automático o manual.
- **Sonido de Alerta Personalizado**: Reproducción de audio en segundo plano (`assets/sonido.mp3`) mediante un *offscreen document* optimizado para Manifest V3.
- **Redirección Directa con un Clic**: Al hacer clic en cualquier notificación (nativa o toast), el navegador abre instantáneamente la pestaña exacta del Work Item en Azure DevOps:
  `https://dev.azure.com/{organizacion}/{proyecto}/_workitems/edit/{id}`

### 🎯 2. Monitoreo Inteligente de Eventos
- **Historias de Usuario (HU)**:
  - Cambio de estado general en HUs asociadas o asignadas.
  - Pase a control de calidad (`QA` / `In QA` / `Testing`).
  - Pase a revisión de Product Owner (`Review PO`).
  - Despliegue en ambiente de Staging (`In Stage` / `Stage`).
  - Finalización o resolución (`Done` / `Closed` / `Resolved`).
  - Alertas críticas de bloqueo por Impedimento (`Impediment` / `Blocked`).
  - Asignación como responsable de QA o desarrollo.
- **Bugs**:
  - **Nuevo Bug**: Notificación inmediata al reportarse un nuevo bug (`New` / `Nuevo` / `To Do`) asignado o libre.
  - **Pase a QA**: Notificación cuando un bug pasa a estado de pruebas.
  - **Reapertura de Bug**: Alerta de alta prioridad cuando un bug es reabierto (`Reopened` / `Reopen`).
  - **Resolución/Cierre**: Confirmación al cerrar o resolver un bug.

### 👤 3. Filtro Inteligente de Usuarios (Fuzzy Matching)
- Permite filtrar notificaciones para que solo recibas alertas de elementos donde estés asignado o asociado.
- Soporta búsqueda flexible sin importar mayúsculas, minúsculas o tildes.
- Evalúa coincidencia por email o por nombre completo / apellidos invertidos (ejemplo: `Pérez Gómez, Juan` coincide con `Juan Pérez`).
- Busca coincidencias en múltiples campos: `AssignedTo`, `Responsable QA`, `Backend`, `Maquetación`, `Integrador`, etc.

### ⚙️ 4. Portal Web de Control & Mapeo de Estados (Options Page)
- **Credenciales & Conexión**: Configuración de Organización, Proyecto, Personal Access Token (PAT) y Usuario con botón de **Probar Conexión** instantánea.
- **Mapeo Dinámico de Estados**: Personaliza los nombres exactos de los estados de tu tablero en Azure DevOps sin necesidad de modificar código.
- **Simulador de Notificaciones en Vivo**: 11 botones de prueba interactivos para simular eventos de HUs y Bugs en tiempo real.
- **Historial Interactivo de Alertas**: Registro persistente de notificaciones recibidas con filtros por categoría (HUs, Bugs, Todos), contador de no leídas, marcado individual o masivo y borrado de historial.
- **Guía Integrada para el PAT**: Instrucciones paso a paso para generar el Personal Access Token dentro de Azure DevOps con los permisos requeridos.

### 🔒 5. Privacidad y Seguridad Total
- **Cero dependencias externas**: Toda la lógica se ejecuta localmente en el navegador.
- **Sin recopilación de datos**: Credenciales y tokens se almacenan exclusivamente en `chrome.storage.local` del usuario.
- **Sin información privada hardcodeada**: Repositorio 100% limpio listo para clonar y usar por cualquier equipo o desarrollador.

---

## 🛠️ Instalación Paso a Paso

1. Clonar o descargar este repositorio en tu equipo:
   ```bash
   git clone https://github.com/tu-usuario/tu-repositorio.git
   ```
2. Abre tu navegador (Chrome, Edge o Brave) e ingresa a la sección de extensiones:
   - Chrome / Brave: `chrome://extensions`
   - Microsoft Edge: `edge://extensions`
3. Activa el **Modo de desarrollador** (*Developer mode*) en el interruptor de la esquina superior derecha.
4. Haz clic en el botón **Cargar descomprimida** (*Load unpacked*).
5. Selecciona la carpeta raíz del proyecto (la carpeta que contiene el archivo `manifest.json`).
6. ¡Listo! Verás el icono de **Azure DevOps Notifier** en la barra de herramientas de extensiones de tu navegador.

---

## 🔑 Configuración Inicial

1. Haz clic en el icono de la extensión en la barra del navegador y selecciona **Portal Completo** (o haz clic derecho en el icono > *Opciones*).
2. En la pestaña **Credenciales & Conexión**, ingresa tus datos:
   - **Organización Azure DevOps**: El nombre de tu organización en la URL (ej: `mi-empresa` para `dev.azure.com/mi-empresa`).
   - **Nombre del Proyecto**: El nombre exacto de tu proyecto en Azure DevOps.
   - **Personal Access Token (PAT)**: Token de acceso personal generado en Azure DevOps con permiso `Work Items: Read`.
   - **Tu Usuario / Email**: Tu correo o nombre para el filtrado de notificaciones personalizadas.
   - **Intervalo de Verificación**: Frecuencia de consulta en segundo plano (entre 1 y 15 minutos).
3. Presiona el botón **Probar Conexión** para verificar que la organización, el proyecto y el PAT sean válidos.
4. Presiona **Guardar Configuración**.

---

## 🧪 Cómo Probar las Notificaciones (Simulador)

1. Abre el **Portal de Configuración** de la extensión.
2. Ve a la pestaña **Simulador & Pruebas**.
3. Haz clic en cualquiera de los botones de prueba disponibles (ej. *Probar Bug Nuevo*, *Probar HU en QA*, *Probar HU Con Impedimento*, etc.).
4. Verás aparecer inmediatamente la notificación flotante del sistema operativo, el Toast in-page animado y escucharás el sonido de alerta.

---

## 📁 Estructura del Proyecto

```
state_news/
├── manifest.json              # Manifiesto V3 de la extensión de Chrome
├── README.md                  # Documentación del proyecto
├── background/
│   └── service-worker.js      # Service worker en segundo plano (Consultas WIQL, badges y notificaciones)
├── options/                   # Portal Web de Control y Configuración
│   ├── options.html           # Interfaz del portal completo
│   ├── options.css            # Estilos UI (Dark mode, glassmorphism y diseño responsivo)
│   └── options.js             # Lógica del portal (Conexión, mapeo, historial y simulador)
├── popup/                     # Menú emergente de la barra de herramientas
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/                   # Scripts de contenido para Notificaciones Toast in-page
│   ├── content-script.js
│   └── toast.css
├── offscreen/                 # Documento offscreen para reproducción de audio en MV3
│   ├── offscreen.html
│   └── offscreen.js
└── assets/                    # Iconos y sonido de notificación
    ├── icon16.png
    ├── icon48.png
    ├── icon128.png
    └── sonido.mp3             # Sonido MP3 de alerta
```

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Siéntete libre de clonarlo, adaptarlo y contribuir a su desarrollo.

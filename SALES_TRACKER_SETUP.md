# 📊 Odoo Sales Tracker - Guía de Configuración

Sistema automático de prospección y seguimiento para vendedores B2B de refacciones industriales.

## 🚀 Configuración Inicial

### 1. Variables de Entorno

Agrega a tu `.env.local`:

```env
# Odoo Connection (XML-RPC)
ODOO_URL=https://tuempresa.odoo.com
ODOO_DB=tuempresa
ODOO_USER=tu@email.com
ODOO_PASSWORD=tu_api_key_o_contraseña
ODOO_API_KEY=tu_api_key_opcional

# MongoDB
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/bannercatalog

# Email Marketing (Brevo)
BREVO_API_KEY=tu_api_key_brevo
BREVO_SENDER_EMAIL=noreply@tuempresa.com

# NextAuth (opcional)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=tu_secret_muy_largo_y_random
```

### 2. Base de Datos

El sistema crea automáticamente las colecciones MongoDB con estos modelos:

- **Customer** - Clientes con historial de compras
- **Task** - Tareas automáticas generadas
- **EmailCampaign** - Campañas de email enviadas
- **OdooSync** - Log de sincronizaciones
- **Cotizacion** - Cotizaciones (existente)
- **Lead** - Leads nuevos (existente)

## 📋 Cómo Funciona

### Flow Automático

```
1. SINCRONIZACIÓN (Manual o automática cada X horas)
   └─ POST /api/tracker/sync
      ├─ Trae clientes de Odoo
      ├─ Trae historial de compras
      └─ Analiza con RFM

2. ANÁLISIS RFM
   ├─ Recency: ¿Cuándo fue la última compra?
   ├─ Frequency: ¿Cuántas compras hizo?
   └─ Monetary: ¿Cuánto gastó?

3. SEGMENTACIÓN
   ├─ VIP Activo: Clientes de alto valor + compras recientes
   ├─ Activo: Compras regulares
   ├─ En Riesgo: Sin compras hace 1-2 meses
   ├─ Dormido: Sin compras hace 6+ meses
   └─ Prospect: Sin historial de compras

4. GENERACIÓN DE TAREAS
   ├─ URGENTE: Llamar a VIP sin contacto 60+ días
   ├─ HOY: Email a activos, seguimiento cotizaciones
   └─ ESTA SEMANA: Prospección de leads nuevos

5. DASHBOARD
   └─ Muestra tareas priorizadas para hacer hoy
```

## 🎯 API Endpoints

### Sincronización
```bash
POST /api/tracker/sync
# Sincroniza datos de Odoo, analiza y genera tareas

GET /api/tracker/sync
# Ve el status de la última sincronización
```

### Tareas
```bash
GET /api/tracker/tasks?status=pending&priority=urgent&limit=50
# Obtiene tareas filtradas

PATCH /api/tracker/tasks
# Actualiza tarea (marcar completa, posponer, etc)
# Body: { taskId, status, result, notes }
```

### Estadísticas
```bash
GET /api/tracker/stats
# Obtiene estadísticas del dashboard
```

## 🌐 Dashboard

Accede en: `http://localhost:3000/dashboard`

Muestra:
- **Tareas priorizadas** (Urgente, Hoy, Esta semana)
- **Estadísticas** (Tareas hoy, clientes por segmento, email open rate)
- **Top clientes por valor**
- **Botón de sincronización** manual

## 📧 Email Marketing (Próximamente)

El sistema está preparado para integrar con **Brevo** para:
- Campañas automáticas de reactivación
- Seguimiento de leads nuevos
- Upsell a clientes activos
- Tracking de aperturas y clicks

## 🔧 Reglas de Negocio

Se pueden personalizar en `libs/task-generator.js`:

```javascript
// Ejemplos:
- VIP sin contacto 60+ días → Llamada urgente
- Cotización abierta 7+ días → Seguimiento
- Cliente dormido → Email + llamada post-email
- Prospect → Email bienvenida + prospección
```

## 🏃 Uso Diario

1. **Mañana**: Abre el dashboard
2. **Ve las tareas** prioritarias
3. **Haz click en botones** (Llamar, Email, Hecho)
4. **Gana puntos** y ve tu progreso
5. **Sistema sugiere** siguientes acciones

## 🚨 Troubleshooting

### "Error de autenticación Odoo"
- Verifica `ODOO_URL`, `ODOO_DB`, `ODOO_USER`, `ODOO_PASSWORD`
- API Key debe estar habilitada en Settings → Users

### "No hay tareas"
- Ejecuta sincronización manual (botón 🔄)
- Verifica que tengas clientes en Odoo
- Checa que exista historial de compras

### "Sincronización lenta"
- Normal si tienes 300+ clientes
- Puede tardar 1-2 minutos
- Se ejecuta en background, no bloquea el dashboard

## 📚 Estructura del Código

```
/libs
  ├─ odoo.js              → Conexión con Odoo
  ├─ rfm-analysis.js      → Análisis RFM
  └─ task-generator.js    → Generación de tareas

/models
  ├─ Customer.js
  ├─ Task.js
  ├─ EmailCampaign.js
  └─ OdooSync.js

/app/api/tracker
  ├─ /sync               → Sincronización
  ├─ /tasks              → CRUD de tareas
  └─ /stats              → Estadísticas

/app/dashboard
  └─ page.js             → UI del dashboard
```

## 🎯 Próximas Características

- [ ] Integración Brevo para email automático
- [ ] Webhook de Odoo para sync en tiempo real
- [ ] Predicción de churn con ML
- [ ] A/B testing de mensajes
- [ ] Exportar reportes a PDF
- [ ] Mobile app

## 💡 Tips

- **Sincroniza** cada noche a las 2 AM (cron job)
- **Personaliza** las reglas RFM según tu negocio
- **Ajusta** los umbrales de "dormido", "en riesgo", etc.
- **Revisa** las top clientes por valor
- **Usa** los textos sugeridos, pero personaliza según cliente

## 📞 Soporte

- Errores de sincronización: Revisa `OdooSync` collection
- Errores de tareas: Revisa `Task` collection
- Conectividad: Verifica las env vars

---

**¡Listo!** Tu copiloto de ventas está operativo. Ahora solo haz clicks y gana. 🚀

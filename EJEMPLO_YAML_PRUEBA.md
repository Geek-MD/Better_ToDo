# Ejemplo de YAML para Probar con v0.11.0

## 📋 Resumen

He creado una **tarjeta simple** que replica la funcionalidad de Local Todo de Home Assistant. Esta tarjeta se puede agregar manualmente al panel de Better ToDo para probar antes de implementarla automáticamente.

## 🎯 Lo que se hizo

1. **Creada la tarjeta**: `better-todo-simple-card.js`
   - Interfaz limpia y simple como Local Todo
   - Agregar tareas rápidamente
   - Secciones Active y Completed
   - Checkbox para marcar tareas completadas
   - Clic en tareas para editarlas

2. **Registrada como recurso**: Ya está en `const.py` para que se cargue automáticamente

3. **Documentación completa**: `YAML_TESTING_EXAMPLE.md` (en inglés)

## 🚀 Cómo Probar (Pasos Simples)

### Paso 1: Ir al Panel de Better ToDo
Ve a tu panel de Better ToDo en la barra lateral de Home Assistant

### Paso 2: Abrir el Editor
1. Clic en los **tres puntos (⋮)** arriba a la derecha
2. Selecciona **"Edit Dashboard"**
3. Clic en los **tres puntos** de nuevo
4. Selecciona **"Raw configuration editor"**

### Paso 3: Reemplazar el YAML

Busca esta parte:
```yaml
views:
  - title: Better ToDo
    path: tasks
    icon: mdi:format-list-checks
    cards: []
```

Y reemplázala con **una de las opciones** de abajo.

## 📝 Ejemplos de YAML

### Opción 1: Una Sola Lista (MÁS SIMPLE - Empieza con Esta)

```yaml
views:
  - title: Better ToDo
    path: tasks
    icon: mdi:format-list-checks
    cards:
      - type: custom:better-todo-simple-card
        entity: better_todo.tasks
```

### Opción 2: Tasks + Shopping List

```yaml
views:
  - title: Better ToDo
    path: tasks
    icon: mdi:format-list-checks
    cards:
      - type: custom:better-todo-simple-card
        entity: better_todo.tasks
        title: Tareas Personales
      
      - type: custom:better-todo-simple-card
        entity: better_todo.shopping_list
        title: Lista de Compras
```

### Opción 3: Todas las Listas con Iconos

```yaml
views:
  - title: Better ToDo
    path: tasks
    icon: mdi:format-list-checks
    cards:
      - type: custom:better-todo-simple-card
        entity: better_todo.tasks
        title: 📋 Tareas Personales
      
      - type: custom:better-todo-simple-card
        entity: better_todo.shopping_list
        title: 🛒 Lista de Compras
      
      - type: custom:better-todo-simple-card
        entity: better_todo.work_tasks
        title: 💼 Tareas de Trabajo
```

### Opción 4: Vista en Cuadrícula (2 Columnas)

```yaml
views:
  - title: Better ToDo
    path: tasks
    icon: mdi:format-list-checks
    cards:
      - type: grid
        square: false
        columns: 2
        cards:
          - type: custom:better-todo-simple-card
            entity: better_todo.tasks
            title: Tareas
          
          - type: custom:better-todo-simple-card
            entity: better_todo.shopping_list
            title: Compras
```

## ⚠️ Importante

### Nombres de Entidades
Tus entidades de Better ToDo serán algo como:
- `better_todo.tasks` (lista "Tasks")
- `better_todo.shopping_list` (lista "Shopping List")
- etc.

Para verificar los nombres exactos:
1. Ve a **Developer Tools** → **States**
2. Busca `better_todo`
3. Usa el nombre exacto (entity ID) en el YAML

### Si No Funciona
1. **Refresca el navegador** (Ctrl+F5 o Cmd+Shift+R)
2. **Verifica el nombre de la entidad** en Developer Tools → States
3. **Revisa los logs** de Home Assistant por errores
4. **Reinicia Home Assistant** si es necesario

## ✅ Qué Probar

Después de agregar el YAML:

1. ✅ La tarjeta se carga correctamente
2. ✅ Puedes agregar nuevas tareas
3. ✅ Puedes marcar tareas como completadas (checkbox)
4. ✅ Puedes hacer clic en tareas para editarlas
5. ✅ Las tareas se guardan después de refrescar la página
6. ✅ Funciona con múltiples listas

## 📸 Cómo Debe Verse

La tarjeta mostrará:
- **Encabezado**: Nombre de la lista
- **Campo de entrada**: Para agregar tareas rápido
- **Sección "Active"**: Tareas pendientes
- **Sección "Completed"**: Tareas completadas
- **Fechas de vencimiento**: Si las tareas las tienen
- **Descripciones**: Si las tareas las tienen

## 🎨 Características

### Agregar Tareas
- Escribe en el campo de texto
- Presiona Enter o clic en el botón +
- La tarea se agrega instantáneamente

### Marcar Completas
- Clic en el checkbox para marcar/desmarcar
- Las tareas completadas se mueven a la sección "Completed"
- Texto tachado en tareas completadas

### Editar Tareas
- Clic en cualquier parte de la tarea (excepto el checkbox)
- Se abre el diálogo de edición
- Puedes cambiar nombre, descripción, fecha, etc.

## 💡 Después de Probar

Si todo funciona bien, dame feedback sobre:
1. ¿Se carga la tarjeta correctamente?
2. ¿Las funciones básicas funcionan? (agregar, marcar, editar)
3. ¿El diseño se ve bien?
4. ¿Algo que cambiarías o mejorarías?

Luego podremos trabajar en la implementación automática para que no tengas que configurar el YAML manualmente.

---

**Archivos creados**:
- `custom_components/better_todo/www/better-todo-simple-card.js` - La tarjeta
- `YAML_TESTING_EXAMPLE.md` - Documentación completa (inglés)
- Este archivo - Guía rápida en español

**Versión**: 1.0.0  
**Compatible con**: Better ToDo v0.11.0+

# YAML para Probar - Ejemplo Más Simple

## Copia este YAML:

```yaml
views:
  - title: Better ToDo
    path: tasks
    icon: mdi:format-list-checks
    cards:
      - type: custom:better-todo-simple-card
        entity: better_todo.tasks
```

## Cómo usarlo:

1. Ve al panel **Better ToDo** en la barra lateral
2. Clic en **⋮** (tres puntos) → **"Edit Dashboard"**
3. Clic en **⋮** de nuevo → **"Raw configuration editor"**
4. **Pega el YAML** de arriba (reemplaza todo)
5. Clic en **"Save"**
6. ¡Listo! Refresca el navegador si no ves cambios

## Si tienes Shopping List también:

```yaml
views:
  - title: Better ToDo
    path: tasks
    icon: mdi:format-list-checks
    cards:
      - type: custom:better-todo-simple-card
        entity: better_todo.tasks
      
      - type: custom:better-todo-simple-card
        entity: better_todo.shopping_list
```

## Notas:

- El `entity` debe coincidir con tu lista de Better ToDo
- Verifica los nombres en: **Developer Tools** → **States** → busca `better_todo`
- Refresca el navegador después de guardar (Ctrl+F5)

---

Ver más ejemplos y detalles en: `EJEMPLO_YAML_PRUEBA.md`

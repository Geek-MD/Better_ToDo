// ── Home Assistant type stubs ─────────────────────────────────────────────
// ── Constants ─────────────────────────────────────────────────────────────
const STATUS_NEEDS_ACTION = "needs_action";
const STATUS_COMPLETED = "completed";
// ── Pure helper functions ─────────────────────────────────────────────────
export function getBetterTodoEntities(hass) {
    if (!hass?.states) {
        return [];
    }
    return Object.values(hass.states)
        .filter((stateObj) => {
        if (!stateObj?.entity_id?.startsWith("todo.")) {
            return false;
        }
        const entityEntry = hass.entities?.[stateObj.entity_id];
        return entityEntry?.platform === "better_todo";
    })
        .sort((left, right) => getEntityName(left).localeCompare(getEntityName(right), undefined, {
        sensitivity: "base",
    }));
}
export function getEntityName(stateObj) {
    return (stateObj?.attributes?.friendly_name ||
        stateObj?.name ||
        stateObj?.entity_id ||
        "Better To-do");
}
export function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
export function formatDue(value) {
    if (!value) {
        return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    const options = value.includes("T")
        ? {
            dateStyle: "medium",
            timeStyle: "short",
        }
        : {
            dateStyle: "medium",
        };
    try {
        return new Intl.DateTimeFormat(undefined, options).format(date);
    }
    catch (_err) {
        return value;
    }
}
export function isDateTimeValue(value) {
    return Boolean(value && value.includes("T"));
}
// ── Internal tag-line parser ──────────────────────────────────────────────
function parseTagLine(line) {
    const matches = Array.from(line.matchAll(/\[(?<tag>[a-z_]+):(?<value>[^\]]+)\]/g));
    if (!matches.length) {
        return null;
    }
    const consumed = line.replace(/\[(?<tag>[a-z_]+):(?<value>[^\]]+)\]/g, "").trim();
    if (consumed) {
        return null;
    }
    const parsed = {};
    for (const match of matches) {
        const tag = match.groups?.["tag"]?.trim()?.toLowerCase();
        const value = match.groups?.["value"]?.trim();
        if (tag && value) {
            parsed[tag] = value;
        }
    }
    return Object.keys(parsed).length ? parsed : null;
}
// ── Description parser ────────────────────────────────────────────────────
export function parseTaskDescription(description) {
    if (!description) {
        return {
            quantity: "",
            unit: "",
            category: "",
            repeat: "",
            notes: "",
        };
    }
    let quantity = "";
    let unit = "";
    let category = "";
    let repeat = "";
    const notes = [];
    let inMetadata = true;
    for (const line of String(description).split(/\r?\n/)) {
        if (inMetadata) {
            const parsed = parseTagLine(line.trim());
            if (parsed) {
                quantity || (quantity = parsed["quantity"] ?? "");
                unit || (unit = parsed["unit"] ?? "");
                category || (category = parsed["category"] ?? "");
                repeat || (repeat = parsed["repeat"] ?? "");
                continue;
            }
            if (!line.trim()) {
                inMetadata = false;
                continue;
            }
        }
        inMetadata = false;
        notes.push(line);
    }
    return {
        quantity,
        unit,
        category,
        repeat,
        notes: notes.join("\n").trim(),
    };
}
// ── Task details helper ───────────────────────────────────────────────────
export function getTaskDetails(stateObj, item) {
    const parsedDescription = parseTaskDescription(item?.description);
    const taskDetails = stateObj?.attributes?.task_details?.[item.uid] ?? {};
    const taskRecurrence = stateObj?.attributes?.task_recurrence?.[item.uid] ?? "";
    return {
        quantity: taskDetails.quantity ?? parsedDescription.quantity ?? "",
        unit: taskDetails.unit ?? parsedDescription.unit ?? "",
        category: taskDetails.category ?? parsedDescription.category ?? "",
        repeat: taskRecurrence || taskDetails.repeat || parsedDescription.repeat || "",
        notes: parsedDescription.notes || "",
    };
}
// ── Entity version stamp ──────────────────────────────────────────────────
export function computeEntityVersion(stateObj) {
    return `${stateObj?.entity_id ?? ""}:${stateObj?.last_updated ?? ""}:${stateObj?.state ?? ""}`;
}
// ── Todo payload builder ──────────────────────────────────────────────────
export function buildTodoPayload(fields, includeStatus = true) {
    const payload = {};
    if (fields.summary !== undefined) {
        payload.item = fields.summary;
    }
    if (fields.rename !== undefined) {
        payload.rename = fields.rename;
    }
    if (includeStatus && fields.status) {
        payload.status = fields.status;
    }
    if (fields.due) {
        if (fields.due.includes("T")) {
            payload.due_datetime = new Date(fields.due).toISOString();
        }
        else {
            payload.due_date = fields.due;
        }
    }
    else if (fields.clearDue) {
        payload.due_date = null;
    }
    return payload;
}
// ── Detail presence check ─────────────────────────────────────────────────
export function hasDetailValues(details) {
    return Boolean(details.quantity || details.unit || details.category || details.notes);
}
// ── API client ────────────────────────────────────────────────────────────
export class BetterTodoClient {
    constructor(host) {
        this.host = host;
    }
    get hass() {
        return this.host._hass;
    }
    get entityId() {
        return this.host._entityId;
    }
    get entityState() {
        return this.entityId ? this.hass?.states?.[this.entityId] : undefined;
    }
    async fetchItems() {
        if (!this.hass?.connection || !this.entityId) {
            return [];
        }
        const result = await this.hass.connection.sendMessagePromise({
            type: "todo/item/list",
            entity_id: this.entityId,
        });
        return Array.isArray(result?.items) ? result.items : [];
    }
    async addItem(fields) {
        const before = new Set((this.host._items || []).map((item) => item.uid));
        await this.hass.callService("todo", "add_item", buildTodoPayload(fields, false), { entity_id: this.entityId ?? undefined });
        await this.host.refreshItems();
        const created = this.host._items.find((item) => item.uid && !before.has(item.uid));
        if (created?.uid) {
            await this.updateMetadata(created.uid, fields);
            await this.host.refreshItems();
        }
    }
    async updateItem(uid, fields, previousItem) {
        const payload = buildTodoPayload({
            rename: fields.summary,
            status: fields.status,
            due: fields.due,
            clearDue: !fields.due && Boolean(previousItem?.due),
        }, true);
        payload["item"] = uid;
        await this.hass.callService("todo", "update_item", payload, {
            entity_id: this.entityId ?? undefined,
        });
        await this.updateMetadata(uid, fields);
        await this.host.refreshItems();
    }
    async updateMetadata(uid, fields) {
        const details = {
            item: uid,
            quantity: fields.quantity ?? null,
            unit: fields.unit ?? null,
            category: fields.category ?? null,
            notes: fields.notes ?? null,
        };
        if (hasDetailValues(fields)) {
            await this.hass.callService("better_todo", "set_task_details", details, {
                entity_id: this.entityId ?? undefined,
            });
        }
        else if (fields.clearDetails) {
            await this.hass.callService("better_todo", "set_task_details", {
                item: uid,
                quantity: null,
                unit: null,
                category: null,
                notes: null,
            }, { entity_id: this.entityId ?? undefined });
        }
        if (fields.repeat || fields.clearRepeat) {
            await this.hass.callService("better_todo", "set_task_recurrence", {
                item: uid,
                rrule: fields.repeat ?? "",
            }, { entity_id: this.entityId ?? undefined });
        }
    }
    async toggleItem(item, checked) {
        await this.hass.callService("todo", "update_item", {
            item: item.uid,
            status: checked ? STATUS_COMPLETED : STATUS_NEEDS_ACTION,
        }, { entity_id: this.entityId ?? undefined });
        await this.host.refreshItems();
    }
    async deleteItem(uid) {
        await this.hass.callService("todo", "remove_item", { item: [uid] }, { entity_id: this.entityId ?? undefined });
        await this.host.refreshItems();
    }
    async removeCompleted() {
        await this.hass.callService("todo", "remove_completed_items", {}, { entity_id: this.entityId ?? undefined });
        await this.host.refreshItems();
    }
    async moveItem(uid, previousUid) {
        await this.hass.connection.sendMessagePromise({
            type: "todo/item/move",
            entity_id: this.entityId,
            uid,
            ...(previousUid ? { previous_uid: previousUid } : {}),
        });
        await this.host.refreshItems();
    }
}
export { STATUS_COMPLETED, STATUS_NEEDS_ACTION };

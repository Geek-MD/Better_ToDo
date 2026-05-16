// ── Home Assistant type stubs ─────────────────────────────────────────────

export interface HassEntityAttributes {
  friendly_name?: string;
  task_details?: Record<string, StoredTaskDetails>;
  task_recurrence?: Record<string, string>;
  [key: string]: unknown;
}

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: HassEntityAttributes;
  last_updated: string;
  name?: string;
}

export interface HassEntityEntry {
  platform?: string;
  [key: string]: unknown;
}

export interface HassConnection {
  sendMessagePromise<T = unknown>(message: Record<string, unknown>): Promise<T>;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  entities?: Record<string, HassEntityEntry>;
  connection: HassConnection;
  callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
    target?: { entity_id?: string | string[] }
  ): Promise<void>;
}

// ── To-do item types ─────────────────────────────────────────────────────

export interface TodoItem {
  uid: string;
  summary: string;
  status: string;
  due?: string;
  description?: string;
}

export interface StoredTaskDetails {
  quantity?: string;
  unit?: string;
  category?: string;
  repeat?: string;
}

export interface ParsedDescription {
  quantity: string;
  unit: string;
  category: string;
  repeat: string;
  notes: string;
}

export interface ItemDetails extends ParsedDescription {}

export interface ItemFields {
  summary?: string;
  rename?: string;
  status?: string;
  due?: string;
  clearDue?: boolean;
  quantity?: string;
  unit?: string;
  category?: string;
  repeat?: string;
  notes?: string;
  clearDetails?: boolean;
  clearRepeat?: boolean;
}

export interface TodoPayload {
  item?: string;
  rename?: string;
  status?: string;
  due_datetime?: string;
  due_date?: string | null;
}

// ── Host interface expected by BetterTodoClient ───────────────────────────

export interface BetterTodoCardHost {
  _hass: HomeAssistant;
  _entityId: string | null;
  _items: TodoItem[];
  refreshItems(): Promise<void>;
}

// ── Constants ─────────────────────────────────────────────────────────────

const STATUS_NEEDS_ACTION = "needs_action";
const STATUS_COMPLETED = "completed";

// ── Pure helper functions ─────────────────────────────────────────────────

export function getBetterTodoEntities(hass: HomeAssistant | null): HassEntity[] {
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
    .sort((left, right) =>
      getEntityName(left).localeCompare(getEntityName(right), undefined, {
        sensitivity: "base",
      })
    );
}

export function getEntityName(stateObj: HassEntity | undefined): string {
  return (
    stateObj?.attributes?.friendly_name ||
    stateObj?.name ||
    stateObj?.entity_id ||
    "Better To-do"
  );
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatDue(value: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const options: Intl.DateTimeFormatOptions = value.includes("T")
    ? {
        dateStyle: "medium",
        timeStyle: "short",
      }
    : {
        dateStyle: "medium",
      };

  try {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  } catch (_err) {
    return value;
  }
}

export function isDateTimeValue(value: string | undefined): boolean {
  return Boolean(value && value.includes("T"));
}

// ── Internal tag-line parser ──────────────────────────────────────────────

function parseTagLine(line: string): Record<string, string> | null {
  const matches = Array.from(line.matchAll(/\[(?<tag>[a-z_]+):(?<value>[^\]]+)\]/g));
  if (!matches.length) {
    return null;
  }

  const consumed = line.replace(/\[(?<tag>[a-z_]+):(?<value>[^\]]+)\]/g, "").trim();
  if (consumed) {
    return null;
  }

  const parsed: Record<string, string> = {};
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

export function parseTaskDescription(description: string | undefined): ParsedDescription {
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
  const notes: string[] = [];
  let inMetadata = true;

  for (const line of String(description).split(/\r?\n/)) {
    if (inMetadata) {
      const parsed = parseTagLine(line.trim());
      if (parsed) {
        quantity ||= parsed["quantity"] ?? "";
        unit ||= parsed["unit"] ?? "";
        category ||= parsed["category"] ?? "";
        repeat ||= parsed["repeat"] ?? "";
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

export function getTaskDetails(
  stateObj: HassEntity | undefined,
  item: TodoItem
): ItemDetails {
  const parsedDescription = parseTaskDescription(item?.description);
  const taskDetails: StoredTaskDetails =
    stateObj?.attributes?.task_details?.[item.uid] ?? {};
  const taskRecurrence: string =
    stateObj?.attributes?.task_recurrence?.[item.uid] ?? "";

  return {
    quantity: taskDetails.quantity ?? parsedDescription.quantity ?? "",
    unit: taskDetails.unit ?? parsedDescription.unit ?? "",
    category: taskDetails.category ?? parsedDescription.category ?? "",
    repeat: taskRecurrence || taskDetails.repeat || parsedDescription.repeat || "",
    notes: parsedDescription.notes || "",
  };
}

// ── Entity version stamp ──────────────────────────────────────────────────

export function computeEntityVersion(stateObj: HassEntity | undefined): string {
  return `${stateObj?.entity_id ?? ""}:${stateObj?.last_updated ?? ""}:${stateObj?.state ?? ""}`;
}

// ── Todo payload builder ──────────────────────────────────────────────────

export function buildTodoPayload(
  fields: ItemFields,
  includeStatus = true
): TodoPayload {
  const payload: TodoPayload = {};

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
    } else {
      payload.due_date = fields.due;
    }
  } else if (fields.clearDue) {
    payload.due_date = null;
  }

  return payload;
}

// ── Detail presence check ─────────────────────────────────────────────────

export function hasDetailValues(details: ItemFields): boolean {
  return Boolean(
    details.quantity || details.unit || details.category || details.notes
  );
}

// ── API client ────────────────────────────────────────────────────────────

export class BetterTodoClient {
  private readonly host: BetterTodoCardHost;

  constructor(host: BetterTodoCardHost) {
    this.host = host;
  }

  private get hass(): HomeAssistant {
    return this.host._hass;
  }

  private get entityId(): string | null {
    return this.host._entityId;
  }

  private get entityState(): HassEntity | undefined {
    return this.entityId ? this.hass?.states?.[this.entityId] : undefined;
  }

  async fetchItems(): Promise<TodoItem[]> {
    if (!this.hass?.connection || !this.entityId) {
      return [];
    }

    const result = await this.hass.connection.sendMessagePromise<{
      items?: TodoItem[];
    }>({
      type: "todo/item/list",
      entity_id: this.entityId,
    });
    return Array.isArray(result?.items) ? result.items : [];
  }

  async addItem(fields: ItemFields): Promise<void> {
    const before = new Set((this.host._items || []).map((item) => item.uid));

    await this.hass.callService(
      "todo",
      "add_item",
      buildTodoPayload(fields, false) as Record<string, unknown>,
      { entity_id: this.entityId ?? undefined }
    );

    await this.host.refreshItems();
    const created = this.host._items.find(
      (item) => item.uid && !before.has(item.uid)
    );

    if (created?.uid) {
      await this.updateMetadata(created.uid, fields);
      await this.host.refreshItems();
    }
  }

  async updateItem(
    uid: string,
    fields: ItemFields,
    previousItem: TodoItem | undefined
  ): Promise<void> {
    const payload = buildTodoPayload(
      {
        rename: fields.summary,
        status: fields.status,
        due: fields.due,
        clearDue: !fields.due && Boolean(previousItem?.due),
      },
      true
    ) as Record<string, unknown>;
    payload["item"] = uid;

    await this.hass.callService("todo", "update_item", payload, {
      entity_id: this.entityId ?? undefined,
    });
    await this.updateMetadata(uid, fields);
    await this.host.refreshItems();
  }

  async updateMetadata(uid: string, fields: ItemFields): Promise<void> {
    const details: Record<string, unknown> = {
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
    } else if (fields.clearDetails) {
      await this.hass.callService(
        "better_todo",
        "set_task_details",
        {
          item: uid,
          quantity: null,
          unit: null,
          category: null,
          notes: null,
        },
        { entity_id: this.entityId ?? undefined }
      );
    }

    if (fields.repeat || fields.clearRepeat) {
      await this.hass.callService(
        "better_todo",
        "set_task_recurrence",
        {
          item: uid,
          rrule: fields.repeat ?? "",
        },
        { entity_id: this.entityId ?? undefined }
      );
    }
  }

  async toggleItem(item: TodoItem, checked: boolean): Promise<void> {
    await this.hass.callService(
      "todo",
      "update_item",
      {
        item: item.uid,
        status: checked ? STATUS_COMPLETED : STATUS_NEEDS_ACTION,
      },
      { entity_id: this.entityId ?? undefined }
    );
    await this.host.refreshItems();
  }

  async deleteItem(uid: string): Promise<void> {
    await this.hass.callService(
      "todo",
      "remove_item",
      { item: [uid] },
      { entity_id: this.entityId ?? undefined }
    );
    await this.host.refreshItems();
  }

  async removeCompleted(): Promise<void> {
    await this.hass.callService(
      "todo",
      "remove_completed_items",
      {},
      { entity_id: this.entityId ?? undefined }
    );
    await this.host.refreshItems();
  }

  async moveItem(uid: string, previousUid: string | null): Promise<void> {
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

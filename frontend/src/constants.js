export const ORDER_TYPE = "order";

export const TYPE_OPTIONS = [
  { value: ORDER_TYPE, label: "Приказы / Решения" },
  { value: "regulation", label: "Регламенты" },
  { value: "instruction", label: "Инструкции" },
  { value: "new_goods", label: "Новые товары" },
  { value: "other", label: "Другое" },
];

/** Типы внутри группы «Рабочие документы» (без приказов/решений). */
export const WORK_DOCUMENT_TYPE_OPTIONS = TYPE_OPTIONS.filter(
  (option) => option.value !== ORDER_TYPE
);

export const LEGAL_ENTITY_TYPE = "legal_entity";

export const LEGAL_ENTITY_OPTION = {
  value: LEGAL_ENTITY_TYPE,
  label: "Документы юрлиц",
};

export const ALL_TYPE_OPTIONS = [...TYPE_OPTIONS, LEGAL_ENTITY_OPTION];

export const SORT_OPTIONS = [
  { value: "new", label: "Сортировка: новые сначала" },
  { value: "old", label: "Сортировка: старые сначала" },
  { value: "title", label: "Сортировка: по названию" },
];

export function typeLabel(type) {
  return ALL_TYPE_OPTIONS.find((option) => option.value === type)?.label || type;
}

/** Приказы/решения хранятся без иерархии папок. */
export function typeAllowsFolders(type) {
  return type !== ORDER_TYPE;
}

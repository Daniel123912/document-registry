export const TYPE_OPTIONS = [
  { value: "order", label: "Приказы / Решения" },
  { value: "regulation", label: "Регламенты" },
  { value: "instruction", label: "Инструкции" },
  { value: "new_goods", label: "Новые товары" },
  { value: "other", label: "Другое" },
];

export const SORT_OPTIONS = [
  { value: "new", label: "Сортировка: новые сначала" },
  { value: "old", label: "Сортировка: старые сначала" },
  { value: "title", label: "Сортировка: по названию" },
];

export function typeLabel(type) {
  return TYPE_OPTIONS.find((option) => option.value === type)?.label || type;
}

export const TYPE_LABELS = {
  strength: 'Силовая',
  cardio: 'Кардио',
  crossfit: 'Кроссфит',
  stretching: 'Растяжка',
  other: 'Другое',
};

export const TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));

export function typeLabel(v) {
  return TYPE_LABELS[v] || v || '';
}

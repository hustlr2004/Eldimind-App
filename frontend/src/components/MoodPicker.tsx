const moodOptions = [
  { value: 1, emoji: '😢', label: 'Very Sad' },
  { value: 2, emoji: '😕', label: 'Sad' },
  { value: 3, emoji: '😐', label: 'Neutral' },
  { value: 4, emoji: '🙂', label: 'Happy' },
  { value: 5, emoji: '😄', label: 'Very Happy' },
];

export function MoodPicker({
  selected,
  onSelect,
}: {
  selected?: number | null;
  onSelect: (value: number) => void;
}) {
  return (
    <div className="mood-picker">
      {moodOptions.map((option) => (
        <button
          key={option.value}
          className={`mood-chip ${selected === option.value ? 'mood-chip-active' : ''}`}
          type="button"
          onClick={() => onSelect(option.value)}
        >
          <span>{option.emoji}</span>
          <small>{option.label}</small>
        </button>
      ))}
    </div>
  );
}

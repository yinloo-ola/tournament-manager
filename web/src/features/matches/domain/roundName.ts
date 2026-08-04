// Human-readable name for a knockout round given its size (the number of
// entries that round accommodates). The model stores only the numeric size
// (2 = Final, 4 = Semi-final, …); this maps it to a display name. Lives in
// the domain layer — not the component — because it encodes bracket
// knowledge documented in AI_AGENT_GUIDE.md ("Round stores the round size").
export function roundName(size: number): string {
  switch (size) {
    case 2:
      return 'Final'
    case 4:
      return 'Semi-finals'
    case 8:
      return 'Quarter-finals'
    case 16:
      return 'Round of 16'
    default:
      return size >= 32 ? `Round of ${size}` : `Round ${size}`
  }
}

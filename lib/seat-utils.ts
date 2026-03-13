/**
 * Compute a seat label from seat_number, section title, and columns_per_row.
 *
 * Example with section title "A" and columns_per_row = 4:
 *   seat 1  → A1-1
 *   seat 2  → A1-2
 *   seat 3  → A1-3
 *   seat 4  → A1-4
 *   seat 5  → A2-1
 *   seat 9  → A3-1
 */
export function getSeatLabel(
  seatNumber: number,
  sectionTitle: string,
  columnsPerRow: number,
): string {
  const cols = Math.max(columnsPerRow, 1)
  const row = Math.ceil(seatNumber / cols)
  const col = ((seatNumber - 1) % cols) + 1
  return `${sectionTitle}${row}-${col}`
}

/**
 * Compute row and column from a sequential seat number.
 */
export function getSeatRowCol(
  seatNumber: number,
  columnsPerRow: number,
): { row: number; col: number } {
  const cols = Math.max(columnsPerRow, 1)
  return {
    row: Math.ceil(seatNumber / cols),
    col: ((seatNumber - 1) % cols) + 1,
  }
}

/** Разбор координат «54.1839, 45.1849» (принимаем запятую как десятичный
 *  разделитель и любые разделители пары — пробел/запятая/точка с запятой).
 */

export function parseCoords(text: string): { lat: number; lon: number } | null {
  const parts = text.trim().split(/[\s,;]+/).filter(Boolean)
  if (parts.length !== 2) return null
  const lat = Number(parts[0].replace(',', '.'))
  const lon = Number(parts[1].replace(',', '.'))
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat, lon }
}

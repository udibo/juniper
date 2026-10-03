/** Orders literal sibling segments before parameters, preserving ties. */
export function compareRouteSegments(a: string, b: string): number {
  return Number(a.startsWith(":")) - Number(b.startsWith(":"));
}

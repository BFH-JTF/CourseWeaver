/** Badge-Klassen Hart/Weich — eine Stelle für die Farblogik (Import-Schema-Overlays). */
export function badgeClasses(hard: boolean): string {
  return hard ? 'badge badge-hard' : 'badge badge-soft'
}

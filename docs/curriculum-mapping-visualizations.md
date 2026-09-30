# Curriculum Mapping — Traceability, Abdeckung, Lücken

**Status:** Entwurf zur Umsetzung
**Kontext:** Drei zusammenhängende Darstellungen für CourseWeaver, die alle auf derselben Verknüpfung Modul ↔ Kompetenz beruhen: (1) eine Matrix für Traceability, (2) eine Kennzahlen-Ansicht für die Abdeckung, (3) eine gefilterte Sicht für Lücken. Es sind **keine drei getrennten Features**, sondern drei Ansichten auf dieselben Daten — das sollte die Implementierung entsprechend spiegeln (eine Datenquelle, mehrere Renderings).

---

## 1. Benötigte Datengrundlage

Aktuell gibt es keine explizite Verknüpfung "dieses Modul deckt diese Kompetenz in dieser Tiefe ab". Das ist die Voraussetzung für alle drei Darstellungen und sollte zuerst gebaut werden.

```ts
type CoverageLevel = 'introduced' | 'reinforced' | 'assessed'

interface ModuleCompetencyLink {
  id: string
  moduleId: string
  competencyId: string
  level: CoverageLevel
  proofOfCompetencyId?: string   // gesetzt, wenn level === 'assessed'
}
```

**Wichtiger Hinweis zur Befüllung:** `level: 'assessed'` sollte nicht manuell gepflegt werden müssen — wenn zu einem Modul bereits ein `ProofOfCompetency`-Eintrag existiert, der dieselbe `competencyId` referenziert, kann der Link automatisch auf `assessed` gesetzt werden. Nur `introduced`/`reinforced` müssen von den Programmverantwortlichen manuell zugeordnet werden (z. B. beim Anlegen/Bearbeiten eines Moduls: "Welche Kompetenzen werden hier eingeführt, welche vertieft?"). Das reduziert den Pflegeaufwand erheblich und verhindert, dass die beiden Datenquellen (Link-Tabelle und ProofOfCompetency) auseinanderlaufen.

**Offene Frage ans Team:** Lässt sich `introduced`/`reinforced` aus der bestehenden `LearningCycle`-Struktur (Stufen 1–6) ableiten, statt es separat zu pflegen? Falls ja, spart das eine ganze Pflege-UI.

---

## 2. Darstellung 1 — Modul-Kompetenz-Matrix (Traceability)

**Zweck:** Eine Zeile lesen → "was deckt dieses Modul ab". Eine Spalte lesen → "wo wird diese Kompetenz vermittelt/geprüft".

### Aufbau
- Zeilen = Module, Spalten = Kompetenzen, gruppiert nach `CompetencyFramework`.
- **Zwingend ein Scoping-Filter oberhalb der Matrix** ("Programm" / "Curriculum-Version" auswählen) — eine Matrix über alle Module und alle Kompetenzen von BFH gleichzeitig ist weder performant noch lesbar. Ohne diesen Filter ist die Darstellung für den produktiven Einsatz nicht brauchbar.
- Zellinhalt: **kein kontinuierlicher Score wie im Matching-Prototyp**, sondern die drei diskreten Stufen aus `CoverageLevel`. Farblich als **ordinale** Skala behandeln (eine Hue, drei Helligkeitsstufen: hell = introduced, mittel = reinforced, dunkel = assessed) — nicht als drei beliebige Kategorie-Farben, weil die Reihenfolge (introduced < reinforced < assessed) tatsächlich eine Bedeutung trägt.
- Leere Zelle = keine Verknüpfung vorhanden = neutrale Oberflächenfarbe, keine Sonderfarbe.
- **Legende ist Pflicht**, da drei bedeutungstragende Stufen nicht allein über Farbintensität unterscheidbar sein dürfen (kleine Text-Legende: hell/mittel/dunkel + Label, nicht nur ein Farbverlauf).

### Interaktion
- Hover/Focus pro Zelle: Tooltip mit Modulname, Kompetenzname, Stufe — bei `assessed` zusätzlich ein Link/Verweis auf den konkreten `ProofOfCompetency`-Eintrag.
- Klick auf eine Zelle: optional Sprung zur Modul- bzw. Kompetenz-Detailseite (kein Blocker für die erste Version).
- **Tabellen-Fallback**: dieselben Daten als einfache Liste (Modul | Kompetenz | Stufe) hinter einem Umschalter — Pflicht aus Zugänglichkeitsgründen, nicht optional.

---

## 3. Darstellung 2 — Abdeckungs-Kennzahlen pro Kompetenz

**Zweck:** Nicht mehr "wer deckt was ab", sondern "wie gut ist jede Kompetenz insgesamt abgedeckt" — eine Aggregation der Matrix aus Abschnitt 2, keine neue Datenquelle.

### Berechnung (rein abgeleitet, kein eigener Speicher nötig)
```ts
interface CompetencyCoverage {
  competencyId: string
  introducedCount: number
  reinforcedCount: number
  assessedCount: number
}
// = Anzahl ModuleCompetencyLink-Einträge je Kompetenz, gruppiert nach level
```

### Darstellung
- Eine Zeile pro Kompetenz, ein kleiner horizontaler gestapelter Balken (introduced/reinforced/assessed-Segmente, gleiche drei Farbstufen wie in der Matrix — **Farbcodierung zwischen beiden Darstellungen konsistent halten**, sonst wirkt es wie zwei unabhängige Systeme).
- **Sortierung ist der eigentliche Nutzen dieser Ansicht**: aufsteigend nach Gesamtabdeckung (oder nach "noch nie geprüft"), sodass die am schwächsten abgedeckten Kompetenzen automatisch oben stehen — das ist bereits die Vorstufe zu Abschnitt 4.
- Diese Ansicht kann als kompaktes Panel direkt oberhalb oder neben der Matrix aus Abschnitt 2 leben, muss keine eigene Seite sein.

---

## 4. Darstellung 3 — Lücken-Ansicht

**Zweck:** Explizit die Frage "wo fehlt noch etwas" beantworten, ohne dass jemand die ganze Matrix oder Kennzahlenliste selbst durchsuchen muss.

### Logik (wieder rein abgeleitet)
```ts
function gapStatus(c: CompetencyCoverage): 'critical' | 'warning' | null {
  const total = c.introducedCount + c.reinforcedCount + c.assessedCount
  if (total === 0) return 'critical'            // nirgends abgedeckt
  if (c.assessedCount === 0) return 'warning'    // abgedeckt, aber nie geprüft
  return null                                     // keine Lücke
}
```

### Darstellung
- Kein neues Chart — ein **Filter-Umschalter** ("Nur Lücken anzeigen") auf der Kennzahlen-Ansicht aus Abschnitt 3, der auf `gapStatus(c) !== null` filtert.
- Jede verbleibende Zeile bekommt einen Status-Badge: `critical` (rot, Icon + Label "Keine Abdeckung") bzw. `warning` (gelb/orange, Icon + Label "Nie geprüft") — **nie Farbe allein**, immer mit Icon und Text, da Status-Bedeutung nicht über Farbwahrnehmung geraten werden darf.
- Empfehlenswert als Ergänzung (nicht Blocker für v1): Export dieser gefilterten Liste als CSV/PDF — das ist typischerweise genau die Liste, die für Akkreditierungsgespräche gebraucht wird.

---

## 5. Gemeinsame technische Hinweise für alle drei Darstellungen

- **Eine Datenquelle, drei Renderings.** Darstellung 2 und 3 sind Aggregation/Filter auf denselben `ModuleCompetencyLink`-Daten wie Darstellung 1 — nicht separat pflegen oder cachen, sonst laufen die Ansichten irgendwann auseinander.
- **Farbcodierung konsistent halten.** Die drei Stufen introduced/reinforced/assessed nutzen in allen drei Darstellungen dieselbe Farbskala. Die Status-Farben (kritisch/warnend) in Darstellung 3 sind bewusst eine *andere*, davon klar unterscheidbare Farbfamilie — sie dürfen nicht mit den Abdeckungsstufen verwechselt werden.
- **Scoping-Filter (Programm/Curriculum-Version) zuerst bauen**, bevor die Matrix selbst gebaut wird — ohne ihn ist Darstellung 1 bei realer Datenmenge nicht nutzbar.
- **Tabellen-Fallback ist für alle drei Pflicht**, nicht nur für die Matrix — auch die Kennzahlen- und Lücken-Ansicht müssen als einfache Liste/Tabelle einsehbar sein.
- Reihenfolge der Umsetzung: Abschnitt 2 (Basis-Datenmodell) → Darstellung 1 (Matrix) → Darstellung 2 (Kennzahlen, reine Aggregation auf 1) → Darstellung 3 (Filter auf 2). Darstellung 3 ohne 1+2 vorher zu bauen ist nicht sinnvoll möglich.

---

## 6. Offene Fragen fürs Team

- Lässt sich `introduced`/`reinforced` aus `LearningCycle` ableiten, oder braucht es eine eigene Pflege-UI?
- Soll die Matrix pro Programm oder pro Degree gescoped werden (Frage betrifft auch den Umfang eines "vernünftigen" ersten Scoping-Filters)?
- Wird der CSV/PDF-Export der Lücken-Liste für die nächste Akkreditierungsrunde tatsächlich gebraucht, oder reicht die Ansicht in der App?

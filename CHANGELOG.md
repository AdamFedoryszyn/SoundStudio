# Changelog

## [10.4.0] – 2026-10-15

### Hinzugefügt
- Piano-Roll: Strg/Cmd + Linksklick ziehen startet eine Auswahlrahmen-Auswahl, auch wenn der Zug auf einer bestehenden Note beginnt.
- Auswahlrahmen wählt mehrere Noten über Tonhöhen und Zeitpositionen aus; die Auswahl kann anschließend gemeinsam verschoben, gelöscht, kopiert, eingefügt und dupliziert werden.
- Strg/Cmd-Klick ohne Ziehen toggelt eine Note in der aktuellen Auswahl.
- Sample-Kanäle besitzen neben dem Dateiimport eine Mikrofonaufnahme. Aufnahmen können gestartet, gestoppt, als Vorschau abgespielt, benannt und direkt in den gewählten Sample-Kanal übernommen werden.
- Aufgenommene Samples werden in IndexedDB gespeichert und stehen nach dem Neustart sowie beim Step-Sequencing zur Verfügung.
- Electron gewährt Medienberechtigung nur für die lokale App-Oberfläche und nur für Audio-only-Anfragen; `contextIsolation: true` und `nodeIntegration: false` bleiben erhalten.

### Geändert
- Version auf 10.4.0 erhöht; Projektformat bleibt unverändert, da Noten- und Sample-Daten das bestehende Modell verwenden.
- Sample-Dateiimport und Mikrofonaufnahme nutzen denselben Speicherpfad, einschließlich IndexedDB, Mixer/Rack-Aktualisierung und Auto-Save.

### Hinweise
- Das Betriebssystem kann beim ersten Zugriff nach Mikrofonberechtigung fragen.
- Mikrofonaufnahme setzt ein verfügbares Eingabegerät und MediaRecorder-Unterstützung voraus.


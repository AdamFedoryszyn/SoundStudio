<<<<<<< HEAD
# FL Clone v10.4.0

## Neue Funktionen

### Piano-Roll: Auswahlrahmen
- Piano-Roll über das 🎹-Symbol eines Melodiekanals öffnen.
- `Strg` (Windows/Linux) oder `Cmd` (macOS) gedrückt halten und mit linker Maustaste ein Rechteck ziehen.
- Alle Noten, die den Rahmen schneiden, werden gemeinsam ausgewählt.
- Danach Noten ziehen, `Entf` drücken oder `Strg/Cmd+C` und `Strg/Cmd+V` verwenden.
- `Strg/Cmd`-Klick ohne Ziehen schaltet eine Note in der Auswahl um.
- Die bisherige Bedienung bleibt erhalten: einfacher Klick auf eine freie Zelle erstellt eine Note; Ziehen auf freier Fläche wählt weiterhin per Rahmen aus.

### Mikrofonaufnahme für Sample-Kanäle
- Im Rack bei Sample 1–4 auf `🎙` klicken.
- `Aufnahme starten` drücken und den Zugriff auf das Mikrofon erlauben.
- `Aufnahme stoppen` drücken, die Aufnahme optional anhören und einen Namen vergeben.
- `Sample in Kanal übernehmen` speichern die Aufnahme im ausgewählten Sample-Kanal.
- Das Sample wird in IndexedDB gespeichert, im Rack und Mixer angezeigt und kann anschließend über die Steps getriggert werden.

## Starten / Packen

Voraussetzung: Node.js installiert.

```bash
npm install
npm start
```

Windows-Installer erstellen:

```bash
npm run dist:win
```

Mikrofonaufnahme benötigt ein verfügbares Audio-Eingabegerät. Beim ersten Zugriff kann die Betriebssystemberechtigung erforderlich sein.

## Technische Prüfung

Die JavaScript-Dateien wurden mit `node --check` geprüft und `package.json` wurde als gültiges JSON validiert. Ein tatsächlicher Electron-/Mikrofonlaufzeittest wurde in dieser Umgebung nicht durchgeführt, da Electron/Playwright hier nicht installiert sind.
=======
# SoundStudio
An Electron-based digital audio workstation (DAW) featuring a step sequencer, piano roll, song arrangement, automation, modular effects, sample management, microphone recording, and WAV export. Built with JavaScript and the Web Audio API.
>>>>>>> ce4f8aa652463439cb4e699ed2e9b7ba24ed31df

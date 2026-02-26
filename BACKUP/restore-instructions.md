# Instrukcja odtworzenia kopii zapasowej

1. Zweryfikuj sumy kontrolne:
   ```bash
   cd <ABSOLUTE_REPO_PATH>/BACKUP
   sha256sum -c checksums.txt
   ```
2. Rozpakuj archiwum:
   ```bash
   unzip stillontime-pre-cleanup-<timestamp>.zip
   # lub
   tar -xzf stillontime-pre-cleanup-<timestamp>.tar.gz
   ```
3. Przywróć katalog `.git` i pliki robocze:
   ```bash
   rsync -a stillontime-pre-cleanup-<timestamp>/ <ABSOLUTE_REPO_PATH>/
   ```
4. Reset do tagu bezpieczeństwa:
   ```bash
   cd <ABSOLUTE_REPO_PATH>
   git checkout pre-cleanup-<timestamp>
   ```

## Kryteria sukcesu
- Sumy SHA256 zgadzają się z `checksums.txt`.
- Po checkout repozytorium przechodzi `scripts/smoke-test.sh --dry-run`.

## Znane ryzyka
- **Nadpisanie lokalnych zmian** – wykonaj własny backup przed przywróceniem.
- **Brak archiwum** – weryfikuj log `logs/backup.log` wygenerowany przez skrypt.

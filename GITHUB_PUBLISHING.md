# Publikacja Wizard Investigation Board na GitHubie

## Repozytorium

1. Rozpakuj lub skopiuj cały folder `wizard-investigation-board` do stałego katalogu roboczego poza `Data/modules` Foundry.
2. Uruchom GitHub Desktop i wybierz `File → New repository`.
3. Ustaw nazwę `wizard-investigation-board`, wskaż katalog nadrzędny i pozostaw `Git ignore: None` oraz `License: None`, ponieważ potrzebne pliki są już w projekcie.
4. Jeżeli GitHub Desktop utworzy pusty folder repozytorium, skopiuj do niego zawartość przygotowanego folderu. `module.json` ma znajdować się w katalogu głównym repozytorium.
5. Wykonaj commit `Public release candidate v0.14.0`.
6. Kliknij `Publish repository` i odznacz `Keep this code private`, aby repozytorium było publiczne.

## Wydanie testowe

1. W repozytorium na GitHubie wybierz `Releases → Draft a new release`.
2. Utwórz tag `v0.14.0` dla głównej gałęzi.
3. Ustaw tytuł `Wizard Investigation Board v0.14.0 RC`.
4. Dodaj najważniejsze informacje z `CHANGELOG.md` i zaznacz `This is a pre-release`.
5. Dołącz plik `wizard-investigation-board-v0.14.0.zip` jako plik wydania.
6. Opublikuj wydanie.

## Po utworzeniu repozytorium

Uzupełnij w `module.json` pola `url`, `manifest` i `download` rzeczywistymi adresami repozytorium oraz plików GitHub Release. Nie używaj adresów przykładowych ani prywatnego repozytorium, ponieważ Foundry musi pobrać manifest i ZIP bez logowania.

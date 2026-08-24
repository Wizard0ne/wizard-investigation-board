# Wizard Investigation Board v0.14.0 RC

Publiczny kandydat do wydania dla Foundry Virtual Tabletop V14.

W v0.1.2 przyciski zaczęły korzystać z natywnego systemu `actions` klasy `ApplicationV2`, dzięki czemu nie zależą od ręcznego podpinania zdarzeń po renderze. Zmieniono też tworzenie sprawy na klasę dokumentu z `CONFIG.JournalEntry.documentClass`.

W v0.1.3 plik skryptu otrzymał nową nazwę `board-v013.js`. Wymusza to pobranie aktualnego kodu przez klienta Foundry i omija pamięć podręczną, w której pozostawał wcześniejszy szkielet z metodą `#newCase`.

W v0.1.4 dodano przycisk **Dodaj dokument** z listą Actorów, Journali, Itemów i Scen oraz wyborem widoczności. Drag & drop przyjmuje teraz dane `text/plain`, `application/json` i `text`.

W v0.1.5 naprawiono zapadanie się planszy do cienkiego paska w niektórych motywach/systemach Foundry. Plansza ma gwarantowaną wysokość, nowe karty są pozycjonowane względem bezpiecznego rozmiaru obszaru, a stopka pokazuje liczbę widocznych kart.

W v0.2.0 dodano własne notatki, opisane połączenia między dwiema kartami oraz przyciski otwierające powiązane dokumenty Foundry bezpośrednio z karty.

W v0.2.1 dodano edycję i usuwanie pojedynczych kart. Usunięcie karty usuwa również wszystkie jej połączenia. Kliknięcie linii lub opisu relacji otwiera edycję opisu i widoczności oraz pozwala usunąć samo połączenie.

W v0.2.2 dodano wybór koloru przy tworzeniu i edycji każdego połączenia. Starsze relacje bez zapisanego koloru otrzymują automatycznie kolor domyślny.

W v0.2.3 naprawiono układ kafelków: przyciski akcji są ułożone w osobnym poziomym pasku na dole karty i nie wychodzą już poza jej obramowanie. Obliczenia połączeń i dopasowania uwzględniają nową wysokość kart.

W v0.2.4 odizolowano style kart od reguł motywu i systemu Foundry. Kluczowe wymiary, tło, kolory oraz poziomy pasek akcji mają selektory ograniczone do okna modułu i nie mogą zostać zastąpione przez ogólne style systemu gry.

W v0.2.5 przywrócono dokładny układ kart z działającej wersji 0.2.1. Kolor połączenia jest przekazywany przez natywne atrybuty SVG `stroke` i `fill`, a nie przez style inline, dzięki czemu nie wpływa na renderowanie kafelków.

W v0.2.6 arkusz stylów otrzymał nową nazwę `board-v026.css`. Wymusza to pobranie poprawnego CSS i omija pamięć podręczną przeglądarki, która mogła nadal podawać zepsute style nawet po ponownym zainstalowaniu starszej wersji modułu.

W v0.3.0 dodano statusy kart (nieustalone, podejrzenie, potwierdzone, fałszywy trop, rozwiązane), typy relacji (fakt, podejrzenie, fałszywa teoria) oraz szybkie ujawnianie tajnych kart graczom. Typ relacji wpływa na wzór linii, a status karty na jej oznaczenie i obramowanie.

W v0.3.1 dodano wyszukiwanie kart z automatycznym centrowaniem i podświetleniem, kopiowanie pojedynczej karty do wybranej sprawy prawym przyciskiem myszy oraz eksport/import kompletnej sprawy w formacie JSON.

W v0.4.0 dodano prawdziwy panel graczy. Klient gracza otrzymuje przez socket wyłącznie publiczne karty i relacje, bez tajnych danych sprawy. Panel gracza jest tylko do odczytu, obsługuje wyszukiwanie, dopasowanie, zoom, przesuwanie widoku i otwieranie dokumentów, do których gracz ma uprawnienia.

W v0.4.1 dodano widoczność całej sprawy (`Dla graczy` / `Tylko MG`) oraz ustawienia pozwalające zmienić ją później. Gracze mogą tworzyć własne publiczne sprawy, dodawać w nich notatki, przesuwać i edytować karty oraz budować połączenia. Zapis jest wykonywany przez jeden aktywny klient MG i walidowany przed umieszczeniem w JournalEntry.

W v0.4.2 usunięto zależność listy spraw i spraw graczy od niestandardowych wiadomości socketowych. MG publikuje wyłącznie oczyszczone dane publiczne we własnej fladze `User`, a gracze zapisują własne sprawy we własnych dokumentach `User`. Foundry synchronizuje te dokumenty swoim podstawowym mechanizmem, dzięki czemu sprawy działają także bez aktywnego kanału socketowego modułu.

W v0.4.3 ustawiono `Dla graczy` jako domyślną widoczność nowych kart, notatek i połączeń. Dodano również lokalną historię 20 operacji oraz przycisk cofania zmian treści sprawy; nawigacja planszy, zoom, dopasowanie i wyszukiwanie nie zajmują miejsca w historii.

W v0.5.0 dodano grafiki kart: portrety Actorów, obrazy Itemów, miniatury lub tła Scen oraz obrazy z odpowiednich stron Journala. Przycisk z ikoną obrazu włącza lub wyłącza grafiki lokalnie dla konkretnego klienta bez zmiany danych sprawy.

W v0.6.0 dodano filtry typu i statusu, wielokrotne zaznaczanie kart przez `Ctrl`/`Cmd + klik`, grupowe przesuwanie oraz automatyczny układ widocznych kart. Automatyczne rozmieszczenie jest zapisywane jako jedna operacja i można je cofnąć.

W v0.6.1 dodano numer wersji modułu w pasku narzędzi oraz stopce panelu. Numer jest odczytywany bezpośrednio z aktywnego manifestu `module.json`.

W v0.7.0 dodano kolorowe grupy kart i obszary na planszy, filtrowanie według grupy oraz operacje zbiorcze na zaznaczonych kartach: status, widoczność, przypisanie do grupy i usuwanie.

W v0.8.0 utrwalono przetestowany zestaw funkcji grup i operacji zbiorczych jako stabilne wydanie oraz zmieniono nazwy zasobów, aby wymusić ich ponowne wczytanie przez Foundry.

W v0.9.0 rozbudowano linie połączeń o strzałki kierunku, linie proste i zakrzywione, trzy style kreski oraz cztery grubości. Wiele relacji pomiędzy tą samą parą kart jest automatycznie rozdzielane na osobne łuki, a końce linii dochodzą do krawędzi kart zamiast znikać pod kafelkami. Starsze połączenia zachowują zgodny wygląd i można je edytować nowymi opcjami.

W v0.10.0 dodano oś czasu sprawy. Każda karta może otrzymać datę i godzinę wydarzenia oraz oznaczenie daty przybliżonej. Widok chronologiczny obsługuje zakres dat, respektuje aktywne filtry i widoczność dla graczy, a przycisk przy wydarzeniu przenosi bezpośrednio do odpowiedniego kafelka na planszy.

W v0.11.0 dodano minimapę widocznych kart i kolorowych grup. Ramka pokazuje aktualnie oglądany obszar, aktualizuje się podczas przesuwania i zmiany zoomu, a kliknięcie minimapy przenosi planszę we wskazane miejsce. Dodano także przycisk szybkiego powrotu do powiększenia 100% z zachowaniem środka bieżącego widoku.

W v0.12.0 dodano uprawnienia osobno dla podglądu i edycji każdej sprawy MG. Gracze z prawem edycji mogą współtworzyć publiczną część planszy, a ich zapis jest walidowany i łączony z pełnymi danymi przez aktywnego MG bez naruszania tajnych kart i relacji. Oczekujące zmiany pozostają zapisane również wtedy, gdy MG jest chwilowo offline. Nowe karty i notatki otrzymują informację o autorze, widoczną na planszy i osi czasu.

W v0.13.0 wprowadzono schemat danych v2 i jednorazową migrację starszych spraw. Przed zmianą tworzona jest kopia migracyjna, a uszkodzone identyfikatory, pozycje, grupy, relacje, kolory i pozostałe pola są walidowane oraz normalizowane. MG otrzymał ręczny przycisk kontroli i naprawy aktywnej sprawy. Import obsługuje zarówno starszy format v1, jak i v2. Dopracowano także układ osi czasu i nawigacji dla węższych okien.

W v0.13.1 dodano ochronę współdzielonych spraw przed konfliktami. Każda zmiana treści posiada numer rewizji i trafia do trwałej kolejki gracza. MG akceptuje zapis wyłącznie wtedy, gdy bazuje on na aktualnej wersji sprawy; nieaktualna zmiana jest odrzucana z czytelnym komunikatem, a klient pobiera najnowsze dane. Zmiany zoomu i położenia widoku nie zwiększają rewizji i nie wywołują fałszywych konfliktów.

W v0.14.0 dodano bezpieczne przywracanie kopii migracyjnej. Przed odzyskaniem moduł zapisuje także bieżący stan sprawy jako kopię sprzed przywrócenia. Wydanie zawiera dokumentację dla publicznych testerów, checklistę regresji i szablon zgłoszenia błędu na GitHubie.

## Naprawione

- **Nowa sprawa** otwiera dialog, tworzy `JournalEntry` i od razu wybiera go jako aktywny.
- Lista spraw jest budowana ponownie przy każdym otwarciu panelu oraz po utworzeniu, zmianie i usunięciu odpowiedniego JournalEntry.
- Dokument można dodać przyciskiem z listy świata albo przez drag & drop. Obsługiwane są `Actor`, `JournalEntry`, `Item` i `Scene`.
- Karty można przeciągać; ich pozycje są zapisywane w flagach sprawy.
- **Widok graczy** filtruje karty i relacje z `visibility: "gm"` i natychmiast renderuje planszę ponownie.
- **Dopasuj** obejmuje bounding box wszystkich aktualnie widocznych kart, z marginesem i ograniczonym zoomem.
- Przyciski zależne od sprawy są wyłączone bez aktywnej sprawy, a operacje zgłaszają czytelne komunikaty.
- Planszę można przesuwać przez `Shift + przeciągnięcie`, powiększać kółkiem i otwierać powiązany dokument dwuklikiem.

## Instalacja

### Instalacja z manifestu

W instalatorze modułów Foundry wybierz **Install Module**, wklej poniższy adres w polu manifestu i zatwierdź:

`https://raw.githubusercontent.com/Wizard0ne/wizard-investigation-board/main/module.json`

### Instalacja ręczna

1. Pobierz ZIP z GitHub Releases.
2. Rozpakuj folder `wizard-investigation-board` do `FoundryVTT/Data/modules/`.
3. Uruchom ponownie Foundry.
4. Włącz moduł w **Manage Modules**.
5. Jako MG wybierz narzędzia Tokenów i kliknij ikonę diagramu.

## Publiczne testy

To wydanie ma status Release Candidate. Testy najlepiej wykonywać na kopii świata. Szczegółowa lista scenariuszy znajduje się w `TESTING.md`. Przy zgłaszaniu problemu podaj wersję Foundry, system gry, rolę użytkownika oraz kroki prowadzące do błędu. Nie publikuj eksportów spraw zawierających dane kampanii bez ich wcześniejszego oczyszczenia.

## Licencja

Kod, style, szablony i dokumentacja Wizard Investigation Board są udostępnione na licencji MIT. Copyright © 2026 Wizard One. Pełne warunki znajdują się w pliku `LICENSE`.

## Dane

Każda sprawa jest zwykłym `JournalEntry`. Dane planszy znajdują się w:

`flags.wizard-investigation-board.board`

Nowe karty upuszczone w zwykłym widoku MG mają `visibility: "gm"`. Karty upuszczone podczas aktywnego **Widoku graczy** mają `visibility: "players"`.

## Status

v0.14.0 jest publicznym kandydatem do stabilnego v1.0.0. Manifest korzysta z głównej gałęzi repozytorium, a instalacyjny ZIP z załącznika wydania GitHub.

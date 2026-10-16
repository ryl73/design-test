# Design QA — Technical Design Document

Версия: 2.0 · 16 октября 2026 · Заменяет серверный TDD 1.0.

Спецификация продукта: [PRD.md](PRD.md). План: [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md). При расхождении поведения приоритет имеет PRD2.

## 1. Архитектура и миграция

Статическая React/Vite/TypeScript/MUI SPA. Оба изображения и замечания существуют только в памяти вкладки. Пользователь вручную выбирает скриншот сайта и экспорт Figma. Нет автоматического захвата, API Figma, backend, БД, MinIO, участников, cookie, URL стендов, shared projects и очередей. Никаких сетевых запросов после загрузки приложения для обработки изображений.

Сохранить проверенный React/MUI toolchain и оформление, заменить корневой экран на инструмент сравнения. Удалить из активного репозитория apps/api, apps/capture, packages/contracts, Prisma, серверные тесты, server-specific scripts и Compose DB/storage. Старый код и спецификации восстановимы из Git; старые Docker volumes и пользовательские данные не удалять. Старый IMPLEMENTATION_LOG сохранить как историю, явно пометив смену требований.

Root npm workspaces оставляет apps/web. Команды dev/start/build/typecheck/lint/test:unit/test:integration/test:e2e не требуют env/серверных секретов. test:integration запускает реальные проверки взаимодействия браузерных модулей/файлов, а не фиктивный exit. Если проверка интеграции реализована Playwright, использовать отдельный проект/tag без дублирования всего E2E. Пустые suites не считаются успехом.

Для локального запуска npm ci и npm run dev. Для локального просмотра production npm run build и npm run preview. Статический web-сервер раздаёт только dist. Опциональный Docker содержит только web/nginx и используется исключительно как удобный локальный preview на127.0.0.1:58080; он не обязателен. Nginx не имеет upstream API, runtime env или сетевых зависимостей.

## 2. Структура

```text
apps/web/src/
  app/App.tsx                 # провайдер темы и единственная страница
  app/theme.ts
  pages/compare/
    index.ts                  # публичный вход страницы
    model/
      image-file.ts           # сигнатуры, лимиты, decode, URL lifecycle
      geometry.ts             # camera, coordinate transforms, zoom, fit, rect
      annotations.ts          # note validation and report data
      use-comparison.ts       # пара, async generations, notes, replacement state
    ui/
      ComparePage.tsx
      ImagePicker.tsx
      ComparisonCanvas.tsx
      CompareToolbar.tsx
      NotesPanel.tsx
    *.test.ts / model/*.test.ts
apps/web/tests/               # дополнительные реальные unit/integration checks
 tests/e2e/                  # production browser acceptance + file fixtures
infra/Dockerfile.web          # необязательный static preview
infra/web/default.conf
infra/compose.yml             # только web
README.md
```

Минимальные app/pages слои, без entities/features/widgets и generic state framework. Одна страница владеет бизнес-логикой сравнения. React state/reducer достаточно; TanStack Query, router и contracts package больше не нужны. Сохранить точные версии совместимых существующих зависимостей; пересобрать lockfile npm, убрать server-only overrides/dependencies.

## 3. Модель в памяти и интерфейсы

```ts
type Size = { width: number; height: number };
type Point = { x: number; y: number };
type Rect = Point & Size;
type Camera = { center: Point; zoom: number }; // zoom .1–4

type ImageHeader = Size & { format: 'png'|'jpeg'; mime: 'image/png'|'image/jpeg' };
type ComparisonImage = ImageHeader & { id: string; name: string; url: string; bytes: number };
type ComparisonNote = { id: string; rect: Rect; body: string; state: 'OPEN'|'RESOLVED' };
type ComparisonMode = 'overlay'|'slider'|'side-by-side';
```

Общие типы страницы живут в model/geometry.ts, image-file.ts и annotations.ts по ответственности, а не в backend contracts. UI может адаптировать названия, но model exports и tests используют один согласованный контракт.

image-file.ts exports:
- parseImageHeader(bytes:Uint8Array):ImageHeader
- validateImageSize(header:Size, byteLength:number):void
- loadImageFile(file:File):Promise<ComparisonImage>
- releaseImage(image:ComparisonImage):void

geometry.ts exports:
- imageToScreen(point:Point,camera:Camera,viewport:Size):Point
- screenToImage(point:Point,camera:Camera,viewport:Size):Point
- zoomAt(camera:Camera,nextZoom:number,anchor:Point,viewport:Size):Camera
- fitCamera(world:Size,viewport:Size):Camera
- clampRect(start:Point,end:Point,site:Size):Rect|null
- clampZoom(value:number):number

annotations.ts exports:
- validateNoteBody(value:string):string (trim, ошибка на пустом/>5000)
- validateNoteRect(rect:Rect,site:Size):void
- createReport(site:ComparisonImage,figma:ComparisonImage,notes:ComparisonNote[],exportedAt:string):object

UI state: site/figma, mode, camera, opacity50/divider50, tool pan/draw, selected note, note draft, errors/loading per slot, replacement confirmation. Notes ≤500. Body простой текст.

## 4. Чтение файлов и жизненный цикл

Ограничить File.size до15MiB до arrayBuffer. Проверить PNG8-byte signature и bounded chunk walk (IHDR размеры, acTL запрет, некорректные длины/обрывы). JPEG signature SOI и bounded marker walk до SOF для размеров; неподдерживаемые/повреждённые структуры отклонять. 1≤width≤4096,1≤height≤10000,width×height≤25_600_000 до decode.

Полный браузерный decode через createImageBitmap(file), проверить декодированные размеры теми же лимитами, close bitmap. Учитывать EXIF orientation JPEG: в UI использовать реально декодированные размеры и браузерное отображение той же ориентации. Ошибка decode не публикует новый слот. Создать blob URL только после успешной валидации/decode; не использовать base64/localStorage/server upload.

Каждый слот имеет монотонный request generation. Поздно завершившийся load, который перестал быть текущим, освобождает созданный URL и не меняет state. Старая валидная картинка остаётся до готовности новой. Замена с notes сначала успешно валидируется, затем требует UI-подтверждения; отмена освобождает candidate URL. Подтверждение меняет слот и очищает notes/draft, камера заново fit. Очистка/новая пара тоже подтверждается при notes.

При replace/clear/unmount отозвать URL. React StrictMode extra setup/cleanup не должен отзывать действующий выбранный файл. Не отзывать URL преждевременно во время рендера или из обработчика, пока изображение ещё используется. Отмена pending load защищена generation. Не нужны фоновые fetch или API.

## 5. Общая геометрия

Мировые координаты — пиксели изображений, начало(0,0) слева сверху. world.width=max(widths),world.height=max(heights). Для viewport W×H:

```
screen = (worldPoint - camera.center) * camera.zoom + (W/2,H/2)
worldPoint = (screen - (W/2,H/2)) / camera.zoom + camera.center
```

fit zoom=clamp(min(W/world.width,H/world.height)), center=(world.width/2,world.height/2). Панорамирование на(dx,dy) меняет center на(-dx/zoom,-dy/zoom). zoomAt сохраняет worldPoint под локальным anchor. Side-by-side использует размеры отдельной панели, одинаковые center/zoom. На смене режима не вызывать fit автоматически. На смене пары — fit после измерения доступной панели.

Рендер img абсолютными слоями, CSS natural width/height в мировых px, transform translate/scale; без object-fit растяжения. SVG слой прямоугольников использует ту же систему координат. Белый фон PNG, штриховка только непокрытых областей. Side-by-side Figma слева/site справа. Overlay Figma поверх site, opacity0..1. Slider clip в экранной области: site слева/Figma справа, положение0..100%; drag handle с pointer capture и aria-valuenow/keyboard, доступный range control допустим как дополнительный способ.

Pan/draw на PointerEvents, setPointerCapture, pointercancel/Escape cleanup. Space не перехватывать в input/textarea/contenteditable. Для ctrl/wheel zoom отменять браузерное действие только на холсте. Элементы slider/toolbar не запускают draw/pan. Рисование только site plane, x/y clamp, reverse drag normalize, площадь≥1×1; ≤500. Клик без drag не создаёт note.

## 6. Замечания и экспорт

После draw хранить draft rect, отдельная форма тела. Save валидирует текст/rect/лимит и создаёт note. При ошибке draft остаётся. Select note центрирует camera на rect и подсвечивает его; существующий zoom сохраняется. Разрешены body edit, OPEN/RESOLVED, delete. Нет автора/обсуждений/серверных событий.

Report schemaVersion1: exportedAt, site{name,width,height},figma{name,width,height},notes{id,rect,body,state}. Создать application/json Blob, временный URL, anchor.download с безопасным постоянным именем design-qa-notes.json, отозвать после начала скачивания. Не включать image.url, File, бинарные данные и пользовательские пути. Нет import отчёта.

UI постоянно сообщает, что сессия только в памяти; beforeunload при notes — дополнительная защита с обычными ограничениями браузера. Новая пара с notes требует подтверждения.

## 7. Тесты и приёмка

Unit: реальные parse headers/limits/APNG/corrupt, math roundtrip/zoom anchor/fit/clamp, body/rect validation/report shape. Моки браузерного decode не подменяют реальные file integration tests.

Browser integration: настоящие PNG/JPEG + corrupt/unsupported/oversize fixture inputs, decode/URL lifecycle/race и подтверждённая замена. Fixtures синтетические, не пользовательские изображения. Можно tag @integration внутри Playwright: test:integration выбирает их, test:e2e выбирает остальные сценарии.

E2E production static app: два изображения → три режима → прозрачность/разделитель0/50/100 → zoom50/100/200 → rect в исходных px → заметка/текст/статус/экспорт → replace confirmation/cancel → mobile375px/keyboard. Проверить отсутствие /api/HTTP upload/external requests после initial page load. Перезагрузка даёт пустую локальную сессию, предупреждение UI не обещает persistence.

Chromium sandbox=true, без ослабления флагов. Нет DB env, Docker services и session cookies в тестах. Настоящие численные проверки геометрии и browser screenshot inspection, не тестирование текстов реализации. Записывать доказательства LC-01–LC-12 в IMPLEMENTATION_LOG, unchecked пока не проверены. Старые AC/исторические тесты не считаются текущей приёмкой.

## 8. Документация и дальнейшее развитие

README/LOCAL_SETUP содержат запуск только статической версии. Старый серверный код удалён из текущего дерева, но доступен в Git (3c50bc4 и предыдущие коммиты). Не удалять реальные Docker volumes и записи старой среды. Необязательный web-only Compose использует тот же порт58080 для удобства пользователя; старые api/postgres/minio не нужны и при переключении останавливаются без удаления данных.

Возможные следующие задачи после оценки локального инструмента: IndexedDB persistence, импорт/экспорт полной пары, pixel diff. Они не являются скрытыми зависимостями текущей версии.

Context7 отсутствовал среди доступных инструментов при подготовке v2. Актуальные API проверяются по первичным источникам: React useEffect https://react.dev/reference/react/useEffect , browser Blob/image APIs MDN и Playwright https://playwright.dev/docs/test-webserver .

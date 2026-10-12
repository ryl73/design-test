# Design QA — Technical Design Document

Версия: 1.0 · Дата: 12 октября 2026 · Статус: техническая спецификация MVP.

Продуктовые требования: [PRD.md](PRD.md). Документ предназначен для последовательной реализации в Codex. TDD здесь означает Technical Design Document. Тестирование описано отдельно и не подменяет продуктовые критерии приёмки.

## 1. Принятые решения

| Область | Решение и причина |
|---|---|
| Архитектура | Модульный NestJS-монолит; API и worker — два процесса одного приложения |
| Frontend | React, Vite, TypeScript, MUI; TanStack Query для серверных данных; Zustand только для viewer/UI |
| Данные | PostgreSQL, Prisma, SQL-миграции для ограничений и блокировок |
| Очередь | Таблица CaptureJob в PostgreSQL; один worker, concurrency=1, polling; Redis/BullMQ не нужны |
| Снимки | Chromium/Playwright, свежий context на задание, viewport only, CSS scale 1× |
| Изображения | Sharp для полной проверки/нормализации PNG и превью; приватный MinIO |
| История | Неизменяемые BaselineVersion и ReviewRevision; отдельные IssueReview и append-only события |
| Доступ | Корпоративный сетевой шлюз/VPN; отображаемое имя, без собственных аккаунтов |
| Сеть браузера | Изолированный capture-процесс в отдельном контейнере; только разрешённые исходящие назначения |
| Обновление UI | HTTP polling; WebSocket/SSE не вводить |
| Развёртывание | Один Linux-сервер, Docker Compose; без оркестратора и отдельной платформы мониторинга |

Синхронный захват в API отклонён: браузер не должен занимать HTTP-запрос и влиять на доступность интерфейса. Redis-очередь отклонена: для одного воркера долговечная очередь в существующей БД достаточна. MinIO выбран по согласованному стеку; отдельный CDN не требуется.

Версии зависимостей фиксируются lockfile и точными тегами образов на этапе 1. Выбирать совместимые стабильные версии с поддерживаемым Node.js LTS, не `latest`. Версия Playwright должна совпадать с версией браузеров его образа. Настоящий документ не объявляет конкретную библиотечную версию «последней»; перед реализацией Codex получает её актуальную документацию через Context7.

## 2. Компоненты и структура

```text
Браузер сотрудника → web (SPA + same-origin reverse proxy) → api
                                                        → PostgreSQL
                                                        → MinIO
worker → PostgreSQL (очередь) / MinIO (готовые PNG)
worker → capture (внутренний HTTP, PNG в ответе)
capture → разрешённые стенды и CDN через ограниченный egress
```

`capture` запускает Playwright и Sharp, получает только снимок конфигурации текущего задания и необходимый профиль доступа. Не имеет пароля БД, ключей MinIO и доступа к их сетям. Worker хранит PNG и публикует результат. Разделение capture нужно для изоляции недоверенной страницы; это не самостоятельный бизнес-сервис.

```text
apps/
  web/src/
    app/                  # router, QueryClient, theme
    projects/             # проекты, страницы, варианты
    reviews/              # история, запуск задания, детали ревизии
    viewer/               # geometry.ts, store.ts, слои, инструменты
    issues/               # список, сообщения, статусы
    api/                  # типизированный HTTP-клиент
  api/src/
    participants/ projects/ pages/ variants/
    baselines/ captures/ revisions/ issues/ assets/
    storage/ database/ config/
    main.ts               # HTTP API
    worker.ts             # очередь и публикация результата
  capture/src/
    server.ts             # внутренний контракт capture
    policy.ts             # URL/origin/IP-проверки
    capture.ts            # подготовка страницы и PNG
packages/
  contracts/              # DTO/enums, без Prisma-моделей в браузере
prisma/schema.prisma
prisma/migrations/
tests/fixtures/           # управляемые сайты, PNG, закрытый стенд
tests/e2e/
infra/compose.yml
infra/network-policy/
docs/PRD.md
docs/TDD.md
```

Монорепозиторий на npm workspaces. Контракты доступны обеим сторонам; backend всё равно валидирует вход независимо от TypeScript. NestJS-модули используют сервисы друг друга, не делают HTTP-запросы внутри монолита. Не добавлять generic repository, event bus, CQRS или plugin framework.

## 3. Модель данных

### 3.1. Общие правила

UUID для сущностей; UTC `timestamptz`; целочисленные счётчики версий; координаты `double precision`. Метаданные ограниченного объёма — `jsonb`, отношения и фильтруемые поля — отдельные колонки. Prisma описывает таблицы и отношения, SQL-миграции добавляют CHECK, частичные индексы и защиту неизменяемости.

Удаления связанного материала — RESTRICT. Архивирование — `archivedAt`; soft delete комментариев не вводить. Авторские записи содержат `participantId` и `authorNameSnapshot`, чтобы переименование участника не меняло историю.

### 3.2. Таблицы

| Таблица | Основные поля |
|---|---|
| Participant | id, displayName, createdAt, updatedAt |
| Project | id, name, description, archivedAt, version, authorId, createdAt, updatedAt |
| Page | id, projectId, name, url, archivedAt, version, createdAt, updatedAt |
| Variant | id, pageId, name, viewportWidth, viewportHeight, urlOverride?, readySelector?, settleDelayMs, authProfileRef?, authReadySelector?, currentBaselineId?, archivedAt, version, nextBaselineNumber, nextJobNumber, nextRevisionNumber, createdAt, updatedAt |
| Asset | id, kind=BASELINE/SCREENSHOT, objectKey, previewKey?, sha256, width, height, bytes, mime=image/png, createdAt |
| BaselineVersion | id, variantId, number, assetId, source=UPLOAD, sourceMetadata jsonb, authorId, authorNameSnapshot, createdAt |
| CaptureJob | id, variantId, number, state, inputSnapshot jsonb, sourceRevisionId?, carriedIssuesSnapshot jsonb, requesterId, requesterNameSnapshot, idempotencyKey, requestHash, attemptToken?, leaseUntil?, phase?, revisionId?, errorCode?, safeErrorMessage?, warnings jsonb, createdAt, startedAt?, finishedAt? |
| ReviewRevision | id, variantId, number, baselineId, screenshotAssetId, captureJobId, captureSnapshot jsonb, warnings jsonb, finalUrl, browserVersion, captureEngineVersion, capturedAt, createdAt |
| Issue | id, variantId, originRevisionId, originalX, originalY, originalWidth, originalHeight, authorId, authorNameSnapshot, createdAt |
| IssueReview | id, issueId, revisionId, state, placement=CONFIRMED/NEEDS_REANCHOR, x?, y?, width?, height?, sourceIssueReviewId?, version, createdAt, updatedAt |
| Comment | id, issueId, revisionId, participantId, authorNameSnapshot, body, createdAt |
| IssueEvent | id, issueId, revisionId, type=CREATED/CARRIED/STATUS_CHANGED/REANCHORED, fromState?, toState?, previousRect?, newRect?, participantId, authorNameSnapshot, commentId?, createdAt |
| StorageReservation | id=jobId или uploadId, bytes, expiresAt, createdAt |
| WorkerHeartbeat | id=workerName, lastSeenAt, captureReady, updatedAt |

`authProfileRef` — только ссылка на `{profileId, version}` из операторского secret manifest; отдельной таблицы с секретами нет. `sourceMetadata` пока содержит исходное имя файла; в будущем — Figma file/node/version. `captureSnapshot` хранит разрешённые настройки, версию сетевой политики, имена и версии профилей, но не cookies/пароли. Полный URL хранится для воспроизведения; URL с userinfo, секретными токенами в query запрещён. Подписанные URL не поддерживаются.

`inputSnapshot`: schemaVersion=1, effectiveUrl, viewport, baselineId, readySelector, settleDelayMs, authProfileRef, authReadySelector, locale, timezoneId, colorScheme, captureMode=VIEWPORT, sourceVariantVersion, sourcePageVersion, policyVersion. `carriedIssuesSnapshot` содержит до 500 записей `{issueId, sourceIssueReviewId, sourceVersion, state, placement, rect, sourceBaselineId, sourceViewport}`. Статусы переносов замораживаются при постановке в очередь.

### 3.3. Инварианты и индексы

- UNIQUE (variantId, number) для BaselineVersion, CaptureJob и ReviewRevision; номера выдаются под блокировкой строки Variant в короткой транзакции.
- UNIQUE ReviewRevision.captureJobId и UNIQUE CaptureJob.revisionId: одно успешное задание — одна ревизия.
- UNIQUE (issueId, revisionId) для IssueReview. UNIQUE (variantId, idempotencyKey) для CaptureJob.
- Частичный UNIQUE по CaptureJob.variantId WHERE state IN ('QUEUED','RUNNING').
- Индексы: Page(projectId), Variant(pageId), CaptureJob(state,createdAt), IssueReview(revisionId,state), Comment(issueId,createdAt,id), IssueEvent(issueId,createdAt,id).
- CHECK для viewport и задержки по PRD; для прямоугольников — конечные числа, x/y≥0, width/height≥1. NaN/Infinity отвергать до SQL и в CHECK. Для NEEDS_REANCHOR все четыре координаты NULL; для CONFIRMED заполнены все.
- Привязки currentBaselineId, baselineId, sourceRevisionId и IssueReview обязаны вести к тому же Variant. Проверять в сервисе под транзакцией и закрепить составными FK по `(id,variantId)` там, где возможно; для IssueReview добавить variantId как служебную колонку для таких FK.
- Границы прямоугольника проверять по Asset снимка внутри транзакции; API не принимает изображение/размеры от клиента как источник истины.
- CHECK формата URL не заменяет policy validation. Эффективный URL проверяется при сохранении и перед фактическим подключением.
- DB trigger запрещает UPDATE/DELETE ReviewRevision, BaselineVersion, Comment, IssueEvent и геометрии/автора Issue. Asset immutable после создания. Обслуживание orphan-файлов не удаляет опубликованные записи.
- `version` используется для optimistic concurrency изменяемых объектов. PATCH/переход с устаревшей версией → 409; сначала проверить версию, затем выполнить операцию и увеличить её атомарно.

### 3.4. Транзакции

Создание Issue включает Issue + IssueReview + первое Comment + CREATED event. Изменение статуса включает Comment + STATUS_CHANGED + увеличение version. Создание успешной ревизии включает Asset + ReviewRevision + перенесённые IssueReview/events + SUCCEEDED job. Эти операции выполняются атомарно в PostgreSQL.

MinIO не участвует в DB-транзакции. Сначала загрузить PNG по уникальному ключу, проверить размер/хеш, затем сделать короткую DB-транзакцию. Если транзакция не прошла, файл остаётся orphan и удаляется операторским скриптом после 24 часов. Никогда не публиковать запись с отсутствующим файлом. Сбой после commit и до HTTP-ответа обрабатывается чтением уже созданного результата по jobId.

Транзакции не держать во время открытия сайта, ожидания PNG или передачи в MinIO. Доступ к SQL — параметризованные запросы выбранной версии Prisma; не собирать SQL конкатенацией строк. API Prisma меняется между версиями: выбрать и зафиксировать один вариант по документации, не смешивать старые и новые API.

## 4. REST API

### 4.1. Общий контракт

Префикс `/api/v1`; JSON camelCase, UUID, ISO 8601 UTC. Списки `{items,nextCursor}`; cursor непрозрачный, сортировка `(createdAt,id)`, limit по умолчанию 30, максимум 100. Параметры фильтра валидируются. Задания в истории сортируются по number DESC, как и ревизии.

Успех: 200 чтение/изменение, 201 создание, 202 постановка задания, 204 отмена queued. Ошибки: 400 невалидный DTO, 401 отсутствующая/недействительная сессия участника для записи, 403 origin/сетевая политика, 404 объект, 409 конфликт версии/архив/активное задание/несовместимый эталон, 413 размер загрузки, 415 формат, 422 содержимое PNG/настройки, 429 очередь/частота, 507 квота хранилища. Истёкший профиль на исполнении — FAILED job, не HTTP 401 API.

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Замечание изменено другим участником. Обновите данные.",
    "details": {"currentVersion": 4},
    "requestId": "b89159b3-4969-4ef1-b617-3d81d58c17fe"
  }
}
```

Стек/секреты/сырой текст страницы в ответ не попадают. Поля неизвестного назначения отклоняются, строковые и числовые лимиты применяются на сервере. URL ≤2048 символов; имя варианта/страницы ≤120. Имена и сообщения не рендерить как HTML.

Перед первой записью POST `/participants` с `{displayName}` создаёт Participant и подписанную cookie-сессию с participantId (HttpOnly, Secure в production, SameSite=Strict, 30 дней). GET/PATCH `/participants/me` читает/обновляет имя. Это средство атрибуции, не аутентификация личности. При потере cookie пользователь создаёт новую запись. На мутации проверять точный Origin; CORS отключён, SPA и API имеют один origin. Читать через сетевой шлюз можно без этой cookie.

### 4.2. Маршруты

| Метод и путь | Назначение / существенные поля |
|---|---|
| POST /participants | `{displayName}`; установить cookie, вернуть id/name |
| GET /participants/me | Текущий участник |
| PATCH /participants/me | `{displayName}` |
| GET, POST /projects | Список (`archived=false/true/all`), создание `{name,description}` |
| GET, PATCH /projects/:id | Детали; PATCH `{version,name?,description?,archived?}` |
| GET, POST /projects/:id/pages | Список, создание `{name,url}` |
| GET, PATCH /pages/:id | PATCH `{version,name?,url?,archived?}` |
| GET, POST /pages/:id/variants | Создание `{name,viewportWidth,viewportHeight,urlOverride?,readySelector?,settleDelayMs?,authProfileRef?,authReadySelector?}` |
| GET, PATCH /variants/:id | PATCH с version, изменяемыми полями и archived |
| GET /capture-profiles | Только id, version, label, origin; секреты отсутствуют |
| GET /variants/:id/baselines | Версии эталона |
| POST /variants/:id/baselines | multipart: file + variantVersion; всегда новая версия, становится текущей |
| PUT /variants/:id/current-baseline | `{version,baselineId}`; выбрать совместимый эталон |
| POST /variants/:id/capture-jobs | `{sourceRevisionId?:uuid}`; обязательный Idempotency-Key UUID; 202 `{jobId,state,statusUrl}` |
| GET /variants/:id/capture-jobs | История, опциональный state |
| GET /capture-jobs/:id | Состояние, phase, safeErrorMessage, warnings, revisionId |
| DELETE /capture-jobs/:id | Только QUEUED → CANCELED; терминальное CANCELED → 204, остальные → 409 |
| GET /variants/:id/revisions | Успешные ревизии и counts по статусам |
| GET /revisions/:id | Snapshot, baseline, screenshot, автор запуска, источник повторной проверки |
| GET /revisions/:id/issues | IssueReview, Issue, counts, фильтр state, pagination |
| POST /revisions/:id/issues | `{rect:{x,y,width,height},body}`; 201 IssueReview |
| GET /issues/:id | Исходное замечание, список его ревизий, события (отдельная пагинация) |
| GET, POST /issues/:id/comments | GET cursor; POST `{revisionId,body}` |
| POST /issue-reviews/:id/transitions | `{version,toState,body}`; атомарное решение |
| PUT /issue-reviews/:id/placement | `{version,rect}`; только переносы, событие REANCHORED |
| GET /assets/:id/content | Приватный оригинал PNG через API stream; same-origin |
| GET /assets/:id/preview | Превью, если есть; в сравнение не используется |
| GET /health/live, /health/ready | Жизнь процесса / доступность обязательных зависимостей |

Отдельного endpoint «retry» нет: POST capture-jobs с новым ключом повторяет операцию. Если прежний idempotency key существует и requestHash совпадает, вернуть то же задание (202 для активного, 200 для терминального); несовпадение тела → 409 IDEMPOTENCY_CONFLICT. Активное задание с другим ключом → 409 ACTIVE_CAPTURE с existingJobId. Исходная ревизия нужна для переноса; UI подставляет выбранную или последнюю ревизию и явно показывает источник. Перед отправкой можно выбрать «Новая проверка без переноса».

Ревизия возвращает ID файлов, их размеры/хеши и пути API, не ключи MinIO. URL screenshot/baseline содержит assetId; `Cache-Control: private, max-age=86400`, ETag=sha256. После выхода из корпоративного контура доступ прекращается; скачанные сотрудником файлы сервис не отзывает.

Пример запуска и snapshot результата:

```json
{"sourceRevisionId":"47d0d832-9939-4b7f-b61c-2c71af7c0b6a"}
```

```json
{
  "id":"a1645a3f-0ae4-4a6a-80a4-a45db599f5d2",
  "number":2,
  "viewport":{"width":1440,"height":900},
  "baseline":{"id":"85179002-fc2e-42a2-9ce8-5d20eb567b81","width":1440,"height":900},
  "screenshot":{"id":"d2ad76e8-33a5-4000-aa01-9248e510e35a","width":1440,"height":900},
  "captureMode":"VIEWPORT",
  "warnings":[]
}
```

### 4.3. Архивирование и конкуренция

При каждой мутации проверять проект, страницу и вариант на архив под блокировкой предков в порядке Project → Page → Variant; архивирование берёт те же блокировки. Уже выполняющееся/queued задание может завершиться после архива, создавая историческую ревизию и переносы. Новые пользовательские записи после архива запрещены.

Изменение currentBaseline и настроек варианта увеличивает version. Запуск задания атомарно читает настройки/эталон под блокировкой Variant. Изменение Page URL учитывается через sourcePageVersion. Для повторной проверки читать исходные IssueReview согласованным снимком транзакции; дальнейшие изменения обсуждения/статусов не меняют carriedIssuesSnapshot.

## 5. Очередь и screenshot pipeline

### 5.1. Постановка и выполнение

1. API проверяет участника, архив, URL policy, совместимость эталона и профиль доступа. Блокирует Variant, проверяет active job и глобальную очередь до 20 QUEUED; для глобального лимита использовать общий advisory lock в транзакции. Резервирует 20 MiB квоты, формирует snapshots, выделяет номер задания, commit.
2. Worker опрашивает БД раз в 1 s. В короткой транзакции выбирает старейшее QUEUED через `FOR UPDATE SKIP LOCKED`, устанавливает RUNNING, новый attemptToken, startedAt и leaseUntil=now+90 s. Блокировку освобождает до любых внешних вызовов.
3. Worker загружает нужную версию профиля из read-only secrets, отправляет capture HTTP-запрос с конфигурацией, jobId, attemptToken и общим deadline. Таймаут внутреннего запроса 65 s; тело ответа не более 20 MiB. Capture принимает только одного клиента-worker и одно активное задание, иначе 409.
4. Capture запускает свежий Chromium процесс и context для задания. Сетевое разрешение/пиннинг выполнены до navigation. Для каждого задания новый browser процесс упрощает очистку и обновление DNS-политики; не вводить pool в MVP. Использовать manifest версии из snapshot; если эта версия удалена или отозвана оператором, завершить POLICY_UNAVAILABLE, не подменять новой версией молча.
5. Фиксированные параметры: headless, viewport из snapshot, deviceScaleFactor=1, locale=`ru-RU`, timezoneId=`UTC`, colorScheme=`light`, reducedMotion=`reduce`, serviceWorkers=`block`, acceptDownloads=false. Использовать Chromium user agent по умолчанию, сохранить browserVersion. Без ignoreHTTPSErrors.
6. Применить только origin-scoped профиль, установить обработчики запросов/redirect/response, закрывать popup, запретить загрузки и лишние вкладки. Для Basic добавлять credentials только к разрешённому exact origin; не применять глобальные extraHTTPHeaders.
7. Открыть effectiveUrl с ожиданием DOMContentLoaded, лимит navigation 15 s. Ошибка сертификата, главного документа 4xx/5xx, запрещённый redirect или auth mismatch завершают задание ошибкой. Последний URL обязан находиться в разрешённых origins профиля/страницы.
8. Если задан readySelector, ждать его visible до 10 s. Для закрытого стенда authReadySelector обязателен и должен стать visible: отсутствующий маркер → AUTH_REQUIRED. HTTP 200 страницы входа сам по себе не является успехом.
9. Ждать `document.fonts.ready`, затем decode уже обнаруженных `img`, пересекающих viewport. Суммарный лимит готовности шрифтов/видимых изображений 10 s. Broken/timeout видимого изображения → RESOURCE_NOT_READY. CSS backgrounds и async данные не имеют универсального детектора: для них оператор страницы задаёт readySelector. Не использовать networkidle как универсальную готовность.
10. Применить settleDelayMs (по умолчанию 300). Прокрутка (0,0); не скроллить для lazy-load, не скрывать cookie-banner автоматически, не менять текст/DOM произвольным скриптом пользователя.
11. Снимок PNG: `fullPage:false`, `animations:'disabled'`, `caret:'hide'`, `scale:'css'`. Лимит screenshot 10 s, общий wall-clock deadline 60 s от начала capture. Отключение CSS-анимаций не останавливает произвольный JS, видео и меняющиеся данные; это ограничение фиксируется в UI/help.
12. Sharp полностью декодирует, переводит в sRGB и повторно кодирует PNG без метаданных; проверяет точные viewport размеры, byte cap. Формирует превью шириной ≤480 px. Возвращает PNG и служебные метаданные worker; preview можно вычислить worker из PNG, чтобы контракт capture оставался простым.
13. Worker вычисляет SHA-256 нормализованного PNG, загружает screenshot/preview по уникальным ключам и выполняет publish-транзакцию только если job всё ещё RUNNING с тем же attemptToken. Под блокировкой Variant выделяет номер ревизии, создаёт переносы, освобождает reservation и отмечает SUCCEEDED.
14. В finally закрыть context/browser, уничтожить дочерние процессы, удалить временные файлы и секретный input. Ошибка на любом шаге → FAILED с безопасным кодом и освобождением резерва.

Не сравнивать SHA-256 снимков, снятых в разное время, как доказательство качества: динамический сайт может отличаться. Для тестов детерминированности использовать неподвижную fixture-страницу.

### 5.2. Сбои и восстановление

Worker обновляет lease каждые 10 s; fencing attemptToken обязателен при heartbeat и завершении. После lease expiration reaper помечает RUNNING как FAILED/WORKER_INTERRUPTED, не возвращает его в QUEUED. Поздний результат не публикуется; его файлы становятся orphan. Reaper работает при старте worker и раз в 10 s. Capture независимо убивает браузер по 60 s deadline.

Автоматических повторных попыток нет. Вариант освобождается после терминального состояния; пользователь запускает новое задание. Терминальные состояния не меняются. Если процесс умер после успешного commit, SUCCEEDED остаётся SUCCEEDED.

Отмена queued выполняется условным UPDATE state=QUEUED. Если worker уже захватил строку, вернуть 409. Состояния:

```text
QUEUED → RUNNING → SUCCEEDED
                → FAILED
QUEUED → CANCELED
```

Фазы RUNNING: VALIDATING, NAVIGATING, WAITING, SCREENSHOTTING, STORING. Это подписи этапов, не процент прогресса. Worker ограничивает выходные метаданные и массив warnings: максимум 50 записей, 300 символов каждая, общий JSON массива ≤4 KiB UTF-8, без текстов ответов и чувствительных query. При превышении общего лимита обрезать массив и добавить одну запись о числе пропущенных предупреждений.

Коды ошибок: URL_NOT_ALLOWED, DNS_POLICY_DENIED, POLICY_UNAVAILABLE, REDIRECT_DENIED, AUTH_REQUIRED, PROFILE_UNAVAILABLE, TLS_ERROR, NAVIGATION_FAILED, READY_SELECTOR_TIMEOUT, RESOURCE_NOT_READY, CAPTURE_TIMEOUT, OUTPUT_LIMIT, STORAGE_FAILED, WORKER_INTERRUPTED. Сетевой отказ при загрузке главного документа/iframe → FAILED; запрещённый необязательный ресурс → blocked warning. Видимый img/шрифт после такого отказа всё равно не пройдёт readiness.

## 6. SSRF, закрытые стенды и ресурсы

### 6.1. Политика назначения

Оператор задаёт manifest policy вне UI, versioned и read-only:

```yaml
policyVersion: 1
destinations:
  - hostname: stage.designqa.example.com
    schemes: [https]
    ports: [443]
    allowedCidrs: [10.42.8.16/32]
    purposes: [navigation, subresource]
  - hostname: assets.designqa.example.com
    schemes: [https]
    ports: [443]
    allowedCidrs: [10.42.8.17/32]
    purposes: [subresource]
```

Имена и IP выше — пример формата; оператор заменяет их реальными стендами. По умолчанию destinations пустой, capture fail-closed. Каждое правило разрешает exact hostname, scheme и порт; wildcard доменов и разрешение всего RFC1918 запрещены. Публичные CDN разрешаются отдельными hostname и утверждёнными сетевыми диапазонами; если диапазоны нестабильны, использовать существующий корпоративный egress proxy с такими же проверками.

URL разбирать стандартным WHATWG parser в одном shared policy-модуле. Принимать только http/https; HTTPS по умолчанию, HTTP только явно разрешённое исключение. Отклонять userinfo, fragment, неканоничные формы IP, IP literals вне явных правил, управляющие символы, backslash, неизвестные порты. Hostname нормализовать IDNA и регистр, убрать конечную точку, сравнить exact. URL сохранять в канонической форме. Query допустима для несекретных фильтров страницы; credential/token query нельзя использовать вместо профиля.

Запрет служебных адресов применяется даже при ошибочном allowlist: loopback IPv4/IPv6, unspecified, link-local, multicast, cloud metadata, адреса app/API/DB/MinIO/control plane. Проверять IPv4-mapped IPv6. Внутренние адреса разрешать только для конкретных стендов, не через общий переключатель «разрешить private IP».

### 6.2. DNS и сетевой контур

Одной проверки URL и Playwright route недостаточно для SSRF. В выбранном MVP защита имеет два уровня:

1. API/capture проверяют каждый HTTP(S)-запрос, включая redirect hop, subresource, iframe и popup. Service workers отключены; WebSocket и WebRTC в MVP блокируются, UDP/QUIC закрыты. Top-level data/file/ftp/blob navigation запрещена. Внутренние data/blob ресурсов изображения допускаются только как локальные данные страницы и не дают сетевого исключения.
2. Контейнер capture не подключён к data-сети. На Linux-хосте egress firewall для capture разрешает только pinned IP стендов/CDN и разрешённые порты; запрещает прямой доступ к API, БД, MinIO, metadata, loopback-службам и сети управления. Playwright route — дополнительный контроль, не граница изоляции.

Перед запуском браузера capture разрешает все A/AAAA для hostname, проверяет каждый адрес против allowedCidrs и hard deny. Смешанный набор с запрещённым адресом отклоняется целиком. Для MVP выбирать один проверенный адрес на hostname и фиксировать mappings на всё задание через Chromium host-resolver rules: MAP для каждого разрешённого hostname, затем MAP всех остальных в NOTFOUND. Отключить Secure DNS и QUIC политикой образа; браузерный DNS/DoH и UDP блокируются также сетью. Firewall разрешает только утверждённые IP/port. TLS остаётся для исходного hostname/SNI, подстановка IP в URL недопустима. Playwright route дополнительно сверяет hostname/origin с mapping; после DNS изменения текущий процесс продолжает использовать прежний проверенный адрес. При недоступности выбранного IP задание завершается ошибкой, не переключается на непроверенный адрес.

Capture launcher и Chromium работают под разными UID. Chromium запускается через фиксированный wrapper, который сбрасывает права до browser UID, очищает env и exec-ит только известный binary; взаимодействие Playwright с Chromium — pipe, без TCP devtools port. Операторский init-скрипт до старта сервиса устанавливает в network namespace capture OUTPUT-policy для browser UID: только TCP к утверждённым IP/port, затем REJECT всех остальных соединений, включая loopback/control, DNS и UDP. UID browser не имеет capabilities; правило устанавливается оператором через host namespace tools, а не браузером/пользовательским input. Launcher слушает control interface и не предоставляет произвольного exec/file API. Startup smoke-test проверяет, что правила действуют для реального browser UID, иначе readiness=false.

На Docker-хосте правила фильтрации устанавливать в цепи, реально обрабатывающей container forwarding (для используемого backend Docker — DOCKER-USER либо соответствующий nftables ruleset). Не считать `internal: true` полной политикой: оно не разрешает нужные стенды и не реализует hostname policy. Правила управляются операторским deploy-скриптом, не privileged контейнером приложения. Тесты должны доказать недоступность control plane из процесса браузера, включая loopback и DNS rebinding. Если это не выполнено, сервис не допускается к пилоту.

Это минимальная необходимая сетевая изоляция для браузера, открывающего чужой код. Не требуется отдельная платформа безопасности. VPN/маршрут до конкретного стенда организуются на хосте; браузер сотрудников не используется как туннель. HTTP redirects допускаются до 5 hops с проверкой каждого. UI не может расширять allowlist.

### 6.3. Профили доступа

Операторские versioned secret files: origin, label, credentials типа BASIC или STORAGE_STATE, допустимые final origins и срок действия. Profiles перечисляются API без содержимого. Файл immutable для версии; старые версии не перезаписывать. Если version из snapshot отсутствует/истекла, задание FAILED/PROFILE_UNAVAILABLE.

Cookies проверять на exact host, не широкий Domain; localStorage разрешать только exact origin. Для Basic инжектировать Authorization только запросам origin профиля, включая повторную проверку redirect; не пересылать на CDN. Предварительно подготовленный storage state совместим с моделью профиля, но не гарантирует приложения с sessionStorage/IndexedDB/MFA — такие стенды вне поддерживаемого входа MVP.

Для private CA установить доверенный корпоративный сертификат в образ/хост capture. Не отключать TLS-проверку. Credentials read-only через Docker secrets/смонтированные файлы, права 0600; передавать capture по внутреннему защищённому каналу, не в URL. Capture API принимает secret service token, сетево доступен только worker; дочерний browser процесс не наследует служебный token и не имеет доступа к секретным файлам launcher.

Два последовательных задания всегда используют разные contexts и browser процессы. Context state не сохраняется после захвата. В production запрещены Playwright trace/HAR/видеозапись: они могут содержать токены. Логи не включают cookies, Authorization, request body, query string, localStorage или HTML.

### 6.4. Лимиты

| Ресурс | Лимит MVP |
|---|---|
| Одновременный capture | 1 |
| QUEUED глобально / активных на вариант | 20 / 1 |
| Создание заданий | 5/min на participant и 30/min на source IP |
| Browser wall-clock | 60 s; worker request 65 s; lease 90 s |
| Browser container | 2 CPU, 2 GiB memory, 128 pids, bounded tmpfs 256 MiB |
| PNG upload | 15 MiB, ≤2560×10000, ≤25,6 млн px |
| PNG output | 20 MiB, exact viewport, ≤2560×1600 |
| Upload decode | Отдельный ограниченный child process: ≤10 s, ≤512 MiB; убить при превышении |
| Network | ≤1000 запросов/задание, ≤100 MiB входящего трафика browser UID/задание, включая транспортный overhead |
| Переносы / новые замечания | ≤500 IssueReview на ревизию |
| Обсуждение | 5000 символов/сообщение, POST 30/min на participant |
| Квота изображений | 10 GiB опубликованных файлов + резервы |

Сетевой byte limit измерять счётчиками соединений browser UID с обнулением на задание: маркировать его исходящие соединения и считать ответный трафик по connection mark, без чтения всех body в память. При превышении сеть блокирует передачу и launcher убивает browser: FAILED/OUTPUT_LIMIT. Счётчик включает TLS/transport overhead, поэтому предел строже лимита полезных response bodies. Content-Length не является гарантией. Подтвердить механизм тестом большого chunked response. Timeout/memory/pids/размер выходного PNG остаются обязательными независимыми ограничениями.

Браузер запускается непривилегированным пользователем с рабочим Chromium sandbox/seccomp; не использовать `--no-sandbox` как штатное решение. Capture child не читает host filesystem, Docker socket или каталоги профилей. Нехватка ресурсов должна завершать задание ошибкой и освобождать активный слот.

## 7. PNG и MinIO

Upload идёт multipart через API, не напрямую в MinIO. Reverse proxy и streaming parser прерывают чтение при 15 MiB. Проверить signature PNG и отсутствие APNG `acTL`, затем metadata format/размеры; metadata без полного декодирования недостаточно. Sharp запускается с явным limitInputPixels=25600000 и строгим failOn, полностью декодирует файл, нормализует sRGB и повторно кодирует PNG без пользовательских метаданных. Не ресайзить оригинал. Если нормализованный файл >20 MiB, отклонить OUTPUT_LIMIT. SHA-256 относится к нормализованному PNG.

Ключи: `projects/{projectId}/variants/{variantId}/baselines/{baselineId}/image.png` и `.../captures/{jobId}/{attemptToken}/image.png`; рядом `preview.png`. Имена пользовательских файлов не участвуют в пути. Каждый upload/capture имеет уникальный objectKey; перезапись опубликованного ключа запрещена на уровне приложения и IAM storage principal, где доступна granular policy. Bucket private, credentials API/worker имеют минимальные операции, admin console не публиковать.

Квоту защищать advisory lock в PostgreSQL: опубликованные Asset.bytes + активные StorageReservation ≤10 GiB. Для PNG upload резерв 20 MiB, для capture 20 MiB; при публикации резерв заменяется фактическим размером оригинала+preview (если суммарно >20 MiB — ошибка). Upload reservations истекают через 5 минут; job reservations живут до terminal/lease reaper. Orphan-файлы учитывать отдельно в физическом запасе диска; ежедневный sweep удаляет только объекты без DB reference старше 24 h и вне активных job/upload. Диск должен иметь минимум двойной запас относительно мягкой квоты; оператор проверяет свободное место.

Asset content выдаётся API stream с Content-Type image/png, nosniff и ETag. Range не нужен в MVP. Файл изображения не исполняется и не служит HTML. Ревизии отображают оригинал; превью используются только в списках.

## 8. Координаты и Comparison Viewer

### 8.1. Каноническая плоскость

Начало `(0,0)` — левый верхний угол снимка; x вправо, y вниз. Единица — пиксель оригинального PNG. При capture scale=css и DPR=1 она равна CSS-пикселю сайта. Координаты floating-point, округление в JSON до 3 знаков; никакой зависимости от zoom или devicePixelRatio экрана пользователя.

Прямоугольник полуоткрытый `[x,x+width) × [y,y+height)`. Условие: `0≤x`, `0≤y`, `width≥1`, `height≥1`, `x+width≤W`, `y+height≤H`, все значения конечны. UI clamp ограничивает края; сервер повторяет проверку. Drag в любую сторону нормализуется min/max. Выделение менее 4 экранных px по любой оси считается кликом, не замечанием.

Изображения располагаются без resize в общей плоскости `max(Wbaseline,Wscreenshot) × max(Hbaseline,Hscreenshot)`. Размеры исходного снимка определяют доступную область аннотаций. Высокий PNG-эталон не расширяет разрешённую область снимка.

### 8.2. Преобразования

Zustand хранит `mode`, `zoom`, `center:{x,y}`, `opacity`, `sliderRatio`, `tool`, `selectedIssueId`. Для панели с центром экрана `(cx,cy)` и zoom=z:

```text
screenX = panelLeft + cx + (imageX - centerX) * z
screenY = panelTop  + cy + (imageY - centerY) * z

imageX = centerX + (clientX - panelLeft - cx) / z
imageY = centerY + (clientY - panelTop  - cy) / z
```

`panelLeft/panelTop` брать из getBoundingClientRect на момент interaction; учитывать CSS layout и scroll внешнего контейнера. Использовать одни geometry.ts функции для картинок, SVG-аннотаций и pointer input. devicePixelRatio в эти формулы не входит.

Для zoom вокруг курсора сначала вычислить image point старым z, затем подобрать новый center, сохраняющий screen point. Для pan delta screen → delta image/z. В side-by-side обе панели используют один center и z, но собственный screen center. При переносе из режима в режим не хранить независимые pixel offsets панелей.

«1:1»: z=1. «Вписать»: минимум отношения доступных размеров панели к размерам общего холста, clamp 0,1–4. В side-by-side использовать минимум fit двух панелей. Если длинный эталон при минимальном zoom не помещается целиком, сохраняется z=0,1 и доступен pan; UI показывает ограничение масштаба. На resize panel сохранять image center; Fit пересчитывается только если пользователь включил режим fit.

### 8.3. Рендеринг и инструменты

DOM `<img>` в общей трансформируемой сцене, поверх SVG с viewBox в координатах оригинала. SVG — прямоугольники/метки/черновик, тексты/толщина границы визуально компенсируют zoom. Не использовать WebGL/Canvas в первой версии. Отдельный UI-слой для toolbar/sidebar и slider divider, не масштабируемый вместе с картинкой.

Overlay: снимок снизу, эталон сверху с opacity. Slider: два изображения с clip region; divider задаётся долей общей ширины image plane и трансформируется вместе с просмотром. Разделитель перетаскивается отдельной ручкой, не запускает pan/draw. Side-by-side: разные панели с общей геометрией. Штриховка вне размеров конкретного изображения.

Pointer capture для drag, Escape отменяет выделение, Space временно включает pan, pointercancel очищает черновик. Подтверждение замечания открывает форму только после завершения drag; ошибка сохранения сохраняет черновик и текст. Если запись конфликтует/архивирована, показать причину, не создавать скрытый локальный Issue.

Координаты NEEDS_REANCHOR не рисуются. При выборе показать сообщение об уточнении и исходный прямоугольник как числовую справку. PUT placement сохраняет новую область, делает CONFIRMED и создаёт событие; повторное уточнение перенесённого замечания также возможно с version. Созданное в текущей ревизии замечание не меняет исходную геометрию.

## 9. Повторные проверки и frontend data flow

При постановке задания копировать до 500 незакрытых IssueReview исходной ревизии в snapshot. При публикации новый IssueReview ссылается на тот же Issue и sourceIssueReviewId. Rect сохраняется, только если baselineId, viewport и source placement=CONFIRMED совпадают. Иначе placement=NEEDS_REANCHOR и rect=NULL; исходное положение доступно по цепочке origin/source. Статус сохраняется, новое событие CARRIED фиксирует происхождение.

Параллельные ветки от старой ревизии допустимы; sourceRevisionId не подразумевает линейное «предыдущее». «Последняя ревизия» определяется number, счётчики показываются по ней, глобального Issue.status нет. Все сообщения Issue показываются с бейджем контекста ревизии; изменения статуса только для выбранного IssueReview.

TanStack Query keys: projects, project/id, pages/id, variant/id, baselines/variantId, jobs/variantId, job/id, revisions/variantId, revision/id, issueReviews/revisionId/filter, comments/issueId. Poll активного job раз в 2 s; выбранные issueReviews/comments раз в 10 s при видимой вкладке, остановить в background. Терминальный job инвалидирует историю/variant. Мутации статусов/комментариев инвалидируют соответствующие keys. Не хранить серверные списки в Zustand, не использовать optimistic status change в MVP: сначала подтверждение сервера.

Deep links: `/projects/:projectId/pages/:pageId/variants/:variantId/revisions/:revisionId?issue=:issueId`. Параметры проверять по реальным связям, несовместимый ID → понятный 404. Viewer state локален; изображения/замечания доступны после перезагрузки ссылки.

## 10. Развёртывание и поддержка

Compose: `web`, `api`, `worker`, `capture`, `postgres`, `minio`. Это шесть контейнеров на одном сервере; отдельный Redis, CDN, message broker и Prometheus не нужны. Web раздаёт production SPA и проксирует /api, корпоративный шлюз завершает HTTPS. Для локальной разработки допускается HTTP на loopback, но production cookie требует HTTPS.

Сети: frontend для web/api; data для api/worker/postgres/minio; control для worker/capture; capture-egress для capture и разрешённых внешних маршрутов. Браузер не должен достучаться до control listener даже изнутри capture: host-init устанавливает правила browser UID в OUTPUT namespace capture по разделу 6.2, а host forwarding firewall ограничивает контейнер целиком. Postgres/MinIO не имеют опубликованных host ports. Compose сам не обеспечивает все правила egress — deploy-скрипт и smoke-тест обязательны. Если среда не позволяет установить эти правила, запуск capture запрещён; переход на корпоративный egress proxy оформляется как отдельное изменение TDD, а не отключение защиты.

Переменные конфигурации: DATABASE_URL (api/worker), MINIO_ENDPOINT/BUCKET и отдельные secrets (api/worker), SESSION_SIGNING_KEY (api), CAPTURE_INTERNAL_URL/TOKEN (worker/launcher), POLICY_MANIFEST_PATH, AUTH_PROFILES_PATH, QUEUE_LIMIT=20, CAPTURE_CONCURRENCY=1, STORAGE_QUOTA_BYTES=10737418240. Не передавать весь env worker в browser процесс.

Health: API readiness проверяет DB и storage; worker пишет heartbeat в операторский лог и WorkerHeartbeat каждые 10 s; capture проверяет запуск/закрытие браузера в startup smoke-test. POST capture-jobs проверяет heartbeat не старше 30 s и captureReady=true, иначе 503 CAPTURE_UNAVAILABLE; чтение истории доступно. Migration job выполняется один раз до api/worker, не из каждого процесса при старте. Образы проходят build и базовый smoke-test.

Структурные логи: timestamp, level, requestId/jobId, phase, elapsedMs, safe errorCode. API, worker и capture используют один jobId. Логирование метрик: число queued/running/failed, длительность capture, bytes хранения; достаточно JSON-логов и операторской команды. Ротация логов Docker ограничивает объём.

Ежедневно: согласованное окно без новых upload/capture, дождаться активных операций, backup PostgreSQL и MinIO; сохранять зашифрованную копию вне сервера, 7 дневных + 4 недельных. Профили/политику/secrets резервировать отдельно под доступом оператора. Проверка восстановления ежемесячно на отдельной среде: DB, bucket, hashes контрольных PNG, открытия ревизии. Нельзя считать backup volume на том же диске полноценной резервной копией.

## 11. Проверки реализации

Тесты проверяют доменные риски и поведение, а не копируют каждую строку реализации. Использовать unit runner для geometry/policy, интеграционные тесты с реальным PostgreSQL/MinIO и Playwright для приложения. Сетевую изоляцию проверять на Linux с production firewall, не только mock route.

| Уровень | Обязательные проверки |
|---|---|
| Unit geometry | screen↔image roundtrip ≤0,5 px, zoom around cursor, отрицательный drag, clamp, одинаковая геометрия трёх режимов |
| Unit policy | canonical host, userinfo, backslash, IPv6/mapped IPv4, неразрешённый port, смешанный DNS ответ, denied redirect |
| DB integration | ограничения same-variant, partial unique active job, concurrent numbering, version conflicts, immutable records |
| Storage integration | PNG masquerade/corrupt/APNG/oversize, полный decode, квота+reservation, orphan после rollback, отсутствие перезаписи |
| Queue integration | двойной POST, idempotency conflict, cancel/claim race, lease expiry, поздний publish с устаревшим token |
| Capture fixtures | шрифты/visible img, ready marker, broken image, timeout, 401, HTTP 200 login, private CA, отсутствие утечки credentials |
| Network acceptance | browser→DB/API/MinIO/control/metadata/localhost запрещён; CDN разрешён; redirect/iframe/rebinding/UDP/WS блокируются |
| Browser E2E | полный путь AC-01–AC-17: эталон → снимок → замечание → ready → новый снимок → resolve, старая ревизия сохранена |
| Operations | нагрузка AC-18, worker restart, backup restore AC-19 |

Сравнение screenshots для UI-тестов ограничить статическими fixtures. Не использовать pixel-perfect тесты произвольных внешних сайтов как основной gate. Performance результаты записывать с характеристиками сервера/клиента и количеством файлов.

## 12. План задач для Codex

### Общие правила выполнения

Сначала прочитать PRD/TDD и локальный AGENTS.md. Не расширять MVP. Выполнять этапы по порядку; каждый этап завершается рабочим результатом, проверками и короткой записью о решениях. Библиотечные API сверять с Context7; версии фиксировать. Перед сложной логикой сначала добавить проверку ожидаемого поведения, убедиться в её падении, реализовать и добиться прохождения. Не начинать публичное развёртывание по этому документу: предусмотрен только корпоративный контур.

Задать npm scripts `typecheck`, `lint`, `test:unit`, `test:integration`, `test:e2e`, `build` в этапе 1. На последующих этапах запускать затронутые тесты и typecheck; перед пилотом — все scripts. Изменения сохранять небольшими осмысленными коммитами в рабочем репозитории, если он предоставлен. Эти документы сами не являются запросом начать писать приложение.

### Этап 1. Основа и доменная структура

Файлы: workspace package.json/lockfile; apps/web/src/app; apps/api/src/{projects,pages,variants,participants}; packages/contracts; prisma/schema.prisma и migrations; infra/compose.yml.

Контракты: CRUD DTO из раздела 4, UUID/version, error envelope. Результат: можно создать проект/страницу/вариант и после обновления увидеть данные.

- [ ] Зафиксировать совместимые Node/React/Vite/Nest/Prisma/Playwright версии, собрать web/api, подготовить конфиг без секретов в репозитории.
- [ ] Добавить DB-тест «два PATCH одной version: один успех, один 409» и тест запрета изменения архивированного потомка; до реализации они падают.
- [ ] Создать миграции таблиц структуры, session participant, валидацию URL/viewport и DTO.
- [ ] Реализовать UI списков/форм и same-origin API proxy.
- [ ] Проверить AC-01, AC-16; typecheck/lint/build и интеграционные тесты этого этапа проходят.

### Этап 2. Эталоны и приватные файлы

Файлы: apps/api/src/{baselines,assets,storage}; apps/web/src/projects; prisma migrations; tests/fixtures/png.

Контракт: multipart baseline upload → BaselineVersion/Asset; content endpoint → stream PNG. Результат: PNG можно загрузить, переключить версию и открыть, старые файлы сохраняются.

- [ ] Добавить fixture-тесты JPEG-as-PNG, APNG, повреждённого и слишком широкого PNG, полного decode и транзакционного квотирования.
- [ ] Реализовать ограниченный decode process, normalization/hash, unique object keys, reservation и publish после storage upload.
- [ ] Реализовать currentBaseline с version, reset при смене ширины, предупреждение разной высоты.
- [ ] Добавить preview в список, оригинал через API, orphan cleanup dry-run/execute для оператора.
- [ ] Проверить AC-02 и immutable baseline часть AC-03; storage/DB integration, typecheck/build проходят.

### Этап 3. Безопасный capture и очередь

Файлы: apps/api/src/captures, worker.ts; apps/capture/src/{server,policy,capture}; infra/network-policy; queue migrations; fixtures сайтов.

Контракты: capture-jobs API; внутренний `POST /capture` с validated snapshot → PNG body и metadata в `X-Capture-Metadata` (base64url JSON, ≤8 KiB); worker публикует ReviewRevision. Metadata содержит finalUrl, browserVersion, capturedAt и warnings без секретов. При ошибке capture возвращает JSON error envelope вместо PNG. Служебный token проверяется до чтения input body; максимальный body 256 KiB для профиля и настроек. Capture не принимает произвольные launch args/path.

- [ ] Написать policy/queue tests: mixed DNS, redirect, двойной claim, idempotency, stale token, timeout, credential separation; затем реализовать.
- [ ] Добавить операторский manifest, сетевые правила и fixture стенд/ресурсы; показать разрешённый запрос и запрещённый browser→control/DB/metadata.
- [ ] Реализовать snapshot enqueue, reservations, lease/reaper, phases, cancel queued и один активный слот.
- [ ] Реализовать pipeline раздела 5 с профилями доступа, readiness, output limits и cleanup.
- [ ] Добавить UI прогресса/ошибок и историю ревизий. Повторный запуск пока может быть без переносов, UI это явно показывает.
- [ ] Проверить AC-04/05/12/13/14/15 на Linux; capture/queue tests и build проходят. SSRF gate нельзя отложить до пилота.

### Этап 4. Comparison Viewer

Файлы: apps/web/src/viewer/{geometry.ts,store.ts,ComparisonViewer.tsx}; apps/web/src/reviews; geometry unit tests и viewer E2E.

Контракт: Viewer получает read-only пару Asset, размеры и список IssueReview; emits rect в исходных пикселях. Результат: три режима, синхронная геометрия, zoom/pan/fit/1:1.

- [ ] Написать численные tests roundtrip/zoom/pan и fixture разной высоты до рендера.
- [ ] Реализовать общий center+zoom и слои image/SVG, три режима и outside hatch.
- [ ] Добавить toolbar, pointer capture/Escape/Space, draw draft только в пределах снимка.
- [ ] Проверить AC-06/07/08; режимы 50/100/200% и клики по точкам fixture не меняют геометрию, viewer E2E проходит.

### Этап 5. Обсуждения и статусы

Файлы: apps/api/src/issues; apps/web/src/issues; Issue/IssueReview/Comment/Event migrations; integration tests.

Контракт: POST revision/issues, comments, transitions с version. Результат: рабочее ручное ревью одной ревизии.

- [ ] Добавить tests атомарного issue creation/transition, границ снимка, 409 конкуренции, текстового XSS и запрета редактировать историю.
- [ ] Реализовать API/DB инварианты, append-only сообщения/события, фильтры и лимит 500.
- [ ] Подключить viewer draw→форма→server result, список, центрирование, deep link и polling.
- [ ] Проверить AC-08/09/17, полный сценарий OPEN→READY_FOR_REVIEW→RESOLVED→OPEN; integration и E2E проходят.

### Этап 6. Повторные проверки

Файлы: captures snapshot/publish, issues carry/reanchor; reviews UI; tests/e2e/recheck.

Контракт: sourceRevisionId и carriedIssuesSnapshot, IssueReview placement/reanchor. Результат: ручная проверка исправлений с независимой историей ревизий.

- [ ] Написать tests «resolved не переносится», «изменение источника после enqueue не меняет копию», «старый status не меняется после resolve новой ревизии», «новый baseline требует reanchor».
- [ ] Реализовать согласованный snapshot и создание переносов в publish-транзакции; блокировать чужой variant/source.
- [ ] Реализовать NEEDS_REANCHOR, placement event/version, выбор источника и историю веток.
- [ ] Проверить AC-03/10/11 и весь сценарий от R1 до R3; hash старых PNG и исходные координаты остаются прежними.

### Этап 7. Приёмка и пилот

Файлы: docs/runbook.md, infra backup/restore/smoke scripts, tests/e2e, отчёт приёмки.

Результат: сервис доступен коллегам в корпоративном контуре, с воспроизводимым развёртыванием и восстановлением.

- [ ] Запустить typecheck/lint/unit/integration/e2e/build, smoke production images; исправить реальные сбои, не расширяя scope.
- [ ] Повторить сетевые тесты из браузерного процесса, проверить утечки secrets и cookie origin isolation.
- [ ] Принудительно остановить worker/capture на каждом значимом шаге; проверить lease, отсутствие дублей и orphan cleanup.
- [ ] Замерить нагрузку/лимиты AC-18, провести восстановление AC-19.
- [ ] Заполнить матрицу AC-01–AC-19 «pass/fail + evidence»; подготовить runbook установки, allowlist, профилей, cleanup, backups и обновления образов.
- [ ] Запустить двухнедельный пилот с 3–5 коллегами; записать время подготовки ревью и замечания к UX.

## 13. Расширения после MVP

- **Figma:** импорт создаёт BaselineVersion source=FIGMA и sourceMetadata; текущая модель захватов не меняется. OAuth и управление секретами вводятся отдельно.
- **Full-page:** новое captureMode, новая ограниченная политика скролла/размеров; пересмотр переносов координат. Не переключать existing revision mode задним числом.
- **Diff:** отдельная таблица DerivedArtifact с revisionId, algorithm/version/options и Asset; нормализация размеров явная. Не выдавать отличие пикселей за ошибку дизайна.
- **Автоанализ:** отдельный AnalysisRun/Suggestion с происхождением/версией модели; принятие создаёт обычный Issue с явным авторством. Никаких автоматических status transitions.
- **Аккаунты:** связать Participant с подтверждённым userId; ACL на Project перед доступом нескольких команд. Исторические authorNameSnapshot сохраняются.

В MVP не создавать таблицы расширений, фиктивные кнопки и заглушки интеграций.

## 14. Документация, проверенная при подготовке

Библиотечные API сверены через Context7 12 октября 2026. Проектные решения, лимиты, модель ревизий и очередь — решения этой спецификации, а не гарантии библиотек.

- [Playwright BrowserContext](https://playwright.dev/docs/api/class-browsercontext): context isolation, route и ограничение перехвата service workers.
- [Playwright Page screenshot](https://playwright.dev/docs/api/class-page#page-screenshot): viewport/fullPage, scale, animations, caret. Отключение анимаций может доводить конечную анимацию до завершения, поэтому захват проверяется на fixtures.
- [Prisma transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions): короткие транзакции и атомарность. Конкретный API сверять с выбранной версией; SQL row locking — свойство PostgreSQL.
- [Sharp input](https://sharp.pixelplumbing.com/api-input/) и [Sharp constructor](https://sharp.pixelplumbing.com/api-constructor/): metadata не выполняет полное декодирование; limitInputPixels задаётся явно.
- [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): allowlist, проверка адресов/перенаправлений и сетевые ограничения. Применение к изолированному capture — архитектурное решение данного TDD.

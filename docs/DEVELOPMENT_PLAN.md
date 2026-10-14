# Design QA — пошаговый план разработки MVP

> Для Codex: выполнять задачи последовательно с навыком `executing-plans`, проверяя результат каждой задачи. Этот файл задаёт порядок реализации, но его создание само по себе не запускает разработку.

**Цель:** внутренний сервис ручного дизайнерского ревью с серверными скриншотами, сравнением PNG, замечаниями и повторными проверками.

**Архитектура:** модульный NestJS-монолит с отдельным worker, долговечной очередью в PostgreSQL и изолированным capture-контейнером. React SPA обращается к API через один origin; изображения хранятся в приватном MinIO.

**Стек:** React / Vite / TypeScript / MUI / TanStack Query / Zustand; NestJS / PostgreSQL / Prisma / Playwright / Sharp / MinIO / Docker Compose.

**Спецификации:** [PRD.md](PRD.md), [TDD.md](TDD.md). Версия плана: 1.0, 13 октября 2026. PRD определяет поведение, TDD — технические решения; план не изменяет их.

## 1. Правила выполнения

1. Работать из корня репозитория `design-test`. Прочитать локальный AGENTS.md и обе спецификации до первой задачи.
2. До изменения кода проверить рабочее дерево; не включать чужие изменения, `.idea`, `.DS_Store` и секреты в коммиты.
3. Использовать совместимые стабильные версии; Node.js LTS, lockfile и точные теги образов. Для библиотечных API получать актуальные документы через Context7. Не копировать API разных версий Prisma в одну реализацию.
4. Для каждой задачи: добавить указанную проверку поведения, увидеть ожидаемое падение, реализовать минимальное решение, запустить проверку, затем затронутые проверки и typecheck. Для настройки/документации использовать build или smoke вместо искусственных unit-тестов.
5. После проверки результата сделать отдельный осмысленный коммит. Записывать завершённые пункты здесь и доказательства в `docs/IMPLEMENTATION_LOG.md`: задача, commit, команда, результат, ограничения. Отметка `[x]` означает проверенный результат, а не начало работы.
6. Не расширять MVP: нет Figma, diff, AI, full-page, мобильной эмуляции, ролей, SaaS, Redis и realtime.
7. На macOS можно разрабатывать интерфейс/API и выполнять часть тестов. Сетевую изоляцию и эксплуатационную приёмку capture подтверждать на Linux; mock Playwright route не заменяет эти проверки.
8. Перед пилотом все AC-01–AC-19 должны иметь подтверждение. Не запускать браузер с ослабленной защитой ради прохождения демонстрации.

### Неизменяемые ограничения

| Область | Значение |
|---|---|
| Viewport | Целая ширина 320–2560, высота 320–1600; viewport-only, scale 1× |
| Эталон | Статический PNG ≤15 MiB, ≤2560×10000, ≤25,6 млн px; ширина равна viewport |
| Снимок | PNG ≤20 MiB; размеры точно равны viewport |
| Очередь | concurrency=1; ≤20 QUEUED глобально; одно QUEUED/RUNNING на Variant |
| Время | capture 60 s; worker request 65 s; lease 90 s; heartbeat 10 s |
| Хранилище | Мягкая квота 10 GiB с резервами; история не удаляется автоматически |
| Замечания | ≤500 на ревизию; текст 1–5000 символов; координаты исходного снимка |
| История | Immutable PNG/BaselineVersion/ReviewRevision; сообщения и события append-only |
| Доступ | Корпоративный шлюз/VPN; имя автора без собственной регистрации |
| Compose | web, api, worker, capture, postgres, minio; сетевые правила также на хосте |

## 2. Порядок и контрольные точки

| Этап | Задачи | Рабочий результат |
|---|---|---|
| A. Основа | 01–05 | Проекты, страницы и viewport сохраняются и открываются |
| B. Эталоны | 06–08 | Версии PNG загружаются, выбираются и доступны через API |
| C. Захват | 09–14 | Безопасный серверный снимок создаёт неизменяемую ревизию |
| D. Viewer | 15–17 | Три режима сравнения с общей геометрией |
| E. Ревью | 18–20 | Замечания, обсуждения, статусы и ссылки |
| F. Перепроверка | 21–22 | Перенос замечаний между независимыми ревизиями |
| G. Приёмка | 23–25 | Проверенное развёртывание, восстановление и пилот |

Следующая задача начинается после её зависимостей. Viewer сначала использует статические fixture-изображения; API замечаний подключается на этапе E. Это сохраняет проверяемость геометрии до появления обсуждений.

## Этап A. Основа

### Задача 01. Подготовить репозиторий и инструменты

**Зависимости:** нет. **Файлы:** `package.json`, `package-lock.json`, `.gitignore`, `.env.example`, конфигурации TypeScript/lint, `apps/web/package.json`, `apps/api/package.json`, `apps/capture/package.json`, `packages/contracts/package.json`, `docs/IMPLEMENTATION_LOG.md`.

- [x] Зафиксировать версии Node.js и зависимостей; настроить npm workspaces и единый strict TypeScript.
- [x] Добавить root scripts `typecheck`, `lint`, `test:unit`, `test:integration`, `test:e2e`, `build`; каждый запускает соответствующие workspace-команды, а не фиктивный успешный exit.
- [x] Создать минимальные web/API entrypoints и contracts package без экспорта Prisma в браузер.
- [x] Исключить node_modules, build outputs, IDE-файлы, env с секретами и локальные данные storage.
- [x] Установить зависимости по lockfile, выполнить typecheck/lint/build; записать выбранные версии и команды запуска.

**Готово:** чистая установка собирает web/API; секреты отсутствуют в tracked files. Интеграционные/E2E scripts начинают выполнять реальные проверки по мере появления соответствующих тестов, до этого не считаются подтверждением приёмки.

### Задача 02. Поднять локальные зависимости и проверяемую среду

**Зависимости:** 01. **Файлы:** `infra/compose.yml`, `infra/web/default.conf`, Dockerfile приложений, `apps/api/src/config/`, `apps/api/src/database/`, `apps/api/src/main.ts`.

- [x] Поднять PostgreSQL/MinIO с volume и healthcheck; добавить migration service/одноразовую команду запуска миграций.
- [x] Настроить web→API same-origin proxy; production config требует HTTPS корпоративного шлюза.
- [x] Добавить live/ready endpoints и startup validation обязательных настроек.
- [x] Настроить отдельную тестовую БД и bucket, чтобы интеграционные тесты не удаляли рабочие данные.
- [x] Выполнить smoke: API видит DB/storage; при отключении БД ready неуспешен, live остаётся доступным.

**Готово:** воспроизводимый локальный запуск, реальные healthchecks; DB/MinIO не публикуются в production. Capture пока отключён до задачи 11.

### Задача 03. Создать доменную схему и ограничения истории

**Зависимости:** 02. **Файлы:** `prisma/schema.prisma`, `prisma/migrations/`, `tests/integration/schema.spec.ts`.

- [x] Описать все таблицы TDD §3, включая Asset, CaptureJob, IssueReview, reservations и heartbeat.
- [x] Добавить SQL CHECK/FK/unique constraints, индексы и immutable triggers из TDD. Изменяемые поля имеют version.
- [x] Проверить миграции на пустой базе и повторный deploy без изменений.
- [x] Добавить DB-проверки: чужой baseline/source variant запрещён; два active job одного варианта запрещены; UPDATE/DELETE исторических записей запрещён.

**Готово:** ограничения действуют в PostgreSQL независимо от DTO/API. Полные бизнес-проверки таблиц добавляются в соответствующих задачах ниже.

### Задача 04. Реализовать участника, CRUD и архивацию

**Зависимости:** 03. **Файлы:** `packages/contracts/src/`, `apps/api/src/{participants,projects,pages,variants}/`, `tests/integration/structure.spec.ts`.

- [ ] Реализовать participant cookie, Origin check и error envelope по TDD §4; identity не трактовать как подтверждённый аккаунт.
- [ ] Реализовать создание/чтение/PATCH проектов, страниц и вариантов; cursor pagination, числовые/строковые лимиты.
- [ ] Обновлять version условно, соблюдать блокировки Project→Page→Variant; запретить записи в архивированном дереве.
- [ ] Проверить два конкурентных PATCH version=1: один обновляет данные, другой получает 409; разархивирование родителя не снимает архив ребёнка.
- [ ] Проверить DTO с width=319/2561, пустым именем, неизвестным полем; сервер возвращает ошибку, не сохраняет запись.

**Готово:** FR-01, backend часть AC-01/AC-16. Создание проверки ещё не доступно.

### Задача 05. Собрать UI структуры проекта

**Зависимости:** 04. **Файлы:** `apps/web/src/{app,api,projects}/`, `tests/e2e/structure.spec.ts`.

- [ ] Настроить MUI theme/router/QueryClient и типизированный клиент, форму ввода имени участника.
- [ ] Добавить списки/формы проектов, страниц, вариантов; архивацию, loading/empty/error состояния и обработку 409.
- [ ] Реализовать серверные данные через TanStack Query, инвалидировать списки после мутаций.
- [ ] В E2E создать 1440×900, 768×1024 и 375×812; обновить страницу и проверить сохранение всех вариантов.
- [ ] Проверить фокус клавиатуры и сообщения об ошибке в формах.

**Контрольная точка A:** AC-01/AC-16 подтверждены; задачи 01–05 проверены и сохранены.

## Этап B. Эталоны

### Задача 06. Реализовать безопасный PNG decode

**Зависимости:** 03. **Файлы:** `apps/api/src/baselines/png-validator.ts`, `apps/api/src/baselines/png-decoder.ts`, `tests/fixtures/png/`, `tests/integration/png.spec.ts`.

- [ ] Подготовить valid 1440×900, tall 1440×3000, wrong-width 2880×1800, APNG, JPEG-as-PNG, corrupt и oversized fixtures.
- [ ] Ограничить streaming upload 15 MiB; проверить PNG signature/chunks и отсутствие acTL.
- [ ] В child process с лимитами 10 s/512 MiB выполнить полный Sharp decode, pixel limit, sRGB reencode без метаданных; оригинал не resize.
- [ ] Проверить размеры/выход ≤20 MiB, SHA-256 нормализованного файла, корректное сохранение alpha.
- [ ] Проверить, что повреждённый PNG с правдоподобным header не проходит через metadata-only проверку.

**Готово:** AC-02 на уровне обработки файлов; отказ не создаёт BaselineVersion.

### Задача 07. Добавить storage, квоту и версии эталона

**Зависимости:** 06, 04. **Файлы:** `apps/api/src/{storage,assets,baselines}/`, `infra/scripts/orphan-cleanup.ts`, `tests/integration/storage.spec.ts`.

- [ ] Создать приватный bucket и уникальные ключи из UUID; content/preview stream через API, ETag/nosniff/private cache.
- [ ] Под advisory lock резервировать 20 MiB, при публикации заменить резерв фактическим размером; учесть original+preview.
- [ ] Upload создаёт Asset/BaselineVersion и currentBaseline атомарно после успешной записи PNG в MinIO.
- [ ] Реализовать выбор прошлой версии, проверку variantVersion и reset baseline при несовместимой новой ширине.
- [ ] Проверить rollback после storage upload: записи нет, orphan есть; dry-run cleanup не удаляет referenced/active objects, execute удаляет orphan только после 24 h.
- [ ] Проверить гонку двух reservations на границе квоты: только допустимая операция проходит, просмотр старых файлов работает.

**Готово:** FR-02 и основа AC-03/AC-18; замена эталона не перезаписывает PNG.

### Задача 08. Подключить эталоны в интерфейс

**Зависимости:** 07, 05. **Файлы:** `apps/web/src/projects/BaselinesPanel.tsx`, `apps/web/src/api/baselines.ts`, `tests/e2e/baselines.spec.ts`.

- [ ] Добавить upload, историю версий, выбор текущего baseline и превью.
- [ ] Показать понятные ошибки формата/ширины/квоты и предупреждение несовпадающей высоты.
- [ ] Проверить upload B1→B2→выбор B1; обновление браузера сохраняет выбор.
- [ ] Проверить смену ширины: несовместимый currentBaseline сброшен, история файлов доступна.

**Контрольная точка B:** AC-02 подтверждён через UI/API; полный AC-03 подтверждается после появления ревизий.

## Этап C. Захват и ревизии

### Задача 09. Реализовать policy и versioned profiles

**Зависимости:** 04. **Файлы:** `apps/capture/src/policy.ts`, shared policy contract в `packages/contracts/src/`, `apps/api/src/config/capture-profiles.ts`, `infra/policy.example.yml`, `tests/unit/policy.spec.ts`.

- [ ] Реализовать канонический разбор URL, exact hostname/scheme/port, CIDR и hard deny; manifest без destinations запрещает всё.
- [ ] Подготовить проверки userinfo/backslash/control chars/IPv4-mapped IPv6/неразрешённого порта/смешанного A+AAAA.
- [ ] Валидировать origin-scoped BASIC/STORAGE_STATE профили; читать immutable версии без выдачи secrets клиенту.
- [ ] Реализовать `/capture-profiles`; отсутствующая/отозванная версия policy/profile даёт безопасную ошибку.

**Готово:** API и capture используют один контракт policy; UI не меняет allowlist. Полная SSRF-проверка ещё требует задачи 11.

### Задача 10. Реализовать очередь, snapshot и leases

**Зависимости:** 07, 09. **Файлы:** `apps/api/src/captures/{captures.service.ts,queue.service.ts,reaper.ts}`, `apps/api/src/worker.ts`, `tests/integration/queue.spec.ts`.

- [ ] Реализовать POST job: parent locks, подходящий baseline, snapshot конфигурации, requestHash/Idempotency-Key, quota reservation.
- [ ] Ограничить глобальную очередь 20, один active job на Variant; проверять свежесть WorkerHeartbeat перед enqueue.
- [ ] Реализовать claim через FOR UPDATE SKIP LOCKED, RUNNING/attemptToken/lease 90 s, heartbeat 10 s, reaper 10 s.
- [ ] Реализовать cancel только QUEUED, терминальные состояния immutable; автоматического retry нет.
- [ ] Проверить двойной одинаковый POST, другой ключ при active job, тот же ключ с другим телом, cancel/claim race, late publish с устаревшим token.
- [ ] Проверить: lease expiry → FAILED/WORKER_INTERRUPTED, reservation освобождён, новый job допустим.

**Готово:** AC-05/AC-15 на доменном уровне. Worker тестируется с fake capture adapter; реальный браузер подключается после задачи 11.

### Задача 11. Доказать изоляцию реального браузера

**Зависимости:** 09, 02. **Файлы:** `apps/capture/src/{server.ts,browser-launcher.ts}`, `infra/network-policy/`, `infra/scripts/network-smoke.sh`, `tests/network/`.

- [ ] Создать отдельный capture image без DB/MinIO secrets, с launcher/browser UID и фиксированным wrapper из TDD §6.2.
- [ ] Настроить pipe transport, pinned host mappings без DNS fallback, sandbox/seccomp; никакого no-sandbox.
- [ ] Установить operator host-init firewall: browser UID только approved TCP IP/port, deny control/loopback/DNS/UDP; forwarding rule ограничивает capture container.
- [ ] Добавить счётчик входящих bytes через маркировку browser connections; лимит 100 MiB прекращает передачу.
- [ ] На Linux из браузера проверить доступность fixture стенда и отказ DB/API/MinIO/control/metadata/IPv6 loopback, redirect/iframe/rebinding/WS/UDP.
- [ ] При отсутствии правил capture readiness=false; закрыть возможность включить его обходным launch flag.

**Готово:** AC-13 с доказательствами на целевой Linux-среде. Это обязательная контрольная точка перед доступом реального capture к корпоративным стендам. Невозможность обеспечить изоляцию оформляется изменением TDD, а не отключением проверки.

### Задача 12. Реализовать pipeline и закрытые стенды

**Зависимости:** 11, 06. **Файлы:** `apps/capture/src/capture.ts`, `tests/fixtures/sites/`, `tests/integration/capture.spec.ts`.

- [ ] Реализовать внутренний POST /capture: service token до body, body ≤256 KiB, bounded metadata header и PNG либо error JSON.
- [ ] Для каждого задания создать browser/context с DPR=1, ru-RU/UTC/light/reducedMotion, blocked service workers, без downloads/popups.
- [ ] Реализовать navigation/readiness/visible img decode/settleDelay/viewport screenshot по TDD §5; общий deadline 60 s.
- [ ] Применять профиль только к exact origin; authReadySelector обязателен для закрытого стенда, TLS проверяется.
- [ ] Проверить ready selector timeout, broken visible image, 401/500, HTTP 200 login, истёкший profile, анимации и точный размер PNG.
- [ ] Проверить две последовательные авторизованные страницы: cookies и Basic не пересекаются; finally уничтожает browser и временные данные.

**Готово:** AC-04/AC-12/AC-14 для capture; служебные данные не содержат credentials.

### Задача 13. Опубликовать ревизию атомарно

**Зависимости:** 12, 10. **Файлы:** `apps/api/src/captures/publish.service.ts`, `apps/api/src/revisions/`, `tests/integration/publish.spec.ts`.

- [ ] Worker вызывает capture с таймаутом 65 s и ограничением PNG, нормализует/хеширует и сохраняет файл+preview.
- [ ] Publish-транзакция проверяет attemptToken, создаёт Asset/ReviewRevision, number под Variant lock, SUCCEEDED и освобождает reserve.
- [ ] При ошибке установить FAILED без ReviewRevision; если commit уже состоялся, повторный результат читает существующий job.
- [ ] Проверить crash до/после storage upload и до/после DB commit: нет дубля ревизии и ссылок на отсутствующий PNG.
- [ ] Создать R1 с B1, заменить baseline на B2; подтвердить прежние baselineId/hash R1.

**Готово:** AC-03/AC-04/AC-12/AC-15 end-to-end на уровне backend. Переносы подключаются в задаче 21.

### Задача 14. Добавить запуск и историю проверок в UI

**Зависимости:** 13, 08. **Файлы:** `apps/web/src/reviews/`, `apps/web/src/api/captures.ts`, `tests/e2e/capture.spec.ts`.

- [ ] Добавить запуск с одним Idempotency-Key на пользовательское действие, cancel queued, повтор после FAILED с новым ключом.
- [ ] Poll job раз в 2 s; показать QUEUED/RUNNING phases/terminal/error, а не искусственный процент готовности.
- [ ] Реализовать историю заданий/ревизий, последнюю успешную по number и индикатор изменённых после capture настроек/макета.
- [ ] Проверить mutation настроек после enqueue: открывшаяся ревизия отражает старый snapshot.

**Контрольная точка C:** рабочий безопасный снимок и история; AC-03/04/05/12/13/14/15 подтверждены. До задачи 21 создание повторной проверки явно работает без переносов.

## Этап D. Comparison Viewer

### Задача 15. Реализовать чистую геометрию

**Зависимости:** 01. **Файлы:** `apps/web/src/viewer/geometry.ts`, `apps/web/src/viewer/geometry.spec.ts`.

- [ ] Определить Rect/ImagePoint/PanelBounds и функции screen↔image, zoomAroundPoint, pan, normalizeDrag/clamp по TDD §8.
- [ ] Проверить roundtrip для z=0.5/1/2, panel offset и center≠0; ошибка ≤0,5 px.
- [ ] Проверить zoom вокруг точки курсора: image point остаётся тем же; pan delta переводится в image delta/z.
- [ ] Проверить обратный drag, границы 1440×900, NaN/Infinity, minimum rect, независимо от devicePixelRatio экрана.

**Готово:** численная основа AC-07/AC-08. DOM/UI используют те же функции, без второй реализации формул.

### Задача 16. Собрать три режима и управление холстом

**Зависимости:** 15, 14. **Файлы:** `apps/web/src/viewer/{store.ts,ComparisonViewer.tsx,ViewerToolbar.tsx,ImageScene.tsx}`, `tests/e2e/viewer.spec.ts`.

- [ ] Zustand хранит только mode/zoom/center/opacity/slider/tool/selection; размеры и файлы приходят из ревизии.
- [ ] Реализовать img+SVG сцену, top-left alignment, штриховку вне изображения и длинный baseline без ресайза.
- [ ] Добавить overlay opacity 0/50/100%, slider 0/50/100%, side-by-side с общей image center/zoom.
- [ ] Добавить 10–400%, fit, 1:1, pan и сохранение центра при переключении режима/resize.
- [ ] На fixture с контрольными цветными зонами проверить видимость правильного слоя и одинаковую геометрию двух панелей.

**Готово:** AC-06/AC-07 на уровне рендера; превью не используется для сравнения.

### Задача 17. Реализовать выделение прямоугольника

**Зависимости:** 16. **Файлы:** `apps/web/src/viewer/{AnnotationLayer.tsx,usePointerTool.ts}`, `tests/e2e/drawing.spec.ts`.

- [ ] Добавить инструменты draw/pan, pointer capture, Escape, временный pan по Space, pointercancel.
- [ ] В side-by-side рисовать только на screenshot панели; во всех режимах clamp по размерам снимка.
- [ ] Минимум 4 экранных px отделяет клик от drag; черновик выдаёт rect в исходных пикселях.
- [ ] Проверить rect (100,200,300,100) при zoom 50/100/200%, pan, переключении режимов; ниже снимка на длинном baseline выделение невозможно.

**Контрольная точка D:** AC-06/07 и клиентская часть AC-08. Результат draw подключается к реальному сохранению на следующем этапе.

## Этап E. Замечания и обсуждения

### Задача 18. Реализовать создание замечания и список

**Зависимости:** 13, 04. **Файлы:** `apps/api/src/issues/{issues.service.ts,issues.controller.ts}`, `tests/integration/issues.spec.ts`.

- [ ] POST revision/issues атомарно создаёт Issue, OPEN/CONFIRMED IssueReview, первое Comment и CREATED event.
- [ ] Сервер проверяет rect по Asset снимка, текст и автора, архив, лимит 500 и same-variant связи.
- [ ] Добавить список по ревизии с фильтрами/counts и детали исходного Issue.
- [ ] Проверить x=1400,width=100 для снимка 1440: отказ; rect ниже 900: отказ; valid rect: ровно один комплект записей.

**Готово:** серверная часть AC-08, основа AC-09; исходный прямоугольник неизменяем.

### Задача 19. Реализовать комментарии и переходы статусов

**Зависимости:** 18. **Файлы:** `apps/api/src/issues/{comments.service.ts,transitions.service.ts}`, `tests/integration/transitions.spec.ts`.

- [ ] Добавить append-only сообщения с revision context и авторским name snapshot, pagination по createdAt/id.
- [ ] Реализовать OPEN→READY_FOR_REVIEW/RESOLVED, READY_FOR_REVIEW→OPEN/RESOLVED, RESOLVED→OPEN; body обязателен.
- [ ] Транзакционно создать comment/event, обновить state/version; конкурентное старое version → 409 без лишнего comment.
- [ ] Проверить: пустой/5001 символов body отклонён; HTML сохраняется как текст; имя автора истории не меняется после переименования Participant.

**Готово:** AC-09, история статуса и обсуждения не теряется.

### Задача 20. Подключить ревью и deep links в UI

**Зависимости:** 19, 17. **Файлы:** `apps/web/src/issues/`, viewer integration, router ревизий; `tests/e2e/review.spec.ts`.

- [ ] Связать draw→форма→API; при ошибке сохранять текст/черновик, не создавать ложное локальное замечание.
- [ ] Добавить список/фильтры, highlighted rect, центрирование, комментарии с контекстом, действия статусов.
- [ ] Реализовать deep link из TDD §9, проверку связей project/page/variant/revision/issue и понятный 404.
- [ ] Poll issues/comments раз в 10 s только в видимой вкладке; mutation invalidation, явный 409 без optimistic status update.
- [ ] Проверить второй браузерный context: замечание и статус появляются после polling; статус можно изменить клавиатурой.

**Контрольная точка E:** AC-08/09/17, ручное ревью одной ревизии полностью работает.

## Этап F. Повторные проверки

### Задача 21. Реализовать snapshot переносов и независимые статусы

**Зависимости:** 20, 13. **Файлы:** `apps/api/src/captures/{enqueue.service.ts,publish.service.ts}`, `apps/api/src/issues/carry.service.ts`, `tests/integration/carry.spec.ts`.

- [ ] При enqueue с sourceRevisionId копировать согласованный набор ≤500 OPEN/READY_FOR_REVIEW IssueReview и sourceVersion/rect/placement.
- [ ] В publish создать новые IssueReview того же Issue и CARRIED events; RESOLVED не переносить.
- [ ] При том же baseline/viewport и CONFIRMED source переносить rect; иначе NEEDS_REANCHOR с NULL rect и сохранённой source link.
- [ ] Проверить изменение source статуса после enqueue: R2 использует замороженный snapshot; resolve в R2 не меняет R1.
- [ ] Проверить ветку от старой R1, чужую source variant, неуспешный capture: переносов/ревизии нет при FAILED.

**Готово:** AC-10, доменная часть AC-11; новые статусы независимы, исходные PNG остаются прежними.

### Задача 22. Добавить уточнение положения и UX перепроверки

**Зависимости:** 21. **Файлы:** `apps/api/src/issues/placement.service.ts`, `apps/web/src/{issues,reviews}/`, `tests/e2e/recheck.spec.ts`.

- [ ] Реализовать PUT placement с version только для перенесённых замечаний; REANCHORED хранит previous/new rect.
- [ ] Показать источник повторной проверки, выбор новой без переноса, badge NEEDS_REANCHOR и исходные координаты для справки.
- [ ] Не рисовать NULL rect; дать задать актуальную область или закрыть замечание с пояснением.
- [ ] E2E: R1/B1→ready→R2/B1→resolve; затем R3/B2 или изменённый viewport: незакрытые переносы требуют уточнения, без авто-resolve.
- [ ] Сверить hashes/images/status R1 после всех действий; обсуждение общего Issue показывает контекст каждого сообщения.

**Контрольная точка F:** AC-03/10/11 полностью подтверждены; весь основной сценарий PRD реализован.

## Этап G. Приёмка и эксплуатация

### Задача 23. Проверить сбои, лимиты и производительность

**Зависимости:** 22. **Файлы:** `tests/integration/failure-recovery.spec.ts`, `tests/network/`, `tests/performance/`, `docs/ACCEPTANCE_REPORT.md`.

- [ ] Остановить worker/capture при navigation, upload и publish; проверить release lease/reservation, cleanup, отсутствие повторной ревизии.
- [ ] Заполнить очередь/квоту, превысить request/byte/pids/memory лимиты; новые операции отклоняются, просмотр истории остаётся доступным.
- [ ] На 4 vCPU/8 GiB и фиксированных fixtures замерить API p95≤1 s, capture≤15 s без очереди, viewer≤3 s в LAN для 1440×900.
- [ ] Повторить реальные network tests AC-13, two-profile isolation AC-14; проверить отсутствие credentials в логах, metadata и tracked files.
- [ ] Запустить полный набор typecheck/lint/unit/integration/e2e/build; записать результаты и аппаратную конфигурацию.

**Готово:** AC-12/13/14/15/18 подтверждены в production-подобной среде. Если целевые показатели не достигнуты, записать измерение и исправить причину либо согласовать изменение требования.

### Задача 24. Подготовить развёртывание и восстановление

**Зависимости:** 23. **Файлы:** `docs/RUNBOOK.md`, `infra/scripts/{deploy,backup,restore,smoke}.sh`, production compose config.

- [ ] Описать настройку VPN/allowlist/profiles/private CA/секретов, host firewall и startup smoke; использовать шесть контейнеров TDD.
- [ ] Ввести daily backup в согласованное окно без записей: БД, bucket и отдельные operator secrets, зашифрованная копия вне сервера; 7 дневных +4 недельных.
- [ ] Восстановить на чистой изолированной среде, проверить структуру, обсуждение, статусы и SHA-256 контрольных PNG.
- [ ] Замерить RPO≤24 h/RTO≤4 h, описать ежемесячный restore drill, orphan dry-run/execute и обновление образов/миграций.
- [ ] Проверить закрытые DB/MinIO ports, приватный bucket, production HTTPS/cookie и ротацию логов.

**Готово:** AC-19; оператор способен установить и восстановить сервис по RUNBOOK без устных дополнений.

### Задача 25. Закрыть приёмку и провести пилот

**Зависимости:** 24. **Файлы:** `docs/ACCEPTANCE_REPORT.md`, `docs/PILOT_REPORT.md`, этот план.

- [ ] Заполнить AC-01–AC-19: pass/fail, конкретный тест/замер, среда, дата и commit. Непроверенные критерии не маркировать pass.
- [ ] Проверить полный основной сценарий PRD на трёх viewport, ссылки, обновление браузера, архивацию и клавиатурные действия.
- [ ] Зафиксировать исходное время подготовки ревью, пригласить 3–5 коллег в корпоративный контур для 2 проектов/≥10 вариантов.
- [ ] В течение двух недель получить ≥20 завершённых проверок, собрать время подготовки и обратную связь.
- [ ] Разделить проблемы пилота на дефекты MVP и следующие возможности; менять scope только явно. Записать итог пилота и список исправлений.

**Готово:** все критерии приёмки подтверждены, пилот завершён, его результаты записаны; даты пилота назначаются при готовности среды, не вычисляются от даты этого документа.

## 3. Матрица покрытия приёмки

| Критерий | Задачи | Доказательство |
|---|---|---|
| AC-01 | 04, 05 | E2E create→reload трёх viewport |
| AC-02 | 06, 07, 08 | PNG fixtures + UI upload failures |
| AC-03 | 07, 13, 22 | Старые baselineId/PNG SHA-256 неизменны |
| AC-04 | 12, 13, 14 | Exact dimensions + enqueue snapshot |
| AC-05 | 10, 14 | Concurrent POST/idempotency/active job |
| AC-06 | 16 | Overlay/slider endpoints и side-by-side |
| AC-07 | 15, 16, 17 | Roundtrip и один rect при разных transforms |
| AC-08 | 15, 17, 18, 20 | Clamp клиента и отказ API вне снимка |
| AC-09 | 18, 19, 20 | Транзакции, event history, version conflict |
| AC-10 | 21, 22 | Только незакрытые переносы, независимость статуса |
| AC-11 | 21, 22 | Новый baseline/viewport → NEEDS_REANCHOR |
| AC-12 | 12, 13, 23 | FAILED без ревизии, новое задание при повторе |
| AC-13 | 09, 11, 23 | Реальная Linux network isolation |
| AC-14 | 09, 12, 23 | Profile isolation, expired/login fixtures |
| AC-15 | 10, 13, 23 | Restart/lease/fencing без дублей |
| AC-16 | 04, 05, 25 | Архив родителей/детей и чтение истории |
| AC-17 | 20, 25 | Deep link + второй context/polling |
| AC-18 | 07, 10, 23 | Квота, очередь, измерения performance |
| AC-19 | 24 | Восстановление с прежними hashes |

## 4. Общая готовность MVP

- [ ] Задачи 01–24 завершены, проверки записаны в IMPLEMENTATION_LOG и ACCEPTANCE_REPORT.
- [ ] Реальные DB/storage/network tests прошли; проверка всей системы не подменена mocks.
- [ ] Профили/секреты не присутствуют в Git, API-ответах и логах; история доступна только через корпоративный контур.
- [ ] Ревизии/эталоны неизменяемы, статусы замечаний принадлежат конкретной ревизии, переносы не закрываются автоматически.
- [ ] Документация установки/восстановления проверена другим запуском на чистой среде.
- [ ] Все AC-01–AC-19 имеют evidence; пилот задачи 25 завершён и его дефекты зафиксированы.

Расширения Figma/diff/AI/full-page/аккаунтов планируются после оценки пилота отдельными изменениями PRD/TDD и новым планом.

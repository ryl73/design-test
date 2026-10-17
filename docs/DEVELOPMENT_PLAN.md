# Local Screenshot Comparison — Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL use subagent-driven-development or executing-plans. Выполнять задачи последовательно; этот план заменяет серверные задачи версии1. Чекбоксы только для проверенного результата.

**Goal:** сравнивать локальный скриншот сайта и экспорт Figma, оставлять локальные замечания без backend и корпоративной инфраструктуры.

**Architecture:** React/Vite/MUI static SPA; image decode и state в памяти вкладки; DOM/SVG comparison plane и JSON report. Старый server code остаётся в Git, текущая установка — web-only.

**Tech Stack:** существующие закреплённые Node24/React19/Vite8/TypeScript/MUI9, Vitest/Playwright; без новых runtime libraries, если нет обоснованной необходимости.

**Spec:** [PRD.md](PRD.md)2.0, [TDD.md](TDD.md)2.0.

## Global Constraints

- Файлы PNG/JPEG≤15MiB, width1–4096,height1–10000,pixels≤25_600_000; APNG/SVG/GIF запрещены.
- Нет uploads/API/backend/БД/Figma API, внешних шрифтов, аналитики и image persistence.
- Разные размеры допустимы без resample; camera.zoom .01–4; rect в site pixels.
- Notes≤500, body trim1–5000, states OPEN/RESOLVED; JPEG EXIF consistent decoded/rendered size.
- Замена с notes требует подтверждения; невалидный новый файл сохраняет прежнее состояние.
- Сессия живёт только в памяти, export JSON без images/blobURL. UI объясняет потерю при reload.
- Старые реальные volumes/данные не удаляются; Git сохраняет удаляемый код.
- Сначала настоящий RED, затем код, GREEN, review и осмысленный commit. Для docs/config — build/smoke вместо искусственных unit tests.

## Task 1. Перевести рабочую среду на статический frontend

**Files:** root package.json/lock, apps/web/package.json/configs/App/main, eslint, README, docs/LOCAL_SETUP; удалить apps/api, apps/capture, packages/contracts, prisma*, серверные scripts/tests, старые web/api и projects/ компоненты, старую .env.example, server Dockerfiles/overrides. Сохранить infra/Dockerfile.web + web/default.conf + compose.yml как web-only preview.

**Interfaces:** consumes existing React/MUI toolchain/theme. Produces root npm scripts dev/start/preview/build/typecheck/lint/test:unit/test:integration/test:e2e, apps/web/src/pages/compare/index.ts page entry. Placeholder page только как краткая интеграционная граница до Task3, не результат приёмки.

- [x] Сохранить подтверждённые PRD/TDD/plan2; проверить git status, работать в уже существующей isolated worktree.
- [x] Удалить только tracked obsolete server code и старые зависимые тесты; не трогать Docker volumes/пользовательские файлы и sources/.
- [x] Root workspaces=['apps/web']; scripts dispatch real web commands; TypeScript/lint/build не вызывают Prisma/DB. Удалить obsolete dependencies и npm ci по обновлённому lockfile.
- [x] Единственный App — theme+compare page; без queryclient/router/participants. Удалить API proxy и backend env/test guards.
- [x] Playwright запускает только production static webserver, Chromium sandbox=true. Integration tag @integration, E2E grepInvert; actual suites добавятся Task2/3, не passWithNoTests.
- [x] Web Dockerfile собирает только web, nginx раздаёт static. Compose только web на127.0.0.1:58080 и HTTP healthcheck; нет DB ports/secrets/dependencies.
- [x] README/LOCAL_SETUP описывают npm ci/dev/build/preview без env/Docker; Docker необязателен. Отдельно пометить исторический IMPLEMENTATION_LOG.
- [x] `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build` безDATABASE_URL/MinIO/docker проходят; проверить bundle не содержит старых /api routes. Commit.

## Task 2. Реализовать браузерные image/geometry/notes модели

**Files:** pages/compare/model/image-file.ts, geometry.ts, annotations.ts и focused unit tests рядом; tests/fixtures/images либо fixture helper; browser file integration tests.

**Interfaces:** exact exports/types TDD§3. Task3 потребляет imageToScreen/screenToImage/zoomAt/fitCamera/clampRect/clampZoom, loadImageFile/releaseImage, validateNoteBody/Rect/createReport.

- [x] RED unit: `screenToImage(imageToScreen({x:120,y:230},camera,viewport),camera,viewport)` при .5/1/2 и pan возвращает исходную точку≤0.5px; zoomAt сохраняет anchor; reverse/outside rect clamp; zero drag=null.
- [x] RED file header tests PNG/JPEG, APNG/acTL, corrupt/unknown signature,15MiB+1, width4097,height10001,pixels25_600_001. Конечные числа проверяются.
- [x] Реализовать bounded header readers, validate-before-decode, actual createImageBitmap+close, create/revoke URL; typed helpful errors. Проверить orientation и decode failures реальным browser integration, без серверов.
- [x] Реализовать math exports по формулам TDD§5, без DOM dependencies и избыточных абстракций.
- [x] RED notes/report: whitespace body error,5001 error, out-of-bounds rect error, no image URL/binary fields in JSON. Реализовать validation и export shape.
- [x] Подготовить настоящие synthetic PNG/JPEG fixtures. Реальный browser @integration запускается в Task3 через file pickers готового UI: valid/corrupt/unsupported/oversize inputs. В Task2 не добавлять тестовые API/hooks в production page ради доступа к модели.
- [x] Focused tests +typecheck/lint/build проходят. Записать RED/GREEN, commit.

Task2 evidence: 22 unit tests/typecheck/lint/build PASS (2026-10-16). Task3 browser integration added real orientation/decode and URL lifecycle checks (2/2 PASS), completing the remaining browser checkbox. Fixtures are committed; oversized input is generated in browser tests. RED began with missing module exports.

## Task 3. Собрать comparison workspace и локальные замечания

**Files:** pages/compare/ui/{ComparePage,ImagePicker,ComparisonCanvas,CompareToolbar,NotesPanel}.tsx; model/use-comparison.ts; App wiring, theme при необходимости, tests/e2e/local-comparison.spec.ts и browser @integration tests.

**Interfaces:** потребляет Task2 exact model exports; site/figma slots, mode/camera/tool, local notes and drafts. Public page через pages/compare/index.ts.

- [x] Написать E2E сначала: реальные двафайла → три режима → rect → note → JSON download; увидеть RED отсутствующего поведения.
- [x] Два file pickers с именами/размерами/error/loading; одна pending generation на слот, release всех неиспользуемых URL, состояние StrictMode безопасно.
- [x] Overlay opacity0/50/100, draggable+keyboard divider0/50/100, side-by-side Figma/site, hatch outside image. Не растягивать исходники.
- [x] Общие camera/zoom1–400, fit/1:1/+/-/zoomanchor, pan/Space/Escape/pointercancel. Смена режима сохраняет center/zoom. Мобильная375px компоновка без overflow.
- [x] Draw только site plane, clamp и zoom transforms; draft form, plain-text body, select/highlight/center, edit text, OPEN/RESOLVED/delete, limit500.
- [x] Candidate replacement сначала validate/decode, затем confirm при notes; cancel/invalid сохраняет пару/notes; confirm очищает. Clear/reset такие же.
- [x] Экспорт JSON и сообщение о памяти вкладки; beforeunload дополнительный. Не обещать восстановление/export images.
- [x] Browser tests: different sizes, actual JPEG/PNG, invalidreplace, rapid selection, URL cleanup, 50/100/200% rect coordinates, leftpane draw rejected, note selection/status/delete, textHTMLsafe, cancel/reset, export exactfields, network requests absent afterinitialload, keyboard/mobile.
- [x] Визуально проверить populated desktop/mobile screenshots с fixture-парой. Полный unit/integration/E2E/typecheck/lint/build. Заполнить LC evidence, commit.

Task3 evidence: RED placeholder scenario; baseline `eb35a88` прошёл unit 22/22, integration 2/2, E2E 5/5. Независимый scoped review выявил проблемы нового черновика при редактировании заметки, Space на кнопках, индикации загрузки по слотам и очистки URL; исправления вошли в `acce610` и приняты повторным scoped review. Финальные проверки на `acce610`: unit 22/22, integration 4/4, E2E 8/8, typecheck/lint/production build exit0. Populated desktop/mobile screenshots и LC-01–LC-12 перечислены в IMPLEMENTATION_LOG.

## Task 4. Проверить переход и показать результат

**Files:** docs/IMPLEMENTATION_LOG.md, README/LOCAL_SETUP, current plan; optional static Docker preview.

- [x] Независимое code/spec review всей новой концепции, исправить реальные findings с regression tests.
- [x] Выполнить clean npm ci и все root checks без env/БД/Docker. Tests действительно проверяют локальные файлы и geometry, не skip.
- [x] Обновить preview localhost58080 статическим web, старые api/postgres/minio остановить без volume deletion; проверить UI не делает /api calls и работает с браузером offline послеinitialload.
- [x] Сверить LC-01–LC-12 с evidence; описать ограничения in-memory/форматы и команды запуска. Сохранить checked progress и commit log.

Task4 evidence: clean npm ci на `eb35a88` добавил 213 пакетов; 2026-10-16 после исправлений parent независимо проверил все root suites на `acce610` (22 unit, 4 integration, 8 E2E, typecheck/lint/production build). Docker web preview `acce610` healthy на 127.0.0.1:58080, HTTP200 и новый asset подтверждены, в том числе повторно 2026-10-17; legacy api/postgres/minio остановлены без удаления контейнеров и volumes. Финальный whole-branch review подтвердил PRD/TDD v2 без новых actionable findings.

## Пересмотр старого плана

Прежний этап A реализован в commits до3c50bc4 и описан в IMPLEMENTATION_LOG как исторический. Его server acceptance, очередь/capture/security manifest/backup/pilot больше не являются зависимостями локальной версии. Дальнейшие работы определяются этим планом, а не незавершёнными задачами старой версии.

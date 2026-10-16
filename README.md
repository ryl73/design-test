# Design QA — локальное сравнение

Статическое браузерное приложение для сравнения двух вручную выбранных PNG/JPEG и локальных замечаний. Доступны наложение, разделитель, вид рядом, прямоугольные области на скриншоте сайта, заметки и JSON-экспорт.

Нужны Node.js 24.21.0 и npm 11.19.0 (версии закреплены в репозитории).

```sh
npm ci
npm run dev
```

Vite покажет адрес локального приложения. `npm start` — синоним dev. Для production preview:

```sh
npm run build
npm run preview
```

Переменные окружения, backend и Docker не нужны. Сессия живёт только в памяти вкладки: перезагрузка закрывает изображения и замечания. JSON-экспорт содержит заметки и метаданные пары без изображений; восстановление из JSON не предусмотрено.

Проверки: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`. Integration выбирает браузерные тесты с тегом `@integration`; E2E исключает их. Для браузерных проверок нужен Chromium Playwright (`npx playwright install chromium`).

Необязательный web-only Docker preview: `docker compose -f infra/compose.yml up --build -d web`, адрес http://127.0.0.1:58080. Перед переключением со старой серверной версии см. [локальную настройку](docs/LOCAL_SETUP.md). Существующие volumes и данные не удалять.

Требования: [PRD](docs/PRD.md), [TDD](docs/TDD.md). Старый серверный код доступен в Git до коммита 3c50bc4; [журнал](docs/IMPLEMENTATION_LOG.md) сохраняет историю версии 1 и доказательства новой версии.

# Локальный запуск версии 2

Используйте Node.js 24.21.0 и npm 11.19.0. При наличии nvm выполните `nvm use` в корне проекта.

```sh
npm ci
npm run dev
```

Откройте адрес Vite. `npm start` запускает тот же сервер разработки. Настройки `.env`, БД, Prisma, MinIO и Docker для этого не нужны. Старые локальные `.env` не удаляются и приложением не используются.

Production preview:

```sh
npm run build
npm run preview -- --port 58080 --strictPort
```

Дополнительные параметры корневого preview передаются серверу Vite.

Проверки выполняются из корня: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`. Playwright сам собирает production frontend и запускает только статический preview на 127.0.0.1:55310. Chromium sandbox включён. Integration использует тег `@integration`, E2E его исключает. Для браузерных проверок нужен установленный Chromium Playwright (`npx playwright install chromium`).

## Необязательный Docker preview

```sh
docker compose -f infra/compose.yml up --build -d web
```

Адрес: http://127.0.0.1:58080. Compose содержит только nginx/web, без секретов, runtime env и API proxy. Проверка здоровья — HTTP GET главной страницы.

При переходе со старой среды сначала проверьте, свободен ли порт 58080. Старые контейнеры могут продолжать работать; остановка старых api/postgres/minio и обновление preview отслеживаются отдельно в Task 4. Не выполнять `down -v`, удаление volumes или очистку пользовательских данных. Удалённый серверный код восстановим из Git (3c50bc4 и ранее).

## Память сессии

Выбранные изображения и замечания существуют только в памяти текущей вкладки. Перезагрузка/закрытие уничтожают сессию. JSON-экспорт содержит замечания и метаданные пары, без изображений; импорт и восстановление не входят в текущую версию. Поддерживаются PNG/JPEG до 15 MiB с ограничениями размеров из [PRD](PRD.md); анимированные и другие форматы отклоняются.

import { test, expect } from "@playwright/test";
test.use({ extraHTTPHeaders: { Origin: "http://localhost:55310" } });
test("participant creates persisted project, page and three viewport variants", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Указать имя" }).click();
  await page.getByLabel("Имя участника").fill("Дизайнер E2E");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByRole("button", { name: "Новый проект" }).click();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByText("Введите название")).toBeVisible();
  await expect(page.getByLabel("Название", { exact: true })).toBeFocused();
  const name = "Проверка " + Date.now();
  await page.getByLabel("Название", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByRole("link", { name, exact: true }).click();
  await page.getByRole("button", { name: "Новая страница" }).click();
  await page.getByLabel("Название", { exact: true }).fill("Главная");
  await page.getByLabel("URL страницы").fill("https://example.com/");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByRole("link", { name: "Главная", exact: true }).click();
  for (const [w, h] of [
    [1440, 900],
    [768, 1024],
    [375, 812],
  ]) {
    await page.getByRole("button", { name: "Новый вариант" }).click();
    await page.getByLabel("Название", { exact: true }).fill(`${w} × ${h}`);
    await page.getByLabel("Ширина").fill(String(w));
    await page.getByLabel("Высота").fill(String(h));
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: `${w} × ${h}`, exact: true }),
    ).toBeVisible();
  }
  await page.reload();
  for (const size of ["1440 × 900", "768 × 1024", "375 × 812"])
    await expect(
      page.getByRole("heading", { name: size, exact: true }),
    ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: new URL(
      "../../.superpowers/sdd/DEVELOPMENT_PLAN/task-5-desktop.png",
      import.meta.url,
    ).pathname,
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await page.screenshot({
    path: new URL(
      "../../.superpowers/sdd/DEVELOPMENT_PLAN/task-5-mobile.png",
      import.meta.url,
    ).pathname,
    fullPage: true,
  });
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Перейти к содержимому" }),
  ).toBeFocused();
});
test("archives preserve child flags and inherited state blocks restore", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Указать имя" }).click();
  await page.getByLabel("Имя участника").fill("Архив");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Архив", exact: true }),
  ).toBeVisible();
  const project = await page.request.post("/api/v1/projects", {
    data: { name: "Архив " + Date.now() },
  });
  expect(project.ok()).toBeTruthy();
  const p = await project.json();
  const response = await page.request.post(`/api/v1/projects/${p.id}/pages`, {
    data: { name: "Страница архива", url: "https://example.com/" },
  });
  expect(response.ok()).toBeTruthy();
  const child = await response.json();
  await page.goto(`/projects/${p.id}`);
  await page
    .getByRole("button", { name: "Архивировать Страница архива" })
    .click();
  await expect(page.getByText("В собственном архиве")).toBeVisible();
  await page.getByRole("button", { name: `Архивировать ${p.name}` }).click();
  await expect(
    page.getByText("Родитель в архиве", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Восстановить Страница архива" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: `Восстановить ${p.name}` }).click();
  await expect(
    page.getByRole("button", { name: "Восстановить Страница архива" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Восстановить Страница архива" })
    .click();
  await expect(page.getByText("В собственном архиве")).toHaveCount(0);
  const persisted = await (
    await page.request.get(`/api/v1/pages/${child.id}`)
  ).json();
  expect(persisted.archivedAt).toBeNull();
});
test("conflicting edit retains draft and asks for explicit review before save", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Указать имя" }).click();
  await page.getByLabel("Имя участника").fill("Конфликт");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Конфликт", exact: true }),
  ).toBeVisible();
  const p = await (
    await page.request.post("/api/v1/projects", {
      data: { name: "Конфликт " + Date.now() },
    })
  ).json();
  await page.goto(`/projects/${p.id}`);
  await page.getByRole("button", { name: `Изменить ${p.name}` }).click();
  await page.getByLabel("Название", { exact: true }).fill("Мой черновик");
  expect(
    (
      await page.request.patch(`/api/v1/projects/${p.id}`, {
        data: { version: p.version, name: "Изменено коллегой" },
      })
    ).ok(),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByText("Данные изменены другим участником. Черновик сохранён."),
  ).toBeVisible();
  await expect(page.getByLabel("Название", { exact: true })).toHaveValue(
    "Мой черновик",
  );
  await page
    .getByRole("button", { name: "Загрузить актуальные данные" })
    .click();
  await expect(page.getByLabel("Название", { exact: true })).toHaveValue(
    "Изменено коллегой",
  );
});
test("variant metadata rename only patches changed fields and preserves settings", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Указать имя" }).click();
  await page.getByLabel("Имя участника").fill("Редактор");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Редактор", exact: true }),
  ).toBeVisible();
  const project = await (
    await page.request.post("/api/v1/projects", {
      data: { name: "Настройки " + Date.now() },
    })
  ).json();
  const child = await (
    await page.request.post(`/api/v1/projects/${project.id}/pages`, {
      data: { name: "Настройки", url: "https://example.com/" },
    })
  ).json();
  const variant = await (
    await page.request.post(`/api/v1/pages/${child.id}/variants`, {
      data: {
        name: "Исходный",
        viewportWidth: 1440,
        viewportHeight: 900,
        urlOverride: "https://example.com/other",
        readySelector: "main",
        settleDelayMs: 250,
      },
    })
  ).json();
  await page.goto(`/projects/${project.id}/pages/${child.id}`);
  await page.getByRole("button", { name: "Изменить Исходный" }).click();
  await page.getByLabel("Название", { exact: true }).fill("Новое имя");
  const patch = page.waitForRequest(
    (r) =>
      r.method() === "PATCH" && r.url().endsWith(`/variants/${variant.id}`),
  );
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  expect((await patch).postDataJSON()).toEqual({
    name: "Новое имя",
    version: variant.version,
  });
  await expect(
    page.getByRole("heading", { name: "Новое имя", exact: true }),
  ).toBeVisible();
  const saved = await (
    await page.request.get(`/api/v1/variants/${variant.id}`)
  ).json();
  expect(saved.urlOverride).toBe("https://example.com/other");
  expect(saved.readySelector).toBe("main");
  expect(saved.settleDelayMs).toBe(250);
  await page.getByRole("button", { name: "Изменить Новое имя" }).click();
  await page.getByRole("button", { name: "Дополнительные настройки" }).click();
  await expect(page.getByLabel("URL варианта")).toHaveValue(
    "https://example.com/other",
  );
  await page.getByLabel("URL варианта").fill("https://example.com/alternate");
  await page.getByLabel("Селектор готовности", { exact: true }).fill("#ready");
  await page.getByLabel("Задержка после готовности").fill("500");
  await page.getByLabel("Селектор готовности авторизации").fill("#account");
  await page.getByRole("combobox", { name: "Профиль доступа" }).click();
  await page
    .getByRole("option", {
      name: "Тестовый профиль · v1 · https://example.com",
    })
    .click();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const configured = await (
    await page.request.get(`/api/v1/variants/${variant.id}`)
  ).json();
  expect(configured).toMatchObject({
    urlOverride: "https://example.com/alternate",
    readySelector: "#ready",
    settleDelayMs: 500,
    authReadySelector: "#account",
    authProfileRef: { profileId: "e2e-profile", version: 1 },
  });
});
test("page form keeps draft after server policy error; pagination retrieves persisted records", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Указать имя" }).click();
  await page.getByLabel("Имя участника").fill("Пагинация");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Пагинация", exact: true }),
  ).toBeVisible();
  const project = await (
    await page.request.post("/api/v1/projects", {
      data: { name: "Список " + Date.now() },
    })
  ).json();
  await page.goto(`/projects/${project.id}`);
  await expect(page.getByText("Пока нет записей")).toBeVisible();
  await page.getByRole("button", { name: "Новая страница" }).click();
  await page.getByLabel("Название", { exact: true }).fill("Черновик страницы");
  await page.getByLabel("URL страницы").fill("https://unapproved.example/");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByText(
      "Этот адрес не разрешён настройками проекта. Проверьте URL.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Название", { exact: true })).toHaveValue(
    "Черновик страницы",
  );
  await expect(page.getByLabel("URL страницы")).toHaveValue(
    "https://unapproved.example/",
  );
  await page.getByLabel("URL страницы").fill("https://example.com/");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Черновик страницы" }),
  ).toBeVisible();
  for (let i = 0; i < 31; i++) {
    const response = await page.request.post(
      `/api/v1/projects/${project.id}/pages`,
      { data: { name: `Страница ${i}`, url: `https://example.com/${i}` } },
    );
    expect(response.ok()).toBeTruthy();
  }
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Загрузить ещё" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Страница 30", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Загрузить ещё" }).click();
  await expect(
    page.getByRole("link", { name: "Страница 30", exact: true }),
  ).toBeVisible();
});

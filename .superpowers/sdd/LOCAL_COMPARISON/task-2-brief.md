## Task 2. Реализовать браузерные image/geometry/notes модели

**Files:** pages/compare/model/image-file.ts, geometry.ts, annotations.ts и focused unit tests рядом; tests/fixtures/images либо fixture helper; browser file integration tests.

**Interfaces:** exact exports/types TDD§3. Task3 потребляет imageToScreen/screenToImage/zoomAt/fitCamera/clampRect/clampZoom, loadImageFile/releaseImage, validateNoteBody/Rect/createReport.

- [x] RED unit: `screenToImage(imageToScreen({x:120,y:230},camera,viewport),camera,viewport)` при .5/1/2 и pan возвращает исходную точку≤0.5px; zoomAt сохраняет anchor; reverse/outside rect clamp; zero drag=null.
- [x] RED file header tests PNG/JPEG, APNG/acTL, corrupt/unknown signature,15MiB+1, width4097,height10001,pixels25_600_001. Конечные числа проверяются.
- [ ] Реализовать bounded header readers, validate-before-decode, actual createImageBitmap+close, create/revoke URL; typed helpful errors. Проверить orientation и decode failures реальным browser integration, без серверов.
- [x] Реализовать math exports по формулам TDD§5, без DOM dependencies и избыточных абстракций.
- [x] RED notes/report: whitespace body error,5001 error, out-of-bounds rect error, no image URL/binary fields in JSON. Реализовать validation и export shape.
- [x] Подготовить настоящие synthetic PNG/JPEG fixtures. Реальный browser @integration запускается в Task3 через file pickers готового UI: valid/corrupt/unsupported/oversize inputs. В Task2 не добавлять тестовые API/hooks в production page ради доступа к модели.
- [x] Focused tests +typecheck/lint/build проходят. Записать RED/GREEN, commit.


Task2 evidence: 22 unit tests/typecheck/lint/build PASS (2026-10-16). Header/decode/URL implementation ready; real browser orientation/decode/lifecycle verification remains Task3, so the combined browser checkbox remains unchecked. Fixtures are committed; oversized input is generated in browser tests. RED began with missing module exports; no browser decode acceptance is claimed.

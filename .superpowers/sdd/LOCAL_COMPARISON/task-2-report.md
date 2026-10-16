# Task 2 report

Status: model implementation and focused verification complete; browser integration deferred to Task3 as brief requires.

RED: initial unit run failed with missing geometry module. GREEN: 22 unit tests pass; typecheck, lint and production build pass on Node24.21.0. Tests use real byte parsing/math/report logic; there is no mocked decode acceptance. Browser decode, EXIF orientation and URL lifecycle remain unverified until UI integration.

## Public export guide for Task3

- geometry.ts exports Size, Point, Rect, Camera, ComparisonMode and all six TDD functions. Camera.center is in image/world pixels, anchor is local viewport pixels. fitCamera requires positive viewport/world sizes (defer fit until measurement). clampZoom throws on nonfinite, otherwise clamps .01–4. clampRect returns null for nonfinite/zero/subpixel or fully outside drags.
- image-file.ts exports ImageHeader, ComparisonImage, ImageFileError (code FORMAT/CORRUPT/ANIMATED/SIZE/DECODE/READ), parseImageHeader, validateImageSize, loadImageFile, releaseImage. Load rejects before publishing URL, closes ImageBitmap, returns browser-decoded dimensions and a sanitized filename. UI owns async generations/confirmation/old-slot retention and must release candidates/previous/current URLs at correct lifecycle transitions. Error.message is Russian and display-ready.
- annotations.ts exports ComparisonNote, validateNoteBody, validateNoteRect, createReport. Validation throws Error, body returns trimmed text, createReport copies explicit safe fields/rects, rejects empty/>500 notes and invalid statuses. UI owns note IDs and editing state. Report has inferred typed shape with schemaVersion1, exportedAt, site/figma{name,width,height}, notes{id,rect,body,state}; it has no image URL, bytes, MIME or File objects.

## Fixtures

Committed apps/web/tests/fixtures/images/: site-320x240.png, figma-300x200.png, site-320x240.jpg, oriented-240x320.jpg (encoded320×240, EXIF6, expected browser240×320), animated.png, corrupt.png, decode-corrupt.png (valid chunks/header, broken IDAT), unsupported.gif, width-limit.png, height-limit.png, pixels-limit.png. These are synthetic; no user images. Optional generate.py recreates files, but browser suites use checked-in bytes directly. Create oversize file with Buffer.alloc(15*1024*1024+1) in browser test, not checked-in binary. Generation also produced local /tmp/design-qa-image-fixtures for convenience, never a test dependency.

## Pending browser checks

Use actual UI file inputs: valid PNG/JPEG/EXIF decoded dimensions; corrupt decode and APNG rejection preserve prior slot; type/size limits; stale generation release, replace cancel/confirm, clear/unmount URL cleanup; no upload/network. No production hooks or module bridges added. Task2 combined browser checklist stays unchecked until those real checks run.

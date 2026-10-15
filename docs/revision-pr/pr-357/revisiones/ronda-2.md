# PR 357 - Round 2
Reviewed SHA: 7909e3bca66e29980b3bd6bb9b3c536844143f1a.
Status: BLOCKED. E2E run 38758120713: 76 passed, 2 failed. Main flow 5 passed in 33.2 seconds.

R01: Newly added action text matches an existing label. Two Playwright tests in e2e/specs/multi-drop.spec.ts at lines 313 and 723 fail with strict-mode ambiguity. The trace identifies a paragraph and a link. Adjust the action text in permitted components and keep a descriptive accessible name. Do not modify the external test.

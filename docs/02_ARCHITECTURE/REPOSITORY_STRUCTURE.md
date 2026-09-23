# Repository Structure

```text
workout-coach/
├─ apps/
│  └─ web/
│     ├─ src/
│     ├─ public/
│     ├─ index.html
│     ├─ package.json
│     └─ README.md
├─ docs/
│  ├─ 00_INDEX.md
│  ├─ 01_PRODUCT/
│  ├─ 02_ARCHITECTURE/
│  ├─ 03_FEATURES/
│  ├─ 04_DESIGN/
│  ├─ 05_DEVELOPMENT/
│  ├─ 06_DECISIONS/
│  ├─ 07_STATUS/
│  └─ _templates/
├─ scripts/
├─ tests/
├─ dist/                 # 생성물, Git에서 제외
├─ AGENTS.md
├─ README.md
├─ package.json
├─ pnpm-workspace.yaml
└─ pnpm-lock.yaml
```

앱이 하나뿐이므로 `packages/`는 아직 생성하지 않는다. 루트 `scripts/`와 `tests/`는 GAS 빌드와 여러 화면 크기의 통합 검증을 함께 관리하는 레포 공통 도구다.

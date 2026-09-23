# Workout Coach 문서 안내

이 레포의 문서 구조는 [바이브코딩 기본 레포·문서 구조 템플릿](https://app.notion.com/p/54af676439d04145b2557f7957199e6a?pvs=204)을 기준으로 정리했다.

## 읽는 순서

1. [`AGENTS.md`](../AGENTS.md) — 레포 작업 규칙
2. [`07_STATUS/CURRENT.md`](07_STATUS/CURRENT.md) — 실제 현재 상태
3. [`01_PRODUCT/PRD.md`](01_PRODUCT/PRD.md) — 제품 목표와 범위
4. [`01_PRODUCT/PLAN.md`](01_PRODUCT/PLAN.md) — 단계별 작업 계획
5. 관련 기능의 구조·디자인·개발 문서
6. `apps/web/`의 실제 코드

## 문서 분류

| 폴더 | 내용 |
| --- | --- |
| [`01_PRODUCT`](01_PRODUCT/) | 제품 요구사항, 범위, 단계 계획 |
| [`02_ARCHITECTURE`](02_ARCHITECTURE/) | 앱 구조, 저장 데이터, 레포 책임 |
| [`03_FEATURES`](03_FEATURES/) | 기능별 흐름과 완료 기준 |
| [`04_DESIGN`](04_DESIGN/) | 화면·상호작용·시각 기준 |
| [`05_DEVELOPMENT`](05_DEVELOPMENT/) | 설치, 테스트, GitHub Pages·GAS 배포 |
| [`06_DECISIONS`](06_DECISIONS/) | 구조와 기술 선택의 이유 |
| [`07_STATUS`](07_STATUS/) | 현재 상태, 다음 작업, 작업 기록, 변경 내역 |
| [`_templates`]( _templates/) | 기능 문서와 ADR 작성 양식 |

기본 공개 배포는 [GitHub Pages 안내](05_DEVELOPMENT/GITHUB_PAGES.md), 기존 Apps Script 배포는 [GAS 배포 안내](05_DEVELOPMENT/GAS_DEPLOYMENT.md)를 참고한다.

문서에 적힌 경로는 레포 루트 기준으로 작성하지 않고, 각 문서의 위치에서 실제 파일까지 연결되는 상대 경로를 사용한다. 자동 생성되는 `dist/`는 문서가 아니라 빌드 산출물이다.

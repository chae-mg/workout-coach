# Workout Coach

개인용 홈트레이닝 진행 보조 웹앱입니다. 운동 선택, 세트·휴식 타이머, 반복 알람, 시간 운동과 설정 저장을 제공합니다.

## 실행

공개 앱: [https://chae-mg.github.io/workout-coach/](https://chae-mg.github.io/workout-coach/)

로컬에서는 Node.js 22 이상과 pnpm을 준비하고 다음 명령을 실행합니다.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

브라우저에서 `http://127.0.0.1:4173`을 엽니다.

## 배포

기본 배포 대상은 GitHub Pages이며 GitHub Actions가 `apps/web/`의 정적 파일만 게시합니다. 앱은 브라우저 모듈을 직접 사용하므로 별도 빌드가 필요하지 않습니다. 이 저장소의 Pages 원본은 `GitHub Actions`로 설정되어 있고 `main`의 앱 변경을 자동 배포합니다. 상세 절차와 저장 데이터의 출처별 경계는 [GitHub Pages 배포 안내](./docs/05_DEVELOPMENT/GITHUB_PAGES.md)에 있습니다.

기존 GAS v4 배포는 유지되며, 앱 설정과 진행 상태는 GAS 주소와 Pages 주소 사이에서 자동 이동하지 않습니다. GAS 파일 생성·배포는 [GAS 배포 안내](./docs/05_DEVELOPMENT/GAS_DEPLOYMENT.md)를 참고합니다.

## 개발과 검증

```sh
pnpm test
pnpm test:browser
pnpm test:mobile
```

사운드·기기 보조 기능은 실제 휴대폰에서도 별도 확인해야 합니다. 자동 브라우저 검사 결과와 실기기 결과는 [모바일 검수 기록](./docs/07_STATUS/MOBILE_QA.md)에서 구분합니다.

## 구조

```text
apps/web/                 브라우저 앱과 Pages 게시 대상
apps/web/src/core/        운동 상태, 설정과 시간 계산
apps/web/src/browser/     localStorage, Web Audio, Wake Lock
apps/web/src/ui/          화면과 스타일
docs/                     제품·구조·개발·상태 문서
scripts/                  로컬 서버, 브라우저 테스트, 이전 GAS 빌드
tests/                    핵심 로직 테스트
```

설정과 현재 운동은 브라우저 `localStorage`에만 저장합니다. 계정, 서버, 데이터베이스와 기기 간 동기화는 제공하지 않습니다.

제품 문서는 [문서 안내](./docs/00_INDEX.md), 현재 프로젝트 상태는 [CURRENT.md](./docs/07_STATUS/CURRENT.md)를 참고합니다.

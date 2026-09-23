# Workout Coach Architecture

## 실행 흐름

```text
apps/web/index.html
  → apps/web/src/main.js
  → ui/views.js + ui/styles.css
  → core/session.js + core/settings.js
  → browser/storage.js + browser/effects.js
```

운동 정의와 브랜딩 값은 `apps/web/src/data/exercises.js`에 있다. 브라우저 저장소와 Web Audio는 `apps/web/src/browser/`에 두고, 상태 전환·입력 병합·시간 계산은 DOM과 분리한 `apps/web/src/core/`에서 처리한다.

로컬 앱은 `scripts/serve.js`가 `apps/web/`을 제공한다. 기본 공개 배포는 GitHub Actions가 같은 정적 파일을 GitHub Pages에 게시한다. 앱은 상대 경로를 사용하는 브라우저 ES 모듈이라 빌드가 필요하지 않다. GAS 번들은 `scripts/build-gas.js`로 별도 생성할 수 있는 이전 호환 경로다.

## 저장 경계

- 설정과 진행 중 세션은 사용자 브라우저의 `localStorage`에만 저장한다.
- GitHub Pages와 기존 GAS 배포는 정적 HTML을 제공하며 계정별 데이터베이스 역할을 하지 않는다.
- 각 출처의 `localStorage`는 서로 분리되므로 배포 주소를 바꾸면 설정·진행 상태도 자동 이전되지 않는다.
- `packages/`는 다른 실행 앱에서 실제로 공유할 코드가 생길 때까지 만들지 않는다.

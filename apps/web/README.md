# Workout Coach Web App

이 폴더는 Workout Coach의 브라우저 앱 원본이다.

- `src/`: 화면, 상태 전환, 저장소, Web Audio, 운동 데이터
- `public/`: 로컬 앱에서 직접 제공하는 아이콘과 샘플 SVG
- `index.html`: 로컬 앱 진입점

GitHub Pages는 이 폴더의 정적 파일만 게시한다. `index.html`의 상대 경로와 브라우저 ES 모듈을 그대로 사용하므로 별도 빌드가 필요하지 않다. 로컬 실행·테스트 명령은 루트 `package.json`에 있고 GAS 번들은 이전 호환 대상으로 `scripts/`에서 생성할 수 있다. 공통 코드는 두 번째 실행 앱에 실제로 필요해질 때만 루트 `packages/`로 분리한다.

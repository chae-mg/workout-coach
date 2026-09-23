# Current Status

- 로컬 Workout Coach 앱 구현과 GAS 번들 검증이 완료되어 있다.
- 기본 웹 배포를 GitHub Pages로 전환하고 앱 원본·워크플로를 공개 저장소 `main`에 푸시했다. Settings → Pages의 Source를 `GitHub Actions`로 지정하고 Actions 배포를 완료했다. 공개 주소에서 운동 선택 화면 로딩을 확인했다: https://chae-mg.github.io/workout-coach/
- 기존 Apps Script 웹 앱은 `Workout Coach v4 — 테마 즉시 적용`으로 유지 중이며 Pages 전환으로 수정·삭제하지 않는다.
- 라이트 테마는 선택 즉시 적용되고 저장 후 새로고침에도 유지된다.
- 소리 크기 증폭은 사용자 휴대폰 확인을 통과했다.
- 진동은 제품 범위에서 제외했다.
- Android Chrome의 화면 꺼짐 방지·홈 화면 아이콘 등 일부 실기기 항목은 별도 확인이 남아 있다.
- GAS 주소의 브라우저 저장 데이터는 GitHub Pages 주소로 자동 이전되지 않는다.

완료한 변경의 자세한 기록은 [`WORKLOG.md`](WORKLOG.md), 다음 확인 작업은 [`NEXT.md`](NEXT.md)를 본다.

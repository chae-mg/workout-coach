# GAS 변환과 배포

12단계의 파일 생성·로컬 검증과 13단계 실제 적용·배포·기본 검증을 완료했다. 이후 소리 크기 조정과 다크·라이트 모드 요청을 반영하고 테마 즉시 적용을 보완해 버전 4로 배포를 갱신했다. 생성물 검증 1개와 번들 브라우저 시나리오 12개가 통과했다. 사용자가 보류한 11단계 실기기 항목은 미확인으로 유지한다.

## 현재 배포

- [웹 앱 실행](https://script.google.com/macros/s/AKfycbzU4_zMH3zNkuNn6uM7SMWpQu14PNVdIMCM883v7VMGXEIsyrEtWmE5EKPLTd7g7Jbq1w/exec)
- [프로젝트 편집기](https://script.google.com/home/projects/1rec7mwX0oM_M91fwJOlWiEbZniOprCf7-QYEkiGGCcbMASqTQ_X5wtul/edit)
- 버전 4(`Workout Coach v4 — 테마 즉시 적용`), 2026-09-17 배포, 실행 계정 본인·접근 `나만`. 동일한 Google 계정으로 로그인해야 한다.
- 실제 배포 주소에서 설정 저장·새로고침·이어하기·스쿼트 2세트·휴식 알람 확인 후 다음 세트·전체 완료(수행 2/건너뜀 0)를 검증했다.
- 테스트 설정은 원래 값으로 복구했다. GAS의 실제 휴대폰 소리 크기는 버전 2 배포 후 사용자가 좋다고 확인했다. 화면 꺼짐 방지·잠금·아이콘 등은 미확인이다.
- Tempo·카운트·휴식 종료음은 기존 Web Audio 레벨을 약 2배로 조정했고, 로컬 효과·GAS 번들 검증을 다시 통과했다. 휴대폰의 최종 음량 개선까지 확인했다.
- 설정의 화면 테마에서 다크·라이트 모드를 선택하면 즉시 화면에 적용되고, 저장하면 새로고침 후에도 유지된다. 실제 GAS 주소에서 저장 전 즉시 전환과 저장·새로고침 후 유지까지 확인한 뒤 테스트 설정은 다크 모드로 복구했다.

## 원본과 산출물

개발·수정·테스트는 `apps/web/src/`와 `apps/web/index.html`에서 수행한다. GAS용 코드는 원본을 다시 작성하지 않고 esbuild로 묶는다. esbuild와 Playwright는 개발 의존성이며 사용자 브라우저나 GAS 서버에 Node.js를 설치할 필요가 없다. [esbuild 공식 문서](https://esbuild.github.io/getting-started/)

```sh
pnpm install --frozen-lockfile
pnpm test:gas
pnpm preview:gas
```

`pnpm test:gas`는 최신 원본을 빌드하고 파일·구문·서버 HTML 조합·manifest·이미지를 검증한 뒤 번들 브라우저 시나리오를 실행한다. Windows에서는 설치된 Edge를 기본 사용하며 `WORKOUT_BROWSER_CHANNEL`로 다른 채널을 지정할 수 있다. 다른 운영체제는 Playwright Chromium 설치가 필요하다. 검증 없이 파일만 다시 만들 때는 `pnpm build:gas`를 사용한다.

```text
dist/gas/
  Code.gs          doGet와 HTML include
  Index.html       앱 컨테이너와 include 템플릿
  Styles.html      원본 CSS
  Script.html      운동 데이터·클라이언트 모듈·이미지를 포함한 JS
  appsscript.json  Asia/Seoul, V8
dist/preview/
  index.html       동일한 Styles/Script를 넣은 로컬 미리보기
```

GAS 파일의 코드를 직접 고치면 다음 빌드에서 덮어쓴다. 샘플 SVG는 이미지 데이터 URL로 포함하므로 외부 이미지 호스팅이 필요 없다. 별도 운동 이미지는 HTTPS URL을 사용한다. 실제 favicon과 Apple Touch Icon을 GAS 바깥 프레임·홈 화면에서 표시하는 동작은 최종 환경에서 별도 확인해야 한다.

## Apps Script에 적용

현재 프로젝트에는 아래 절차로 적용·배포했다. 이후 변경은 로컬 원본에서 시작하고 생성물을 적용한 뒤 배포 관리에서 같은 배포의 버전을 갱신한다. 저장만 하면 기존 배포 버전은 바뀌지 않는다.

1. Google Apps Script에서 개인용 프로젝트를 만든다. 기존 프로젝트를 사용할 경우 현재 파일을 확인하고 보존한다.
2. 빌드한 `Code.gs`와 HTML 파일 3개를 이름에 맞춰 적용한다. 기존 `Exercises.html`·`Config.gs`는 새 앱에서 include하지 않으며, 기존 파일 삭제는 별도로 판단한다.
3. 프로젝트 설정에서 `appsscript.json` 표시를 켜고 생성한 manifest의 시간대·런타임을 확인한다.
4. 배포 메뉴에서 웹 앱을 선택하고 실행 계정·접근 대상을 사용자 환경에 맞게 제한한다.
5. 배포 URL을 Android Chrome과 데스크톱에서 검수한다. 로컬 서버와 GAS는 서로 다른 저장소를 사용하므로 로컬 설정·세션이 자동으로 이전되지는 않는다.

프로젝트가 연결되면 `clasp`로 파일 업로드와 버전 관리를 자동화할 수도 있다. 자격 정보나 프로젝트 연결 파일은 저장소에 넣지 않는다. [Google clasp 안내](https://developers.google.com/apps-script/guides/clasp)

## GAS 환경에서 다시 확인할 항목

HtmlService는 iframe에서 실행되고 외부 스크립트·스타일 등 활성 콘텐츠는 HTTPS가 필요하다. 로컬 앱과 묶인 코드의 테스트만으로 iframe 권한과 실제 모바일 동작을 확인했다고 볼 수 없다. [Google HTML Service 제한](https://developers.google.com/apps-script/guides/html/restrictions)

GAS HTML 안에 직접 넣은 메타 태그와 제목은 바깥 페이지에 적용되지 않는다. 생성하는 `Code.gs`는 `setTitle()`과 `addMetaTag('viewport', ...)`를 사용한다. `theme-color`·아이콘의 바깥 페이지 적용 여부는 별도 검수 대상으로 남긴다. [HtmlOutput 공식 문서](https://developers.google.com/apps-script/reference/html/html-output)

- 운동 시작·이어하기 버튼으로 AudioContext를 활성화하고 Tempo·3초 안내·휴식 종료음을 확인한다. 브라우저에서 소리가 중단되면 안내음 활성화 버튼으로 재시도한다.
- 화면 꺼짐 방지의 지원 여부를 확인한다. 지원하지 않아도 운동 진행이 유지되는지 확인한다.
- 운동·휴식 도중 앱 전환, 화면 잠금, 새로고침, 브라우저 종료 후 돌아와 같은 세트로 이어지는지 확인한다. 화면이 숨겨진 상태의 Tempo 소리 지속은 보장하지 않는다.
- 휴식 타이머는 종료 시각에 맞춰 복구된다. 시간 운동은 현재 세트·구간만 완료하고 다음 타이머는 직접 시작한다.
- 배포 업데이트 후 같은 환경에서 설정을 다시 읽을 수 있는지 확인한다. 브라우저 정책·데이터 삭제에 따라 저장 데이터를 잃을 수 있으며 클라우드 백업은 없다.
- 360·390·412px, 가로 화면, 긴 운동명, 1개·8개 운동, 세트·휴식 조정, 운동 건너뛰기와 마지막 완료를 확인한다.

브라우저 자동 테스트는 실제 AudioContext에 예약한 소리의 시각·주파수를 검사한다. 실제 스마트폰에서 소리가 들리는지와 화면이 계속 켜지는지는 실기기 검수로 확인한다.

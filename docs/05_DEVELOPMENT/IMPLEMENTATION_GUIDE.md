# IMPLEMENTATION_GUIDE — GAS

이 문서는 [PLAN.md](../01_PRODUCT/PLAN.md)의 12~13단계에서 사용할 참고 자료다. 먼저 로컬 앱을 단계별로 검토하고 모바일 검수를 진행한다. 아래 GAS 예시와 현재 빌드 스크립트를 초기 단계에서 모두 적용할 필요는 없다.

현재는 로컬 모듈로 구현·테스트한 뒤 `scripts/build-gas.js`로 GAS 배포 파일을 자동 생성한다. 아래 GAS 예시는 배포 환경의 역할을 설명하며, 수정할 원본은 `apps/web/src/`에 있다. 실제 산출물은 `Code.gs`, `Index.html`, `Styles.html`, `Script.html`, `appsscript.json`이며 운동 데이터와 앱 설정은 `Script.html`에 묶는다.

## 1. 현재 생성 파일 구조

```text
Code.gs
Index.html
Styles.html
Script.html
appsscript.json
```

아래 `Config.gs`·`Exercises.html` 예시는 역할 설명용이다. 현재 앱의 설정·운동 데이터는 `Script.html`에 포함되므로 별도 파일을 만들지 않는다.

---

# 2. Code.gs

역할:

- Web App Entry Point
- HTML include

예:

```javascript
function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Workout Coach')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function include(filename) {
  return HtmlService
    .createHtmlOutputFromFile(filename)
    .getContent();
}
```

---

# 3. Index.html

역할:

- Page Layout
- 각 Screen Container
- Styles / Script Include

예:

```html
<!DOCTYPE html>
<html>
<head>
  <base target="_top">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, viewport-fit=cover"
  >

  <?!= include('Styles'); ?>
</head>

<body>

  <div id="app"></div>

  <?!= include('Exercises'); ?>
  <?!= include('Script'); ?>

</body>
</html>
```

---

# 4. Styles.html

CSS만 포함한다.

```html
<style>

html,
body {
  margin: 0;
}

.app-shell {
  width: 100%;
  max-width: 560px;
  min-height: 100dvh;
  margin: 0 auto;
}

.exercise-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

</style>
```

---

# 5. Exercises.html

운동 Data와 관련 Constant.

```html
<script>

const DEFAULT_EXERCISE_IMAGE =
  'SAMPLE_IMAGE_URL';

const EXERCISES = [
  // ...
];

</script>
```

운동 목록이 커지기 전까지 별도 외부 데이터베이스로 분리하지 않는다.

---

# 6. Script.html

주요 Client Logic.

권장 내부 구조:

```text
Constants
Storage
Settings
Session
Screen Router
Exercise Selection
Workout
Rest Timer
Tempo
Wake Lock
Sound
App Init
```

가능하면 파일 내부에서도 Section Comment로 구분한다.

---

# 7. App 초기화

권장:

```javascript
document.addEventListener(
  'DOMContentLoaded',
  initApp
);

function initApp() {

  loadSettings();

  checkActiveSession();

  renderExerciseGrid();

  showScreen('home');
}
```

---

# 8. Screen Router

SPA처럼 간단히 Screen만 Show / Hide.

```javascript
function showScreen(screenId) {

  document
    .querySelectorAll('[data-screen]')
    .forEach(screen => {
      screen.hidden = true;
    });

  document
    .querySelector(
      `[data-screen="${screenId}"]`
    )
    .hidden = false;
}
```

Router Library는 사용하지 않는다.

---

# 9. localStorage

Key는 Constant로 관리.

```javascript
const STORAGE_KEYS = {
  SETTINGS:
    'workout_settings',

  EXERCISE_SETTINGS:
    'exercise_settings',

  ACTIVE_SESSION:
    'active_session'
};
```

---

# 10. Session Snapshot

Workout 시작 시 Exercise 원본 객체를 직접 사용하지 않는다.

최종 적용 설정값을 Snapshot한다.

```javascript
function createSessionExercise(exercise) {

  const override =
    getExerciseSettings(exercise.id);

  return {
    ...exercise,

    ...override,

    reps: {
      ...exercise.reps,
      ...(override?.reps || {})
    },

    tempo: {
      ...exercise.tempo,
      ...(override?.tempo || {})
    }
  };
}
```

---

# 11. Rest Timer

정확한 시간 계산을 위해 종료 시각 방식 사용.

```javascript
function startRest(seconds) {

  session.status = 'REST';

  session.restEndAt =
    Date.now() + seconds * 1000;

  saveSession();

  renderRestTimer();
}
```

Tick:

```javascript
function getRemainingRestSeconds() {

  return Math.max(
    0,
    Math.ceil(
      (session.restEndAt - Date.now())
      / 1000
    )
  );
}
```

---

# 12. Tempo Sound

Web Audio API 사용.

권장 개념:

```javascript
let audioContext;

function initAudio() {

  if (!audioContext) {

    audioContext =
      new AudioContext();
  }
}
```

`운동 시작` 클릭 이벤트에서 실행.

Beep는 Oscillator 사용 가능.

외부 Sound File 의존도를 줄이는 것이 유지보수에 유리하다.

---

# 13. Wake Lock

Feature Detection.

```javascript
let wakeLock = null;

async function requestWakeLock() {

  if (!('wakeLock' in navigator)) {
    return;
  }

  try {

    wakeLock =
      await navigator.wakeLock.request('screen');

  } catch (error) {

    console.warn(error);
  }
}
```

Workout 종료 시 Release.

---

# 14. App Icon

App Icon URL은 Config 한 곳에서 관리한다.

GAS 환경에서 불필요하게 PWA 구조를 복잡하게 만들지 않는다.

초기 목표:

- Browser favicon
- Apple Touch Icon
- Theme Color

아이콘 이미지가 준비되면 URL만 교체한다.

---

# 16. Config.gs

Server-side Config를 HTML Template에 전달해야 할 필요가 없다면 Config를 Client Constant로 두어도 된다.

관리 편의성을 위해 다음 둘 중 하나만 선택한다.

### 방법 A — Client Config

`Exercises.html` 또는 `Script.html`

장점:

- 가장 단순
- Server 호출 없음

### 방법 B — Config.gs

GAS에서 관리 후 Template으로 주입.

앱 규모상 **방법 A가 더 단순하므로 권장**한다.

즉 초기 구현에서는 Config.gs가 꼭 필요하지 않다.

파일 수를 더 줄이고 싶으면:

```text
Code.gs
Index.html
Styles.html
Exercises.html
Script.html
```

5개 파일로 시작해도 된다.

---

# 17. 유지보수 원칙

## 운동 추가

`EXERCISES`에 Object 추가.

## 운동 이미지 변경

`imageUrl` 변경.

## 기본 Tempo 변경

Exercise Object 수정.

## 사용자 개인 설정 변경

UI에서 수정 → localStorage.

## App Icon 변경

Config URL 수정.

## UI 변경

Styles / Index 수정.

---

# 18. 하지 않을 것

MVP에서는 다음을 추가하지 않는다.

- React
- Vue
- Firebase
- Supabase
- Node.js Backend
- 별도 Database
- Google Sheets Storage
- Complex Router

배포 앱은 GAS + Vanilla HTML/CSS/JavaScript만 사용한다. 로컬 개발 서버와 테스트에는 Node.js를 사용하고, 개발 의존성인 Playwright와 esbuild는 테스트·배포 파일 생성에만 사용한다. Node.js 백엔드를 배포하지 않으며 패키지 매니저는 pnpm을 사용한다.

---

# 19. 구현 완료 체크

이 체크리스트는 최종 GAS 환경 검수용이다. 로컬 구현·자동 테스트 결과와 실제 GAS 배포 여부는 [WORKLOG.md](../07_STATUS/WORKLOG.md)에 구분해 기록한다.

- [ ] 모바일 2×N Grid
- [ ] 운동 선택 순서
- [ ] 오늘 운동 확인
- [ ] Workout Player
- [ ] REPS
- [ ] BOTH_SIDE_REPS
- [ ] TIME
- [ ] Rest Timer
- [ ] ±15초
- [ ] Rest Skip
- [ ] Tempo Sound
- [ ] Settings
- [ ] localStorage
- [ ] Session Resume
- [ ] Wake Lock
- [ ] Vibration
- [ ] Placeholder Image
- [ ] App Icon 확장 구조
- [ ] Desktop 중앙 Layout
- [ ] GAS Web App 배포

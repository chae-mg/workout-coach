# PLAN — Workout Coach

## 구현 전략

한 번에 모든 기능을 만들지 않고 **실제로 운동 한 Session을 끝까지 수행할 수 있는 흐름**부터 완성한다.

개발 순서:

```text
UI
→ 운동 선택
→ Workout State
→ Rest
→ Tempo
→ Settings
→ Resume
→ 모바일 검수
→ GAS 배포
```

---

# Phase 0 — 프로젝트 초기화

## 목표

GAS Web App 기본 구조를 만든다.

## 파일

```text
Code.gs
Config.gs
Index.html
Styles.html
Script.html
Exercises.html
```

## 작업

- `doGet()` 구현
- HTML include helper 구현
- Index에서 Styles / Script include
- Mobile viewport 설정
- App max-width 설정
- Theme Color 적용
- Placeholder favicon 구조 준비

## 완료 조건

GAS Web App URL 접속 시 기본 Skeleton 화면이 표시된다.

---

# Phase 1 — UI Skeleton

## 목표

모든 핵심 화면을 실제 모바일에서 확인 가능하게 만든다.

## 화면

1. 운동 선택
2. 오늘 운동 확인
3. Workout Player
4. Rest Timer
5. 운동 완료
6. 설정

## 작업

### 운동 선택

- 2×N Grid
- 운동 카드
- Placeholder 이미지
- 운동명
- 목표 부위
- 선택 순번

### 오늘 운동 확인

- 운동 수
- 세트 수
- 예상시간
- 운동 순서

### Workout Player

- 진행률
- 이미지
- 이름 / 영문명
- 목표 부위
- 목표 횟수 / 시간
- SET
- Tempo
- 세트 완료

### Rest

- Countdown
- 다음 운동
- ±15초
- Skip

### 완료

- 총 운동시간
- 완료 운동
- 완료 세트
- Skip

### 설정

- Global 설정
- Sound / Vibration
- Wake Lock

## 완료 조건

아직 실제 운동 로직이 없어도 화면 간 Navigation이 가능하다.

---

# Phase 2 — Exercise Data Model

## 목표

UI의 하드코딩 데이터를 `EXERCISES` 데이터로 교체한다.

## 작업

`Exercises.html`에 운동 목록 구성.

예:

```javascript
const EXERCISES = [
  {
    id: 'push_up',
    name: '팔굽혀펴기',
    nameEn: 'Push-up',
    target: '가슴 · 삼두',
    type: 'REPS',
    reps: {
      min: 8,
      max: 15
    },
    sets: 3,
    restSeconds: 90,
    tempo: [2, 1, 1],
    imageUrl: DEFAULT_EXERCISE_IMAGE
  }
];
```

## 완료 조건

운동 추가 / 수정 시 UI 코드를 수정하지 않고 Exercise Object만 수정하면 된다.

---

# Phase 3 — 운동 선택

## 목표

운동을 선택한 순서대로 Session Queue를 생성한다.

## 작업

- 운동 카드 클릭
- 선택 / 해제
- 선택 순번 표시
- 순서 자동 재정렬
- 선택 목록 Preview
- 최소 1개 선택 Validation

State:

```javascript
selectedExerciseIds = [];
```

## 완료 조건

사용자가 선택한 순서와 Workout 순서가 일치한다.

---

# Phase 4 — Session 생성

## 목표

운동 시작 시 Session Snapshot을 생성한다.

## 이유

운동 중 Global 설정이 바뀌어도 현재 운동 Session에 영향을 주지 않도록 한다.

## State 예시

```javascript
session = {
  id: '...',
  startedAt: 0,
  exerciseIndex: 0,
  currentSet: 1,
  status: 'exercise',
  exercises: []
};
```

각 Exercise는 시작 시점의 설정값을 복사한다.

## 완료 조건

오늘 운동 확인 화면과 실제 Workout Player 값이 동일하다.

---

# Phase 5 — Workout Player

## 목표

선택한 운동을 순차 진행한다.

## 구현

### REPS

- 목표 횟수 표시
- 완료 버튼
- 세트 증가

### BOTH_SIDE_REPS

- 좌우 횟수 표시
- 완료 버튼

### TIME

- 운동 Countdown
- Start / Pause
- 종료 시 완료 처리

### TIME_BLOCK

- 시간 Countdown
- 세트 개념 없이 다음 운동 진행 가능

## 완료 조건

운동 1개를 여러 세트 끝까지 진행할 수 있다.

---

# Phase 6 — Rest Timer

## 목표

세트 사이 휴식을 정확하게 관리한다.

## 핵심 원칙

Timer 값 감소 방식이 아니라 `endAt` 기준.

```javascript
restEndAt = Date.now() + duration * 1000;
```

## 기능

- Countdown
- -15초
- +15초
- Skip
- 다음 세트 표시
- 다음 운동 Preview

## 완료 조건

App Background / Foreground 전환 후에도 남은 시간이 크게 틀어지지 않는다.

---

# Phase 7 — Tempo Sound

## 목표

설정된 Tempo에 맞춰 운동 속도를 안내한다.

## 구현

- Web Audio API
- AudioContext
- `운동 시작` User Gesture에서 initialize
- 각 Phase 전환 시 beep

## 기능

- Tempo ON/OFF
- 운동별 Tempo
- Global Sound 설정 반영

## 주의

AudioContext는 모바일 브라우저 정책으로 인해 User Gesture 없이 자동 재생을 시도하지 않는다.

## 완료 조건

Tempo `2-1-1` 운동에서 각 Phase가 설정된 시간으로 반복된다.

---

# Phase 8 — Settings

## 목표

설정 변경값을 기기에서 유지한다.

## Storage

```text
workout_settings
exercise_settings
```

## 기능

Global:

- defaultSets
- defaultRestSeconds
- betweenExerciseRestSeconds
- tempoSound
- restSound
- countdownSound
- vibration
- wakeLock

Exercise Override:

- sets
- reps / time
- restSeconds
- tempo
- tempoSound

## 완료 조건

새로고침 / 브라우저 재실행 후에도 설정이 유지된다.

---

# Phase 9 — Session Resume

## 목표

운동 중 앱이 닫혀도 재개할 수 있게 한다.

## Storage

```text
active_session
```

## 저장 시점

- 운동 시작
- 세트 완료
- Rest 시작
- Rest 조정
- Skip
- 다음 운동 이동

## 시작 시

`active_session` 존재 여부 검사.

존재 시:

```text
진행 중인 운동이 있습니다.

이어하기
새 운동 시작
```

## 완료 조건

Workout 도중 새로고침 후 동일 운동 / 세트 상태로 복귀한다.

---

# Phase 10 — Wake Lock / Vibration

## Wake Lock

설정 ON 시 Workout 동안 Screen Wake Lock 요청.

지원하지 않는 브라우저에서는 조용히 무시한다.

## Vibration

지원 가능한 환경에서 Rest 종료 시 vibration.

Feature Detection 필수.

```javascript
if ('vibrate' in navigator) {
  navigator.vibrate(...);
}
```

---

# Phase 11 — App Branding

## 목표

북마크 / 홈 화면 저장 시 App Identity를 제공한다.

## 준비 항목

- App Name
- iconUrl
- appleTouchIconUrl
- themeColor

실제 아이콘 이미지는 나중에 교체한다.

## 완료 조건

Config 값만 변경하여 App Icon을 변경할 수 있다.

---

# Phase 12 — QA

## 모바일 필수 테스트

### 화면

- 360px
- 390px
- 412px
- Landscape

### 기능

- 운동 1개
- 운동 8개
- 선택 해제 / 재선택
- 1세트
- 3세트
- TIME 운동
- BOTH_SIDE_REPS
- Rest +15
- Rest -15
- Rest Skip
- Tempo ON/OFF
- Sound OFF
- Session Resume
- 새 운동 시작
- 브라우저 Background → 복귀

### Edge Case

- 선택 운동 0개
- LocalStorage 값 손상
- Timer 종료 시 App Background
- Wake Lock 미지원
- Vibration 미지원

---

# Phase 13 — GAS 배포

## 배포

Apps Script:

```text
Deploy
→ New deployment
→ Web app
```

개인용이므로 접근 권한은 사용자 환경에 맞게 제한한다.

## 배포 후 테스트

- 모바일 Chrome
- 홈 화면 / 북마크 실행
- Desktop Chrome
- localStorage 유지
- App 업데이트 후 기존 설정 유지

---

# 완료 정의

다음 Scenario가 정상 동작하면 MVP 완료.

```text
앱 실행
→ 5개 운동 선택
→ 순서 확인
→ 운동 시작
→ Tempo에 맞춰 운동
→ 세트 완료
→ 90초 Rest
→ 다음 세트
→ 중간에 Browser 종료
→ 앱 재실행
→ 이어하기
→ 모든 운동 완료
→ 완료 화면
```

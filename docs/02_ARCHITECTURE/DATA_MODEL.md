# DATA_MODEL — Workout Coach

이 문서는 요구사항과 현재 구현 초안의 데이터 구조를 설명한다. 개발은 [PLAN.md](../01_PRODUCT/PLAN.md)의 단계별 범위를 따른다. 전역 설정·추가 시간 운동·복구 규칙은 관련 단계에서 재확인하며, 현재 구조가 있다는 이유만으로 해당 단계의 검수를 완료한 것으로 보지 않는다.

현재 구현의 저장 형식은 version 2이다. 초기 version 1 예시의 전역 설정과 운동별 설정은 읽을 수 있지만, 타이머·운동별 수행 결과가 없는 version 1 세션은 자동 복구하지 않는다. 구현 원본은 `apps/web/src/data/exercises.js`, `apps/web/src/core/settings.js`, `apps/web/src/core/session.js`에 있다.

## 1. 기본 원칙

앱 데이터는 세 종류로 나눈다.

```text
Static Data
→ 운동 정의

Persistent Local Data
→ 설정

Temporary Persistent Data
→ 현재 진행 중인 Session
```

서버 DB는 사용하지 않는다.

---

# 2. Exercise

권장 구조:

```javascript
{
  id: 'push_up',
  name: '팔굽혀펴기',
  nameEn: 'Push-up',

  target: '가슴 · 삼두',
  category: 'upper',

  type: 'REPS',

  imageUrl: DEFAULT_EXERCISE_IMAGE,

  sets: 3,

  reps: {
    min: 8,
    max: 15
  },

  durationSeconds: null,

  restSeconds: 90,

  tempo: {
    enabled: true,
    phases: [2, 1, 1]
  }
}
```

## 필드

| 필드 | 설명 |
|---|---|
| id | 내부 고유 Key |
| name | 한글 운동명 |
| nameEn | 영문 운동명 |
| target | 운동 부위 |
| category | 부위 필터용 분류: upper(상체), lower(하체), core(코어), full(전신). target 표시 문구와 분리한다. |
| type | 운동 Type |
| imageUrl | 이미지 |
| sets | 기본 세트 |
| reps | 반복 범위 |
| durationSeconds | TIME 운동 시간 |
| restSeconds | 세트 간 휴식 |
| tempo | Tempo 설정 |

---

# 3. Exercise Type

```javascript
const EXERCISE_TYPES = {
  REPS: 'REPS',
  BOTH_SIDE_REPS: 'BOTH_SIDE_REPS',
  TIME: 'TIME',
  TIME_BLOCK: 'TIME_BLOCK'
};
```

---

# 4. 초기 Exercise Data

```javascript
const EXERCISES = [
  {
    id: 'squat',
    name: '스쿼트',
    nameEn: 'Squat',
    target: '하체',
    category: 'lower',
    type: 'REPS',
    sets: 3,
    reps: { min: 15, max: 20 },
    restSeconds: 90,
    tempo: {
      enabled: true,
      phases: [3, 1, 2]
    }
  },

  {
    id: 'push_up',
    name: '팔굽혀펴기',
    nameEn: 'Push-up',
    target: '가슴 · 삼두',
    category: 'upper',
    type: 'REPS',
    sets: 3,
    reps: { min: 8, max: 15 },
    restSeconds: 90,
    tempo: {
      enabled: true,
      phases: [2, 1, 1]
    }
  },

  {
    id: 'one_arm_row',
    name: '원암 덤벨 로우',
    nameEn: 'One-arm Dumbbell Row',
    target: '등 · 광배근 · 이두',
    category: 'upper',
    type: 'BOTH_SIDE_REPS',
    sets: 3,
    reps: { min: 8, max: 12 },
    restSeconds: 90,
    tempo: {
      enabled: true,
      phases: [2, 1, 2]
    }
  },

  {
    id: 'hammer_curl',
    name: '해머 컬',
    nameEn: 'Hammer Curl',
    target: '이두 · 전완',
    category: 'upper',
    type: 'REPS',
    sets: 3,
    reps: { min: 8, max: 12 },
    restSeconds: 60,
    tempo: {
      enabled: true,
      phases: [2, 1, 2]
    }
  },

  {
    id: 'overhead_triceps_extension',
    name: '오버헤드 트라이셉스 익스텐션',
    nameEn: 'Overhead Triceps Extension',
    target: '삼두',
    category: 'upper',
    type: 'REPS',
    sets: 3,
    reps: { min: 8, max: 12 },
    restSeconds: 60,
    tempo: {
      enabled: true,
      phases: [2, 1, 2]
    }
  },

  {
    id: 'crunch',
    name: '크런치',
    nameEn: 'Crunch',
    target: '복부',
    category: 'core',
    type: 'REPS',
    sets: 3,
    reps: { min: 15, max: 20 },
    restSeconds: 60,
    tempo: {
      enabled: true,
      phases: [2, 1, 2]
    }
  },

  {
    id: 'reverse_crunch',
    name: '리버스 크런치',
    nameEn: 'Reverse Crunch',
    target: '하복부 · 골반 컨트롤',
    category: 'core',
    type: 'REPS',
    sets: 3,
    reps: { min: 8, max: 15 },
    restSeconds: 60,
    tempo: {
      enabled: true,
      phases: [2, 1, 2]
    }
  },

  {
    id: 'dead_bug',
    name: '데드 버그',
    nameEn: 'Dead Bug',
    target: '코어 · 골반 안정',
    category: 'core',
    type: 'BOTH_SIDE_REPS',
    sets: 3,
    reps: { min: 6, max: 10 },
    restSeconds: 60,
    tempo: {
      enabled: false,
      phases: []
    }
  }
];
```

Tempo 기본값은 추후 실제 사용하면서 수정할 수 있도록 설정값으로 취급한다.

## 시간 운동 기본값

7단계에서 검토한 로컬 목록은 초기 8개와 아래 시간 운동 2개다. 앞선 구현 초안의 기본값을 유지했다. 이미지는 초기 운동과 같은 공통 샘플을 사용한다.

```javascript
const TIMED_EXERCISES = [
  {
    id: 'plank', name: '플랭크', nameEn: 'Plank', target: '코어', category: 'core',
    type: 'TIME', sets: 3, reps: null, durationSeconds: 30, restSeconds: 60,
    tempo: { enabled: false, phases: [] }
  },
  {
    id: 'warm_up', name: '준비 운동', nameEn: 'Warm-up', target: '전신', category: 'full',
    type: 'TIME_BLOCK', sets: 1, reps: null, durationSeconds: 120, restSeconds: 0,
    tempo: { enabled: false, phases: [] }
  }
];
```

TIME은 설정된 세트 수로 수행하고 TIME_BLOCK은 전역·운동별·오늘 세트 지정과 관계없이 1구간이다. 시간 입력은 1~7200초의 정수이며 필수다. 예상시간은 설정된 시간 × 세트·구간 수와 휴식을 합산한다.

---

# 5. Global Settings

localStorage Key:

```text
workout_settings
```

구조:

```javascript
{
  version: 2,

  defaultSets: null,
  defaultRestSeconds: null,
  betweenExerciseRestSeconds: 120,

  tempoSound: true,
  restSound: true,
  countdownSound: true,
  wakeLock: true,
  theme: 'dark'
}
```

`defaultSets`와 `defaultRestSeconds`의 `null`은 각 운동의 기본값을 사용한다는 뜻이다. 사용자가 정수를 입력하면 전역 지정값이 운동 기본값보다 우선한다. version 1의 숫자 설정도 명시적 전역 지정값으로 읽는다.
`theme`은 `dark` 또는 `light`이며 화면 색상과 브라우저 테마 색상을 결정한다. 이전 저장값에 필드가 없으면 `dark`를 사용한다.

---

# 6. Exercise Settings Override

localStorage Key:

```text
exercise_settings
```

예:

```javascript
{
  version: 2,
  exercises: {
    push_up: {
      sets: 3,
      restSeconds: 90,
      reps: { min: 10, max: 15 },
      tempo: { enabled: true, phases: [2, 1, 1] }
    },
    crunch: { restSeconds: 60 }
  }
}
```

해당 필드가 없으면 Exercise 기본값 또는 Global 기본값을 사용한다.

---

# 7. 설정 Merge 순서

우선순위:

```text
오늘 Session 조정
        ↓
Exercise Override
        ↓
Global 명시적 지정값 (null이면 다음 단계 사용)
        ↓
Exercise 기본값
```

Session 생성 시 최종값을 Snapshot으로 저장한다.

이 우선순위는 세트·휴식처럼 전역 지정값이 있는 필드에 적용한다. 목표 횟수·시간·Tempo는 운동별 기본값에 운동별 설정과 오늘 조정을 적용한다. `TIME_BLOCK`은 세트 지정값에 관계없이 항상 1구간이다. 안내음·운동 간 휴식·화면 설정도 세션 생성 시 복사한다.

## 편집과 오늘 조정

운동별 편집 화면은 표시된 세트·목표·휴식·Tempo 값을 함께 저장한다. 저장한 값은 이후 기본 설정을 바꿔도 유지하며 개별 설정 해제 시 해당 운동의 설정 전체를 제거해 기본 설정을 다시 사용한다. 저장 데이터에서 일부 필드만 있는 경우에는 없는 필드를 상속한다.

시작 전 오늘 조정은 메모리에만 둔다. 새로고침하면 선택과 오늘 조정을 비우며 저장된 기본·운동별 설정은 유지한다. 운동 선택 해제는 그 운동의 오늘 조정만 제거한다. 오늘 조정 해제는 저장된 운동별·기본 설정을 다시 적용한다. 시작한 세션에는 최종값을 복사하고 완료 버튼·운동 종료로 선택과 오늘 조정을 비운다.

반복 운동의 입력 범위는 세트 1~20, 목표 횟수 1~300(최대 ≥ 최소), 휴식 0~1800초다. Tempo는 단계당 1~30초의 정수로 최대 6단계이며 사용을 켜면 한 단계 이상 필요하다. 기본 세트·휴식의 빈 입력만 상속을 뜻하고 운동 간 휴식과 운동별 세트·목표·휴식 입력은 필수다. 시간 운동은 1~7200초의 정수를 사용한다.

---

# 8. Active Session

localStorage Key:

```text
active_session
```

구조 예:

```javascript
{
  version: 2,
  sessionId: '고유 UUID',
  revision: 1,
  startedAt: 1000,
  endedAt: null,
  status: 'REST',
  exerciseIndex: 0,
  currentSet: 2,
  exercises: [ { ...EXERCISES[0] } ], // 실제 생성 시 중첩 값까지 복사
  settings: {
    version: 2,
    defaultSets: null,
    defaultRestSeconds: null,
    betweenExerciseRestSeconds: 120,
    tempoSound: true,
    restSound: true,
    countdownSound: true,
    wakeLock: true,
    theme: 'dark'
  },
  soundEnabled: true, // 세션 화면에서 켜고 끄는 안내음 상태
  restAlarmPending: false, // 휴식 종료 알람의 사용자 확인 대기
  results: [ { id: 'squat', completed: 1, skipped: 0 } ],
  restEndAt: 92000,
  timerEndAt: null,
  timerRemainingMs: null,
  timerPaused: true
}
```

---

# 9. Session Status

권장 Enum:

```javascript
const SESSION_STATUS = {
  EXERCISE: 'EXERCISE',
  REST: 'REST',
  COMPLETE: 'COMPLETE'
};
```

선택·오늘 운동 확인은 세션 생성 전의 화면 상태로 관리한다. `REST` 상태의 운동 인덱스와 세트 번호는 다음에 수행할 대상을 가리킨다. 현재 운동을 건너뛰면 그 운동의 남은 세트만 `skipped`에 더한다. 마지막 운동의 마지막 세트 뒤에는 휴식을 생성하지 않는다.

휴식이 `TICK`으로 자연 만료되고 `restSound`·`soundEnabled`가 켜져 있으면 `EXERCISE`로 이동하면서 `restAlarmPending: true`를 저장한다. 이때 다음 대상은 사용자 확인을 기다리고 수행·건너뛰기·타이머 시작 이벤트를 처리하지 않는다. `DISMISS_REST_ALARM`은 수행 합계를 변경하지 않고 플래그를 해제한다. 음소거도 해제하며 수동 휴식 건너뛰기·조정으로 종료한 휴식에는 플래그를 설정하지 않는다.

`restAlarmPending`은 기존 version 2 데이터에서 생략돼 있으면 false로 취급한다. 값이 있으면 boolean이어야 하며 true는 종료음·사운드가 켜진 `EXERCISE`의 타이머 대기 상태에서만 유효하다. 반복 재생 예약은 메모리에만 관리하고 저장된 플래그로 복귀 후 재개한다. 이미 확인한 알람은 새로고침으로 다시 만들지 않는다.

`TIME`과 `TIME_BLOCK`은 시작 버튼을 누르면 `timerEndAt`을 계산한다. 일시정지하면 남은 밀리초를 `timerRemainingMs`에 저장하고 `timerEndAt`을 비운다. 타이머가 지난 뒤 재개하면 현재 세트·구간 하나만 완료하며 다음 타이머는 자동 시작하지 않는다. 휴식·운동 타이머는 모두 현재 시각과 종료 시각의 차이로 표시한다.

완료·건너뛰기·휴식 조정 이벤트는 화면을 그릴 때의 `revision`을 함께 전달한다. 이미 처리한 화면의 이벤트는 무시한다. 세트 완료와 운동 건너뛰기는 UI에서 공통으로 500ms 간격을 적용해 휴식이 0초일 때 다음 세트·운동까지 연속 처리하지 않는다. 이전 화면의 이벤트는 이 간격을 소비하지 않으며 새 세션 시작 시 초기화한다.

---

# 10. localStorage Helper

직접 여러 곳에서 `JSON.parse()` 하지 않고 `apps/web/src/browser/storage.js`의 Wrapper를 사용한다.

현재 구현은 읽기·쓰기·삭제 실패를 모두 처리한다. 저장된 세션은 운동 유형·범위·타이머 상태·운동별 수행 합계까지 검증한 뒤 이어하기에 사용한다. 저장 실패 시 화면 진행은 유지하되 상태를 복구할 수 없을 가능성을 알린다.

이어하기를 선택하기 전에는 저장된 상태를 자동 진행하지 않는다. 실행 중이던 시간 운동의 종료 시각이 지났다면 현재 세트·구간 하나만 완료하고, 필요한 휴식은 이어한 현재 시각부터 새로 만든다. 지난 휴식은 다음 대상으로 이동하며 멈춘 시간 운동은 남은 밀리초를 유지한다. 다음 시간 운동은 자동으로 시작하지 않는다.

손상된 JSON·지원하지 않는 세션 버전·잘못된 범위·상태·수행 합계는 안내 후 이어하기 대상에서 제외한다. 새 운동 시작 시 기존 세션을 삭제하고 선택과 오늘 조정을 비운다. 완료된 세션은 완료 화면을 복원하고 완료 버튼으로 삭제한다. 삭제 실패 시 화면에서는 새 운동으로 돌아가되 저장된 이전 세션이 다시 나타날 수 있음을 안내한다. 저장소 쓰기 실패는 현재 화면 진행을 유지하며 최신 상태의 복구를 보장하지 않는다.

---

# 11. Storage Version

설정 구조가 변경될 가능성을 대비해 `version`을 포함한다.

```javascript
{
  version: 2
}
```

향후 구조 변경 시 Migration 로직을 추가할 수 있다.

---

# 12. App Config

`Config.gs` 또는 Client Config에서 관리.

```javascript
const APP_CONFIG = {
  name: 'Workout Coach',

  defaultExerciseImage:
    'SAMPLE_IMAGE_URL',

  iconUrl:
    'ICON_URL',

  appleTouchIconUrl:
    'ICON_URL',

  themeColor:
    '#111827'
};
```

이미지 제작 후 URL만 교체한다.

로컬 소스의 실제 설정은 `apps/web/src/data/exercises.js`에서 관리한다. 기본 `name`은 `Workout Coach`, `themeColor`는 `#101b20`, `iconUrl`은 공통 SVG이고 `appleTouchIconUrl`은 빈 문자열이다. Apple Touch Icon은 값이 있을 때만 링크를 추가하며 favicon의 파일 형식은 고정하지 않는다. 공통 운동 이미지는 각 운동의 `imageUrl`로 적용한다.

오디오 컨텍스트·Tempo 예약·Wake Lock 객체는 브라우저 실행 상태이며 localStorage에 저장하지 않는다. 세션의 `soundEnabled`와 복사된 안내음·화면 설정으로 효과를 결정한다. 오디오 컨텍스트가 닫혔으면 사용자 클릭 시 새로 생성한다. 숨김·종료 시 효과를 정리하고 Wake Lock 승인 대기 중 종료되면 나중에 받은 잠금도 해제한다.

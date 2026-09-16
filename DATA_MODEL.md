# DATA_MODEL — Workout Coach

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

---

# 5. Global Settings

localStorage Key:

```text
workout_settings
```

구조:

```javascript
{
  version: 1,

  defaultSets: 3,
  defaultRestSeconds: 90,
  betweenExerciseRestSeconds: 120,

  tempoSound: true,
  restSound: true,
  countdownSound: true,
  vibration: true,
  wakeLock: true
}
```

---

# 6. Exercise Settings Override

localStorage Key:

```text
exercise_settings
```

예:

```javascript
{
  push_up: {
    sets: 3,
    restSeconds: 90,
    reps: {
      min: 10,
      max: 15
    },
    tempo: {
      enabled: true,
      phases: [2, 1, 1]
    }
  },

  crunch: {
    restSeconds: 60
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
Exercise 기본값
        ↓
Global 기본값
```

Session 생성 시 최종값을 Snapshot으로 저장한다.

---

# 8. Active Session

localStorage Key:

```text
active_session
```

구조 예:

```javascript
{
  version: 1,

  sessionId: '20260916-210000',

  startedAt: 1789560000000,

  status: 'REST',

  exerciseIndex: 1,

  currentSet: 2,

  completedSets: 4,

  skippedSets: 0,

  selectedExerciseIds: [
    'squat',
    'push_up',
    'one_arm_row'
  ],

  exercises: [
    {
      id: 'squat',
      sets: 3,
      reps: {
        min: 15,
        max: 20
      },
      restSeconds: 90,
      tempo: {
        enabled: true,
        phases: [3, 1, 2]
      }
    }
  ],

  restEndAt: 1789560120000
}
```

---

# 9. Session Status

권장 Enum:

```javascript
const SESSION_STATUS = {
  READY: 'READY',
  EXERCISE: 'EXERCISE',
  REST: 'REST',
  COMPLETE: 'COMPLETE'
};
```

---

# 10. localStorage Helper

직접 여러 곳에서 `JSON.parse()` 하지 않고 Wrapper 사용 권장.

```javascript
function saveLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadLocal(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return fallback;
    }

    return JSON.parse(value);

  } catch (error) {
    console.error(error);
    return fallback;
  }
}
```

---

# 11. Storage Version

설정 구조가 변경될 가능성을 대비해 `version`을 포함한다.

```javascript
{
  version: 1
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

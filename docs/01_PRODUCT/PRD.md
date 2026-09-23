# PRD — Workout Coach

## 1. 제품 개요

### 제품명

Workout Coach

### 목적

집에서 홈트레이닝을 할 때 사용자가 직접 횟수, 세트, 휴식시간을 계속 확인하지 않아도 되도록 운동 진행을 보조하는 개인용 웹앱을 만든다.

앱은 운동 시작 전 오늘 할 운동을 선택하고, 운동 중에는 현재 운동과 세트, Tempo, 휴식시간, 다음 운동을 순서대로 안내한다.

### 사용 환경

- 사용자: 1명
- 주 사용 기기: Android 스마트폰
- 보조 사용 환경: Desktop Browser
- 기본 배포: GitHub Pages 정적 사이트
- 이전 호환 배포: Google Apps Script Web App
- 저장소: Browser localStorage
- DB: 사용하지 않음

---

## 2. 제품 목표

### 핵심 목표

1. 운동 시작 준비 시간을 줄인다.
2. 운동 중 횟수 / 세트 / 휴식시간 확인 부담을 줄인다.
3. 세트가 끝나면 적정 휴식시간을 자동 Countdown한다.
4. Tempo Sound를 이용해 일정한 운동 속도를 유지할 수 있게 한다.
5. 모바일에서 한 손으로 쉽게 사용할 수 있게 한다.
6. 별도 서버나 DB 없이 간단하게 유지보수할 수 있게 한다.

### 성공 기준

다음 흐름을 모바일에서 중단 없이 진행할 수 있으면 MVP 완료로 본다.

```text
운동 선택
→ 운동 시작
→ 1세트 수행
→ 휴식
→ 다음 세트
→ 다음 운동
→ 전체 운동 완료
```

---

## 3. 핵심 사용자 흐름

```text
[홈 / 운동 선택]

사용자가 운동 카드를 순서대로 선택
        ↓
선택한 순서가 ① ② ③ 형태로 표시
        ↓
[오늘 운동 확인]
        ↓
세트 / 횟수 / 시간 / 휴식 확인
        ↓
[운동 시작]
        ↓
[Workout Player]
        ↓
세트 완료
        ↓
[Rest Timer]
        ↓
다음 세트 또는 다음 운동
        ↓
반복
        ↓
[운동 완료]
```

---

## 4. 화면 요구사항

### 4.1 운동 선택

운동 선택 화면은 모바일 기준 **2×N Grid**로 구성한다.

각 운동 카드:

```text
운동 이미지
운동 이름
목표 부위
선택 순번
```

예:

```text
┌─────────────┐
│      ①      │
│   [IMAGE]   │
│             │
│ 스쿼트       │
│ 하체         │
└─────────────┘
```

선택 규칙:

- 카드 최초 선택 → 현재 마지막 순번 부여
- 선택된 카드 재선택 → 선택 해제
- 중간 카드 해제 → 뒤의 선택 순번 자동 재정렬
- 선택된 운동 순서가 실제 운동 진행 순서가 됨

초기 운동 이미지가 준비되지 않은 경우 모든 카드에서 동일한 샘플 이미지를 사용한다.

향후 각 운동의 `imageUrl`만 교체할 수 있도록 구성한다.

### 4.2 오늘 운동 확인

표시 항목:

- 선택한 운동 수
- 예상 총 세트
- 예상 운동시간
- 운동 순서
- 각 운동의 횟수 / 시간
- 세트 수
- 휴식시간

이 화면에서 **오늘 Session에만 적용되는 간단 조정**이 가능해야 한다.

예:

- 3세트 → 오늘만 2세트
- 휴식 90초 → 오늘만 60초

Global 설정값 자체는 변경하지 않는다.

예상 소요시간의 계산 기준:

- 반복 운동은 목표 범위의 평균 횟수 × 저장된 Tempo 단계 시간의 합 × 세트 수로 계산한다. Tempo 단계가 없으면 반복당 4초를 가정하고 좌우 반복은 양쪽을 포함한다.
- 안내음 ON/OFF와 관계없이 저장된 Tempo 시간을 계산에 사용한다. 실제 수행 속도나 준비·이동 시간은 측정하지 않는다.
- 각 운동의 세트 간 휴식은 `세트 수 - 1`번, 운동 간 휴식은 `운동 수 - 1`번 더한다. 마지막 운동 뒤 휴식은 더하지 않는다.
- 합계 초를 반올림한 뒤 분 단위로 올림해 표시한다. 실제 수행 시간과 차이가 있을 수 있는 추정치다.
- 시간 운동은 설정된 시간 × 세트·구간 수로 계산한다. TIME_BLOCK은 1구간으로 계산한다.

### 4.3 Workout Player

Workout 중 가장 중요한 화면이다.

표시 항목:

- 전체 진행상황
- 운동 이미지
- 운동 이름
- 영문명
- 목표 부위
- 목표 횟수 또는 시간
- 현재 세트 / 전체 세트
- Tempo
- Tempo Sound 상태
- 세트 완료
- 운동 건너뛰기

운동 진행 중 Bottom Navigation은 숨긴다.

좌우 반복은 양쪽의 목표 횟수를 모두 수행한 뒤 한 세트로 완료한다. 전체 진행률은 완료한 세트와 건너뛴 세트를 합쳐 계산하며, 건너뛰기는 현재 운동의 남은 세트만 처리한다. 완료 세트와 건너뛴 세트의 합계는 결과에서 구분한다.

### 4.4 Rest Timer

세트 완료 직후 표시한다.

표시 항목:

- 남은 휴식시간
- 다음 세트 또는 다음 운동
- 다음 운동 목표 횟수 / 시간
- -15초
- +15초
- 휴식 건너뛰기

휴식 종료 시:

- 휴식 종료음
- 필요 시 3초 Countdown Sound

### 4.5 운동 완료

표시 항목:

- 총 운동시간
- 완료 운동 수
- 완료 세트 수
- 건너뛴 세트 수
- 운동별 완료 상태

MVP에서는 상세 통계 분석을 제공하지 않는다.

### 4.6 설정

#### 운동 설정

- 기본 세트 수
- 기본 휴식시간
- 운동 간 휴식시간

#### 사운드 / 알림

- Tempo Sound
- 휴식 종료음
- 휴식 종료 전 3초 Countdown

#### 화면

- 화면 꺼짐 방지
- 다크 모드 / 라이트 모드 선택

#### 운동별 설정

Global 설정을 기본으로 사용하되 각 운동별 Override 가능.

---

## 5. 운동 유형

운동 데이터는 다음 Type을 지원한다.

### REPS

일반 반복 운동.

예:

- Push-up
- Squat
- Crunch

### BOTH_SIDE_REPS

좌우 각각 반복하는 운동.

예:

- One-arm Dumbbell Row
- Dead Bug

### TIME

운동 자체를 시간으로 수행.

예:

- Plank

앱에서 Countdown을 제공한다.

### TIME_BLOCK

운동 세트가 아닌 일정 시간 블록.

예:

- Warm-up
- Cool-down
- Walking

---

## 6. 기본 운동 목록

초기 구현 대상:

| ID | 운동 | 유형 | 목표 부위 |
|---|---|---|---|
| squat | 스쿼트 | REPS | 하체 |
| push_up | 팔굽혀펴기 | REPS | 가슴 · 삼두 |
| one_arm_row | 원암 덤벨 로우 | BOTH_SIDE_REPS | 등 · 광배근 · 이두 |
| hammer_curl | 해머 컬 | REPS | 이두 · 전완 |
| overhead_triceps_extension | 오버헤드 트라이셉스 익스텐션 | REPS | 삼두 |
| crunch | 크런치 | REPS | 복부 |
| reverse_crunch | 리버스 크런치 | REPS | 하복부 · 골반 컨트롤 |
| dead_bug | 데드 버그 | BOTH_SIDE_REPS | 코어 · 골반 안정 |

초기 기본값은 [DATA_MODEL.md](../02_ARCHITECTURE/DATA_MODEL.md) 기준으로 관리한다.

7단계에서 검토한 시간 운동 목록은 플랭크(`plank`, TIME, 기본 30초·3세트)와 준비 운동(`warm_up`, TIME_BLOCK, 기본 120초·1구간)이다. 이는 앱의 조정 가능한 시작값이며 준비 운동은 시간 구간으로 관리한다.

---

## 7. Tempo Sound

운동별로 Tempo 설정을 가질 수 있다.

예:

```text
Push-up

2 - 1 - 1

내려가기 2초
정지 1초
올라오기 1초
```

Tempo Sound는 Web Audio API를 사용한다.

권장 구분:

- Phase Start → 짧은 beep
- 마지막 Phase → 높거나 다른 beep
- Tempo OFF → 소리 없음

모바일 브라우저 Audio 정책을 고려해 사용자가 `운동 시작` 버튼을 누른 이후 AudioContext를 활성화한다.

반복 운동 수행 중에 전역 Tempo·운동별 Tempo·Player 안내음이 모두 켜져 있을 때 Tempo를 재생한다. 휴식·대화상자·숨겨진 화면·전체 완료에서는 Tempo를 멈춘다. 화면 복귀 시 놓친 단계를 몰아서 재생하지 않는다.

3초 카운트와 휴식 종료음은 각각의 설정과 Player 안내음 상태를 따른다. 오디오가 중단되면 활성화 버튼으로 재시도할 수 있고 미지원·거부 시 안내 후 화면만으로 운동을 계속한다. 실제 소리 출력 여부는 기기 검수가 필요하다.

안내음은 음량을 짧게 유지한 뒤 줄여 종료한다. 휴식 종료음은 더 강한 두 신호를 사용자가 `휴식 알람 끄기`를 누를 때까지 반복한다. 그동안 다음 대상과 확인 버튼을 표시하고 Tempo·세트 수행·시간 운동 시작은 대기한다. 알람 종료는 수행 세트를 추가하지 않는다. 휴식 종료음 OFF·Player 음소거·휴식 건너뛰기에는 알람 확인을 요구하지 않는다.

알람 대기 상태는 저장·이어하기로 복구한다. 숨겨진 화면과 대화상자에서는 소리를 잠시 멈추고 복귀하면 미확인 알람을 재개한다. 안내음 모두 끄기나 운동 종료로도 알람을 종료할 수 있다. 브라우저 중단·잠금 중 백그라운드 재생을 보장하지 않으며 실기기에서 별도로 확인한다.

화면 꺼짐 방지는 지원 환경에서만 사용하는 선택적 기능이다. 설정이 켜진 운동·휴식 화면에서 요청하고 숨김·페이지 이탈·종료 시 해제한다. 화면 복귀 시 다시 요청한다. API 미지원·거부·오류가 운동을 중단하지 않도록 한다.

---

## 8. 데이터 저장

별도 DB는 사용하지 않는다.

### localStorage

저장 대상:

```text
workout_settings
exercise_settings
active_session
```

#### workout_settings

Global 설정.

#### exercise_settings

운동별 Override 설정.

#### active_session

운동 도중 브라우저 종료 / 새로고침 시 복구용.

저장 정보:

- 선택한 운동
- 현재 운동 Index
- 현재 세트
- 완료 세트
- 건너뛴 세트
- Session 시작시간
- 현재 상태
- Rest 종료 예정 시각

---

## 9. Session Resume

운동 중 다음 상황이 발생해도 가능한 범위에서 복구한다.

- 새로고침
- Chrome 종료
- 다른 앱 전환 후 복귀

앱 시작 시 `active_session` 확인.

존재하면:

```text
진행 중인 운동이 있습니다.

[이어하기]
[새 운동 시작]
```

표시.

`새 운동 시작` 선택 시 기존 active_session 제거.

반복 운동·휴식·실행 중 또는 멈춘 시간 운동의 대상과 수행 합계를 복원한다. 멈춘 타이머의 남은 시간은 보존하고, 진행 중이던 타이머는 저장된 종료 시각을 사용한다. 만료된 시간 운동은 현재 세트·구간 하나만 완료하며 다음 타이머는 직접 시작한다. 필요한 휴식은 이어한 시각부터 시작한다.

완료 상태는 완료 화면을 다시 표시한다. 손상되거나 지원하지 않는 저장 형식은 안내 후 이어하기를 제공하지 않으며, 저장소 접근·저장·삭제 실패는 화면 진행과 데이터 복구 가능성을 구분해 안내한다. 실제 Chrome 종료·기기 잠금 후 복귀는 실기기 검수에서 확인한다.

---

## 10. Timer 구현 원칙

다음 방식은 사용하지 않는다.

```javascript
remaining--;
```

브라우저 Background 상태에서 Timer Drift가 발생할 수 있다.

대신 종료 시각을 기록한다.

```javascript
restEndAt = Date.now() + restSeconds * 1000;
```

화면 표시:

```javascript
remaining = Math.max(
  0,
  Math.ceil((restEndAt - Date.now()) / 1000)
);
```

---

## 11. Responsive UI

### Mobile

기본 기준.

- 2×N 운동 Grid
- 한 손 조작 고려
- 주요 CTA 화면 하단
- 충분한 Touch Target
- Workout 화면 집중형

### Desktop

동일 UI를 과도하게 Stretch하지 않는다.

```css
.app {
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
}
```

Desktop에서도 모바일 앱 형태로 중앙 표시한다.

---

## 12. App Branding

초기 버전은 Placeholder Icon URL 사용 가능.

추후 교체 가능해야 하는 값:

- App Name
- Favicon
- Apple Touch Icon
- Theme Color

권장 Config:

```javascript
const APP_CONFIG = {
  name: 'Workout Coach',
  iconUrl: 'ICON_URL',
  appleTouchIconUrl: 'ICON_URL',
  themeColor: '#111827'
};
```

PWA 고도화는 MVP에서 제외한다.

로컬 구현의 기본값은 `apps/web/src/data/exercises.js`의 앱 이름 `Workout Coach`, 테마 `#101b20`, 공통 SVG 아이콘이며 Apple Touch Icon URL은 비어 있다. URL을 지정하면 링크를 추가하고 favicon은 SVG 형식으로 고정하지 않는다. 링크 적용 검증과 실제 홈 화면 아이콘 검수는 구분한다.

---

## 13. 비기능 요구사항

### 사용성

- 운동 중 최대한 적은 조작
- 주요 버튼 한 손 접근 가능
- 운동 화면에서 불필요한 메뉴 숨김

### 성능

- 운동 데이터는 초기 로딩 후 Client-side에서 처리
- Timer / Tempo는 Client JavaScript에서 처리
- GAS Server 호출 최소화

### 유지보수

- 운동 추가 시 JavaScript 운동 객체 추가만으로 가능
- 이미지 교체 시 `imageUrl` 수정
- App Icon 교체 시 Config 수정
- 스타일은 Styles.html에 집중

---

## 14. MVP 제외 범위

- 로그인
- 사용자 관리
- Cloud DB
- Google Sheets Sync
- 운동 기록 분석
- 주간 / 월간 통계
- Progressive overload 추천
- AI 운동 추천
- Push Notification
- Wearable 연동
- PWA Offline Cache 고도화

---

## 15. 향후 확장 후보

필요성이 확인된 이후 검토한다.

- Routine Preset
- 운동 기록 History
- 운동별 수행 추세
- Progressive overload 보조
- 반복 횟수 직접 기록
- 개인 운동 이미지
- Custom Exercise 추가 UI

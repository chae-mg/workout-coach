# UI_SPEC — Workout Coach

## 1. UI 원칙

### Mobile-first

주 사용 환경이 모바일이므로 모든 핵심 기능은 스마트폰 Portrait 기준으로 설계한다.

### Workout 중 최소 조작

운동 중에는 필요한 기능만 노출한다.

```text
현재 운동
목표
세트
Tempo
완료
Skip
```

설정, 기록 등의 Navigation은 숨긴다.

### Desktop

모바일 Layout을 중앙 정렬한다.

권장:

```css
.app-shell {
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
}
```

---

# 2. 공통 Layout

일반 화면:

```text
Header
Content
Bottom Navigation
```

Workout / Rest:

```text
Progress
Main Content
Primary Action

Bottom Navigation 없음
```

---

# 3. 운동 선택 화면

## 목적

오늘 진행할 운동과 순서를 결정한다.

## Layout

```text
Workout Coach

오늘 운동
진행할 운동을 순서대로 선택하세요.

[전체] [상체] [하체] [코어]

┌────────────┐ ┌────────────┐
│      ①     │ │      ②     │
│   IMAGE    │ │   IMAGE    │
│            │ │            │
│ 스쿼트      │ │ 푸시업      │
│ 하체        │ │ 가슴·삼두    │
└────────────┘ └────────────┘

┌────────────┐ ┌────────────┐
│   IMAGE    │ │   IMAGE    │
│ 덤벨 로우   │ │ 해머 컬     │
│ 등·이두     │ │ 이두·전완    │
└────────────┘ └────────────┘

선택한 운동 4개

스쿼트 → 푸시업 → 덤벨 로우 → 해머 컬

[ 다음 ]

홈        기록        설정
```

## Card

구성:

```text
Image
Name
Target
Order Badge
```

선택 Card는 Border 또는 Background로 상태를 명확하게 구분한다.

---

# 4. 오늘 운동 확인

```text
오늘 운동

운동 4개
총 12세트
약 25분

① 스쿼트
15~20회 · 3세트
휴식 90초

② 팔굽혀펴기
8~15회 · 3세트
휴식 90초

③ 원암 덤벨 로우
좌우 8~12회 · 3세트
휴식 90초

[ 오늘만 세트/시간 조정 ]

[ 운동 시작 ]
```

각 Row 터치 시 Session용 Override Modal / Bottom Sheet를 열 수 있다.

---

# 5. Workout Player

```text
전체 사이클                     3 / 8

██████████░░░░░░░

┌────────────────────────┐
│                        │
│                        │
│         IMAGE          │
│                        │
│                        │
└────────────────────────┘

          팔굽혀펴기
           Push-up
          가슴 · 삼두

           8 ~ 15회

          SET 2 / 3

       🔊 Tempo 2 · 1 · 1

[          세트 완료          ]

건너뛰기                     ···
```

### TIME 운동

횟수 대신 Timer.

```text
00:42
```

필요 시:

```text
[ Pause ]
```

---

# 6. Rest

```text
             휴식

             01:18

          ● ● ● ● ●

다음

팔굽혀펴기 · SET 3 / 3
8~15회 · 가슴·삼두

[ -15초 ]          [ +15초 ]

[       휴식 건너뛰기       ]
```

3초 이하:

```text
00:03
00:02
00:01
```

Sound / Vibration 설정 반영.

---

# 7. 완료

```text
               ✓

        오늘 운동 완료

             32분

운동          완료 세트       건너뜀
 6              16              1

스쿼트                         3 / 3
팔굽혀펴기                     3 / 3
덤벨 로우                      3 / 3

[ 완료 ]
```

---

# 8. 설정

```text
설정

운동

기본 세트 수                    3 >
기본 휴식                     90초 >
운동 간 휴식                 120초 >

사운드 / 알림

Tempo Sound                    ON
휴식 종료음                     ON
종료 3초 카운트                 ON
진동                            ON

화면

화면 꺼짐 방지                  ON
운동별 설정                      >
```

---

# 9. 운동별 설정

예:

```text
← 팔굽혀펴기

목표 횟수
[ 8 ]  ~  [ 15 ]

세트
[ 3 ]

휴식
[ 90초 ]

Tempo
[ 2 ] - [ 1 ] - [ 1 ]

Tempo Sound
ON

[ 저장 ]
```

운동별 설정이 없으면 Global / Exercise Default 사용.

---

# 10. Resume Dialog

`active_session` 존재 시:

```text
진행 중인 운동이 있습니다.

팔굽혀펴기
SET 2 / 3

[ 이어하기 ]

[ 새 운동 시작 ]
```

---

# 11. Sample Image

초기 개발에서는 모든 운동이 동일한 Placeholder를 사용한다.

권장 비율:

```text
4:3
```

또는:

```text
1:1
```

운동 동작 이미지가 준비되면 Exercise의 `imageUrl`만 수정한다.

---

# 12. Touch 기준

권장 최소 높이:

```text
Primary Button
48px 이상

작은 Action
44px 이상
```

운동 중 핵심 CTA는 화면 하단에 배치한다.

---

# 13. Navigation

일반 화면:

```text
홈
기록
설정
```

MVP에서 기록 기능이 아직 없으면 `기록`은 완료 화면 또는 Placeholder로 연결해도 된다.

Workout 및 Rest 화면에서는 Bottom Navigation을 숨긴다.

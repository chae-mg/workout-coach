# Workout Coach

개인용 홈트레이닝 진행 보조 웹앱입니다.

Google Apps Script(GAS) Web App으로 배포하며, 주 사용 환경은 모바일 브라우저입니다.  
운동을 선택한 뒤 세트 진행, Tempo 안내음, 휴식 Countdown, 다음 운동 안내까지 한 흐름으로 진행하는 것을 목표로 합니다.

## 핵심 컨셉

이 앱은 운동 기록 중심 앱이 아니라 **Workout Player**입니다.

사용자는 운동 전에 오늘 진행할 운동을 순서대로 선택하고, 운동 중에는 화면의 안내에 따라 세트와 휴식을 진행합니다.

기본 흐름:

```text
운동 선택
→ 오늘 운동 확인
→ Workout Player
→ 세트 완료
→ Rest Timer
→ 다음 세트 / 다음 운동
→ 운동 완료
```

## 주요 기능

- Mobile-first UI
- 운동 선택 2×N Grid
- 선택 순서대로 운동 진행
- 운동 카드에 이미지 + 운동명 + 목표 부위 표시
- 운동별 세트 / 횟수 / 시간 / 휴식 설정
- Tempo Sound
- Rest Timer
- 휴식 ±15초 조절 및 건너뛰기
- 다음 세트 / 다음 운동 미리보기
- Session Resume
- 설정값 localStorage 저장
- 현재 운동 상태 localStorage 저장
- 화면 꺼짐 방지 옵션
- 진동 / 휴식 종료음 / Countdown Sound 옵션
- Favicon / Apple Touch Icon 확장 구조

## 기술 구성

```text
Google Apps Script
├─ Code.gs
├─ Config.gs
├─ Index.html
├─ Styles.html
├─ Script.html
└─ Exercises.html
```

별도의 DB나 Google Sheets는 사용하지 않습니다.

```text
영구 설정
→ localStorage

현재 운동 Session
→ localStorage

운동 기본 데이터
→ Exercises.html 내부 JavaScript 객체
```

## 권장 개발 순서

1. UI Skeleton 구현
2. 운동 데이터 구조 적용
3. 운동 선택 로직
4. Workout Player
5. Rest Timer
6. Tempo Sound
7. 설정 + localStorage
8. Session Resume
9. 모바일 브라우저 검수
10. GAS 배포

세부 구현 순서는 [PLAN.md](./PLAN.md)를 참고합니다.

## 문서

- [PRD.md](./PRD.md) — 제품 요구사항
- [PLAN.md](./PLAN.md) — 구현 단계 및 작업 순서
- [DATA_MODEL.md](./DATA_MODEL.md) — 운동 데이터 / 설정 / localStorage 구조
- [UI_SPEC.md](./UI_SPEC.md) — 화면 구조 및 UI 동작
- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) — GAS 구현 기준

## MVP에서 제외

다음 기능은 초기 버전에서 구현하지 않습니다.

- 사용자 계정
- 서버 DB
- Google Sheets 기반 설정 저장
- 운동 기록 분석
- 주간 / 월간 리포트
- Progressive overload 자동 추천
- Cloud Sync
- PWA 고도화
- 다중 사용자 지원

필요성이 생긴 경우 2차 기능으로 확장합니다.

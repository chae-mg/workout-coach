# 테스트 기준

- `pnpm test`: 핵심 로직 단위 테스트
- `pnpm test:rest-settings`: 휴식·설정·브라우저 시나리오
- `pnpm test:effects`: Web Audio와 기기 보조 기능
- `pnpm test:mobile`: 종합 모바일 레이아웃 시나리오
- `pnpm test:gas`: GAS 생성물과 번들 브라우저 시나리오

자동화된 브라우저 검증은 실제 휴대폰의 가청 음량, 화면 꺼짐 방지, 홈 화면 아이콘을 대신하지 않는다. 그 결과는 [`07_STATUS/MOBILE_QA.md`](../07_STATUS/MOBILE_QA.md)에 따로 기록한다.

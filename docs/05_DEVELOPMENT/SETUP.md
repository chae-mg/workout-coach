# 개발 환경 설정

Node.js 22 이상과 pnpm을 사용한다.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

기본 로컬 주소는 `http://127.0.0.1:4173`이다. 기본 공개 배포는 GitHub Pages를 사용하며 절차는 [`GITHUB_PAGES.md`](./GITHUB_PAGES.md)에 있다. GAS 번들 미리보기는 이전 호환 검증이 필요할 때 `pnpm preview:gas` 후 `http://127.0.0.1:4175`에서 연다.

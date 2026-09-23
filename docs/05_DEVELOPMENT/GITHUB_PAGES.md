# GitHub Pages 배포

Workout Coach 브라우저 앱은 정적 HTML·CSS·JavaScript 앱이다. `.github/workflows/deploy-pages.yml`이 `apps/web/`만 GitHub Pages에 게시하므로 GAS 파일 생성이나 별도 빌드가 필요하지 않다.

프로젝트 페이지의 예정 주소는 [https://chae-mg.github.io/workout-coach/](https://chae-mg.github.io/workout-coach/)다. 첫 배포 전 저장소의 **Settings → Pages → Build and deployment → Source**에서 `GitHub Actions`를 선택해야 한다. 현재 이 저장소는 설정이 아직 안 되어 첫 Actions 실행이 중단됐다. 설정 후 Actions에서 `Deploy GitHub Pages`를 다시 실행하면 게시된다. 저장소가 공개되어 있어 GitHub Free에서도 Pages를 사용할 수 있다. 자세한 내용은 [GitHub Pages 사용자 지정 워크플로 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)를 참고한다.

배포 뒤 Actions의 `Deploy GitHub Pages` 실행이 성공했는지 확인하고 위 주소를 연다. 운동 선택 화면이 표시되고 아이콘·스타일·모듈 스크립트가 로드되면 기본 제공을 확인한 것이다. Android의 실제 소리·화면 꺼짐 방지 동작은 브라우저 자동 검사와 별개다.

앱은 빌드 없이 브라우저 ES 모듈을 사용한다. `index.html`과 가져오는 자원은 상대 경로를 사용하므로 `/workout-coach/` 아래에서 열려도 저장소 루트를 가정하지 않는다. 워크플로는 `apps/web/`만 게시해 문서, 테스트, 개발 도구, GAS 빌드 산출물을 사이트에 포함하지 않는다.

설정과 진행 중 운동은 브라우저 `localStorage`에 저장된다. 기존 Apps Script 주소와 GitHub Pages 주소는 서로 다른 출처이므로 설정·진행 상태가 자동으로 이동하지 않는다. Pages에서 처음 열면 기본 설정으로 시작하며, 예전 설정은 GAS 주소 쪽 브라우저 저장소에 그대로 남는다. 계정·서버·클라우드 동기화는 제공하지 않는다.

## GAS 배포와의 관계

기존 Apps Script v4 배포는 별도 서비스로 남아 있다. GitHub Pages 전환은 그 배포를 삭제하거나 변경하지 않는다. 앞으로 기본 공유 주소는 GitHub Pages를 사용하고, GAS 파일 생성과 재배포가 필요할 때는 [GAS 배포 문서](./GAS_DEPLOYMENT.md)를 참고한다.

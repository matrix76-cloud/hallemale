# HallaMalle RN 프로젝트 (2026-02-20 생성)

## 기본 정보
- **위치**: `/Users/a1111/Downloads/2026Dev/mainproject/2026Mobile/HallaMalle`
- **패키지**: `com.hongcomms.hallemalle`
- **RN 버전**: 0.77.0
- **React**: 18.3.1, Node >= 18
- **패턴**: WebView Shell (RNShellDictionary 기반)

## 구조
```
HallaMalle/
├── App.js              → WebView Shell 메인 (RNShellDictionary에서 복사)
├── src/
│   ├── bridge/bridge.js         → RN ↔ Web 양방향 통신
│   ├── config/AppConfig.js      → 앱별 설정 (SSOT)
│   ├── features/
│   │   ├── auth/authDispatcher.js      → Google/Kakao 소셜 로그인
│   │   ├── guard/useBootGuard.js       → 스플래시/부팅 가드
│   │   ├── linking/linkingPolicy.js    → 외부 링크 정책
│   │   ├── location/locationTracker.js → 위치 추적
│   │   ├── permission/permissionHandler.js → 권한 요청
│   │   ├── push/pushBridge.js          → FCM 푸시
│   │   └── share/shareHandler.js       → 네이티브 공유
│   └── utils/safe.js            → JSON 안전 직렬화
├── android/
│   └── app/
│       ├── hallamalle-release.keystore  → 릴리스 키스토어
│       ├── debug.keystore               → 디버그 키스토어
│       └── src/main/res/mipmap-*/       → 앱 아이콘 (복원됨)
└── ios/HallaMalle/
    ├── Images.xcassets/AppIcon.appiconset/
    └── LaunchScreen.storyboard
```

## AppConfig 설정
- **webUrl**: `https://halle-bf789.web.app/welcome`
- **enableAuth**: true
- **enablePushBridge**: true
- **enableExternalLinking**: true
- **enableSplash**: true
- **splash title**: "할래말래"

## 의존성
- react-native-webview (WebView)
- @react-native-firebase/app + messaging (FCM)
- @react-native-google-signin/google-signin (구글 로그인)
- @react-native-seoul/kakao-login (카카오 로그인)
- @invertase/react-native-apple-authentication (애플 로그인)
- @react-native-community/geolocation (위치)

## 메시지 프로토콜 (Web ↔ RN)

### Web → RN
| 타입 | payload | 설명 |
|------|---------|------|
| WEB_READY | { at } | 웹 로드 완료 |
| NAV_STATE | { isRoot, path, canGoBackInWeb, hasBlockingUI } | 네비게이션 동기화 |
| EXIT_APP | - | 앱 종료 |
| START_SIGNIN | { provider: "google"\|"kakao" } | 소셜 로그인 요청 |
| START_SIGNOUT | - | 로그아웃 |
| GET_PUSH_TOKEN | - | FCM 토큰 요청 |
| REQUEST_PERMISSION | {} | 권한 요청 |
| OPEN_SETTINGS | {} | 설정 열기 |

### RN → Web
| 타입 | payload | 설명 |
|------|---------|------|
| WEB_READY_ACK | { at, install_id } | 웹 준비 확인 |
| NAV_STATE_ACK | { nav, at } | 네비게이션 확인 |
| BACK_REQUEST | { nav, at } | 뒤로가기 요청 |
| APP_EXIT_REQUEST | { at } | 앱 종료 요청 |
| SIGNIN_RESULT | { success, idToken, provider, error_* } | 로그인 결과 |
| SIGNOUT_RESULT | { success } | 로그아웃 결과 |
| FCM_TOKEN | { token } | FCM 토큰 전달 |
| PUSH_TOKEN | { token, platform, app_version } | 푸시 토큰 상세 |
| PUSH_EVENT | { remoteMessage } | 푸시 이벤트 |
| PUSH_BRIDGE_STATUS | { ok, reason? } | 푸시 브릿지 상태 |
| PERMISSION_RESULT | { location, push } | 권한 결과 |
| SPLASH_HIDDEN | { reason } | 스플래시 숨김 |
| OFFLINE_FALLBACK | { reason } | 오프라인 대응 |

## TODO (프로젝트 생성 후)
1. ⚠️ Firebase 앱 등록 (Android com.hongcomms.hallemalle + iOS)
2. ⚠️ google-services.json → android/app/
3. ⚠️ GoogleService-Info.plist → ios/HallaMalle/
4. ⚠️ AppConfig.social 키 설정 (googleWebClientId, kakaoNativeKey)
5. ⚠️ android/app/build.gradle 릴리스 서명 설정
6. 빌드 테스트: `npx react-native run-ios` / `run-android`

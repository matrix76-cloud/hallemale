---
name: rn-owner-project
description: 구장 관리자(구장주)용 RN WebView 앱 HallaMalleOwner — 생성 내역·식별자·빌드법·남은 작업
metadata: 
  node_type: memory
  type: project
  originSessionId: c89919e8-2a2c-4933-a1b6-35f92f808493
---

# 할래말래 구장주 앱 (HallaMalleOwner) — 2026-06-26 생성

사용자앱 [[rn-project]](HallaMalle)을 스켈레톤 삼아 만든 **구장 관리자용** WebView 앱. 구장 관리자 웹(`/owner/*`)을 감싸 스토어 출시 예정.

- **위치**: `/Users/a1111/Downloads/2026Dev/mainproject/2026Mobile/HallaMalleOwner`
- **패키지/번들ID**: `com.hongcomms.halleowner`
- **표시명**: 할래말래 구장주 / RN 프로젝트명(app.json name): `HallaMalleOwner`
- **webUrl**: `__DEV__ ? localhost:3000/owner : https://halle-bf789.web.app/owner` (AppConfig.js)
- **RN**: 0.77.0 (HallaMalle와 동일 deps: webview, firebase app/messaging, kakao-login, google-signin, geolocation, health/health-connect)
- **Firebase**: 사용자앱과 **같은 halle-bf789** 프로젝트에 새 패키지로 앱 등록
  - Android App ID: `1:939913723928:android:d26c226c0207b93a1cc36d`
  - iOS App ID: `1:939913723928:ios:610d69e3402d66981cc36d`
  - google-services.json → android/app/, GoogleService-Info.plist → ios/HallaMalleOwner/ 배치 완료
- **소셜키**: 같은 Firebase·같은 카카오 앱이라 키 재사용 (googleWebClientId, kakaoNativeKey `9d525…` 동일)
- 헬스/워치 권한은 구장주앱엔 불필요해 AndroidManifest에서 제외 (JS는 graceful 처리)

## 빌드 (Android) — 환경변수 필수
맥에 JAVA_HOME 미설정이라 그냥 `gradlew` 하면 "Unable to locate a Java Runtime" 뜸. Android Studio 번들 JDK 21 사용:
```
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="/Users/a1111/Library/Android/sdk"
android/gradlew -p android assembleDebug
```
`android/local.properties`에 `sdk.dir=/Users/a1111/Library/Android/sdk` 필요(생성함, gitignore됨).
→ 2026-06-26 assembleDebug BUILD SUCCESSFUL, app-debug.apk 112MB 생성 확인.

## 남은 수동 작업 (스토어 전)
- 카카오 개발자콘솔: `com.hongcomms.halleowner` 플랫폼(Android/iOS) + 키해시 추가
- Firebase Android SHA-1 등록 (구글 로그인용): `gradlew signingReport`
- iOS: `cd ios && pod install` + Xcode에서 `GoogleService-Info.plist`를 타겟 Copy Bundle Resources에 추가 + Signing 팀
- 앱 아이콘/스플래시 교체 (현재 기본 RN 아이콘)
- release 키스토어 자체 생성 (HallaMalle 키 재사용 불가 — 다른 패키지)

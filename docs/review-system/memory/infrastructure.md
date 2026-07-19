# 인프라 및 설정

## Firebase 프로젝트
- **프로젝트 ID**: halle-bf789
- **Firestore 위치**: nam5 (북미 멀티리전)
- **Functions 리전**: asia-northeast3 (도쿄)
- **타임존**: Asia/Seoul

## 의존성

### 프론트엔드 (package.json)
- React 19.2.0, React DOM 19.2.0
- React Router DOM 7.9.6
- Firebase SDK 12.6.0
- Styled Components 6.1.19
- Lottie React 2.4.1, Rive React 4.24.0
- React Icons 5.5.0
- React Scripts 5.0.1 (CRA)

### 백엔드 (functions/package.json)
- firebase-admin 13.6.0
- firebase-functions 7.0.0
- Node 20

## firebase.json 구성
- **Hosting**: build/ 디렉토리, SPA 리라이트 (`**` → `/index.html`)
- **Firestore**: 기본 DB, nam5, firestore.rules, firestore.indexes.json
- **Functions**: functions/ 소스
- **Storage**: storage.rules

## 보안 규칙 상태
- **Firestore**: ⚠️ 전면 허용 (allow read, write: if true) — 프로덕션 전 수정 필수
- **Storage**: 전면 차단 (allow read, write: if false)

## 환경 변수

### .env.production (프론트)
- REACT_APP_FIREBASE_API_KEY
- REACT_APP_FIREBASE_AUTH_DOMAIN
- REACT_APP_FIREBASE_PROJECT_ID
- REACT_APP_FIREBASE_STORAGE_BUCKET
- REACT_APP_FIREBASE_MESSAGING_SENDER_ID
- REACT_APP_FIREBASE_APP_ID
- REACT_APP_FIREBASE_MEASUREMENT_ID (G-XGV59SNLME)
- REACT_APP_SCHEMA_DUMP=1
- (미설정) REACT_APP_FCM_VAPID_KEY — 배포 전 필수!

### functions/.env (백엔드)
- FUNCTIONS_REGION=asia-northeast3
- TZ=Asia/Seoul
- CRAWL_DAYS_AHEAD=7
- USER_AGENT=Mozilla/5.0 (compatible; KBL-ScheduleBot/1.0)
- RESET_PASSWORD_PROXY_KEY (비밀번호 프록시 인증)

## 앱 진입점
1. `src/index.js` → React.StrictMode + BrowserRouter + App
2. `src/App.js` → Context 스택: Theme→Auth→Club→UI→HomeData→MatchingData→WebviewBridge→Routes
3. `src/services/firebase.js` → Firebase 초기화 (app, auth, db, storage)
4. `functions/index.js` → 6개 Cloud Functions 익스포트
5. `functions/firebaseAdmin.js` → Admin SDK 싱글톤

## public/ 주요 파일
- `index.html`: Kakao Maps API, Daum 우편번호, 모바일 최적화 viewport
- `firebase-messaging-sw.js`: FCM 백그라운드 수신 + 알림 클릭 → deepLink
- `manifest.json`: CRA 기본값 (앱이름 미업데이트)
- `fonts/`: GmarketSans, Pretendard (한글 폰트)

## 빌드/배포
```bash
# 프론트엔드
npm start          # 개발 서버
npm run build      # 프로덕션 빌드

# 백엔드
cd functions && npm run serve    # 에뮬레이터
firebase deploy --only functions # 함수 배포
firebase deploy --only hosting   # 호스팅 배포
firebase deploy                  # 전체 배포
firebase functions:log           # 로그
```

## 외부 서비스
- **Naver Sports API**: KBL/NBA 게임 데이터 크롤링
- **Kakao Maps API**: 지도 표시 (index.html에 SDK 로드)
- **Daum 우편번호**: 주소 검색
- **SMS Gateway**: `http://34.64.211.220:8080/sendSms` (GCP VM)
- **React Native WebView**: 앱 연동 (webviewBridge.js)

## 주요 리스크/TODO
1. ⚠️ Firestore 보안규칙 전면 허용 상태 → 프로덕션 전 수정
2. ⚠️ REACT_APP_FCM_VAPID_KEY 미설정
3. manifest.json 앱 이름 미업데이트 ("Create React App Sample")
4. Storage 규칙 전면 차단 (미디어 업로드 시 조정 필요)
5. SMS Gateway 하드코딩 IP (환경변수화 권장)

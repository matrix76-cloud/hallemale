# Hallamaella — 배포/운영 환경 체크리스트

## 1. 웹 푸시 VAPID 키 발급
1. [Firebase Console](https://console.firebase.google.com/) → 프로젝트 `halle-bf789`
2. ⚙️ 프로젝트 설정 → **Cloud Messaging** 탭
3. **웹 구성 → Web Push 인증서**에서 키 페어 생성 (또는 기존 키 복사)
4. `.env.production` 의 `REACT_APP_FCM_VAPID_KEY=...` 에 붙여넣기
5. `npm run build && firebase deploy --only hosting`

## 2. IAM: Service Account Token Creator 부여
카카오 커스텀 토큰 함수(`admin.auth().createCustomToken`)에 필수.

1. [GCP Console → IAM](https://console.cloud.google.com/iam-admin/iam?project=halle-bf789)
2. 주체: `halle-bf789@appspot.gserviceaccount.com`
3. 역할 추가: **Service Account Token Creator** (`roles/iam.serviceAccountTokenCreator`)
4. 누락 시 에러: `Permission 'iam.serviceAccounts.signBlob' denied`

## 3. SMS Gateway 헬스체크
```bash
curl -v http://34.64.211.220:8080/health
```
응답이 없으면 GCE VM 확인:
- GCP Console → Compute Engine → VM 인스턴스 → `sms-gateway` 상태
- 방화벽 규칙: `tcp:8080` 허용
- 로그: `gcloud compute ssh sms-gateway -- 'journalctl -u sms-gateway -n 100'`

## 4. 카카오 개발자 콘솔 체크리스트
- [ ] 네이티브 앱 키 발급 (앱 설정)
- [ ] 플랫폼 등록: **Android** 패키지명 `com.hongcomms.hallemalle`, **iOS** 번들 ID
- [ ] Android 키 해시 등록 (debug / release 각각)
  ```bash
  keytool -exportcert -alias androiddebugkey \
    -keystore ~/.android/debug.keystore -storepass android \
    | openssl sha1 -binary | openssl base64
  ```
- [ ] 제품 설정 → **카카오 로그인 활성화 ON**
- [ ] 동의항목: 닉네임/프로필사진(선택), 이메일(선택)
- [ ] Redirect URI: 사용 안 함(네이티브 SDK 방식)

## 5. 배포 전 빠른 체크
- [ ] `.env.production` 필수 키 전부 채워짐 (`.env.production.example` 기준)
- [ ] Firestore 보안 규칙 점검 (현재 전면 허용 상태 주의)
- [ ] `firebase deploy --only functions,hosting`
- [ ] 카카오 로그인 실제 기기에서 1회 확인 (앱 복귀 flow 포함)

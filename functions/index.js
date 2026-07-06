const {crawlKblInitOnce, crawlKblDaily, crawlKblTick } = require("./jobs/crawlKblGames");
const { resetPasswordViaProxy } = require("./password/resetPasswordViaProxy");

exports.crawlKblInitOnce = crawlKblInitOnce;
exports.crawlKblDaily = crawlKblDaily;
exports.crawlKblTick = crawlKblTick;
exports.resetPasswordViaProxy = resetPasswordViaProxy;

// ✅ SMS Proxy export 추가
const { sendSmsProxy } = require("./sms/sendSmsProxy");
exports.sendSmsProxy = sendSmsProxy;

// ✅ FCM Push Notification — 실시간 트리거(생성 즉시 발송) + 스케줄러(백로그·재시도 폴백)
const { sendPushTick, onNotificationCreated } = require("./jobs/sendPushNotifications");
exports.sendPushTick = sendPushTick;
exports.onNotificationCreated = onNotificationCreated;

// ✅ 즉시 푸시 발송 (디버깅용)
const { sendTestPush } = require("./jobs/sendTestPush");
exports.sendTestPush = sendTestPush;

// ✅ 경기 시작 알림 스케줄러 (5분마다)
const { matchStartReminderTick } = require("./jobs/matchStartReminder");
exports.matchStartReminderTick = matchStartReminderTick;

// ✅ 경기 종료 + 결과 입력 알림 스케줄러 (5분마다)
const { matchEndReminderTick } = require("./jobs/matchEndReminder");
exports.matchEndReminderTick = matchEndReminderTick;

// ✅ 결과 미입력 무효 처리 스케줄러 (매시간): 종료+3일까지 양 팀 다 미입력이면 무효 종결
const { matchAutoVoidTick } = require("./jobs/matchAutoVoid");
exports.matchAutoVoidTick = matchAutoVoidTick;

// ✅ 결과 자동 승인 스케줄러 (매시간): 한 팀이 제출했는데 종료+3일까지 상대 미승인이면 제출값으로 자동 확정
const { matchAutoConfirmTick } = require("./jobs/matchAutoConfirm");
exports.matchAutoConfirmTick = matchAutoConfirmTick;

// ✅ 카카오 소셜 로그인 (accessToken → Firebase Custom Token)
const { kakaoCustomToken } = require("./auth/kakaoCustomToken");
exports.kakaoCustomToken = kakaoCustomToken;

// ✅ 회원탈퇴 — Auth 계정 삭제 (Admin SDK, requires-recent-login 회피)
const { deleteAccount } = require("./auth/deleteAccount");
exports.deleteAccount = deleteAccount;

// ✅ 어드민 로그인 — 서버 비번검증 + admin 클레임 커스텀 토큰 발급
const { adminLogin } = require("./auth/adminLogin");
exports.adminLogin = adminLogin;

// ✅ 국세청 사업자등록정보 진위확인 (구장 사업자 인증 자동 처리)
const { verifyBusiness } = require("./business/verifyBusiness");
exports.verifyBusiness = verifyBusiness;

// ✅ 전화번호 SMS 인증 (Solapi) — 소셜 계정 전화번호 통합용
const { requestPhoneOtp, verifyPhoneOtp } = require("./otp/phoneOtp");
exports.requestPhoneOtp = requestPhoneOtp;
exports.verifyPhoneOtp = verifyPhoneOtp;
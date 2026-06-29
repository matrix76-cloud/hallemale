const {crawlKblInitOnce, crawlKblDaily, crawlKblTick } = require("./jobs/crawlKblGames");
const { resetPasswordViaProxy } = require("./password/resetPasswordViaProxy");

exports.crawlKblInitOnce = crawlKblInitOnce;
exports.crawlKblDaily = crawlKblDaily;
exports.crawlKblTick = crawlKblTick;
exports.resetPasswordViaProxy = resetPasswordViaProxy;

// ✅ SMS Proxy export 추가
const { sendSmsProxy } = require("./sms/sendSmsProxy");
exports.sendSmsProxy = sendSmsProxy;

// ✅ FCM Push Notification 스케줄러
const { sendPushTick } = require("./jobs/sendPushNotifications");
exports.sendPushTick = sendPushTick;

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
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

// ✅ 카카오 소셜 로그인 (accessToken → Firebase Custom Token)
const { kakaoCustomToken } = require("./auth/kakaoCustomToken");
exports.kakaoCustomToken = kakaoCustomToken;
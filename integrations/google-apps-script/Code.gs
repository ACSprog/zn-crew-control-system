/**
 * ZN Crew Control — free email gateway on Google Apps Script (Gmail).
 *
 * Interim / staging alternative to the Microsoft Power Automate flow.
 * Sends from the Gmail account that deploys this script. Consumer Gmail
 * accounts can email roughly 100 recipients per day through Apps Script.
 *
 * Setup (see docs/FREE_TIER.md → "Option B: Gmail via Google Apps Script"):
 *  1. script.google.com → New project → paste this file.
 *  2. Project Settings → Script properties:
 *       SHARED_SECRET    = <long random string, same as in the app>
 *       ALLOWED_DOMAINS  = zambiaairways.co.zm,gmail.com   (comma-separated)
 *       SENDER_NAME      = Zambia Airways Crew Control
 *       REPLY_TO         = (optional) occ@zambiaairways.co.zm
 *  3. Deploy → New deployment → Web app.
 *       Execute as: Me    Who has access: Anyone
 *  4. Copy the Web app URL (…/exec) into Crew Control →
 *     Notifications → Gateway settings → "Flow HTTP POST URL".
 */

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    var expected = props.getProperty('SHARED_SECRET');
    if (!expected || payload.secret !== expected) {
      return reply_(false, 'Rejected: bad or missing shared secret.');
    }

    var to = String(payload.to || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      return reply_(false, 'Rejected: invalid recipient address.');
    }

    // Never let a leaked URL be used to email arbitrary outsiders.
    var allowed = (props.getProperty('ALLOWED_DOMAINS') || 'zambiaairways.co.zm')
      .split(',')
      .map(function (d) { return d.trim().toLowerCase(); })
      .filter(String);
    var domain = to.split('@')[1];
    if (allowed.indexOf(domain) === -1) {
      return reply_(false, 'Rejected: recipient domain ' + domain + ' is not in ALLOWED_DOMAINS.');
    }

    if (MailApp.getRemainingDailyQuota() < 1) {
      return reply_(false, 'Daily Gmail sending quota reached. Try again tomorrow.');
    }

    var priority = String(payload.priority || '');
    var subject = String(payload.subject || 'Zambia Airways Crew Control notification');
    if (priority === 'CRITICAL') subject = '[CRITICAL] ' + subject;

    var options = {
      to: to,
      subject: subject,
      body: String(payload.textBody || stripHtml_(payload.htmlBody || '')),
      name: props.getProperty('SENDER_NAME') || 'Zambia Airways Crew Control',
    };
    if (payload.htmlBody) options.htmlBody = String(payload.htmlBody);
    var replyTo = props.getProperty('REPLY_TO');
    if (replyTo) options.replyTo = replyTo;

    MailApp.sendEmail(options);
    return reply_(true, 'Sent via Gmail to ' + to + '. Remaining quota today: ' + MailApp.getRemainingDailyQuota());
  } catch (err) {
    return reply_(false, 'Error: ' + (err && err.message ? err.message : err));
  }
}

/** Lets you open the /exec URL in a browser to check it is deployed. */
function doGet() {
  return reply_(true, 'ZN Crew Control Gmail gateway is running.');
}

function reply_(ok, message) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: ok, message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

function stripHtml_(html) {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

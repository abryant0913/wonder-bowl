/**
 * ============================================================================
 * Wonder Bowl — form submission sink (Google Apps Script web app)
 * ============================================================================
 * Receives sign-up payloads from wonder-bowl.com and appends one row per
 * submission to a Google Sheet you own.
 *
 * DEPLOY
 *   1. Open the Google Sheet that should hold submissions.
 *   2. Extensions > Apps Script. Delete the stub, paste this file, Save.
 *   3. Deploy > New deployment > type "Web app".
 *        Execute as:      Me
 *        Who has access:  Anyone            <- required; the browser posts anonymously
 *   4. Authorize when prompted, then copy the /exec URL.
 *   5. Paste that URL into FORM_ENDPOINT in script.js and redeploy the site.
 *
 * RE-DEPLOYING AFTER AN EDIT
 *   Deploy > Manage deployments > edit (pencil) > Version: New version > Deploy.
 *   This keeps the SAME /exec URL. Creating a *new* deployment mints a new URL
 *   and would silently orphan the site until script.js is updated to match.
 *
 * NOTE ON THE CONTENT TYPE
 *   The site posts text/plain (not application/json) on purpose: JSON would
 *   trigger a CORS preflight OPTIONS request, which Apps Script web apps do not
 *   answer. The body is still JSON — we just parse it ourselves below.
 * ============================================================================
 */

var SHEET_NAME = "Submissions";

// Column order for the sheet. Adding a field here is enough — the header row is
// created on first write and any new trailing columns are appended on the fly.
var COLUMNS = [
  "wb_id",
  "submitted_at",
  "received_at",
  "name",
  "email",
  "address",
  "dog_name",
  "dog_age",
  "dog_size",
  "ad_variant",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "landing_url",
  "agree_terms"
];

function doPost(e) {
  // Serialize appends. Two visitors submitting in the same instant would
  // otherwise race on getLastRow() and one row could overwrite the other.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return jsonOut({ ok: false, error: "busy" });
  }

  try {
    var payload = parseBody(e);
    if (!payload) return jsonOut({ ok: false, error: "empty or unparseable body" });

    var sheet = getSheet();
    ensureHeader(sheet);

    // Idempotency. The site sends each submission with a unique wb_id and keeps
    // a local retry queue; a request that actually succeeded but whose response
    // was lost to the Stripe redirect will be retried on the visitor's next
    // visit. Without this guard that would append a duplicate row.
    if (payload.wb_id && alreadyRecorded(sheet, payload.wb_id)) {
      return jsonOut({ ok: true, duplicate: true });
    }

    var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    payload.received_at = new Date().toISOString();

    // Any field the site sends that we don't have a column for yet gets one,
    // so a future form field can't be silently dropped.
    Object.keys(payload).forEach(function (key) {
      if (header.indexOf(key) === -1) {
        header.push(key);
        sheet.getRange(1, header.length).setValue(key).setFontWeight("bold");
      }
    });

    var row = header.map(function (key) {
      var v = payload[key];
      if (v === undefined || v === null) return "";
      // Force text so long addresses and leading-zero values aren't coerced.
      return typeof v === "object" ? JSON.stringify(v) : String(v);
    });

    sheet.appendRow(row);
    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// A GET on the /exec URL is a convenient "is this deployment alive?" check.
function doGet() {
  return jsonOut({ ok: true, service: "wonder-bowl form sink" });
}

function parseBody(e) {
  if (!e) return null;
  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {
      // Fall through to form-encoded below.
    }
  }
  if (e.parameter && Object.keys(e.parameter).length) return e.parameter;
  return null;
}

function alreadyRecorded(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var col = header.indexOf("wb_id");
  if (col === -1) return false;
  var ids = sheet.getRange(2, col + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return true;
  }
  return false;
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function ensureHeader(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]).setFontWeight("bold");
  sheet.setFrozenRows(1);
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

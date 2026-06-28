// Code.gs

const SHEET_NAME = '學員帳號';

// Google OAuth Web Client ID
// 來源：Google Cloud Console → APIs & Services → Credentials
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

// GitHub OAuth App
// 來源：GitHub → Developer settings → OAuth Apps
const GITHUB_CLIENT_ID = 'YOUR_GITHUB_OAUTH_APP_CLIENT_ID';

// 必須和 GitHub OAuth App 的 Authorization callback URL 完全一致。
const GITHUB_REDIRECT_URI = 'https://accounts.sitcon.party/';

const SCRIPT_PROPERTY_KEYS = {
  SPREADSHEET_ID: 'SPREADSHEET_ID',
  GITHUB_CLIENT_SECRET: 'GITHUB_CLIENT_SECRET',
};

const COLUMNS = {
  TEAM: 1,
  NAME: 2,
  CONTACT_EMAIL: 3,
  TOKEN: 4,
  GOOGLE_ACCOUNT_MAIL: 5,
  GITHUB_USERNAME: 6,
  TEAM_TELEGRAM_URL: 7,
  CAMP_TELEGRAM_URL: 8,
};

function doGet(e) {
  const action = String(e.parameter.action || '').trim();

  if (action === 'profile') {
    return handleProfileRequest_(e);
  }

  if (action === 'complete') {
    return handleCompleteRequest_(e);
  }

  return jsonp_(e, {
    ok: false,
    message: '這是 SITCON Camp 2026 行前帳號設定後端。請從行前信中的專屬連結進入。',
  });
}

function handleProfileRequest_(e) {
  const token = normalizeToken_(e.parameter.t);

  try {
    if (!token) {
      throw new Error('缺少綁定碼，請確認行前信連結是否完整。');
    }

    const rowInfo = findRowByToken_(token);

    if (!rowInfo) {
      throw new Error('找不到這個綁定碼對應的學員資料。');
    }

    return jsonp_(e, {
      ok: true,
      team: String(rowInfo.values[COLUMNS.TEAM - 1] || ''),
      name: String(rowInfo.values[COLUMNS.NAME - 1] || ''),
      hasGoogleAccountMail: Boolean(rowInfo.values[COLUMNS.GOOGLE_ACCOUNT_MAIL - 1]),
      hasGithubUsername: Boolean(rowInfo.values[COLUMNS.GITHUB_USERNAME - 1]),

      // 注意：profile 階段不回傳任何群組連結，避免尚未完成驗證前外洩。
      hasTeamTelegramUrl: Boolean(rowInfo.values[COLUMNS.TEAM_TELEGRAM_URL - 1]),
      hasCampTelegramUrl: Boolean(rowInfo.values[COLUMNS.CAMP_TELEGRAM_URL - 1]),
    });
  } catch (error) {
    return jsonp_(e, {
      ok: false,
      message: error.message || String(error),
    });
  }
}

function handleCompleteRequest_(e) {
  try {
    assertConfigReady_();

    const token = normalizeToken_(e.parameter.t);
    const googleCredential = String(e.parameter.credential || '').trim();
    const githubCode = String(e.parameter.githubCode || '').trim();
    const githubState = String(e.parameter.githubState || '').trim();

    if (!token) {
      throw new Error('缺少綁定碼，請重新打開行前信連結。');
    }

    if (!googleCredential) {
      throw new Error('尚未完成 Google 登入。');
    }

    if (!githubCode) {
      throw new Error('缺少 GitHub OAuth code，請重新操作 GitHub 授權。');
    }

    if (!githubState) {
      throw new Error('缺少 GitHub OAuth state，請重新操作 GitHub 授權。');
    }

    const rowInfo = findRowByToken_(token);

    if (!rowInfo) {
      throw new Error('找不到這個綁定碼對應的學員資料。');
    }

    const googleEmail = verifyGoogleCredential_(googleCredential);

    const githubAccessToken = exchangeGithubCodeForToken_(githubCode);
    const githubUser = fetchGithubAuthenticatedUser_(githubAccessToken);

    if (!githubUser.login) {
      throw new Error('GitHub 回傳資料中沒有 username。');
    }

    const sheet = getSheet_();

    sheet
      .getRange(rowInfo.row, COLUMNS.GOOGLE_ACCOUNT_MAIL, 1, 2)
      .setValues([[
        googleEmail,
        githubUser.login,
      ]]);

    return jsonp_(e, {
      ok: true,
      team: String(rowInfo.values[COLUMNS.TEAM - 1] || ''),
      name: String(rowInfo.values[COLUMNS.NAME - 1] || ''),
      googleEmail,
      githubUsername: String(githubUser.login || ''),

      // 只有 complete 驗證成功才回傳群組連結。
      teamTelegramUrl: String(rowInfo.values[COLUMNS.TEAM_TELEGRAM_URL - 1] || ''),
      campTelegramUrl: String(rowInfo.values[COLUMNS.CAMP_TELEGRAM_URL - 1] || ''),
    });
  } catch (error) {
    return jsonp_(e, {
      ok: false,
      message: error.message || String(error),
    });
  }
}

function exchangeGithubCodeForToken_(code) {
  const response = UrlFetchApp.fetch(
    'https://github.com/login/oauth/access_token',
    {
      method: 'post',
      muteHttpExceptions: true,
      headers: {
        Accept: 'application/json',
      },
      payload: {
        client_id: GITHUB_CLIENT_ID,
        client_secret: getRequiredScriptProperty_(
          SCRIPT_PROPERTY_KEYS.GITHUB_CLIENT_SECRET
        ),
        code,
        redirect_uri: GITHUB_REDIRECT_URI,
      },
    }
  );

  if (response.getResponseCode() !== 200) {
    throw new Error(
      `GitHub token exchange 失敗，HTTP ${response.getResponseCode()}`
    );
  }

  const data = JSON.parse(response.getContentText());

  if (data.error) {
    throw new Error(
      `GitHub token exchange 失敗：${data.error_description || data.error}`
    );
  }

  if (!data.access_token) {
    throw new Error('GitHub token exchange 失敗：沒有 access_token。');
  }

  return data.access_token;
}

function fetchGithubAuthenticatedUser_(accessToken) {
  const response = UrlFetchApp.fetch(
    'https://api.github.com/user',
    {
      method: 'get',
      muteHttpExceptions: true,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + accessToken,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'SITCON-Camp-2026-Account-Binding',
      },
    }
  );

  if (response.getResponseCode() !== 200) {
    throw new Error(
      `GitHub 使用者資料讀取失敗，HTTP ${response.getResponseCode()}`
    );
  }

  return JSON.parse(response.getContentText());
}

function verifyGoogleCredential_(credential) {
  const url =
    'https://oauth2.googleapis.com/tokeninfo?id_token=' +
    encodeURIComponent(credential);

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('Google 帳號驗證失敗，請重新登入。');
  }

  const data = JSON.parse(response.getContentText());

  if (data.aud !== GOOGLE_CLIENT_ID) {
    throw new Error('Google OAuth Client ID 不符合，請檢查 GOOGLE_CLIENT_ID 設定。');
  }

  if (
    data.iss !== 'accounts.google.com' &&
    data.iss !== 'https://accounts.google.com'
  ) {
    throw new Error('Google ID token issuer 不正確。');
  }

  if (Number(data.exp) * 1000 < Date.now()) {
    throw new Error('Google 登入憑證已過期，請重新登入。');
  }

  if (String(data.email_verified) !== 'true') {
    throw new Error('Google email 尚未通過驗證。');
  }

  const email = String(data.email || '').trim();

  if (!email) {
    throw new Error('Google 回傳資料中沒有 email。');
  }

  return email;
}

function findRowByToken_(token) {
  const normalizedToken = normalizeToken_(token);

  if (!normalizedToken) {
    return null;
  }

  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();

  for (let i = 0; i < values.length; i++) {
    const rowToken = normalizeToken_(values[i][COLUMNS.TOKEN - 1]);

    if (rowToken && rowToken === normalizedToken) {
      return {
        row: i + 2,
        values: values[i],
      };
    }
  }

  return null;
}

function normalizeToken_(token) {
  return String(token || '').trim();
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(
    getRequiredScriptProperty_(SCRIPT_PROPERTY_KEYS.SPREADSHEET_ID)
  );
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error(`找不到分頁：${SHEET_NAME}`);
  }

  return sheet;
}

function assertConfigReady_() {
  if (
    !GOOGLE_CLIENT_ID ||
    GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'
  ) {
    throw new Error('尚未設定 GOOGLE_CLIENT_ID。');
  }

  if (
    !GITHUB_CLIENT_ID ||
    GITHUB_CLIENT_ID === 'YOUR_GITHUB_OAUTH_APP_CLIENT_ID'
  ) {
    throw new Error('尚未設定 GITHUB_CLIENT_ID。');
  }

  if (
    !getRequiredScriptProperty_(SCRIPT_PROPERTY_KEYS.GITHUB_CLIENT_SECRET)
  ) {
    throw new Error('尚未設定 GITHUB_CLIENT_SECRET。');
  }

  if (
    !GITHUB_REDIRECT_URI ||
    GITHUB_REDIRECT_URI !== 'https://accounts.sitcon.party/'
  ) {
    throw new Error('GITHUB_REDIRECT_URI 設定不正確。');
  }
}

function getRequiredScriptProperty_(key) {
  const value = PropertiesService
    .getScriptProperties()
    .getProperty(key);

  if (!value) {
    throw new Error(`尚未設定 Script Property：${key}`);
  }

  return String(value).trim();
}

function jsonp_(e, payload) {
  const callback = String(e.parameter.callback || '').trim();

  if (!isSafeJsonpCallback_(callback)) {
    return ContentService
      .createTextOutput('/* invalid callback */')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput('/**/' + callback + '(' + JSON.stringify(payload) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function isSafeJsonpCallback_(callback) {
  return /^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback);
}

# SITCON Camp 2026 行前帳號設定

這個專案負責 `accounts.sitcon.party` 的行前帳號設定流程。目標不是單純收集欄位，而是讓學員在活動前完成營隊工具的基本準備：

- 選擇營隊期間要使用的 Google 帳號，用於講義、共筆、表單與雲端資料夾權限。
- 登入或建立 GitHub 帳號，用於課程練習、程式碼範例與協作環境。
- 完成驗證後取得 Telegram 群組連結，加入營隊大群與所屬小隊群組。

前端部署在：

```text
https://accounts.sitcon.party/
```

學員行前信中的專屬連結格式為：

```text
https://accounts.sitcon.party/?t=<學員綁定碼>
```

如果學員從 Gmail、LINE、Instagram、Facebook 等 App 內建瀏覽器打開，頁面會阻止開始 OAuth，並提醒改用 Safari 或 Chrome 開啟。這是為了避免 Google / GitHub OAuth 在嵌入式瀏覽器中失敗。

## 檔案說明

```text
index.html   accounts.sitcon.party 的靜態前端頁面
Code.gs      Google Apps Script JSONP 後端
README.md    給 SITCON 夥伴看的維護與重建文件
AGENTS.md    給 coding agent 看的維護指引
```

## 整體流程

```text
1. 學員打開 https://accounts.sitcon.party/?t=<綁定碼>
2. 前端用 JSONP 呼叫 Apps Script action=profile
3. Apps Script 根據綁定碼回傳小隊與姓名
4. 學員確認小隊與姓名正確
5. 學員完成 Google Sign-In
6. 學員點 Continue with GitHub
7. GitHub OAuth callback 回 https://accounts.sitcon.party/
8. 前端用 JSONP 呼叫 Apps Script action=complete
9. Apps Script 驗證綁定碼、Google credential、GitHub code
10. Apps Script 回填 Google Sheet
11. 前端顯示完成頁與 Telegram 群組連結
```

Apps Script 只作為資料與 OAuth 後端，不負責渲染完成頁。完成頁必須留在 `accounts.sitcon.party`，避免 Apps Script HTML 在手機瀏覽器中出現版面與登入流程問題。

## Google Sheet 契約

分頁名稱必須是：

```text
學員帳號
```

欄位順序必須維持：

```text
A 小隊
B 學員姓名
C 行前信接收 email
D token
E google account mail
F GitHub username
G Telegram 群組連結
H 營隊大群組連結
```

範例資料列：

```text
小隊,學員姓名,行前信接收 email,token,google account mail,GitHub username,Telegram 群組連結,營隊大群組連結
第 1 小隊,王小明,student@example.com,9f4q2x8m6c,,,https://t.me/+TEAM_INVITE,https://t.me/+CAMP_INVITE
```

`profile` 階段只會回傳小隊與姓名，不會回傳 Telegram 群組連結或行前信 email。群組連結只有在 `complete` 階段成功驗證綁定碼、Google credential、GitHub OAuth code 後才回傳，避免群組連結被單純查詢綁定碼取得。

## 綁定碼規則

綁定碼是學員專屬、不可公開的查詢鑰匙。建議：

- 每位學員一組不重複綁定碼。
- 使用亂數產生，不使用姓名、email、報名序號或可猜測規則。
- 長度至少 10 個英數字元；如果手動輸入需求高，可以使用不易混淆的字元集。
- 發送前檢查 Google Sheet 的 `token` 欄沒有空白與重複值。
- 不要把含有真實綁定碼的完整連結貼到公開 issue、PR、文件或截圖。

## 需要設定的值

### index.html

請在 `index.html` 設定公開的前端常數：

```js
const GITHUB_CLIENT_ID = 'YOUR_GITHUB_OAUTH_APP_CLIENT_ID';
const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

並替換 Google Sign-In 的 client ID：

```html
data-client_id="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
```

### Code.gs

請在 `Code.gs` 設定可公開提交的 OAuth client ID：

```js
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const GITHUB_CLIENT_ID = 'YOUR_GITHUB_OAUTH_APP_CLIENT_ID';
const GITHUB_REDIRECT_URI = 'https://accounts.sitcon.party/';
```

敏感值與環境值請設定在 Apps Script 的 Script Properties，不要寫進 `Code.gs`：

```text
SPREADSHEET_ID=<Google Sheet ID>
GITHUB_CLIENT_SECRET=<GitHub OAuth App client secret>
```

`SPREADSHEET_ID` 是 Google Sheet URL 中 `/d/` 和 `/edit` 之間的字串。

## 從零重建

1. 建立 Google Sheet，新增分頁 `學員帳號`，並依照「Google Sheet 契約」建立 A 到 H 欄。
2. 產生每位學員的綁定碼，填入 D 欄。
3. 建立 Google Cloud OAuth Client，類型選 `Web application`。
4. 在 Google OAuth Client 設定 Authorized JavaScript origins：

   ```text
   https://accounts.sitcon.party
   ```

   不要加 `/`、path 或 query string。

5. 建立 GitHub OAuth App。請使用 OAuth App，不要使用 GitHub App。

   ```text
   Application name: SITCON Camp 2026 Account Setup
   Homepage URL: https://accounts.sitcon.party
   Authorization callback URL: https://accounts.sitcon.party/
   ```

   目前只需要取得 GitHub username，不需要額外 repo scope。

6. 建立 Google Apps Script 專案，把 `Code.gs` 內容貼入。
7. 在 Apps Script Project Settings 的 Script Properties 設定：

   ```text
   SPREADSHEET_ID=<Google Sheet ID>
   GITHUB_CLIENT_SECRET=<GitHub OAuth App client secret>
   ```

8. 在 `Code.gs` 更新 `GOOGLE_CLIENT_ID`、`GITHUB_CLIENT_ID`。
9. 在 Apps Script 編輯器執行任一函式，依照畫面完成授權。第一次授權會要求存取 Google Sheet 與外部服務。
10. 部署 Apps Script Web App：

   ```text
   Execute as: Me
   Who has access: Anyone
   ```

11. 將 Web App `/exec` URL 填回 `index.html` 的 `APPS_SCRIPT_WEB_APP_URL`。
12. 在 `index.html` 更新 `GITHUB_CLIENT_ID` 與 Google Sign-In `data-client_id`。
13. 部署 `index.html` 到 `accounts.sitcon.party`。
14. 用測試資料完整跑過「測試矩陣」後，再寄送行前信。

更新 Apps Script 時，請編輯既有 deployment 並選 `New version`：

```text
Deploy -> Manage deployments -> 選原本的 Web app -> Edit -> Version 選 New version -> Deploy
```

這樣 `/exec` URL 不會改變，`index.html` 裡的 `APPS_SCRIPT_WEB_APP_URL` 不需要重新更新。

## 測試矩陣

### 成功流程

1. 在 Google Sheet 建立一筆測試資料，填入 `小隊`、`學員姓名`、`行前信接收 email`、`token`。
2. 打開：

   ```text
   https://accounts.sitcon.party/?t=<測試綁定碼>
   ```

3. 確認頁面顯示正確的小隊與姓名。
4. 確認 `profile` JSONP response 沒有行前信 email，也沒有 Telegram 群組連結。
5. 完成 Google Sign-In。
6. 點 Continue with GitHub。
7. GitHub 授權後應回到 `https://accounts.sitcon.party/`。
8. 成功後應顯示 Google 信箱、GitHub 帳號、Telegram 群組按鈕。
9. Google Sheet 的 E、F 欄應被回填。

### 失敗與邊界流程

- 無效綁定碼：頁面應顯示學員可理解的報名資料查無提示，不應出現 `token` 等後端字眼。
- 空白綁定碼：首頁應提醒可輸入綁定碼或貼上完整專屬連結。
- App 內建瀏覽器：頁面應提醒改用 Safari 或 Chrome，並提供複製專屬連結的按鈕。
- Google OAuth Client ID 錯誤：應無法完成 Google 驗證，請檢查 `index.html` 與 `Code.gs` 設定是否一致。
- GitHub OAuth callback 錯誤：GitHub 應拒絕或回不到正確頁面，請檢查 callback URL 是否完全等於 `https://accounts.sitcon.party/`。
- Telegram 連結空白：完成頁應顯示等待工作人員通知，而不是壞掉的按鈕。

## 常見問題

### 學員說點信件連結後無法登入

通常是 App 內建瀏覽器造成。請學員改用 Safari 或 Chrome 開啟，或到：

```text
https://accounts.sitcon.party/
```

手動輸入行前信中的綁定碼。

### 頁面顯示找不到報名資料

請檢查：

- 學員是否使用最新行前信中的專屬連結。
- Google Sheet 的 `token` 是否存在、沒有前後空白、沒有被重新產生。
- 分頁名稱是否仍為 `學員帳號`。
- 欄位順序是否仍為 A 到 H。
- Apps Script Script Property `SPREADSHEET_ID` 是否指到正確試算表。

### 頁面顯示暫時連不上行前帳號設定系統

請檢查：

- Apps Script deployment 是否為 `Who has access: Anyone`。
- `APPS_SCRIPT_WEB_APP_URL` 是否為目前 active deployment 的 `/exec` URL。
- Apps Script 是否曾建立新 deployment，導致前端仍指向舊 URL。

### GitHub OAuth 失敗

請檢查：

- GitHub OAuth App 的 callback URL 是否是 `https://accounts.sitcon.party/`。
- `index.html` 和 `Code.gs` 的 GitHub Client ID 是否一致。
- Apps Script Script Property `GITHUB_CLIENT_SECRET` 是否正確。

## 安全與資料最小化

此流程只蒐集活動執行必要資料：

- Google account mail
- GitHub username

Google Sheet 內的行前信 email 是既有報名資訊，用於內部對應，不透過本頁對外顯示。Telegram 群組連結只在完成驗證後回傳。

維護時請遵守：

- 不要把 `GITHUB_CLIENT_SECRET` 寫進 `index.html` 或 `Code.gs`。
- 不要從 `profile` 回傳行前信 email 或 Telegram 群組連結。
- 不要把真實學員資料、真實綁定碼、群組邀請連結貼到公開 issue、PR 或文件。
- 若需要公開截圖，請遮蔽姓名、email、token、Google Sheet ID、Telegram 邀請連結。

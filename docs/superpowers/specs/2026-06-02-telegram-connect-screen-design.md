# Telegram Connect Screen Design

## Goal

Add an inline wizard in the Connect Storage modal for Telegram. Users enter a connection name, then authenticate with Telegram (phone → code → optional 2FA) through the microservice. The wizard has 3 steps inside the same modal, matching the credential-based provider pattern used by FTP/SFTP.

## Scope

In scope:

- `TelegramConnectionForm` component — 3-step inline wizard.
- `TelegramConnectionController` — store endpoint (POST /connections/telegram).
- `StoreTelegramConnectionRequest` — validation.
- Route registration.
- `ConnectStorageModal` — add Telegram case.
- `ProviderOption` — add 'telegram' to supported credentials providers.
- `HomeController` — ensure TELEGRAM gets `authType: 'credentials'`.
- TypeScript types for Telegram config.

Out of scope:

- Edit connection dialog (phase 2).
- Connection test before save (Telegram auth is the test itself).
- Telegram SVG icon (already exists from previous work).

## Wizard Flow

3 steps inside ConnectStorageModal:

**Step 1 — Create Session:**
- Connection name input (required, max 255).
- "Next" sends `POST /connections/telegram/request-code` with `name` and `phone` empty (just creates the session on microservice).
- Actually, step 1 only collects the name. Step 2 collects phone + code.

**Step 2 — Phone + Code:**
- Phone number input.
- "Send Code" button calls backend → microservice `/request-code`.
- Backend returns success. Frontend shows code input (6 individual boxes for UX, single field underneath).
- "Verify" button calls backend → microservice `/login` with phone + code.
- If microservice returns `password_required: true`, transition to Step 2b.
- If success, transition to Step 3.

**Step 2b — Two-Factor Auth (conditional):**
- Only shown if Step 2 returns `password_required`.
- 2FA password input.
- "Verify" calls backend → microservice `/login` with phone + code + password.
- If success, transition to Step 3.

**Step 3 — Done:**
- Success state with checkmark.
- Shows number of files synced.
- "Done" button closes modal and refreshes dashboard.

## Backend Design

### Route

```php
Route::post('/connections/telegram', [TelegramConnectionController::class, 'store'])
    ->name('connections.telegram.store');
```

### TelegramConnectionController

Create `App\Http\Controllers\TelegramConnectionController`.

Two methods:

**`requestCode(Request $request)`:**

1. Validate: `name` required string max 255, `phone` required string.
2. Build TelegramClient from config.
3. Generate a random `session_id` (e.g. `Str::random(16)`).
4. Call microservice `/request-code` with the phone.
5. Store `session_id`, `phone`, `phone_code_hash` in session (`session()->put('telegram_connect', [...])`).
6. Return JSON `{success: true, phone_code_hash: ...}`.

**`store(Request $request)`:**

1. Validate: `code` required string, `password` nullable string.
2. Retrieve `session_id`, `phone`, `phone_code_hash` from session.
3. Build TelegramClient from config + session_id.
4. Call microservice `/login` with phone, code, phone_code_hash, password.
5. If response has `password_required: true`, return JSON `{password_required: true}`.
6. If response has `success: true`:
   - Create `CloudConnection`:
     - `provider = CloudProvider::TELEGRAM()`
     - `provider_id = session_id`
     - `name` from session
     - `credentials = ['session_id' => session_id]`
     - `status = ConnectionStatus::CONNECTED()`
   - Clear session data.
   - Return JSON `{success: true, synced: <number>}`.
7. If login failed, return JSON `{success: false, message: ...}`.

### TelegramClient integration

The controller uses `TelegramClient` directly (already implemented in `app/Services/Telegram/TelegramClient.php`). No new client code needed.

### Session storage

Store temporary auth state in Laravel session:

```php
session()->put('telegram_connect', [
    'session_id' => $sessionId,
    'name' => $name,
    'phone' => $phone,
    'phone_code_hash' => $phoneCodeHash,
]);
```

Clear on success or when user cancels.

### Validation

Create `App\Http\Requests\RequestTelegramCodeRequest`:
- `name`: required, string, max 255
- `phone`: required, string, max 20

Create `App\Http\Requests\VerifyTelegramCodeRequest`:
- `code`: required, string, max 10
- `password`: nullable, string, max 256

## Frontend Design

### TypeScript types

Add to `resources/js/types/cloud.ts`:

```typescript
export interface TelegramConnectionConfig {
    session_id?: string;
}
```

Update `CloudConnection`:

```typescript
export interface CloudConnection {
    // ... existing fields ...
    telegram_config?: TelegramConnectionConfig;
}
```

### ConnectStorageModal changes

Add Telegram case to the modal, following FTP/SFTP pattern:

```tsx
const isTelegramSelected = selectedCredentialsProvider?.key === 'telegram';
const isCredentialsSelected = isFtpSelected || isSftpSelected || isTelegramSelected;
```

Add title:

```tsx
{isTelegramSelected && 'Connect Telegram'}
```

Add subtitle:

```tsx
isTelegramSelected ? 'Connect your Telegram account to store files in Saved Messages' : ...
```

Add form render:

```tsx
{isTelegramSelected && (
    <TelegramConnectionForm
        onCancel={() => setSelectedCredentialsProvider(null)}
        onSuccess={onClose}
    />
)}
```

Import:

```tsx
import TelegramConnectionForm from '@/components/cloud/TelegramConnectionForm';
```

### ProviderOption changes

Add 'telegram' to supported credentials providers:

```tsx
const isSupportedCredentialsProvider =
    provider.authType === 'credentials' && (provider.key === 'ftp' || provider.key === 'sftp' || provider.key === 'telegram');
```

### HomeController changes

In `availableProviders()`, ensure TELEGRAM gets `authType: 'credentials'`:

The existing code checks `CloudProvider::FTP` and `CloudProvider::SFTP`. Add TELEGRAM:

```php
$authType = $provider->is(CloudProvider::FTP) || $provider->is(CloudProvider::SFTP) || $provider->is(CloudProvider::TELEGRAM) ? 'credentials' : 'oauth';
```

### TelegramConnectionForm component

Create `resources/js/components/cloud/TelegramConnectionForm.tsx`.

**Props:**

```tsx
interface TelegramConnectionFormProps {
    onCancel: () => void;
    onSuccess: () => void;
}
```

**State:**

```tsx
const [step, setStep] = useState<'phone' | 'code' | 'password' | 'done'>('phone');
const [name, setName] = useState('My Telegram');
const [phone, setPhone] = useState('');
const [code, setCode] = useState('');
const [password, setPassword] = useState('');
const [phoneCodeHash, setPhoneCodeHash] = useState('');
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(false);
const [syncedCount, setSyncedCount] = useState(0);
```

**Step indicator:** 3 dots or bars at top, colored based on current step. Step 2b (password) changes the second bar to amber.

**Step 'phone':**
- Connection name input.
- Phone number input with placeholder "+84 912 345 678".
- "Send Code" button.
- On click: `router.post('/connections/telegram/request-code', { name, phone })`.
- On success: store `phone_code_hash`, switch to `step: 'code'`.
- On error: show error message.

**Step 'code':**
- Blue info box: "Code sent to your Telegram app."
- Phone number displayed as read-only.
- Code input (single text input, not 6 separate boxes — simpler implementation).
- "Verify" button.
- "← Back" button → back to 'phone'.
- On click: `router.post('/connections/telegram', { code })`.
- If response `password_required`: switch to `step: 'password'`.
- If response `success`: switch to `step: 'done'`.
- On error: show error message.

**Step 'password':**
- Amber warning box: "Two-factor authentication required."
- Password input (type="password").
- "Verify" button.
- "← Back" button → back to 'code'.
- On click: `router.post('/connections/telegram', { code, password })`.
- If success: switch to `step: 'done'`.
- On error: show error message.

**Step 'done':**
- Green checkmark icon.
- "Telegram Connected!" heading.
- "{N} files synced from Saved Messages."
- "Done" button → calls `onSuccess()`.

**Design tokens:**
- Telegram blue: `#26A5E4` (for icon/badge, not primary button).
- Primary button: `bg-blue-600` (matches existing app style).
- Use existing Tailwind classes from FtpConnectionForm: `rounded-xl`, `border-gray-200`, `text-sm`, etc.

### HTTP calls

Use `router.post()` from Inertia for all calls, matching FTP pattern:

```tsx
router.post('/connections/telegram/request-code', { name, phone }, {
    onSuccess: (page) => { ... },
    onError: (errors) => { ... },
});
```

The backend returns JSON responses (not Inertia redirects) because this is a multi-step flow within the modal. Use `fetch` or `axios` instead of `router.post()` for the intermediate steps, and only use `router.post()` or redirect for the final success.

Actually, looking at the FTP pattern more carefully: FTP uses `router.post()` which does a full Inertia request and expects a redirect on success. For Telegram's multi-step flow, we need JSON responses at each step. Use the built-in `fetch` API or `router.post()` with `{ preserveState: true }` and return JSON from the controller.

Recommended approach: use `fetch()` for requestCode and login steps (returns JSON), and `router.visit()` to refresh dashboard on final success.

## Data Flow

1. User opens Connect Storage modal → sees Telegram option.
2. User clicks Telegram → modal shows `TelegramConnectionForm` (Step 1: phone).
3. User enters name + phone, clicks "Send Code".
4. Frontend `POST /connections/telegram/request-code` → backend calls microservice `/request-code` → Telegram sends code.
5. Backend stores session_id + phone + phone_code_hash in Laravel session. Returns success.
6. Frontend switches to Step 2 (code). User enters code.
7. Frontend `POST /connections/telegram` → backend calls microservice `/login`.
8. If 2FA needed: backend returns `{password_required: true}`. Frontend switches to Step 2b.
9. If success: backend creates `CloudConnection`, returns `{success: true, synced: N}`.
10. Frontend shows Step 3 (done). User clicks "Done" → modal closes, dashboard refreshes.

## Error Handling

- Microservice unreachable → "Cannot connect to Telegram service. Please try again later."
- Invalid phone number → "Please enter a valid phone number with country code."
- Invalid code → "Invalid verification code. Please check and try again."
- 2FA wrong password → "Incorrect two-factor password."
- Session expired → "Session expired. Please start over." (reset to Step 1)
- All errors shown as red text below the form fields.

## Testing

Backend tests:

- `POST /connections/telegram/request-code` validates name and phone.
- `POST /connections/telegram/request-code` calls microservice and stores session data.
- `POST /connections/telegram` validates code.
- `POST /connections/telegram` handles password_required response.
- `POST /connections/telegram` creates CloudConnection on success.
- `POST /connections/telegram` returns synced count.
- Unauthenticated users get redirected to login.

Frontend checks:

- TypeScript type check for TelegramConnectionConfig.
- ProviderOption shows Telegram as active credentials provider.
- ConnectStorageModal renders TelegramConnectionForm when Telegram is selected.
- Wizard transitions between steps correctly.

## Decisions

- Inline wizard inside ConnectStorageModal (not a separate page).
- Use `fetch()` for multi-step API calls (not Inertia router.post).
- Store auth state in Laravel session (not in frontend state across page loads).
- Code input is a single text field (not 6 individual boxes).
- session_id is auto-generated by backend (not entered by user).
- Step 2b (2FA) only shown when needed.

## Self-Review

- Placeholder scan: no TBD/TODO remain.
- Consistency: follows FTP/SFTP credential form pattern.
- Scope: focused on connect flow only; edit dialog is out of scope.
- Ambiguity: session storage, HTTP call method, error messages, and wizard transitions are explicitly defined.

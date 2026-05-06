# Notification Outbox Worker

هذا القالب يشرح طريقة معالجة `notification_outbox` من خدمة خارجية مثل Cloudflare Worker أو Vercel Function.

## Environment Variables

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `SMS_API_URL`
- `SMS_API_KEY`

## Worker Flow

1. يعمل Cron كل 5 دقائق.
2. يقرأ أول 25 مستنداً من `notification_outbox` حيث `status == pending`.
3. يرسل حسب `type`: `telegram`, `sms`, أو `push`.
4. يحدث المستند إلى `sent` أو `failed`.

```js
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processOutbox(env));
  }
};

async function processOutbox(env) {
  const token = await getFirebaseAccessToken(env);
  const base = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;

  const query = {
    structuredQuery: {
      from: [{ collectionId: 'notification_outbox' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'status' },
          op: 'EQUAL',
          value: { stringValue: 'pending' }
        }
      },
      limit: 25
    }
  };

  const res = await fetch(`${base}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(query)
  });
  const rows = await res.json();

  for (const row of rows) {
    if (!row.document) continue;
    const doc = fromFirestore(row.document);
    try {
      if (doc.type === 'telegram') await sendTelegram(env, doc.contact_info, doc.body);
      if (doc.type === 'sms') await sendSms(env, doc.contact_info, doc.body);
      await patchStatus(token, row.document.name, 'sent', '');
    } catch (error) {
      await patchStatus(token, row.document.name, 'failed', error.message || 'Unknown error');
    }
  }
}

async function sendTelegram(env, chatId, body) {
  if (!chatId) throw new Error('Missing Telegram chat id');
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: body })
  });
  if (!res.ok) throw new Error(`Telegram failed: ${await res.text()}`);
}

async function sendSms(env, phone, body) {
  if (!phone) throw new Error('Missing phone number');
  const res = await fetch(env.SMS_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SMS_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: phone, message: body })
  });
  if (!res.ok) throw new Error(`SMS failed: ${await res.text()}`);
}

async function patchStatus(token, name, status, errorMessage) {
  await fetch(`https://firestore.googleapis.com/v1/${name}?updateMask.fieldPaths=status&updateMask.fieldPaths=error_message&updateMask.fieldPaths=sent_at`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        status: { stringValue: status },
        error_message: { stringValue: errorMessage },
        sent_at: { timestampValue: new Date().toISOString() }
      }
    })
  });
}

function fromFirestore(document) {
  const out = {};
  for (const [key, value] of Object.entries(document.fields || {})) {
    out[key] = value.stringValue ?? value.integerValue ?? value.doubleValue ?? value.booleanValue ?? value.timestampValue ?? '';
  }
  return out;
}
```

> دالة `getFirebaseAccessToken` تعتمد على طريقة التوقيع JWT لحساب الخدمة. يفضل وضعها في Worker فقط، وليس داخل تطبيق الويب.

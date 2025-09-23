![CI: passing](https://github.com/cbyme-history/cbyme_history/actions/workflows/ci.yml/badge.svg?branch=main)

# cbyme_history

## 手動検証手順

本番・プレビューともに HMAC 署名付きのリクエストのみ受け付けます。以下の手順を参考に接続確認・動作確認を実施してください。

### 本番環境

1. LINE Developers コンソールの「接続確認」を実行し、`200 OK` が返ることを確認（スクリーンショット取得推奨）。
2. 実機の LINE アプリから任意のテキストメッセージを送信し、`[echo] <本文>` の返信が届くことを確認。
3. Supabase の `app_logs` テーブルで該当イベントが保存されていることを確認（イベント種別・ユーザー ID・ペイロード全体）。

### プレビュー環境

署名付きのダミー Webhook を送信し、`200 OK` が返ることを確認します。

```bash
BODY='{"events":[{"type":"message","replyToken":"dummy","message":{"type":"text","text":"preview ping"}}]}'
SIGNATURE=$(printf "%s" "$BODY" | openssl dgst -binary -sha256 -hmac "$LINE_CHANNEL_SECRET" | openssl base64 -A)
curl -i \
  -H "Content-Type: application/json" \
  -H "X-Line-Signature: $SIGNATURE" \
  -d "$BODY" \
  https://<preview-host>/api/line/webhook
```

レスポンスコード・リクエスト内容を記録し、必要に応じてスクリーンショットを保存してください。

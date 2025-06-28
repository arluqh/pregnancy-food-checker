# 妊娠中の食事チェッカー

妊娠中の食事の安全性をAI（Gemini Vision API）で確認するWebアプリケーションです。

## 機能

- 📷 **写真撮影機能**: スマホカメラで食事を撮影
- 📁 **ファイルアップロード**: 既存の画像をアップロード
- 🤖 **AI画像解析**: Gemini Vision APIによる食品分析
- ⚠️ **リスク判定**: 妊娠中に注意が必要な食品を検出
- 📱 **モバイル対応**: スマートフォンでの使用に最適化

## 技術スタック

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **AI API**: Google Gemini Vision API
- **UI Components**: Radix UI, Lucide React
- **Deploy**: Vercel

## セットアップ

1. **依存関係のインストール**
```bash
pnpm install
```

2. **環境変数の設定**
`.env.local`ファイルを作成し、以下を設定：
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

3. **開発サーバーの起動**
```bash
pnpm dev
```

4. **ブラウザでアクセス**
http://localhost:3000 を開く

## ビルド

```bash
pnpm build
pnpm start
```

## 注意事項

このアプリは妊娠中の食事選びの参考として作成されました。表示される情報はすべてのリスクを網羅・保証するものではありません。心配な場合や体調に不安があるときは、必ず医師や専門家にご相談ください。

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

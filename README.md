# まちまわりオンライン

Socket.IO + Node.js + Express で動く、友達とURLを共有して遊べるオンライン・ボードゲームです。

## ローカルで起動

Node.js 18+ を入れてから:

```bash
npm install
npm start
```

ブラウザで http://localhost:3000 を開きます。

## オンライン公開

このフォルダをGitHubに置き、Node.jsを実行できるホスティングへデプロイします。
Start Command は `npm start`、Build Command は `npm install` です。
公開後のURLにアクセスして「ルームを作る」を押し、表示された招待URLを友達へ送ります。

## 注意

現在はルーム情報をサーバーのメモリに保持しています。サーバーが再起動するとルームは消えます。

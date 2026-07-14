# Claude Code Beam

**Send Claude Code chat sessions between two PCs, instantly, over the internet, P2P, no IP address, no router port-forwarding.** Just a short code.

<p>
  <a href="#english">English</a> ·
  <a href="#русский">Русский</a> ·
  <a href="#中文">中文</a>
</p>

![platform](https://img.shields.io/badge/platform-Windows-2f8fff)
![license](https://img.shields.io/badge/license-MIT-2f8fff)
![electron](https://img.shields.io/badge/built%20with-Electron-2f8fff)

---

## English

**Claude Code Beam** is a small GUI (Electron) app that finds your local [Claude Code](https://claude.com/claude-code) sessions and sends selected chats straight to another PC, over the internet, using a short human-readable code, with no manual IP entry and no router or firewall configuration.

### Why

Claude Code stores every session as a `.jsonl` file under `~/.claude/projects/`. If you switch machines (laptop to desktop, home to work), there was no easy way to carry a chat with you. This app fixes that in a few clicks.

### Install

Download the latest installer from the [Releases](../../releases) page, or build it yourself:

```bash
npm install
npm start        # run in dev mode
npm run dist      # build a Windows installer
```

### How to use

1. Receiving PC: "Receive" tab, then "Show my code". A code like `K4T8-QM2X` appears.
2. Sending PC: "Send" tab, pick sessions, enter that code, then "Send selected".
3. Done. The session file lands in `~/.claude/projects/<project>/` on the other PC. If a same-named file already exists, it's kept as-is and the incoming one is saved with a `-received-<date>` suffix.
4. Works both ways, just swap who's receiving and who's sending.
5. You can also send the linked project folder along with the chat, and the receiving side gets to pick exactly where to save it.

### How it works

- Sessions are read directly from `~/.claude/projects/**/*.jsonl`, the same storage used by the CLI and any wrapper or plugin on top of it (including VS Code).
- Transfer happens directly between the two PCs over a WebRTC data channel (P2P, DTLS-SRTP encryption at the protocol level). The code on screen is a human-readable WebRTC peer id.
- For the initial handshake (signaling) and NAT traversal, it uses the free public [PeerJS](https://peerjs.com/) broker (`0.peerjs.com`), same idea as croc or magic-wormhole: the file itself never passes through a third-party server, it only helps the two PCs find each other and open a direct channel (with TURN relay as a fallback for strict NATs or firewalls).
- Both PCs don't need to be on the same Wi-Fi or LAN, it works over the regular internet, plug-and-play, no router setup.
- On the same LAN, devices that are currently receiving show up automatically in a nearby-devices list (UDP broadcast discovery), so you don't even need to type the code.
- The app updates itself: it checks GitHub Releases in the background and shows an in-app banner ("Update available, Update / Later") when a new version is out, no manual re-download.

### Limitations

- The code is valid only while the "Receive" tab is open on the first PC.
- Relies on the free public PeerJS broker, if it's temporarily overloaded, the connection may take a moment to establish.
- No byte-level progress bar, just a line-by-line event log.
- In very strict corporate networks (hard firewall, no TURN access), a direct connection may not go through.

---

## Русский

Claude Code Beam это GUI-приложение (Electron) для поиска локальных сессий [Claude Code](https://claude.com/claude-code) и прямой передачи выбранных чатов на другой ПК: через интернет, по короткому коду, без ввода IP и без проброса портов на роутере.

### Зачем

Claude Code хранит каждую сессию в виде `.jsonl`-файла в `~/.claude/projects/`. При смене машины (ноутбук / десктоп, дом / работа) забрать чат с собой было неудобно. Это приложение решает задачу в пару кликов.

### Установка

Скачай последний инсталлятор со страницы [Releases](../../releases), либо собери сам:

```bash
npm install
npm start        # запуск в режиме разработки
npm run dist      # сборка инсталлятора под Windows
```

### Как пользоваться

1. На принимающем ПК: вкладка «Принять», затем «Показать мой код». Появится код вида `K4T8-QM2X`.
2. На отправляющем ПК: вкладка «Отправить», выбрать сессии из списка, ввести этот код, затем «Отправить выбранные».
3. Готово: файл сессии появится в `~/.claude/projects/<project>/` на втором ПК. Если файл с таким же именем уже есть, он не перезаписывается, а сохраняется рядом с суффиксом `-received-<дата>`.
4. Работает в обе стороны, просто поменяйте местами, кто принимает, а кто отправляет.
5. Вместе с чатом можно передать и связанную папку проекта, принимающая сторона сама выбирает, куда её сохранить.

### Как это устроено

- Список сессий читается напрямую из `~/.claude/projects/**/*.jsonl`, это то же хранилище, которым пользуется CLI и любые обёртки или плагины над ним, включая VS Code.
- Передача идёт напрямую между двумя ПК по WebRTC data channel (P2P, шифрование DTLS-SRTP на уровне протокола). Код на экране это человекочитаемый идентификатор WebRTC-пира.
- Для первоначального «знакомства» двух ПК (сигналинг) и обхода NAT используется публичный бесплатный брокер [PeerJS](https://peerjs.com/) (`0.peerjs.com`), тот же принцип, что у croc или magic-wormhole: сам файл через сторонний сервер не проходит, он только помогает двум ПК договориться и открыть прямой канал (с TURN-релеем как запасным вариантом для строгих NAT или файрволов).
- Оба ПК не обязаны быть в одной Wi-Fi/LAN сети, работает через обычный интернет, plug-and-play, без настройки роутера.
- В одной локальной сети устройства, которые сейчас принимают, сами появляются в списке рядом (обнаружение через UDP-broadcast), код вводить даже не обязательно.
- Приложение само себя обновляет: в фоне проверяет GitHub Releases и показывает баннер («Доступно обновление, Обновить / Позже»), без ручного скачивания заново.

### Ограничения

- Код действует, пока открыта вкладка «Принять» на первом ПК.
- Полагается на публичный бесплатный брокер PeerJS, если он временно перегружен, соединение может установиться не сразу.
- Нет прогресс-бара по байтам, только построчный лог событий.
- В очень строгих корпоративных сетях (жёсткий файрвол без доступа к TURN) прямое соединение может не пробиться.

---

## 中文

**Claude Code Beam** 是一个小巧的 GUI 应用（基于 Electron），可以查找本机的 [Claude Code](https://claude.com/claude-code) 会话记录，并通过一个简短的代码把选中的对话直接发送到另一台电脑，通过互联网点对点传输，无需手动输入 IP，也无需在路由器上配置端口转发。

### 为什么需要它

Claude Code 会把每个会话保存为 `~/.claude/projects/` 目录下的 `.jsonl` 文件。当你更换设备（笔记本电脑或台式机，家里或公司）时，之前很难把对话带走。这个工具几步点击就能解决。

### 安装

从 [Releases](../../releases) 页面下载最新安装包，或者自己构建：

```bash
npm install
npm start        # 开发模式运行
npm run dist      # 构建 Windows 安装包
```

### 使用方法

1. 接收方电脑：打开「接收」标签页，点击「显示我的代码」，会出现类似 `K4T8-QM2X` 的代码。
2. 发送方电脑：打开「发送」标签页，勾选要发送的会话，输入接收方的代码，点击「发送所选」。
3. 完成后，会话文件会出现在第二台电脑的 `~/.claude/projects/<project>/` 目录下。如果同名文件已存在，不会被覆盖，而是以 `-received-<日期>` 后缀单独保存。
4. 双向都可以用，互换一下谁接收谁发送即可。
5. 也可以把对话关联的项目文件夹一起发送过去，接收方可以自己选择保存到哪个文件夹。

### 工作原理

- 会话列表直接从 `~/.claude/projects/**/*.jsonl` 读取，这与 CLI 本身以及任何基于它的插件或封装（包括 VS Code）使用的是同一个存储位置。
- 传输通过 WebRTC data channel 在两台电脑之间直接进行（点对点，协议层自带 DTLS-SRTP 加密）。屏幕上的代码本质上是一个人类可读的 WebRTC 对等端 ID。
- 两台电脑最初的握手（信令）与 NAT 穿透，使用免费的公共 [PeerJS](https://peerjs.com/) 中转服务器（`0.peerjs.com`），原理和 croc、magic-wormhole 类似：文件本身不会经过第三方服务器，它只帮助两台电脑互相找到对方并建立直连通道（对于非常严格的 NAT 或防火墙，会使用 TURN 中继作为后备方案）。
- 两台电脑不需要在同一个 Wi-Fi 或局域网内，通过普通互联网即可工作，即插即用，无需配置路由器。
- 在同一局域网内，正在接收状态的设备会自动出现在附近设备列表中（基于 UDP 广播发现），甚至不需要手动输入代码。
- 应用会自动更新：在后台检查 GitHub Releases，有新版本时会显示应用内横幅提示（有可用更新，更新 / 稍后），无需手动重新下载。

### 已知限制

- 代码仅在第一台电脑的「接收」标签页保持打开时有效。
- 依赖免费的公共 PeerJS 中转服务器，如果它临时过载，连接建立可能需要稍等片刻。
- 没有按字节的进度条，只有逐行事件日志。
- 在非常严格的企业网络中（防火墙禁止访问 TURN 中继），直连可能无法建立。

---

<p align="center">MIT License. Built with Electron and WebRTC (PeerJS).</p>

# T-072 real-flow UI evidence

The first capture attempt is retained under `*-invalid-server.png` because the 3036 dev server did not have the model environment loaded; its header showed `AI 暂不可用` and its preview probe was empty.

The accepted capture reran the real start once after restarting the 3036 server with the main-workspace env file. It used `commitOperations` to seed the simulated export draft before calling the real chat route. The accepted command, timestamp, code/server SHA, seed revision, and visible text are in `visible-text.md` and `workspace-screenshots.json`.

The accepted screenshots show:

- 1440 and 768: `AI 已连接`, company `外高桥流体接头P3E`, hero `不锈钢快换接头目录`, parameter strip, and the two product cards `快换接头` / `卡套接头`; the alignment options are enabled and only the submit button is disabled until a selection.
- 375: `AI 已连接`, the same company context, and a bottom drawer with `第 1 / 4 题`, selectable look cards, and an enabled `下一题` button. The preview is behind the conversation drawer by design; the same preview content is visible in the two desktop screenshots.

# 项目约束（Claude Code 自动加载）

- 纯前端 HTML/CSS/JS 游戏，单文件结构
- 使用 window.Zhan 命名空间
- data.js 禁止写 function（polyfill 除外）
- core.js 禁止碰 DOM
- ui.js 禁止直接修改 state
- 所有修改必须先备份到指定目录
- 只修改代码，不运行测试，不验证结果

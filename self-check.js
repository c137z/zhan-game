// self-check.js — 一键检查项目健康状态
// 用法: node self-check.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);
const ITEMS = [
    ['Bridge 存活', () => {
        try { require('child_process').execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV 2>nul'); return true; }
        catch { return false; }
    }, 'node.exe 进程存在'],
    ['code 文件完整', () => {
        return ['data.js','core.js','ui.js','index.html'].every(f => fs.existsSync(path.join(ROOT,'code',f)));
    }, '4 files'],
    ['Session ID', () => {
        const has = fs.existsSync(path.join(ROOT,'msp','.cc-session-id'));
        return { pass: true, skip: !has, detail: has ? '已创建' : '首次task后创建' };
    }],
    ['Inbox 无积压', () => {
        const files = fs.readdirSync(path.join(ROOT,'msp','inbox')).filter(f => f.endsWith('.json'));
        return files.length === 0;
    }, '无积压'],
    ['设计手册 AI 警告', () => {
        const overview = fs.readFileSync(path.join(ROOT,'docs','design','overview.md'), 'utf-8');
        return overview.includes('AI 助手在生成 task 时应以 code/ 下的实际代码为准');
    }, '已加警告注释'],
];

console.log('⚔️ 斩项目健康检查');
console.log('─'.repeat(40));

let ok = 0, warn = 0, fail = 0;
for (const [name, check, detail] of ITEMS) {
    let result;
    try { result = check(); } catch (e) { result = false; }
    if (result && result.pass !== undefined) {
        if (result.skip) { console.log(`⚠️  ${name} (${result.detail})`); warn++; }
        else { console.log(`✅ ${name} (${detail})`); ok++; }
    } else if (result) {
        console.log(`✅ ${name} (${detail})`); ok++;
    } else {
        console.log(`❌ ${name} (FAIL)`); fail++;
    }
}

console.log('─'.repeat(40));
console.log(`结果: ${ok} PASS, ${warn} WARN, ${fail} FAIL`);
if (fail > 0) { console.log('⚠️  发现问题，请手动检查。'); process.exit(1); }
else { console.log('全部正常。'); }

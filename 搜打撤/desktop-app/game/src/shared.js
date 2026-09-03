/* ============================================================
 * shared.js —— 全局共享垫片（最先加载）
 *
 * game.* / battle.* 系列拆分文件共享同一顶层词法作用域（普通 script
 * 按序加载，顶层 const/let 跨文件可见）。这些名字原本在各文件里重复
 * 声明会触发 "Identifier has already been declared"，因此统一在此声明
 * 一次，后续文件直接使用、不得再声明同名变量。
 * ============================================================ */
const SDT = window.SDT;
const UI = SDT.UI;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

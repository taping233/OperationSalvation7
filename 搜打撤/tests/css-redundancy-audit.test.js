// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { auditCss } from '../scripts/css-redundancy-audit.mjs';

describe('CSS 冗余只读候选扫描', () => {
  it('定位同选择器/属性/优先级的旧声明并保留原始字节位置', () => {
    const source = '.x { color: red; width: 5px }\n.x { color: blue }';
    const result = auditCss(source);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ property: 'color', value: 'red', survivor: { line: 2, value: 'blue' } });
    expect(source.slice(result[0].start, result[0].end)).toBe('color: red;');
  });
  it('不同条件、选择器和important优先级不合并', () => {
    expect(auditCss('.x { color:red!important } @media (min-width:1px) { .x { color:blue } } .x:hover {color:blue} .x {color:green}')).toEqual([]);
  });
  it('跨文件仅共享显式传入的加载链；默认单文件相互独立', () => {
    const later = new Map(); auditCss('.x{color:blue}', 'later.css', later);
    expect(auditCss('.x{color:red}', 'first.css', later)[0].survivor.file).toBe('later.css');
    expect(auditCss('.x{color:red}', 'alone.css')).toEqual([]);
  });
});

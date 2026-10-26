// @vitest-environment node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { createFixtureCopies } from './helpers/fixture-copies.js';

const factories = [];
afterEach(() => {
  for (const factory of factories.splice(0)) factory.dispose();
});

it('只准备一次，工作文件、Git index与对象都在各用例内独立', () => {
  const initialize = vi.fn(root => {
    mkdirSync(path.join(root, '.git/objects'), { recursive: true });
    writeFileSync(path.join(root, '.git/index'), 'staged index');
    writeFileSync(path.join(root, '.git/objects/base'), 'object bytes');
    writeFileSync(path.join(root, 'value'), 'base');
  });
  const factory = createFixtureCopies('sdt-fixture-copy-contract-', initialize); factories.push(factory);
  const first = factory.create(), second = factory.create();
  expect(initialize).toHaveBeenCalledTimes(1);
  expect(first).not.toBe(second);
  for (const file of ['value', '.git/index', '.git/objects/base']) {
    writeFileSync(path.join(first, file), 'mutated');
    expect(readFileSync(path.join(second, file), 'utf8')).not.toBe('mutated');
  }
  const third = factory.create();
  expect(readFileSync(path.join(third, '.git/index'), 'utf8')).toBe('staged index');
  expect(readFileSync(path.join(third, '.git/objects/base'), 'utf8')).toBe('object bytes');
});

it('集中清理基线、独立副本与权限探针，重复释放安全', () => {
  let seed;
  const factory = createFixtureCopies('sdt-fixture-copy-cleanup-', root => {
    seed = root;
    writeFileSync(path.join(root, 'value'), 'base');
  });
  factories.push(factory);
  const probe = factory.createEmpty(), first = factory.create(), second = factory.create();
  expect([seed, probe, first, second].every(directory => existsSync(directory))).toBe(true);
  factory.dispose();
  expect([seed, probe, first, second].some(directory => existsSync(directory))).toBe(false);
  expect(() => factory.dispose()).not.toThrow();
});

it('初始化失败后拒绝复制半成品', () => {
  const factory = createFixtureCopies('sdt-fixture-copy-failure-', () => { throw new Error('prepare failed'); });
  factories.push(factory);
  expect(() => factory.create()).toThrow('prepare failed');
  expect(() => factory.create()).toThrow('拒绝复制半成品');
});

it('拒绝能逃离临时目录的前缀', () => {
  expect(() => createFixtureCopies('../outside-', () => {})).toThrow('无效');
});

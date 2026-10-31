import re, collections, sys
byfile = collections.defaultdict(list)
for line in open(sys.argv[1], encoding='utf-8', errors='replace'):
    line = line.strip()
    if 'error CS' not in line: continue
    f = re.sub(r'.*[\/]', '', line.split('(',1)[0])
    m = re.search(r'\((\d+),(\d+)\): (error [^:]+): (.*)', line)
    byfile[f].append(f"L{m.group(1)},{m.group(2)} {m.group(3)}" if m else line)
seen_total = 0
for f in sorted(byfile):
    uniq = sorted(set(byfile[f]))
    seen_total += len(uniq)
    print(f'== {f} ({len(uniq)})')
    for e in uniq: print('   ', e)
print('TOTAL unique:', seen_total)

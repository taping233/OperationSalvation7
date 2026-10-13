from pathlib import Path

root = Path(r'D:\素材\代号柒\搜打撤')

def edit(file, changes):
    path = root / file
    with path.open('r', encoding='utf-8', newline='') as stream:
        original = stream.read()
    result = original
    for before, after in changes:
        count = result.count(before)
        if count != 1:
            raise RuntimeError(f'{file}: expected one match, found {count}: {before[:80]}')
        result = result.replace(before, after)
    with path.open('w', encoding='utf-8', newline='') as stream:
        stream.write(result)

edit('game/src/hub/hub.personnel.js', [
    ('<h2>人物与伙伴</h2>', '<h2>队员</h2>'),
    ('data-tab="stash" data-view="cards">前往仓库归档培养</button>', 'data-tab="stash" data-view="cards" data-character="${browse.poolCharacter}">培养${esc(characterName(browse.poolCharacter))} →</button>'),
    ('<button class="mini-btn" data-act="personSection" data-section="pool">查看招式与归档状态</button>', '<div class="person-growth-actions"><button class="mini-btn ok" data-act="hubTab" data-tab="stash" data-view="cards" data-character="${character.id}">归档培养${esc(character.name)} →</button><button class="mini-btn" data-act="personSection" data-section="pool">查看专属招式</button><button class="mini-btn" data-act="hubTab" data-tab="ach" data-view="classes">查看全员归档进度</button></div>'),
    ("'衣着档案' : '人物档案'", "'衣着档案' : '人物培养'"),
])

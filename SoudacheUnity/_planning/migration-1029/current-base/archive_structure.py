from pathlib import Path
p=Path('SoudacheUnity/Assets/Scripts/Sdt.UI/Screens/Hub/HubModernPages.cs');s=p.read_text(encoding='utf-8-sig')
for name in ['BuildRewards','BuildMilestones','BuildAch','BuildBacks']:
    start=s.index('        void '+name+'(')
    opening=s.index('{',start);depth=1;end=opening+1
    while depth:
        if s[end]=='{':depth+=1
        elif s[end]=='}':depth-=1
        end+=1
    s=s[:start]+s[end:]
p.write_text(s,encoding='utf-8')

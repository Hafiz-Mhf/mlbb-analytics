import re, json, collections, statistics
SP = r"C:/Users/LENOVO/AppData/Local/Temp/claude/d--mlbb-analytics/9206d17d-7bef-49c0-aae4-40897b2a930d/scratchpad"
ALIAS = {"arlot":"arlott","bene":"benedetta","esme":"esmeralda","fred":"fredrinn","gatot":"gatotkaca",
         "guin":"guinevere","lance":"lancelot","lapu":"lapu-lapu","leo":"leomord","luoyi":"luo yi",
         "phove":"phoveus","valen":"valentina","yss":"yi sun-shin","yz":"yu zhong"}
norm = lambda h: ALIAS.get(h.strip().lower(), h.strip().lower())
def tnorm(s):
    s = " ".join(s.split()).lower()
    return s

texts = [open(f"{SP}/rs17.wiki",encoding="utf-8").read()]
po = json.load(open(f"{SP}/po17.json",encoding="utf-8"))
texts.append(list(po["query"]["pages"].values())[0]["revisions"][0]["slots"]["main"]["*"])

# league-wide modal slot per hero
pick = collections.defaultdict(lambda:[0]*5)
rows = []   # (team, hero, slot)
for t in texts:
    # split into Match blocks to attach team names
    for mb in re.split(r"\n\s*\|M\d+=", t):
        opps = re.findall(r"\{\{TeamOpponent\|([^}|\n]+)", mb)
        if len(opps) < 2: continue
        t1, t2 = tnorm(opps[0]), tnorm(opps[1])
        for m in re.findall(r"\{\{Map\b(.*?)\n\s*\}\}", mb, re.S):
            if "finished=skip" in m: continue
            for tm, team in ((1,t1),(2,t2)):
                for i in range(1,6):
                    p = re.search(rf"\|\s*t{tm}h{i}\s*=\s*([^\n|]*)", m)
                    if p and p.group(1).strip():
                        h = norm(p.group(1)); pick[h][i-1]+=1; rows.append((team,h,i))

modal = {h: s.index(max(s))+1 for h,s in pick.items()}
off_by_team = collections.Counter(); tot_by_team = collections.Counter()
off_by_hero = collections.Counter()
for team,h,slot in rows:
    tot_by_team[team]+=1
    if slot != modal[h]:
        off_by_team[team]+=1; off_by_hero[h]+=1

print("deviation from hero's modal slot, per team:")
for team,tot in sorted(tot_by_team.items(), key=lambda x:-x[1]):
    if tot < 50: continue
    print(f"  {team:<24} {off_by_team[team]:>4}/{tot:<5} {off_by_team[team]/tot:6.1%}")
print(f"\nleague deviation: {sum(off_by_team.values())}/{len(rows)} = {sum(off_by_team.values())/len(rows):.1%}")
print(f"\ndeviations concentrated in {len(off_by_hero)} heroes; top 8:")
for h,c in off_by_hero.most_common(8):
    print(f"  {h:<14} {c:>3} off-modal   dist={pick[h]}")

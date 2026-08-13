import re, json, collections, statistics

SP = r"C:/Users/LENOVO/AppData/Local/Temp/claude/d--mlbb-analytics/9206d17d-7bef-49c0-aae4-40897b2a930d/scratchpad"

ALIAS = {"arlot":"arlott","bene":"benedetta","esme":"esmeralda","fred":"fredrinn",
         "gatot":"gatotkaca","guin":"guinevere","lance":"lancelot","lapu":"lapu-lapu",
         "leo":"leomord","luoyi":"luo yi","phove":"phoveus","valen":"valentina",
         "yss":"yi sun-shin","yz":"yu zhong"}
norm = lambda h: ALIAS.get(h.strip().lower(), h.strip().lower())

texts = [open(f"{SP}/rs17.wiki", encoding="utf-8").read()]
po = json.load(open(f"{SP}/po17.json", encoding="utf-8"))
texts.append(list(po["query"]["pages"].values())[0]["revisions"][0]["slots"]["main"]["*"])

pick = collections.defaultdict(lambda: [0]*5)   # hero -> count per slot
ban  = collections.defaultdict(lambda: [0]*5)
games = 0
for t in texts:
    for m in re.findall(r"\{\{Map\b(.*?)\n\s*\}\}", t, re.S):
        if "finished=skip" in m: continue
        games += 1
        for tm in (1,2):
            for i in range(1,6):
                p = re.search(rf"\|\s*t{tm}h{i}\s*=\s*([^\n|]*)", m)
                b = re.search(rf"\|\s*t{tm}b{i}\s*=\s*([^\n|]*)", m)
                if p and p.group(1).strip(): pick[norm(p.group(1))][i-1] += 1
                if b and b.group(1).strip(): ban[norm(b.group(1))][i-1] += 1

def concentration(d, min_n=10):
    """For each hero with >=min_n appearances, what share land in its most common slot?"""
    out = []
    for h, slots in d.items():
        n = sum(slots)
        if n >= min_n:
            out.append((h, n, max(slots)/n, slots))
    return sorted(out, key=lambda x: -x[2])

print(f"games parsed: {games}\n")
for label, d in (("PICKS", pick), ("BANS (control)", ban)):
    c = concentration(d)
    shares = [x[2] for x in c]
    print(f"=== {label} — {len(c)} heroes with >=10 appearances")
    print(f"    mean modal-slot share : {statistics.mean(shares):.1%}")
    print(f"    median                : {statistics.median(shares):.1%}")
    print(f"    heroes >90% one slot  : {sum(s>0.9 for s in shares)}/{len(c)}")
    print(f"    heroes <40% one slot  : {sum(s<0.4 for s in shares)}/{len(c)}")
    print(f"    (random baseline would be ~20-30%)")
    print()

print("=== most slot-locked picks")
for h,n,s,slots in concentration(pick)[:12]:
    print(f"  {h:<14} n={n:<4} {s:6.1%} in slot {slots.index(max(slots))+1}   {slots}")
print("\n=== least slot-locked picks (flex heroes)")
for h,n,s,slots in concentration(pick)[-10:]:
    print(f"  {h:<14} n={n:<4} {s:6.1%} in slot {slots.index(max(slots))+1}   {slots}")

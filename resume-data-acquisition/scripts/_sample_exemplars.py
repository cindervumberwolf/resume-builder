import json, os, sys
if sys.platform == "win32":
    os.system("chcp 65001 >nul 2>&1")
    sys.stdout.reconfigure(encoding="utf-8")

with open("data/exemplars/all_exemplars.jsonl", "r", encoding="utf-8") as f:
    lines = f.readlines()

print(f"Total: {len(lines)} bullets\n")

for i in [0, 10, 50, 100, 200, 300, 400, 488]:
    if i < len(lines):
        ex = json.loads(lines[i])
        tags = ", ".join(ex["latent_tags"][:4])
        q = "Q" if ex["style_features"]["quantified"] else " "
        a = "A" if ex["style_features"]["opens_with_action_verb"] else " "
        track = ex["track"]
        section = ex["section"]
        bullet = ex["bullet_text"][:95]
        print(f"[{i:3d}] [{a}{q}] {track:12s} | {section:12s} | {bullet}")
        print(f"      tags: [{tags}]")
        print()

#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""Scores an IPRPS model against iprps_testset.jsonl.

Works with any OpenAI-compatible server: llama.cpp's llama-server, LM Studio, Ollama, vLLM.

  1. Start the model, for example:
       llama-server -m Llama-3.1-Nemotron-Nano-4B-v1.1.Q4_K_M.gguf --port 8080 -c 8192
  2. Run:
       python score_model.py --url http://127.0.0.1:8080/v1 --label v2
  3. Compare two runs:
       python score_model.py --compare results_v1.json results_v2.json

Writes results_<label>.json (every answer and check) and results_<label>.md (readable report).
Only the Python standard library is needed.
"""
import argparse, collections, json, re, sys, time, urllib.request, os

SYSTEM = ("You are the AI Session Master and rules assistant for the Infinite Plane Role Playing System (IPRPS) "
          "by Mythical Legends Publishing, LLC. You apply the official IPRPS AI profiles, profile patches, "
          "campaign patches and rules accurately, completely and in their intended tone.")

def norm(t):
    t = t.replace("−", "-").replace("–", "-").replace("—", "-")
    return re.sub(r"(?<=\d),(?=\d{3})", "", t)   # 700,000 -> 700000

def has_term(text, term):
    low = norm(text).lower()
    for alt in term.split("|"):
        a = norm(alt).lower().strip()
        if re.fullmatch(r"\d*d\d+", a):                    # dice: "d20" also matches "1d20"
            if re.search(rf"(?<![a-z0-9])\d*{re.escape(a.lstrip('0123456789'))}(?!\d)", low) if a[0] == "d" else re.search(rf"(?<![a-z0-9]){re.escape(a)}(?!\d)", low): return True
        elif re.fullmatch(r"[a-z0-9]{1,3}", a):              # short codes like AR, DC, d6 need word boundaries
            if re.search(rf"(?<![a-z0-9]){re.escape(a)}(?![a-z0-9])", low): return True
        elif a in low: return True
    return False

WORDS = {"1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten", "12": "twelve"}

def has_number(text, n):
    t = norm(text)
    for alt in str(n).split("|"):
        if alt.strip() in WORDS and re.search(rf"\b{WORDS[alt.strip()]}\b", t.lower()): return True
    for alt in str(n).split("|"):
        a = norm(alt).strip()
        if re.search(rf"(?<![\d.]){re.escape(a)}(?![\d]|\.\d)", t): return True
    return False

def score(answer, check):
    items = [("term", x, has_term(answer, x)) for x in check.get("all", [])]
    items += [("number", x, has_number(answer, x)) for x in check.get("numbers", [])]
    banned = [x for x in check.get("none", []) if has_term(answer, x)]
    got = sum(ok for _, _, ok in items)
    frac = got / len(items) if items else 1.0
    passed = got == len(items) and not banned
    missing = [x for _, x, ok in items if not ok]
    return passed, frac, missing, banned

def ask(url, model, question, max_tokens, temperature, timeout):
    body = {"messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": question}],
            "max_tokens": max_tokens, "temperature": temperature, "stream": False}
    if model: body["model"] = model
    req = urllib.request.Request(url.rstrip("/") + "/chat/completions", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "Authorization": "Bearer none"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        j = json.load(r)
    return j["choices"][0]["message"]["content"] or ""

def run(args):
    tests = [json.loads(l) for l in open(args.testset, encoding="utf8") if l.strip()]
    if args.category: tests = [t for t in tests if t["category"] in args.category.split(",")]
    if args.limit: tests = tests[:args.limit]
    results, t0 = [], time.time()
    for i, t in enumerate(tests, 1):
        try: ans = ask(args.url, args.model, t["question"], args.max_tokens, args.temperature, args.timeout)
        except Exception as e:
            print(f"\nCould not reach the model at {args.url}: {e}", file=sys.stderr); sys.exit(1)
        passed, frac, missing, banned = score(ans, t["check"])
        results.append({**t, "answer": ans, "passed": passed, "partial": round(frac, 3), "missing": missing, "banned_found": banned})
        print(f"[{i:3d}/{len(tests)}] {'PASS' if passed else 'fail'}  {t['id']}  {t['question'][:70]}")
    by = collections.defaultdict(list)
    for r in results: by[r["category"]].append(r)
    summary = {c: {"passed": sum(r["passed"] for r in rs), "total": len(rs), "partial": round(sum(r["partial"] for r in rs) / len(rs), 3)} for c, rs in by.items()}
    total = {"passed": sum(r["passed"] for r in results), "total": len(results), "partial": round(sum(r["partial"] for r in results) / max(1, len(results)), 3)}
    out = {"label": args.label, "url": args.url, "date": time.strftime("%Y-%m-%d %H:%M"), "seconds": round(time.time() - t0),
           "total": total, "by_category": summary, "results": results}
    json.dump(out, open(f"results_{args.label}.json", "w", encoding="utf8"), ensure_ascii=False, indent=1)
    md = [f"# IPRPS model test — {args.label}", "", f"{out['date']} · {args.url}", "",
          f"**Score: {total['passed']}/{total['total']} passed ({100 * total['passed'] / max(1, total['total']):.0f}%) · partial credit {100 * total['partial']:.0f}%**", "",
          "| Category | Passed | Partial credit |", "|---|---|---|"]
    md += [f"| {c} | {s['passed']}/{s['total']} | {100 * s['partial']:.0f}% |" for c, s in sorted(summary.items())]
    md += ["", "## Failed questions", ""]
    for r in results:
        if r["passed"]: continue
        md += [f"### {r['id']} · {r['category']}", f"**Q:** {r['question']}", f"**Expected:** {r['reference']}",
               f"**Missing:** {', '.join(map(str, r['missing'])) or '—'}" + (f" · **Should not say:** {', '.join(r['banned_found'])}" if r["banned_found"] else ""),
               "", "**Model answered:**", "", "> " + r["answer"].strip().replace("\n", "\n> ")[:1500], ""]
    open(f"results_{args.label}.md", "w", encoding="utf8").write("\n".join(md))
    print(f"\nScore: {total['passed']}/{total['total']} passed, partial credit {100 * total['partial']:.0f}%")
    for c, s in sorted(summary.items()): print(f"  {c:20s} {s['passed']:3d}/{s['total']:<3d}  ({100 * s['partial']:.0f}% partial)")
    print(f"\nWrote results_{args.label}.json and results_{args.label}.md")

def compare(a_path, b_path):
    a, b = json.load(open(a_path, encoding="utf8")), json.load(open(b_path, encoding="utf8"))
    print(f"{'Category':20s} {a['label']:>12s} {b['label']:>12s}")
    for c in sorted(set(a["by_category"]) | set(b["by_category"])):
        sa, sb = a["by_category"].get(c), b["by_category"].get(c)
        fa = f"{sa['passed']}/{sa['total']}" if sa else "—"; fb = f"{sb['passed']}/{sb['total']}" if sb else "—"
        print(f"{c:20s} {fa:>12s} {fb:>12s}")
    print(f"{'TOTAL':20s} {a['total']['passed']:>9d}/{a['total']['total']:<2d} {b['total']['passed']:>9d}/{b['total']['total']:<2d}")
    ra = {r["id"]: r["passed"] for r in a["results"]}; rb = {r["id"]: r["passed"] for r in b["results"]}
    fixed = [i for i in rb if rb[i] and ra.get(i) is False]; broke = [i for i in rb if not rb[i] and ra.get(i)]
    print(f"\nNow passing: {', '.join(fixed) or 'none'}\nNow failing: {', '.join(broke) or 'none'}")

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--url", default="http://127.0.0.1:8080/v1", help="OpenAI-compatible base URL")
    p.add_argument("--model", default="", help="model name, if the server needs one (LM Studio, Ollama)")
    p.add_argument("--label", default=time.strftime("%Y%m%d-%H%M"), help="name for this run, e.g. v2")
    p.add_argument("--testset", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "iprps_testset.jsonl"))
    p.add_argument("--category", default="", help="only these categories, comma-separated")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--max-tokens", type=int, default=600)
    p.add_argument("--temperature", type=float, default=0.0)
    p.add_argument("--timeout", type=int, default=600)
    p.add_argument("--compare", nargs=2, metavar=("OLD.json", "NEW.json"))
    a = p.parse_args()
    compare(*a.compare) if a.compare else run(a)

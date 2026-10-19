import argparse
import json,sys,re
# Same keyword rule for both tickets: gap 1 = fixed field groups / manual-style copy; gap 4 = amplified boundary statements.
# Attribution uses only generated samples in the mixed pool (one reason per site).
G1=r'字段|同构|固定结构|相同顺序|同一组|统一编排|逐项|逐条|说明书|说明页|说明文档|资料表|资料编排|规则清单|规则文档|按资料|资料.{0,4}(转|整理|展开|结构)'
G4=r'边界|不承接|不包含|不保证|不承诺|不做|不能|排除|限制|限定'
def run(label,pairs):
    n=g1=g4=0; rows=[]
    for priv,res in pairs:
        m=json.load(open(priv+'/mapping.json'))
        for s in json.load(open(res))['samples']:
            if m[s['id']]['kind']!='generated': continue
            t=s['reason']; a=bool(re.search(G1,t)); b=bool(re.search(G4,t)); n+=1; g1+=a; g4+=b
            rows.append((m[s['id']]['key'],a,b))
    print(f"{label}: 生成页 {n} 站；缺口1 {g1} 站；缺口4 {g4} 站")
    for k,a,b in rows: print(f"   {k:28s} 缺口1={'是' if a else '否'} 缺口4={'是' if b else '否'}")

def main():
    parser = argparse.ArgumentParser(
        description='按固定关键词统计 mixed 结果中的生成站缺口 1、4；重复标签汇总。',
        usage='%(prog)s LABEL PRIVATE_DIR MIXED_RESULT_JSON [LABEL PRIVATE_DIR MIXED_RESULT_JSON ...]',
    )
    parser.add_argument('rounds', nargs='+', metavar='ROUND_ARG',
                        help='每组三元组：<轮次标签> <private 目录> <mixed result.json>。')
    args = parser.parse_args()
    if len(args.rounds) % 3:
        parser.error('每轮必须提供 <轮次标签> <private 目录> <mixed result.json> 三个参数。')
    groups = {}
    for i in range(0, len(args.rounds), 3):
        label, private, result = args.rounds[i:i + 3]
        groups.setdefault(label, []).append((private, result))
    for label, pairs in groups.items():
        run(label, pairs)

if __name__ == '__main__':
    main()

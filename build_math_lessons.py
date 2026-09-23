"""Convert the supplied Iraqi sixth-scientific mathematics archive to site lessons.

Usage: python3 build_math_lessons.py INPUT.zip
No new answers or distractors are invented. The original question data is retained.
"""
import json
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "lessons" / "pages"
CHAPTERS = [
    ("الأعداد المركبة", [("الحاجة إلى توسيع مجموعة الأعداد الحقيقية",4,6),("العمليات على مجموعة الأعداد المركبة",7,14),("مرافق العدد المركب",15,20),("العمليات ومساواة الأعداد المركبة",21,36),("الجذور التربيعية للعدد المركب",37,43),("حل المعادلة التربيعية في مجموعة الأعداد المركبة",44,59),("الجذور التكعيبية للواحد الصحيح",60,69),("التمثيل الهندسي للأعداد المركبة",70,75),("الصيغة القطبية للعدد المركب",76,83),("مبرهنة ديموافر",84,107)]),
    ("القطوع المخروطية", [("القطوع المخروطية وأهمية دراستها",109,109),("القطع المكافئ",110,118),("انسحاب المحاور للقطع المكافئ",119,131),("القطع الناقص",132,141),("انسحاب المحاور للقطع الناقص",142,148),("القطع الناقص: تطبيقات وتمارين",149,169),("القطع الزائد",170,179),("انسحاب محاور القطع الزائد",180,185),("القطع الزائد: تطبيقات وتمارين",186,208),("تمارين متنوعة على القطوع المخروطية",209,213)]),
    ("تطبيقات التفاضل", []),
    ("التكامل", []),
    ("المعادلات التفاضلية الاعتيادية", []),
    ("الهندسة الفضائية", [("الزاوية الزوجية والمستويات المتعامدة",216,233),("الإسقاط العمودي على مستوٍ",234,242)]),
]

def position(page):
    for ci,(chapter,topics) in enumerate(CHAPTERS,1):
        for ti,(title,first,last) in enumerate(topics,1):
            if first <= page <= last:
                return ci, ti, chapter, title
    raise ValueError(f"Page {page} falls outside all verified curriculum ranges")

def split_compound(input_data):
    correct=str(input_data.get('correct_answer','')).strip()
    options=list(map(str,input_data.get('options',[])))
    for sep in (' و ', ' ، '):
        parts=[x.strip() for x in correct.split(sep)]
        opts=[[x.strip() for x in option.split(sep)] for option in options]
        if len(parts)>1 and len(options)==4 and all(len(row)==len(parts) for row in opts):
            choices=[[row[i] for row in opts] for i in range(len(parts))]
            if all(len(set(c))==4 and parts[i] in c for i,c in enumerate(choices)):
                new=[]
                for i,part in enumerate(parts):
                    cell=dict(input_data)
                    cell['input_id']=f"{input_data['input_id']}_part_{i+1}"
                    cell['label']=f"{input_data.get('label','القيمة')} — الجزء {i+1}"
                    cell['correct_answer']=part
                    cell['options']=choices[i]
                    new.append(cell)
                return new,sep
    return [input_data],None

NUMBER = re.compile(r'(?<![\w])\d+(?:[,.]\d+)?(?![\w])')

def split_numeric_slots(cell):
    """Use only four original choices with matching numerical structure."""
    correct=str(cell.get('correct_answer',''))
    options=list(map(str,cell.get('options',[])))
    if len(options)!=4 or correct not in options:return None
    values=[correct,*options]
    if len({NUMBER.sub('#',value) for value in values})!=1:return None
    numbers=[NUMBER.findall(value) for value in values]
    varying=[i for i in range(len(numbers[0])) if len({row[i] for row in numbers})>1]
    if len(varying)<2 or any(len({row[i] for row in numbers[1:]})!=4 for i in varying):return None
    segments=NUMBER.split(correct);boxes=[];row=[]
    for index,digits in enumerate(numbers[0]):
        if segments[index]:row.append(segments[index])
        if index in varying:
            part=dict(cell)
            part['input_id']=f"{cell['input_id']}_value_{index+1}"
            part['label']=f"{cell.get('label','القيمة')} — القيمة {len(boxes)+1}"
            part['correct_answer']=digits
            part['options']=[choice[index] for choice in numbers[1:]]
            boxes.append(part);row.append({'input_id':part['input_id']})
        else:row.append(digits)
    if segments[-1]:row.append(segments[-1])
    return boxes,row

def layout_for(step):
    original=step.get('inputs') or []
    if not original:return None,0
    if len(original)==1:
        numeric=split_numeric_slots(original[0])
        if numeric:
            cells,row=numeric
            step['inputs']=cells
            step['layout']={'rows':[row]}
            return [row],len(cells)-1
    expanded=[];parts=[];split_count=0
    for cell in original:
        if not cell.get('input_id') or len(cell.get('options',[]))!=4 or str(cell.get('correct_answer','')) not in list(map(str,cell.get('options',[]))):
            return None,0
        cells,sep=split_compound(cell)
        expanded.extend(cells)
        parts.append((cells,sep))
        split_count+=len(cells)-1
    ids=[str(x['input_id']) for x in expanded]
    if len(ids)!=len(set(ids)):return None,0
    solution=str(step.get('step_assistant_solution') or '').strip()
    if not solution or split_count:
        rows=[]
        for cells,sep in parts:
            row=[]
            for i,cell in enumerate(cells):
                if i:row.append(sep)
                row.append({'input_id':cell['input_id']})
            if len(cells)==1:row.insert(0,str(cells[0].get('label') or 'القيمة')+' = ')
            rows.append(row)
    else:
        # Mask a known answer ONLY when it occurs verbatim in the model step.
        # A word-boundary check prevents answer 1 from matching 11 or 1.5.
        matches=[]
        for cell in expanded:
            value=str(cell['correct_answer']).strip()
            pattern=r'(?<![\w\d])'+re.escape(value)+r'(?![\w\d])'
            found=list(re.finditer(pattern,solution))
            if not found:break
            hit=next((m for m in reversed(found) if all(m.end()<=a or m.start()>=b for a,b,_ in matches)),None)
            if not hit:break
            matches.append((hit.start(),hit.end(),cell['input_id']))
        if len(matches)==len(expanded):
            row=[];cursor=0
            for start,end,id in sorted(matches):
                if start>cursor:row.append(solution[cursor:start])
                row.append({'input_id':id});cursor=end
            if cursor<len(solution):row.append(solution[cursor:])
            rows=[row]
        else:
            rows=[[str(cell.get('label') or 'القيمة')+' = ',{'input_id':cell['input_id']}] for cell in expanded]
    step['inputs']=expanded
    step['layout']={'rows':rows}
    return rows,split_count

def main(archive):
    OUT.mkdir(parents=True,exist_ok=True)
    catalog={'title':'رياضيات السادس العلمي — العراق','chapters':[],'sources':['https://sahl.io/iq/book/404/سادس-اعدادي/الرياضيات-علمي','https://mlazemna.com/book6thmatha19/']}
    for ci,(title,topics) in enumerate(CHAPTERS,1):
        catalog['chapters'].append({'id':ci,'title':title,'topics':[{'id':f'{ci}-{ti}','title':name,'pages':[]} for ti,(name,_,_) in enumerate(topics,1)]})
    stats=Counter();review=[]
    with zipfile.ZipFile(archive) as z:
        entries=sorted((n for n in z.namelist() if re.search(r'page_\d+\.json$',n)),key=lambda n:int(re.search(r'page_(\d+)',n).group(1)))
        for name in entries:
            data=json.loads(z.read(name));page=int(data['page_number']);ci,ti,chapter,topic=position(page)
            assert page==int(re.search(r'page_(\d+)',name).group(1)),name
            data.update({'chapter_id':ci,'chapter_title':chapter,'topic_id':f'{ci}-{ti}','topic_title':topic})
            question_stats={'interactive':0,'read_only':0,'diagrams':0}
            for qi,question in enumerate(data.get('exam_questions') or [],1):
                steps=question.get('interactive_steps') or []
                usable=False
                for si,step in enumerate(steps,1):
                    layout,split=layout_for(step)
                    if layout:usable=True;stats['steps_with_layout']+=1;stats['extra_boxes']+=split
                    else:
                        if step.get('inputs'):
                            step['source_inputs']=step['inputs']
                            step['inputs']=[]
                        step['interactive_status']='needs_review'
                        review.append({'page':page,'question':qi,'step':si,'reason':'لا توجد خيارات صالحة لهذه الخطوة'})
                if usable:question_stats['interactive']+=1
                else:question_stats['read_only']+=1
                if question.get('diagram') and question['diagram'].get('image_url'):question_stats['diagrams']+=1
            data['interactive_status']='ready' if question_stats['interactive'] else 'read_only'
            path=OUT/f'page_{page}.json'
            path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
            catalog['chapters'][ci-1]['topics'][ti-1]['pages'].append({'page':page,'path':f'lessons/pages/page_{page}.json','questions':len(data['exam_questions']),**question_stats})
            stats.update({'pages':1,'questions':len(data['exam_questions']),**question_stats})
    (ROOT/'lessons'/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    report={'statistics':dict(stats),'manual_review':review,'missing_chapters':[c['title'] for c in catalog['chapters'] if not c['topics']]}
    (ROOT/'lessons'/'conversion-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'statistics':dict(stats),'manual_review_count':len(review),'missing_chapters':report['missing_chapters']},ensure_ascii=False))

if __name__=='__main__':
    main(sys.argv[1])

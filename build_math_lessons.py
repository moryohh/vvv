"""Convert the supplied Iraqi sixth-scientific mathematics archive to site lessons.

Usage: python3 build_math_lessons.py INPUT.zip
Correct values and worked solutions always come from the supplied JSON.
Short incorrect numerical choices may be derived for individual boxes.
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
NUMBER = re.compile(r'(?<![\w])\d+(?:[,.]\d+)?(?![\w])')
SIGNED_NUMBER = re.compile(r'(?<!\d)(?:[+-]\s*)?\d+(?:[,.]\d+)?')

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

def split_numeric_slots(cell):
    """Split numerical positions only when ALL original choices align positionally.

    Every changing position must itself have four distinct supplied alternatives;
    no new distractors are generated. Fixed exponents and given numbers stay text.
    """
    correct=str(cell.get('correct_answer',''))
    options=list(map(str,cell.get('options',[])))
    if len(options)!=4 or correct not in options:return None
    values=[correct,*options]
    if len({NUMBER.sub('#',value) for value in values})!=1:return None
    numbers=[NUMBER.findall(value) for value in values]
    varying=[i for i in range(len(numbers[0])) if len({row[i] for row in numbers})>1]
    if len(varying)<2 or any(len({row[i] for row in numbers[1:]})!=4 for i in varying):return None
    segments=NUMBER.split(correct)
    boxes=[];row=[]
    for index,digits in enumerate(numbers[0]):
        if segments[index]:row.append(segments[index])
        if index in varying:
            part=dict(cell)
            part['input_id']=f"{cell['input_id']}_value_{index+1}"
            part['label']=f"{cell.get('label','القيمة')} — القيمة {len(boxes)+1}"
            part['correct_answer']=digits
            part['options']=[choice[index] for choice in numbers[1:]]
            boxes.append(part)
            row.append({'input_id':part['input_id']})
        else:row.append(digits)
    if segments[-1]:row.append(segments[-1])
    return boxes,row

def four_number_choices(correct, alternatives):
    """Create four distinct short numeric choices for a computed value."""
    def value(text):
        try:return float(re.sub(r'\s+', '',text).replace(',','.'))
        except ValueError:return None
    chosen=[correct];seen={value(correct)}
    for candidate in alternatives:
        candidate=str(candidate).strip();n=value(candidate)
        if n is not None and n not in seen:
            chosen.append(candidate);seen.add(n)
        if len(chosen)==4:return chosen
    number=value(correct)
    if number is None:return None
    decimals=len(correct.split('.')[-1]) if '.' in correct else len(correct.split(',')[-1]) if ',' in correct else 0
    quantum=10**(-decimals) if decimals else 1
    for factor in (-1,1,2,-2,3,-3,4):
        proposed=number+factor*quantum
        if proposed in seen:continue
        candidate=(f'{proposed:.{decimals}f}' if decimals else str(int(proposed)))
        if ',' in correct:candidate=candidate.replace('.',',')
        chosen.append(candidate);seen.add(proposed)
        if len(chosen)==4:return chosen
    return None

def atomic_formula_layout(step,cell):
    """Replace answer expressions with small unknown values inside the equation."""
    correct=str(cell.get('correct_answer','')).strip()
    options=list(map(str,cell.get('options',[])))
    if len(options)!=4 or correct not in options:return None

    # The conjugate-of-a-fraction exercise has two logical unknowns: its
    # numerator and denominator. Four compact alternatives are obtained by
    # combining the two source terms with their conjugates.
    fraction=re.fullmatch(r'(.*?=\s*)\(([^()]+)\)\s*/\s*\(([^()]+)\)',correct)
    if fraction and 'i' in fraction.group(2)+fraction.group(3):
        prefix,numerator,denominator=fraction.groups()
        def conjugate(term):
            return re.sub(r'([+-])\s*(\d*)i',lambda m:('+' if m[1]=='-' else '-')+m[2]+'i',term)
        pool=list(dict.fromkeys([numerator,denominator,conjugate(numerator),conjugate(denominator)]))
        if len(pool)==4:
            new=[]
            for index,answer in enumerate((numerator,denominator),1):
                part=dict(cell);part['input_id']=f"{cell['input_id']}_term_{index}"
                part['label']='بسط الكسر بعد المرافق' if index==1 else 'مقام الكسر بعد المرافق'
                part['correct_answer']=answer;part['options']=pool[:]
                new.append(part)
            return new,[[prefix+'(',{'input_id':new[0]['input_id']},') / (',{'input_id':new[1]['input_id']},')']]

    if not re.search(r'[=+*/×÷^²√]|\bi\b',correct):return None
    matches=[m for m in SIGNED_NUMBER.finditer(correct) if m.start()==0 or correct[m.start()-1]!='^']
    # Do not turn a whole proof or an arbitrarily long formula into guesses.
    if not matches or len(matches)>6:return None
    option_tokens=[[m.group().strip() for m in SIGNED_NUMBER.finditer(option)
                    if m.start()==0 or option[m.start()-1]!='^'] for option in options]
    aligned=all(len(tokens)==len(matches) for tokens in option_tokens)
    selected=[]
    for index,match in enumerate(matches):
        token=match.group().strip()
        if aligned:
            values=[tokens[index] for tokens in option_tokens]
            if len({re.sub(r'\s+','',x) for x in values})<=1:continue
        selected.append((index,match,token))
    if not selected:
        # Options that differ only by signs or by variable placement need a
        # separately authored layout; copying the full equation is misleading.
        return None
    if len(selected)>5:return None
    cells=[];row=[];cursor=0
    for index,match,token in selected:
        if match.start()>cursor:row.append(correct[cursor:match.start()])
        alternatives=[tokens[index] for tokens in option_tokens if len(tokens)>index]
        # Keep the operation sign visible in the equation; the square holds
        # only its numerical value, as on a handwritten worksheet.
        sign=re.match(r'^([+-])\s*(\d)',token)
        if sign and match.start()>0:
            row.append(sign.group(1))
            token=token[sign.start(2):]
            alternatives=[re.sub(r'^[+-]\s*','',candidate) for candidate in alternatives]
        choices=four_number_choices(token,alternatives)
        if not choices:return None
        part=dict(cell);part['input_id']=f"{cell['input_id']}_atom_{index+1}"
        part['label']=f'قيمة الجزء {len(cells)+1} في المعادلة'
        part['correct_answer']=token;part['options']=choices
        cells.append(part);row.append({'input_id':part['input_id']});cursor=match.end()
    if cursor<len(correct):row.append(correct[cursor:])
    return cells,[row]

def layout_for(step):
    original=step.get('inputs') or []
    if not original:return None,0
    if len(original)==1:
        atomic=atomic_formula_layout(step,original[0])
        if atomic:
            cells,rows=atomic
            step['source_inputs']=original
            step['inputs']=cells
            step['layout']={'rows':rows}
            step['choice_origin']='derived_from_source_options'
            return rows,len(cells)-len(original)
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

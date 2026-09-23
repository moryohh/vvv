"""Import worksheet templates from the supplied processed ZIP into the site.

Run after build_math_lessons.py. Invalid/non-lesson entries retain their existing
page from the original archive and are listed in the conversion report.
"""
import json
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).parent
PAGES = ROOT / 'lessons' / 'pages'
PLACEHOLDER = re.compile(r'\{([^{}]+)\}')


def template_rows(step):
    inputs = step.get('inputs') or []
    template = step.get('equation_template') or ''
    row = []
    seen = set()
    cursor = 0
    for match in PLACEHOLDER.finditer(template):
        if match.start() > cursor:
            row.append(template[cursor:match.start()])
        key = match.group(1)
        position = re.fullmatch(r'input_(\d+)', key)
        index = int(position.group(1)) - 1 if position else -1
        if 0 <= index < len(inputs):
            cell = inputs[index]
            if index in seen:
                row.append(str(cell['correct_answer']))
            else:
                row.append({'input_id': cell['input_id']})
                seen.add(index)
        else:
            row.append(match.group())
        cursor = match.end()
    if cursor < len(template):
        row.append(template[cursor:])
    rows = [row] if row else []
    for index, cell in enumerate(inputs):
        if index not in seen:
            rows.append([str(cell.get('label') or 'القيمة') + ' = ', {'input_id': cell['input_id']}])
    return {'rows': rows}


def unwrap(source):
    if isinstance(source, list):
        if source and all(isinstance(q, dict) and 'question_number' in q for q in source):
            return {'exam_questions': source}
        lessons = source
    elif isinstance(source, dict):
        source = source.get('data', source)
        lessons = source.get('merged_lessons', [])
    else:
        return None
    if len(lessons) != 1 or not isinstance(lessons[0], dict):
        return None
    return lessons[0].get('content')


def parse_source(raw):
    text = raw.decode('utf-8')
    try:
        return json.loads(text)
    except json.JSONDecodeError as error:
        if error.msg == 'Extra data':
            parsed, offset = json.JSONDecoder().raw_decode(text)
            # Some exports append only closing delimiters or whitespace.
            if re.fullmatch(r'[\s}\],]*', text[offset:]):
                return parsed
        if '幕' in text:
            text = re.sub(r'^\s*幕\s*$', '', text, flags=re.MULTILINE)
        if ',\n' in text:
            text = re.sub(r',\s*([}\]])', r'\1', text)
        try:
            return json.loads(text)
        except json.JSONDecodeError as second:
            if second.msg == 'Extra data':
                parsed, offset = json.JSONDecoder().raw_decode(text)
                if re.fullmatch(r'[\s}\],]*', text[offset:]):
                    return parsed
            raise


def main(archive):
    stats = Counter()
    skipped = []
    with zipfile.ZipFile(archive) as zipped:
        names = sorted((name for name in zipped.namelist() if re.search(r'page_\d+\.json$', name)))
        for name in names:
            page = int(re.search(r'page_(\d+)\.json$', name).group(1))
            existing = PAGES / f'page_{page}.json'
            try:
                source = parse_source(zipped.read(name))
                data = unwrap(source)
                if not isinstance(data, dict) or int(data.get('page_number', page)) != page:
                    raise ValueError('entry has no matching lesson content')
                data['page_number'] = page
                questions = data.get('exam_questions')
                if not isinstance(questions, list):
                    raise ValueError('lesson has no question list')
                # Preserve the verified chapter and topic assignments of the site.
                old = json.loads(existing.read_text(encoding='utf-8'))
                for field in ('chapter_id', 'chapter_title', 'topic_id', 'topic_title'):
                    data[field] = old[field]
                for question_index, question in enumerate(questions, 1):
                    for step_index, step in enumerate(question.get('interactive_steps') or [], 1):
                        inputs = step.get('inputs') or []
                        if not isinstance(inputs, list):
                            raise ValueError('invalid input list')
                        for input_index, cell in enumerate(inputs, 1):
                            correct = str(cell.get('correct_answer', ''))
                            choices = [str(value) for value in cell.get('options', [])]
                            if correct not in choices or len(choices) != 4 or len(set(choices)) != 4:
                                raise ValueError('invalid four-choice answer')
                            # IDs must be unique across every step in one question.
                            cell['input_id'] = f'q{question_index}_s{step_index}_i{input_index}'
                            cell['correct_answer'] = correct
                            cell['options'] = choices
                        step['layout'] = template_rows(step)
                        stats['boxes'] += len(inputs)
                        stats['steps'] += 1
                data['interactive_status'] = 'ready' if any(
                    step.get('inputs') for q in questions for step in q.get('interactive_steps', [])
                ) else 'read_only'
                existing.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
                stats['pages'] += 1
            except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
                skipped.append({'page': page, 'reason': str(error)})
    report_path = ROOT / 'lessons' / 'conversion-report.json'
    report = json.loads(report_path.read_text(encoding='utf-8'))
    report['processed_import'] = {'statistics': dict(stats), 'retained_previous_pages': skipped}
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    catalog_path = ROOT / 'lessons' / 'catalog.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
    for chapter in catalog['chapters']:
        for topic in chapter['topics']:
            for listing in topic['pages']:
                data = json.loads((PAGES / f"page_{listing['page']}.json").read_text(encoding='utf-8'))
                questions = data.get('exam_questions', [])
                listing['questions'] = len(questions)
                listing['interactive'] = sum(bool(any(s.get('inputs') for s in q.get('interactive_steps', []))) for q in questions)
                listing['read_only'] = len(questions) - listing['interactive']
                listing['diagrams'] = sum(bool((q.get('diagram') or {}).get('image_url')) for q in questions)
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report['processed_import'], ensure_ascii=False))


if __name__ == '__main__':
    main(sys.argv[1])

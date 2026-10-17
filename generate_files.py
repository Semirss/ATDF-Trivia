import re

def process_ans(en_ans_line, am_ans_line):
    # Defaults
    ans = ''
    en_exp = en_ans_line
    am_exp = am_ans_line
    
    # English Answer parsing
    m = re.match(r'^([A-D])\)\s*(.*)', en_ans_line, re.IGNORECASE)
    if m:
        ans = m.group(1).upper()
        en_exp = m.group(2).strip()
    else:
        m2 = re.match(r'^(True|False)\s*(?:—|-)?\s*(.*)', en_ans_line, re.IGNORECASE)
        if m2:
            tf = m2.group(1).title()
            ans = 'A' if tf == 'True' else 'B'
            en_exp = m2.group(2).strip()

    # Amharic Answer parsing
    m3 = re.match(r'^([ሀ-መ])\)\s*(.*)', am_ans_line)
    if m3:
        am_exp = m3.group(2).strip()
    else:
        m4 = re.match(r'^(እውነት|ሐሰት)\s*(?:—|-)?\s*(.*)', am_ans_line)
        if m4:
            am_exp = m4.group(2).strip()

    return ans, en_exp, am_exp

def get_difficulty(level):
    if 1 <= level <= 5: return "Easy"
    elif 6 <= level <= 15: return "Medium"
    elif 16 <= level <= 20: return "Hard"
    return "Medium"

def generate_files(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = [line.strip() for line in f if line.strip()]

    questions = []
    current_q = None
    level = 1
    
    for line in lines:
        if line.startswith("Level "):
            m = re.search(r'Level\s+(\d+)', line)
            if m:
                level = int(m.group(1))
                
        if re.match(r'^Q\d+\s+🌐', line):
            if current_q:
                current_q['level'] = level
                questions.append(current_q)
            current_q = {'en_options': {}, 'am_options': {}, 'en_ans_line': '', 'am_ans_line': ''}
            
        elif current_q is not None:
            if re.match(r'^EN\s+Q\d+\s+\[.*?\]\s*(.*)', line):
                current_q['en_q'] = re.match(r'^EN\s+Q\d+\s+(?:\[.*?\])?\s*(.*)', line).group(1)
            elif re.match(r'^EN\s+Q\d+\s+(.*)', line):
                current_q['en_q'] = re.match(r'^EN\s+Q\d+\s+(.*)', line).group(1)
            elif re.match(r'^A\)\s*(.*)', line):
                current_q['en_options']['A'] = re.match(r'^A\)\s*(.*)', line).group(1)
            elif re.match(r'^B\)\s*(.*)', line):
                current_q['en_options']['B'] = re.match(r'^B\)\s*(.*)', line).group(1)
            elif re.match(r'^C\)\s*(.*)', line):
                current_q['en_options']['C'] = re.match(r'^C\)\s*(.*)', line).group(1)
            elif re.match(r'^D\)\s*(.*)', line):
                current_q['en_options']['D'] = re.match(r'^D\)\s*(.*)', line).group(1)
            elif re.match(r'^አማ\s+ጥ\d+\s+(.*)', line):
                current_q['am_q'] = re.match(r'^አማ\s+ጥ\d+\s+(.*)', line).group(1)
            elif re.match(r'^ሀ\)\s*(.*)', line):
                current_q['am_options']['A'] = re.match(r'^ሀ\)\s*(.*)', line).group(1)
            elif re.match(r'^ለ\)\s*(.*)', line):
                current_q['am_options']['B'] = re.match(r'^ለ\)\s*(.*)', line).group(1)
            elif re.match(r'^ሐ\)\s*(.*)', line):
                current_q['am_options']['C'] = re.match(r'^ሐ\)\s*(.*)', line).group(1)
            elif re.match(r'^መ\)\s*(.*)', line):
                current_q['am_options']['D'] = re.match(r'^መ\)\s*(.*)', line).group(1)
            elif re.match(r'^EN\s+Answer:\s*(.*)', line):
                current_q['en_ans_line'] = re.match(r'^EN\s+Answer:\s*(.*)', line).group(1)
            elif re.match(r'^አማ\s+መልስ፡\s*(.*)', line):
                current_q['am_ans_line'] = re.match(r'^አማ\s+መልስ፡\s*(.*)', line).group(1)
                
    if current_q:
        current_q['level'] = level
        questions.append(current_q)
        
    print(f"Total questions parsed: {len(questions)}")
    
    # Process and split into 4 files
    file_count = 1
    for i in range(0, len(questions), 100):
        batch = questions[i:i+100]
        out_name = f'quiz_bank_part_{file_count}.txt'
        with open(out_name, 'w', encoding='utf-8') as f:
            for q in batch:
                q_text = q.get('en_q', '')
                am_q = q.get('am_q', '')
                
                en_opt_a = q['en_options'].get('A', '')
                en_opt_b = q['en_options'].get('B', '')
                en_opt_c = q['en_options'].get('C', '')
                en_opt_d = q['en_options'].get('D', '')
                
                am_opt_a = q['am_options'].get('A', '')
                am_opt_b = q['am_options'].get('B', '')
                am_opt_c = q['am_options'].get('C', '')
                am_opt_d = q['am_options'].get('D', '')
                
                en_ans_line = q.get('en_ans_line', '')
                am_ans_line = q.get('am_ans_line', '')
                
                ans, en_exp, am_exp = process_ans(en_ans_line, am_ans_line)
                
                # If True/False
                if re.search(r'(?i)true or false', q_text) or 'True / False' in q_text or (not en_opt_a and not en_opt_b):
                    if not en_opt_a: en_opt_a = "True"
                    if not en_opt_b: en_opt_b = "False"
                    if not am_opt_a: am_opt_a = "እውነት"
                    if not am_opt_b: am_opt_b = "ሐሰት"

                difficulty = get_difficulty(q.get('level', 1))
                
                if file_count >= 3:
                    row = [
                        q_text,
                        en_opt_a,
                        en_opt_b,
                        en_opt_c,
                        en_opt_d,
                        ans,
                        difficulty,
                        en_exp
                    ]
                else:
                    row = [
                        q_text,
                        en_opt_a,
                        en_opt_b,
                        en_opt_c,
                        en_opt_d,
                        ans,
                        difficulty,
                        en_exp,
                        am_q,
                        am_opt_a,
                        am_opt_b,
                        am_opt_c,
                        am_opt_d,
                        am_exp
                    ]
                
                f.write(' | '.join(row) + '\n')
        print(f"Created {out_name} with {len(batch)} questions")
        file_count += 1

generate_files("extracted_text.txt")

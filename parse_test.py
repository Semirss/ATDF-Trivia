import re

def parse_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = [line.strip() for line in f if line.strip()]

    questions = []
    current_q = {}
    
    level = 1
    
    for line in lines:
        if line.startswith("Level "):
            # Extract level number
            m = re.search(r'Level\s+(\d+)', line)
            if m:
                level = int(m.group(1))
                
        if re.match(r'^Q\d+\s+🌐', line):
            if current_q:
                current_q['level'] = level
                questions.append(current_q)
            current_q = {'en_options': {}, 'am_options': {}}
            
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
        
    return questions

questions = parse_file("extracted_text.txt")
print(f"Total questions parsed: {len(questions)}")

# Let's inspect the first 5 questions
for i in range(min(5, len(questions))):
    print(f"--- Q{i+1} ---")
    print(questions[i])

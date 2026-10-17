import os
import random

random.seed(42) # For reproducibility

def write_file(filename, questions):
    with open(filename, 'w', encoding='utf-8') as f:
        f.write("Question | Option A | Option B | Option C | Option D | Answer | Difficulty | Explanation | Amharic Question | Amharic A | Amharic B | Amharic C | Amharic D | Amharic Explanation\n")
        for i, q in enumerate(questions):
            rem = i % 20
            if rem < 5:
                diff = "Easy"
            elif rem < 15:
                diff = "Medium"
            else:
                diff = "Hard"
                
            c = q.get('c', '')
            d = q.get('d', '')
            ac = q.get('ac', '')
            ad = q.get('ad', '')
            
            f.write(f"{q['q']} | {q['a']} | {q['b']} | {c} | {d} | {q['ans']} | {diff} | {q['exp']} | {q['aq']} | {q['aa']} | {q['ab']} | {ac} | {ad} | {q['aexp']}\n")

def get_unique_options(correct_item, all_items, count):
    opts = [correct_item]
    others = [x for x in all_items if x != correct_item]
    random.shuffle(others)
    opts.extend(others[:count-1])
    return opts

def generate_questions(articles, count):
    questions = []
    
    templates = [
        # 1. Which article covers [Title]?
        lambda a, all_a: build_mc(
            f"Which Article covers '{a[1]}'?",
            f"'{a[2]}' የተካተተው በየትኛው አንቀጽ ነው?",
            a, all_a,
            lambda x: f"Article {x[0]}",
            lambda x: f"አንቀጽ {x[0]}",
            f"Article {a[0]} is about {a[1]}.",
            f"አንቀጽ {a[0]} ስለ {a[2]} ይገልጻል።"
        ),
        # 2. What is covered by Article [X]?
        lambda a, all_a: build_mc(
            f"What is the title of Article {a[0]}?",
            f"የአንቀጽ {a[0]} ርዕስ ምንድነው?",
            a, all_a,
            lambda x: x[1],
            lambda x: x[2],
            f"Article {a[0]} covers {a[1]}.",
            f"አንቀጽ {a[0]} ስለ {a[2]} ይገልጻል።"
        ),
        # 3. True/False Correct
        lambda a, all_a: build_tf(
            f"Article {a[0]} covers '{a[1]}'.",
            f"አንቀጽ {a[0]} ስለ '{a[2]}' ይገልጻል።",
            True,
            f"It is true that Article {a[0]} is about {a[1]}.",
            f"አንቀጽ {a[0]} ስለ {a[2]} እንደሚገልጽ እውነት ነው።"
        ),
        # 4. True/False Wrong
        lambda a, all_a: build_tf(
            f"Article {a[0]} covers '{get_wrong(a, all_a)[1]}'.",
            f"አንቀጽ {a[0]} ስለ '{get_wrong(a, all_a)[2]}' ይገልጻል።",
            False,
            f"False. Article {a[0]} is actually about {a[1]}.",
            f"ሀሰት። አንቀጽ {a[0]} በእርግጥ ስለ {a[2]} ይገልጻል።"
        ),
        # 5. Is it true that [Title] is in Article [X]?
        lambda a, all_a: build_tf(
            f"Is it true that '{a[1]}' is the subject of Article {a[0]}?",
            f"'{a[2]}' የአንቀጽ {a[0]} ርዕስ መሆኑ እውነት ነው?",
            True,
            f"Yes, Article {a[0]} covers {a[1]}.",
            f"አዎ፣ አንቀጽ {a[0]} ስለ {a[2]} ይገልጻል።"
        ),
        # 6. Is it true that [Title] is in Article [Wrong X]?
        lambda a, all_a: build_tf(
            f"Is it true that '{a[1]}' is the subject of Article {get_wrong(a, all_a)[0]}?",
            f"'{a[2]}' የአንቀጽ {get_wrong(a, all_a)[0]} ርዕስ መሆኑ እውነት ነው?",
            False,
            f"False, it is actually covered in Article {a[0]}.",
            f"ሀሰት፣ በእርግጥ የተካተተው በአንቀጽ {a[0]} ነው።"
        ),
        # 7. Identify the correct article for [Title]
        lambda a, all_a: build_mc(
            f"To find information about '{a[1]}', which article should you read?",
            f"ስለ '{a[2]}' መረጃ ለማግኘት፣ የትኛውን አንቀጽ ማንበብ አለብዎት?",
            a, all_a,
            lambda x: f"Article {x[0]}",
            lambda x: f"አንቀጽ {x[0]}",
            f"Article {a[0]} contains information about {a[1]}.",
            f"አንቀጽ {a[0]} ስለ {a[2]} መረጃ ይዟል።"
        ),
        # 8. Identify the correct title for Article [X]
        lambda a, all_a: build_mc(
            f"Which of the following best describes Article {a[0]}?",
            f"ከሚከተሉት ውስጥ አንቀጽ {a[0]}ን በተሻለ የሚገልጸው የትኛው ነው?",
            a, all_a,
            lambda x: x[1],
            lambda x: x[2],
            f"Article {a[0]} is specifically about {a[1]}.",
            f"አንቀጽ {a[0]} በተለይ ስለ {a[2]} ነው።"
        ),
        # 9. Negative True/False
        lambda a, all_a: build_tf(
            f"Article {a[0]} does NOT cover '{a[1]}'.",
            f"አንቀጽ {a[0]} ስለ '{a[2]}' አይገልጽም።",
            False,
            f"False, because Article {a[0]} DOES cover {a[1]}.",
            f"ሀሰት፣ ምክንያቱም አንቀጽ {a[0]} ስለ {a[2]} ይገልጻል።"
        ),
        # 10. Another wording
        lambda a, all_a: build_tf(
            f"The provision for '{a[1]}' can be found in Article {a[0]}.",
            f"የ '{a[2]}' ድንጋጌ በአንቀጽ {a[0]} ውስጥ ይገኛል።",
            True,
            f"True. Article {a[0]} provides for {a[1]}.",
            f"እውነት። አንቀጽ {a[0]} ስለ {a[2]} ይደነግጋል።"
        ),
    ]

    while len(questions) < count:
        for a in articles:
            if len(questions) >= count: break
            tmpl = random.choice(templates)
            q_data = tmpl(a, articles)
            questions.append(q_data)
            
    return questions

def get_wrong(correct, all_a):
    opts = [x for x in all_a if x != correct]
    return random.choice(opts)

def build_mc(q_eng, q_amh, correct_a, all_a, fmt_eng, fmt_amh, exp_eng, exp_amh):
    opts = get_unique_options(correct_a, all_a, 4)
    correct_val = opts[0]
    random.shuffle(opts)
    idx = opts.index(correct_val)
    ans_letter = ["A", "B", "C", "D"][idx]
    
    return {
        "q": q_eng, "aq": q_amh,
        "a": fmt_eng(opts[0]), "aa": fmt_amh(opts[0]),
        "b": fmt_eng(opts[1]), "ab": fmt_amh(opts[1]),
        "c": fmt_eng(opts[2]), "ac": fmt_amh(opts[2]),
        "d": fmt_eng(opts[3]), "ad": fmt_amh(opts[3]),
        "ans": ans_letter,
        "exp": exp_eng, "aexp": exp_amh
    }

def build_tf(q_eng, q_amh, is_true, exp_eng, exp_amh):
    ans_letter = "A" if is_true else "B"
    return {
        "q": q_eng, "aq": q_amh,
        "a": "True", "aa": "እውነት",
        "b": "False", "ab": "ሀሰት",
        "ans": ans_letter,
        "exp": exp_eng, "aexp": exp_amh
    }

articles_cat1 = [
    (1, "Short Title", "አጭር ርዕስ"),
    (2, "Definitions", "ትርጓሜ"),
    (3, "Scope of Application", "የተፈፃሚነት ወሰን"),
    (4, "Powers and Functions of the Ministry", "የሚኒስቴሩ ሥልጣንና ተግባራት"),
    (5, "Power and Function of the Council", "የምክር ቤቱ ሥልጣንና ተግባራት"),
    (6, "Principle", "መርህ"),
    (7, "Eligibility for Designation as a Startup", "የስታርታፕ ስያሜ ለማግኘት ብቁ ስለመሆን"),
    (8, "Startup and startup ecosystem builder certificate", "የስታርታፕ እና የስታርታፕ ስነምህዳር ገንቢ ምስክር ወረቀት"),
    (9, "Application for Designation", "ስያሜ ለማግኘት የሚቀርብ ማመልከቻ"),
    (10, "Establishment of National Designation Committee", "ብሔራዊ ስያሜ ኮሚቴ ስለ መቋቋም"),
    (11, "Powers and Functions of the Committee", "የኮሚቴው ሥልጣንና ተግባራት"),
    (12, "Obligations of a Designated Startup", "ስያሜ የተሰጠው ስታርታፕ ግዴታዎች"),
    (13, "Renewal of a Startup Designation", "የስታርታፕ ስያሜ ዕድሳት"),
    (14, "Suspension of a Startup Designation", "የስታርታፕ ስያሜ ዕገዳ"),
    (15, "Revocation of a Startup Designation", "የስታርታፕ ስያሜን መሻር"),
    (16, "Eligibility for Designation as a Startup Ecosystem Builder", "የስታርታፕ ምኅዳር ገንቢ ስያሜ ለማግኘት ብቁ ስለመሆን"),
    (17, "Application for Startup Ecosystem Builder Designation", "የስታርታፕ ምኅዳር ገንቢ ስያሜ ለማግኘት ስለሚቀርብ ማመልከቻ"),
    (18, "Obligation of Designated Startup Ecosystem Builders", "ስያሜ የተሰጣቸው የስታርታፕ ምኅዳር ገንቢ ግዴታ"),
    (19, "Renewal of a Startup Ecosystem Builder Designation", "የስታርታፕ ምኅዳር ገንቢ ስያሜ ዕድሳት"),
    (20, "Suspension of a Startup Ecosystem Builder Designation", "የስታርታፕ ምኅዳር ገንቢ ስያሜ ዕገዳ"),
    (21, "Revocation of a Startup Ecosystem Builder Designation", "የስታርታፕ ምኅዳር ገንቢ ስያሜ መሻር")
]

articles_cat2 = [
    (22, "Establishment of grievance committee", "ቅሬታ ሰሚ ኮሚቴ ስለማቋቋም"),
    (23, "Establishment of a Startup Grant Program", "የስታርታፕ ግራንት ፕሮግራም መቋቋም"),
    (24, "Objective of the Grant", "የግራንቱ ዓላማዎች"),
    (25, "Distribution of the Grant", "ግራንት ስለ ማከፋፈል"),
    (26, "National Credit Guarantee Fund for Startups and Ecosystem Builders", "የስታርታፕ እና የስታርታፕ ምህዳር ገንቢ ብሔራዊ የብድር ዋስትና ፈንድ"),
    (27, "Objectives of the Guarantee Fund", "የዋስትና ፈንድ ዓላማዎች"),
    (28, "Obligation of Guarantee Fund Beneficiaries", "የዋስትና ፈንድ ተጠቃሚዎች ግዴታ"),
    (29, "Prohibition", "ክልከላ"),
    (30, "Tax Incentives", "የግብር ማትጊያዎች"),
    (31, "Loss Carry Forward by Startups", "የስታርታፕ ኪሳራን ወደፊት ስለማሸጋገር")
]

articles_cat3 = [
    (32, "Loss Carry Forward by Investor", "በባለሀብት ወደፊት የሚተላለፍ ኪሳራ"),
    (33, "Duty Free Privilege for Designated Startups", "ስያሜ ለተሰጠው ስታርታፕ ከቀረጥ ነፃ የመሆን መብት"),
    (34, "Duty Free Privilege for Designated Startup Ecosystem Builders", "ስያሜ ለተሰጠው የስታርታፕ ምኅዳር ገንቢ ከቀረጥ ነፃ የመሆን መብቶች"),
    (35, "Establishment of Startup Fund of Funds", "የስታርታፕ የፈንዶች ፈንድ መቋቋም"),
    (36, "Purpose of the Fund of Fund", "የፈንዱ ዓላማ"),
    (37, "Regulatory Sandbox", "የሙከራ ፈቃድና ክትትል")
]

articles_cat4 = [
    (38, "Competency Certificates", "የብቃት ማረጋገጫ የምስክር ወረቀቶች"),
    (39, "Work Permit", "የሥራ ፈቃድ"),
    (40, "Foreign Startups and Ecosystem Builders", "የውጪ ስታርታፕ እና ምህዳር ገንቢ"),
    (41, "Protection for Designated Startups", "ስያሜ ለተሰጠው ስታርታፕ የሚሰጥ ከለላ"),
    (42, "Inapplicable Laws", "ተፈጻሚነት የማይኖራቸው ሕጎች"),
    (43, "Power to Issue Regulations and Directives", "ደንቦችንና መመሪያዎችን የማውጣት ሥልጣን"),
    (44, "Effective Date", "አዋጁ የሚጸናበት ቀን")
]

if __name__ == "__main__":
    q1 = generate_questions(articles_cat1, 100)
    write_file('category_1_designation_and_eligibility.txt', q1)
    
    q2 = generate_questions(articles_cat2, 100)
    write_file('category_2_grants_and_financial.txt', q2)
    
    q3 = generate_questions(articles_cat3, 100)
    write_file('category_3_duty_free_and_sandbox.txt', q3)
    
    q4 = generate_questions(articles_cat4, 100)
    write_file('category_4_talent_and_foreign.txt', q4)
    
    print("All 4 files generated successfully with 100 questions each!")

import zipfile
import xml.etree.ElementTree as ET
import sys

def read_docx(file_path):
    with zipfile.ZipFile(file_path) as docx:
        tree = ET.fromstring(docx.read('word/document.xml'))
        namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        paragraphs = tree.findall('.//w:p', namespaces)
        text = []
        for p in paragraphs:
            texts = p.findall('.//w:t', namespaces)
            text.append(''.join([t.text for t in texts if t.text]))
        return '\n'.join(text)

try:
    content = read_docx(sys.argv[1])
    with open('extracted_text.txt', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Extraction successful.")
except Exception as e:
    print(f"Error: {e}")

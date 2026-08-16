import os
from pathlib import Path
from openai import OpenAI

ROOT=Path("."); DOCS=ROOT/"docs"
SKIP={".git","node_modules",".github","docs/.vitepress","dist","build"}
EXT={".py",".js",".jsx",".ts",".tsx",".json",".css",".html",".sh",".go",".rs",".java",".md"}

def skip(p): return any(x in SKIP for x in p.parts)

def scan():
    out=[]
    for p in ROOT.rglob("*"):
        if p.is_file() and not skip(p) and p.suffix.lower() in EXT:
            try:
                if p.stat().st_size<=500_000:
                    out.append(f"\n--- FILE: {p} ---\n{p.read_text(encoding='utf-8',errors='ignore')[:12000]}")
            except Exception: pass
    return "\n".join(out) or "Dự án chưa có mã nguồn."

def media():
    ex={".png",".jpg",".jpeg",".gif",".svg",".webp"}
    a=[f"- `{p}`" for p in ROOT.rglob("*") if p.is_file() and not skip(p) and p.suffix.lower() in ex]
    return "\n".join(a) or "Không tìm thấy Media."

def ai(prompt):
    key=os.getenv("GROQ_API_KEY")
    if not key:
        return "## chưa cấu hình ai\n\nthêm `GROQ_API_KEY` vào github actions secrets để bật ai agent."
    c=OpenAI(api_key=key,base_url="https://api.groq.com/openai/v1")
    r=c.chat.completions.create(
        model=os.getenv("GROQ_MODEL","llama-3.3-70b-versatile"),
        messages=[
            {"role":"system","content":"Bạn là AI Agent chuyên phân tích mã nguồn và viết tài liệu kỹ thuật."},
            {"role":"user","content":prompt}
        ],
        temperature=0.2)
    return r.choices[0].message.content

def main():
    source=scan()
    prompt=f"""Phân tích mã nguồn và tạo tài liệu tiếng Việt dễ hiểu cho người mới.
Giải thích cấu trúc thư mục, file, cách chạy, build, deploy, biến môi trường,
cách sửa code, review code, lỗi thường gặp và gợi ý phát triển.
Dùng Markdown sạch, bullet ngắn và Mermaid graph TD.

MEDIA:
{media()}

SOURCE:
{source}"""
    vi=ai(prompt)
    for lang,name in [("vi","Tiếng Việt"),("en","English"),("ja","Japanese")]:
        text=vi if lang=="vi" else ai(f"""Dịch tài liệu Markdown sau sang {name}.
Giữ nguyên Markdown, code block, tên file, đường dẫn, shell command, Mermaid và HTML.
Không dịch code.

{vi}""")
        d=DOCS/lang; d.mkdir(parents=True,exist_ok=True)
        (d/"index.md").write_text(text,encoding="utf-8")

if __name__=="__main__": main()

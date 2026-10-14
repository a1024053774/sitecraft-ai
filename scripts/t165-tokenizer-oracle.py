"""Generate offline test oracles with the pinned official DeepSeek V4.1 tokenizer."""
import argparse
import base64
import importlib.metadata
import json
import os
from pathlib import Path
import random
from urllib.parse import urlparse

from tokenizers import Tokenizer
from deepseek_recipe import (
    ChatCompletionRequest,
    ConversionOptions,
    DeepseekV41Encoding,
    Tokenizer as RecipeTokenizer,
)

REVISION = "8cadfede7063c896b944e7bae05daa3549ae97ea"
SOURCE = f"https://raw.githubusercontent.com/deepseek-ai/deepseek-recipe/{REVISION}/static/tokenizers/v41/tokenizer.json"
assert importlib.metadata.version("tokenizers") == "0.23.3"
assert importlib.metadata.version("deepseek-recipe") == "0.1.1"
origin = urlparse(os.environ["SITECRAFT_BASE"])
assert origin.scheme == "http" and origin.hostname in ("127.0.0.1", "localhost", "::1")
assert not origin.username and not origin.password and origin.path in ("", "/")
assert not origin.query and not origin.fragment

parser = argparse.ArgumentParser()
parser.add_argument("--tokenizer", required=True, type=Path)
parser.add_argument("--output", required=True, type=Path)
parser.add_argument("--han-output", required=True, type=Path)
parser.add_argument("--runtime-table", type=Path)
args = parser.parse_args()
tokenizer = Tokenizer.from_file(str(args.tokenizer))
encoding = DeepseekV41Encoding().with_tokenizer(RecipeTokenizer.from_file(str(args.tokenizer)))
random_source = random.Random(165)
base64_text = base64.b64encode(bytes(random_source.randrange(256) for _ in range(12000))).decode("ascii")
ascii_text = "".join(random_source.choice("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") for _ in range(16000))
basic_han = [chr(value) for value in range(0x4E00, 0x9FA6)]
single_han = [character for character, encoded in zip(basic_han, tokenizer.encode_batch(basic_han, add_special_tokens=False)) if len(encoded.ids) == 1]
single_set = set(single_han)
rare_han = "".join(character for character in basic_han if character not in single_set)
texts = [
    ("literal-unicode-escapes", r"\u9fa5" * 4000),
    ("base64-16000", base64_text),
    ("unbroken-ascii-16000", ascii_text),
    ("short-ascii-words", "qz zx jx " * 4000),
    ("literal-control-escapes", r"\x1f" * 4000),
    ("rare-basic-han-end", "龥" * 4000),
    ("rare-basic-han-cluster", "龘靐齉爩灪" * 1000),
    ("rare-extension-a", "㐀䨻㸚" * 1600),
    ("rare-extension-b", "𠮷𪚥𰻞" * 1600),
    ("all-rare-basic-han", rare_han),
    ("common-han-control", "中国汉字" * 2000),
    ("mixed-common-han-ascii", "qz中国jx汉字" * 1600),
    ("mixed-rare-han-ascii", "龥qz𰻞jx" * 1600),
    ("combining-and-emoji", "汉\u0301e\u0301😀👨‍👩‍👧‍👦" * 1000),
]
cases = []
for name, text in texts:
    body = {"model": "deepseek-flash", "max_tokens": 4096, "messages": [{"role": "system", "content": "test"}, {"role": "user", "content": text}]}
    converted = ChatCompletionRequest(body).convert(ConversionOptions())
    cases.append({"name": name, "body": body, "userTokens": len(tokenizer.encode(text, add_special_tokens=False).ids), "promptTokens": len(encoding.encode(converted.conversation))})

tool_body = {"model": "deepseek-flash", "max_tokens": 4096, "messages": [{"role": "user", "content": "返回工具结果"}],
             "tools": [{"type": "function", "function": {"name": "submit", "description": base64_text, "parameters": {"type": "object", "properties": {"text": {"type": "string", "description": r"\u9fa5" * 4000}}}}}], "tool_choice": "auto"}
cases.append({"name": "dense-tool-schema", "body": tool_body, "promptTokens": len(encoding.encode(ChatCompletionRequest(tool_body).convert(ConversionOptions()).conversation))})

# This finite unseen sweep comes from the tokenizer and seeded inputs, without
# loading the gateway, its constants or its character table.
sentinels = []
for index in range(128):
    alphabet = random_source.sample(single_han, 12) + ["龥", "𰻞", "qz", "\\u9fa5", " ", "😀", "+/="]
    text = "".join(random_source.choice(alphabet) for _ in range(256))
    body = {"model": "deepseek-flash", "max_tokens": 4096, "messages": [{"role": "user", "content": text}]}
    sentinels.append({"name": f"mixed-sentinel-{index + 1}", "body": body, "promptTokens": len(encoding.encode(ChatCompletionRequest(body).convert(ConversionOptions()).conversation))})

result = {"source": {"url": SOURCE, "revision": REVISION, "tokenizer": "static/tokenizers/v41/tokenizer.json", "tokenizers": "0.23.3", "deepseekRecipe": "0.1.1", "encoding": "DeepseekV41Encoding", "seed": 165}, "cases": cases, "sentinels": sentinels}
args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
args.han_output.write_text(json.dumps({"source": result["source"], "characters": "".join(single_han)}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
if args.runtime_table:
    # Only this offline command uses tokenizer packages. Runtime consumes the
    # immutable character string, not a tokenizer or a package dependency.
    lines = ["".join(single_han[index:index + 80]) for index in range(0, len(single_han), 80)]
    header = f"// Generated by scripts/t165-tokenizer-oracle.py, tokenizers 0.23.3.\n// Official DeepSeek V4.1 tokenizer, recipe revision {REVISION}.\n// Only U+4E00..U+9FA5 characters whose isolated encoding has one token.\n// Source: {SOURCE}\n// Classification data; no runtime tokenizer dependency.\n"
    license_text = args.tokenizer.with_name("LICENSE").read_text(encoding="utf-8")
    args.runtime_table.write_text(header + "/*\n" + license_text + "*/\nexport const singleTokenHanCharacters =\n" + " +\n".join("  " + json.dumps(line, ensure_ascii=False) for line in lines) + ";\n", encoding="utf-8")
print(json.dumps({"cases": [(case["name"], case.get("userTokens"), case["promptTokens"]) for case in cases], "sentinels": len(sentinels), "singleTokenHan": len(single_han)}, ensure_ascii=False))
